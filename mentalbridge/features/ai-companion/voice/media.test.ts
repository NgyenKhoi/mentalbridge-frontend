import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { connection, voiceKey } from '@/tests/fixtures/voice'
import type { MediaEvents } from './media'

const sdk = vi.hoisted(() => ({ permission: vi.fn(), room: vi.fn() }))
vi.mock('livekit-client', async (original) => ({
  ...(await original<typeof import('livekit-client')>()),
  createLocalAudioTrack: sdk.permission,
  Room: class {
    constructor() {
      return sdk.room()
    }
  },
}))
import { ParticipantKind, RoomEvent } from 'livekit-client'
import { admittedAgent, freshHint, LiveKitVoiceMedia } from './media'

class FakeRoom extends EventEmitter {
  name = connection().roomName
  state = 'connected'
  remoteParticipants = new Map()
  localParticipant = { publishTrack: vi.fn().mockResolvedValue(undefined) }
  connect = vi.fn().mockResolvedValue(undefined)
  disconnect = vi.fn().mockResolvedValue(undefined)
  startAudio = vi.fn().mockResolvedValue(undefined)
}
const events = (): MediaEvents => ({
  hint: vi.fn(),
  reconnecting: vi.fn(),
  reconnected: vi.fn(),
  disconnected: vi.fn(),
  audioBlocked: vi.fn(),
})
afterEach(() => vi.useRealTimers())
describe('audio-only LiveKit media', () => {
  it('filters exact Agent/room/attempt and bounds stale or unknown hints', () => {
    const c = connection()
    const p = { identity: c.agentIdentity, kind: ParticipantKind.AGENT }
    expect(admittedAgent(c, c.roomName, p)).toBe(true)
    for (const bad of [
      { ...p, identity: `va-${c.voiceSessionId}` },
      { ...p, identity: `vu-${voiceKey}` },
      { ...p, kind: ParticipantKind.STANDARD },
    ])
      expect(admittedAgent(c, c.roomName, bad)).toBe(false)
    expect(admittedAgent(c, 'consultation-other', p)).toBe(false)
    expect(freshHint('thinking', 1, 30_000, true)).toBe('thinking')
    expect(freshHint('thinking', 1, 30_001, true)).toBe('unavailable')
    expect(freshHint('thinking', 1, 2, false)).toBe('unavailable')
    expect(freshHint('private-transcript', 1, 2, true)).toBe('unavailable')
  })
  it('does not request a microphone until permission(), expires hints and tears down tracks/listeners', async () => {
    vi.useFakeTimers()
    const room = new FakeRoom()
    sdk.room.mockReturnValue(room)
    const microphone = {
      stop: vi.fn(),
      mute: vi.fn().mockResolvedValue(undefined),
      unmute: vi.fn().mockResolvedValue(undefined),
    }
    sdk.permission.mockReset().mockResolvedValue(microphone)
    const media = new LiveKitVoiceMedia()
    const e = events()
    expect(sdk.permission).not.toHaveBeenCalled()
    await media.permission()
    const c = connection()
    await media.connect(c, e)
    expect(room.connect).toHaveBeenCalledWith(c.serverUrl, c.participantToken, {
      autoSubscribe: false,
    })
    const agent = {
      identity: c.agentIdentity,
      kind: ParticipantKind.AGENT,
      attributes: { 'lk.agent.state': 'thinking' },
    }
    room.emit(
      RoomEvent.ParticipantAttributesChanged,
      { 'lk.agent.state': 'thinking' },
      agent,
    )
    expect(e.hint).toHaveBeenLastCalledWith('thinking')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(e.hint).toHaveBeenLastCalledWith('unavailable')
    room.emit(RoomEvent.Reconnecting)
    expect(microphone.mute).toHaveBeenCalled()
    room.emit(RoomEvent.Reconnected)
    expect(e.reconnected).toHaveBeenCalled()
    expect(microphone.unmute).not.toHaveBeenCalled()
    await media.resume(c)
    expect(microphone.unmute).toHaveBeenCalled()
    media.close()
    expect(microphone.stop).toHaveBeenCalled()
    expect(room.eventNames()).toEqual([])
    expect(room.disconnect).toHaveBeenCalledWith(true)
  })
  it('never subscribes to another participant, video, screen share or content data', async () => {
    const room = new FakeRoom()
    sdk.room.mockReturnValue(room)
    sdk.permission.mockResolvedValue({ stop: vi.fn() })
    const media = new LiveKitVoiceMedia()
    await media.permission()
    const c = connection()
    await media.connect(c, events())
    const agent = { identity: c.agentIdentity, kind: ParticipantKind.AGENT }
    for (const [participant, kind, source, allowed] of [
      [agent, 'audio', 'microphone', true],
      [{ ...agent, identity: 'va-other' }, 'audio', 'microphone', false],
      [agent, 'video', 'camera', false],
      [agent, 'audio', 'screen_share_audio', false],
    ] as const) {
      const publication = { kind, source, setSubscribed: vi.fn() }
      room.emit(RoomEvent.TrackPublished, publication, participant)
      expect(publication.setSubscribed).toHaveBeenCalledWith(allowed)
    }
    media.close()
  })
})
