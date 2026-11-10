import {
  createLocalAudioTrack,
  Room,
  RoomEvent,
  Track,
  ParticipantKind,
  setLogLevel,
  LogLevel,
  type LocalAudioTrack,
  type Participant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from 'livekit-client'
import { VoiceError, type Connection } from './contract'

export type Hint =
  | 'initializing'
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'unavailable'
// MB-820: decorative voice expression; `warm`/`encourage` stay unpublished until a Care-owned safety source exists.
export type Expression = 'neutral' | 'comfort'
const EXPRESSION_ATTRIBUTE = 'mb.mam.expression'
export type MediaEvents = {
  hint: (hint: Hint, expression?: Expression) => void
  reconnecting: () => void
  reconnected: () => void
  disconnected: () => void
  audioBlocked: () => void
}
export interface Media {
  permission(): Promise<void>
  connect(connection: Connection, events: MediaEvents): Promise<void>
  mute(value: boolean): Promise<void>
  resume(connection: Connection): Promise<void>
  audio(): Promise<void>
  close(): void
}
export function admittedAgent(
  connection: Connection,
  roomName: string,
  participant: Pick<Participant, 'identity' | 'kind'>,
) {
  return (
    roomName === connection.roomName &&
    participant.identity === connection.agentIdentity &&
    participant.kind === ParticipantKind.AGENT
  )
}
export function freshHint(
  value: unknown,
  observedAt: number,
  now: number,
  connected: boolean,
): Hint {
  const hint = (
    ['initializing', 'idle', 'listening', 'thinking', 'speaking'] as const
  ).find((state) => state === value)
  return hint && connected && now >= observedAt && now - observedAt < 30_000
    ? hint
    : 'unavailable'
}
// Only `comfort`, only while the fresh state is `speaking`; everything else is neutral.
export function freshExpression(value: unknown, hint: Hint): Expression {
  return hint === 'speaking' && value === 'comfort' ? 'comfort' : 'neutral'
}

export class LiveKitVoiceMedia implements Media {
  private room: Room | undefined
  private microphone: LocalAudioTrack | undefined
  private binding: Connection | undefined
  private events: MediaEvents | undefined
  private muted = false
  private suspended = false
  private closed = false
  private hintTimer: ReturnType<typeof setTimeout> | undefined
  private stateAt: number | undefined
  // Expression attribute last seen from the admitted Agent, and the value live when the last speaking turn ended or was reset.
  private seenExpression: unknown
  private spentExpression: unknown
  private readonly outputs = new Map<RemoteTrack, HTMLMediaElement>()
  async permission() {
    setLogLevel(LogLevel.silent)
    const microphone = await createLocalAudioTrack({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    })
    if (this.closed) {
      microphone.stop()
      throw new VoiceError('CANCELLED')
    }
    this.microphone = microphone
  }
  async connect(connection: Connection, events: MediaEvents) {
    if (this.closed || !this.microphone) throw new VoiceError('CANCELLED')
    const room = new Room({ disconnectOnPageLeave: true })
    this.room = room
    this.binding = connection
    this.events = events
    const expire = () => {
      clearTimeout(this.hintTimer)
      this.stateAt = undefined
      this.spentExpression = this.seenExpression
    }
    // An expression-only change reuses the last state observation: it never renews freshness.
    const hint = (participant: Participant, stateChanged = true) => {
      if (!admittedAgent(connection, room.name, participant) || this.closed)
        return
      const written = participant.attributes[EXPRESSION_ATTRIBUTE]
      this.seenExpression = written
      if (this.suspended || (!stateChanged && this.stateAt === undefined)) {
        this.spentExpression = written
        return
      }
      const now = Date.now()
      if (stateChanged) {
        clearTimeout(this.hintTimer)
        this.stateAt = now
      }
      const state = freshHint(
        participant.attributes['lk.agent.state'],
        this.stateAt ?? now,
        now,
        room.state === 'connected',
      )
      if (state !== 'speaking') this.spentExpression = written
      // The Agent's clear is best effort: an unchanged value left by an earlier turn is stale, only a new write counts.
      events.hint(
        state,
        freshExpression(
          written === this.spentExpression ? undefined : written,
          state,
        ),
      )
      if (stateChanged)
        this.hintTimer = setTimeout(() => {
          this.stateAt = undefined
          this.spentExpression = this.seenExpression
          events.hint('unavailable', 'neutral')
        }, 30_000)
    }
    const attach = (track: RemoteTrack, participant: Participant) => {
      if (
        this.closed ||
        !admittedAgent(connection, room.name, participant) ||
        track.kind !== Track.Kind.Audio ||
        this.outputs.has(track)
      )
        return
      const element = track.attach()
      element.hidden = true
      document.body.append(element)
      this.outputs.set(track, element)
      if (!this.suspended)
        void element.play().catch(() => {
          if (!this.closed) events.audioBlocked()
        })
    }
    const subscribe = (
      publication: RemoteTrackPublication,
      participant: Participant,
    ) => {
      publication.setSubscribed(
        !this.closed &&
          admittedAgent(connection, room.name, participant) &&
          publication.kind === Track.Kind.Audio &&
          publication.source === Track.Source.Microphone,
      )
    }
    room.on(RoomEvent.TrackPublished, (publication, participant) =>
      subscribe(publication, participant),
    )
    room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) =>
      attach(track, participant),
    )
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      this.outputs.get(track)?.remove()
      track.detach()
      this.outputs.delete(track)
    })
    room.on(RoomEvent.ParticipantAttributesChanged, (changed, participant) => {
      if ('lk.agent.state' in changed) hint(participant)
      else if (EXPRESSION_ATTRIBUTE in changed) hint(participant, false)
    })
    room.on(RoomEvent.ParticipantConnected, (participant) => hint(participant))
    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      if (admittedAgent(connection, room.name, participant)) {
        expire()
        events.hint('unavailable', 'neutral')
      }
    })
    room.on(RoomEvent.Reconnecting, () => {
      this.suspended = true
      for (const element of this.outputs.values()) element.pause()
      expire()
      events.hint('unavailable', 'neutral')
      void this.microphone?.mute().catch(events.disconnected)
      events.reconnecting()
    })
    room.on(RoomEvent.Reconnected, () => {
      events.hint('unavailable', 'neutral')
      events.reconnected()
    })
    room.on(RoomEvent.Disconnected, () => {
      if (!this.closed) {
        this.close()
        events.disconnected()
      }
    })
    await room.connect(connection.serverUrl, connection.participantToken, {
      autoSubscribe: false,
    })
    if (this.closed || room.name !== connection.roomName) {
      this.close()
      throw new VoiceError('INVALID_RESPONSE')
    }
    await room.localParticipant.publishTrack(this.microphone, {
      source: Track.Source.Microphone,
    })
    if (this.closed) {
      this.close()
      throw new VoiceError('CANCELLED')
    }
    for (const participant of room.remoteParticipants.values()) {
      hint(participant)
      for (const publication of participant.trackPublications.values()) {
        subscribe(publication, participant)
        if (publication.track) attach(publication.track, participant)
      }
    }
  }
  async mute(value: boolean) {
    if (this.closed) return
    this.muted = value
    const microphone = this.microphone
    if (value || this.suspended) await microphone?.mute()
    else await microphone?.unmute()
    if (this.closed) microphone?.stop()
  }
  async resume(connection: Connection) {
    if (
      this.closed ||
      this.room?.name !== connection.roomName ||
      this.binding?.agentIdentity !== connection.agentIdentity
    ) {
      this.close()
      throw new VoiceError('INVALID_RESPONSE')
    }
    const microphone = this.microphone
    if (!this.muted) await microphone?.unmute()
    if (this.closed) {
      microphone?.stop()
      return
    }
    this.suspended = false
    await this.room?.startAudio()
  }
  async audio() {
    await this.room?.startAudio()
  }
  close() {
    this.closed = true
    clearTimeout(this.hintTimer)
    this.microphone?.stop()
    this.microphone = undefined
    for (const [track, element] of this.outputs) {
      track.detach()
      element.remove()
    }
    this.outputs.clear()
    this.room?.removeAllListeners()
    const events = this.events
    void this.room?.disconnect(true).catch(() => events?.disconnected())
    this.room = undefined
    this.binding = undefined
    this.events = undefined
  }
}
