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
export type MediaEvents = {
  hint: (hint: Hint) => void
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

export class LiveKitVoiceMedia implements Media {
  private room: Room | undefined
  private microphone: LocalAudioTrack | undefined
  private binding: Connection | undefined
  private muted = false
  private suspended = false
  private closed = false
  private hintTimer: ReturnType<typeof setTimeout> | undefined
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
    const hint = (participant: Participant) => {
      if (
        !admittedAgent(connection, room.name, participant) ||
        this.closed ||
        this.suspended
      )
        return
      clearTimeout(this.hintTimer)
      const observedAt = Date.now()
      events.hint(
        freshHint(
          participant.attributes['lk.agent.state'],
          observedAt,
          observedAt,
          room.state === 'connected',
        ),
      )
      this.hintTimer = setTimeout(() => events.hint('unavailable'), 30_000)
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
    })
    room.on(RoomEvent.ParticipantConnected, (participant) => hint(participant))
    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      if (admittedAgent(connection, room.name, participant)) {
        clearTimeout(this.hintTimer)
        events.hint('unavailable')
      }
    })
    room.on(RoomEvent.Reconnecting, () => {
      this.suspended = true
      for (const element of this.outputs.values()) element.pause()
      clearTimeout(this.hintTimer)
      events.hint('unavailable')
      void this.microphone?.mute().catch(events.disconnected)
      events.reconnecting()
    })
    room.on(RoomEvent.Reconnected, () => {
      events.hint('unavailable')
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
    void this.room?.disconnect(true)
    this.room = undefined
    this.binding = undefined
  }
}
