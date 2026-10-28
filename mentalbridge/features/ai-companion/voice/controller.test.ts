import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  connection,
  eligibility,
  session,
  voiceKey,
} from '@/tests/fixtures/voice'
import { VoiceController } from './controller'
import { VoiceError } from './contract'
import type { Media, MediaEvents } from './media'

function fixture() {
  const bound = connection()
  const current = session({ hardStopAt: bound.hardStopAt })
  const api = {
    eligibility: vi.fn().mockResolvedValue(eligibility()),
    disclosure: vi.fn(),
    consent: vi.fn(),
    create: vi.fn().mockResolvedValue(current),
    connection: vi.fn().mockResolvedValue(bound),
    session: vi.fn().mockResolvedValue(current),
    end: vi
      .fn()
      .mockResolvedValue(
        session({ ...current, state: 'ENDED', terminalReason: 'USER_ENDED' }),
      ),
  }
  let events: MediaEvents | undefined
  const media: Media = {
    permission: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn().mockImplementation((_connection, next: MediaEvents) => {
      events = next
      return Promise.resolve()
    }),
    mute: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    audio: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
  }
  const controller = new VoiceController(api, () => media)
  return {
    controller,
    api,
    media,
    current,
    events: () => {
      if (!events) throw new Error('Media not connected')
      return events
    },
  }
}
const deferred = <T>() => {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}
afterEach(() => vi.useRealTimers())

describe('Voice call lifecycle', () => {
  it('does not request microphone or mutate quota for FREE/denied entitlement and requires explicit start', async () => {
    for (const denied of [
      eligibility('FREE'),
      eligibility('PLUS', {
        state: 'ENTITLEMENT_UNAVAILABLE',
        eligible: false,
        availableSessionSeconds: 0,
      }),
      eligibility('PLUS', {
        state: 'CONSENT_REQUIRED',
        eligible: false,
        availableSessionSeconds: 0,
      }),
    ]) {
      const f = fixture()
      f.api.eligibility.mockResolvedValue(denied)
      await f.controller.refresh()
      expect(f.media.permission).not.toHaveBeenCalled()
      await f.controller.start()
      expect(f.api.create).not.toHaveBeenCalled()
      expect(f.media.permission).not.toHaveBeenCalled()
      f.controller.dispose()
    }
  })
  it('leaves quota untouched on microphone denial and discards stale eligibility responses', async () => {
    const f = fixture()
    const older = deferred<ReturnType<typeof eligibility>>()
    f.api.eligibility
      .mockReturnValueOnce(older.promise)
      .mockResolvedValueOnce(eligibility('FREE'))
    const first = f.controller.refresh()
    await f.controller.refresh()
    older.resolve(eligibility('PREMIUM'))
    await first
    expect(f.controller.snapshot().eligibility?.packageCode).toBe('FREE')
    f.api.eligibility.mockResolvedValue(eligibility())
    vi.mocked(f.media.permission).mockRejectedValue(
      new DOMException('Synthetic denial', 'NotAllowedError'),
    )
    await f.controller.start()
    expect(f.controller.snapshot()).toMatchObject({
      phase: 'error',
      error: 'MIC_DENIED',
    })
    expect(f.api.create).not.toHaveBeenCalled()
    f.controller.dispose()
  })
  it('binds current session, keeps media hints separate from usage and closes on authoritative consent revocation', async () => {
    vi.useFakeTimers()
    const f = fixture()
    await f.controller.start()
    f.events().hint('thinking')
    expect(f.controller.snapshot()).toMatchObject({
      phase: 'connected',
      hint: 'thinking',
      session: { deliveredSession: false, chargedSeconds: 0 },
    })
    await f.controller.mute()
    expect(f.media.mute).toHaveBeenCalledWith(true)
    f.api.session.mockResolvedValue(
      session({
        ...f.current,
        state: 'ENDED',
        terminalReason: 'VOICE_CONSENT_REVOKED',
      }),
    )
    await vi.advanceTimersByTimeAsync(2000)
    expect(f.media.close).toHaveBeenCalled()
    expect(f.controller.snapshot()).toMatchObject({
      phase: 'ended',
      hint: 'unavailable',
      session: { terminalReason: 'VOICE_CONSENT_REVOKED' },
    })
    f.controller.dispose()
  })
  it('reauthorizes before resuming reconnect and terminates when that check fails', async () => {
    const f = fixture()
    await f.controller.start()
    f.events().reconnecting()
    expect(f.controller.snapshot().phase).toBe('reconnecting')
    f.api.connection.mockRejectedValueOnce(new VoiceError('CONSENT_REQUIRED'))
    f.events().reconnected()
    await flush()
    await flush()
    expect(f.media.resume).not.toHaveBeenCalled()
    expect(f.api.end).toHaveBeenCalled()
    expect(f.controller.snapshot().phase).toBe('ended')
    f.controller.dispose()
  })
  it('ends a late admitted session after unmount without ever opening media', async () => {
    const f = fixture()
    const admission = deferred<ReturnType<typeof session>>()
    f.api.create.mockReturnValueOnce(admission.promise)
    const start = f.controller.start()
    await flush()
    f.controller.dispose()
    admission.resolve(f.current)
    await start
    expect(f.media.close).toHaveBeenCalled()
    expect(f.api.end).toHaveBeenCalledWith(
      f.current.voiceSessionId,
      expect.any(String),
    )
    expect(f.media.connect).not.toHaveBeenCalled()
  })
  it.each(['OUTCOME_UNKNOWN', 'INVALID_RESPONSE'])(
    'reuses uncertain admission intent after %s without allocating a second call',
    async (code) => {
      const f = fixture()
      f.api.create.mockRejectedValueOnce(new VoiceError(code))
      await f.controller.start()
      expect(f.controller.snapshot().uncertain).toBe(true)
      await f.controller.start()
      expect(f.api.create.mock.calls[0]?.[0]).toBe(
        f.api.create.mock.calls[1]?.[0],
      )
      expect(f.api.eligibility).toHaveBeenCalledTimes(1)
      await f.controller.end()
      expect(f.controller.snapshot().phase).toBe('ended')
      f.controller.dispose()
    },
  )
  it('stops immediately on user end, with one command intent and best-effort unload cleanup', async () => {
    const f = fixture()
    await f.controller.start()
    f.api.end.mockRejectedValueOnce(new VoiceError('OUTCOME_UNKNOWN'))
    await f.controller.end()
    expect(f.media.close).toHaveBeenCalled()
    expect(f.controller.snapshot().phase).toBe('ending')
    const key = f.api.end.mock.calls[0]?.[1]
    await f.controller.end()
    expect(f.api.end.mock.calls[1]?.[1]).toBe(key)
    expect(f.controller.snapshot().phase).toBe('ended')
    f.controller.dispose()
    expect(f.api.end).toHaveBeenCalledTimes(2)
  })
  it('refuses stale connection bindings and does not publish audio for a different session', async () => {
    const f = fixture()
    f.api.connection.mockResolvedValue({
      ...connection(),
      voiceSessionId: voiceKey,
    })
    await f.controller.start()
    expect(f.media.connect).not.toHaveBeenCalled()
    expect(f.api.end).toHaveBeenCalled()
    f.controller.dispose()
  })
})
