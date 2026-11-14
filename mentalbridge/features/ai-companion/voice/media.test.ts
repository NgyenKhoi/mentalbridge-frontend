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
import {
  admittedAgent,
  freshExpression,
  freshHint,
  LiveKitVoiceMedia,
} from './media'

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
  it('accepts only comfort while speaking; warm, encourage, empty and unknown are neutral', () => {
    expect(freshExpression('comfort', 'speaking')).toBe('comfort')
    for (const value of [
      'neutral',
      'warm',
      'encourage',
      'COMFORT',
      '',
      null,
      1,
    ])
      expect(freshExpression(value, 'speaking')).toBe('neutral')
    for (const hint of [
      'thinking',
      'listening',
      'idle',
      'unavailable',
    ] as const)
      expect(freshExpression('comfort', hint)).toBe('neutral')
  })
  it('MB-820 reads the expression only from the admitted Agent and resets without a clear write', async () => {
    vi.useFakeTimers()
    const room = new FakeRoom()
    sdk.room.mockReturnValue(room)
    sdk.permission.mockReset().mockResolvedValue({
      stop: vi.fn(),
      mute: vi.fn().mockResolvedValue(undefined),
      unmute: vi.fn().mockResolvedValue(undefined),
    })
    const media = new LiveKitVoiceMedia()
    const e = events()
    await media.permission()
    const c = connection()
    await media.connect(c, e)
    const attributes: Record<string, string> = {}
    const agent = {
      identity: c.agentIdentity,
      kind: ParticipantKind.AGENT,
      attributes,
    }
    const change = (patch: Record<string, string>, who = agent) => {
      Object.assign(who.attributes, patch)
      room.emit(RoomEvent.ParticipantAttributesChanged, patch, who)
    }
    // Same snapshot carries state and expression.
    change({ 'lk.agent.state': 'speaking', 'mb.mam.expression': 'comfort' })
    expect(e.hint).toHaveBeenLastCalledWith('speaking', 'comfort')
    // Leaving speaking drops comfort even if the Agent never cleared the attribute.
    change({ 'lk.agent.state': 'thinking' })
    expect(e.hint).toHaveBeenLastCalledWith('thinking', 'neutral')
    // An unchanged value the Agent never cleared is stale: the next turn reads neutral.
    change({ 'mb.mam.expression': 'comfort' })
    expect(e.hint).toHaveBeenLastCalledWith('thinking', 'neutral')
    change({ 'lk.agent.state': 'speaking' })
    expect(e.hint).toHaveBeenLastCalledWith('speaking', 'neutral')
    // After a clear, a new write counts again; expression-only changes inside speaking too.
    change({ 'lk.agent.state': 'listening', 'mb.mam.expression': '' })
    change({ 'lk.agent.state': 'speaking', 'mb.mam.expression': 'comfort' })
    expect(e.hint).toHaveBeenLastCalledWith('speaking', 'comfort')
    change({ 'mb.mam.expression': 'warm' })
    expect(e.hint).toHaveBeenLastCalledWith('speaking', 'neutral')
    change({ 'mb.mam.expression': 'comfort' })
    expect(e.hint).toHaveBeenLastCalledWith('speaking', 'comfort')
    change({ 'mb.mam.expression': '' })
    expect(e.hint).toHaveBeenLastCalledWith('speaking', 'neutral')
    // Another participant never sets it.
    const calls = vi.mocked(e.hint).mock.calls.length
    change(
      { 'lk.agent.state': 'speaking', 'mb.mam.expression': 'comfort' },
      { ...agent, identity: 'va-other', attributes: {} },
    )
    expect(e.hint).toHaveBeenCalledTimes(calls)
    // An expression-only change never renews freshness: timeout resets it.
    change({ 'lk.agent.state': 'speaking', 'mb.mam.expression': 'comfort' })
    await vi.advanceTimersByTimeAsync(20_000)
    change({ 'mb.mam.expression': 'comfort' })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(e.hint).toHaveBeenLastCalledWith('unavailable', 'neutral')
    const afterTimeout = vi.mocked(e.hint).mock.calls.length
    change({ 'mb.mam.expression': 'comfort' })
    expect(e.hint).toHaveBeenCalledTimes(afterTimeout)
    // Agent disconnect and room reconnect reset it; a stale snapshot cannot revive it.
    change({ 'lk.agent.state': 'speaking', 'mb.mam.expression': 'comfort' })
    room.emit(RoomEvent.ParticipantDisconnected, agent)
    expect(e.hint).toHaveBeenLastCalledWith('unavailable', 'neutral')
    change({ 'lk.agent.state': 'speaking', 'mb.mam.expression': 'comfort' })
    room.emit(RoomEvent.Reconnecting)
    expect(e.hint).toHaveBeenLastCalledWith('unavailable', 'neutral')
    room.emit(RoomEvent.Reconnected)
    expect(e.hint).toHaveBeenLastCalledWith('unavailable', 'neutral')
    await media.resume(c)
    const revived = vi.mocked(e.hint).mock.calls.length
    change({ 'mb.mam.expression': 'comfort' })
    expect(e.hint).toHaveBeenCalledTimes(revived)
    media.close()
  })
  it('MB-820 a comfort value the Agent failed to clear never leaks into the next turn', async () => {
    vi.useFakeTimers()
    const room = new FakeRoom()
    sdk.room.mockReturnValue(room)
    sdk.permission.mockReset().mockResolvedValue({
      stop: vi.fn(),
      mute: vi.fn().mockResolvedValue(undefined),
      unmute: vi.fn().mockResolvedValue(undefined),
    })
    const media = new LiveKitVoiceMedia()
    const e = events()
    await media.permission()
    const c = connection()
    await media.connect(c, e)
    const agent = {
      identity: c.agentIdentity,
      kind: ParticipantKind.AGENT,
      attributes: {} as Record<string, string>,
    }
    const change = (patch: Record<string, string>) => {
      Object.assign(agent.attributes, patch)
      room.emit(RoomEvent.ParticipantAttributesChanged, patch, agent)
    }
    const last = () => vi.mocked(e.hint).mock.lastCall
    // comfort, listening, speaking again with no attribute change: neutral.
    change({ 'lk.agent.state': 'speaking', 'mb.mam.expression': 'comfort' })
    expect(last()).toEqual(['speaking', 'comfort'])
    change({ 'lk.agent.state': 'listening' })
    change({ 'lk.agent.state': 'speaking' })
    expect(last()).toEqual(['speaking', 'neutral'])
    // comfort, clear, comfort on the next turn: gentle.
    change({ 'lk.agent.state': 'listening', 'mb.mam.expression': '' })
    change({ 'lk.agent.state': 'speaking', 'mb.mam.expression': 'comfort' })
    expect(last()).toEqual(['speaking', 'comfort'])
    // Reconnect without a clear write, next turn unchanged: neutral.
    room.emit(RoomEvent.Reconnecting)
    room.emit(RoomEvent.Reconnected)
    await media.resume(c)
    change({ 'lk.agent.state': 'speaking' })
    expect(last()).toEqual(['speaking', 'neutral'])
    // Same after the 30 s freshness timeout.
    change({ 'lk.agent.state': 'listening', 'mb.mam.expression': '' })
    change({ 'lk.agent.state': 'speaking', 'mb.mam.expression': 'comfort' })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(last()).toEqual(['unavailable', 'neutral'])
    change({ 'lk.agent.state': 'speaking' })
    expect(last()).toEqual(['speaking', 'neutral'])
    // An expression-only change just before the limit does not extend the timer.
    await vi.advanceTimersByTimeAsync(29_999)
    change({ 'mb.mam.expression': 'warm' })
    expect(last()).toEqual(['speaking', 'neutral'])
    await vi.advanceTimersByTimeAsync(1)
    expect(last()).toEqual(['unavailable', 'neutral'])
    media.close()
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
    expect(e.hint).toHaveBeenLastCalledWith('thinking', 'neutral')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(e.hint).toHaveBeenLastCalledWith('unavailable', 'neutral')
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
