import { act, render, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getAchievements } from '@/features/achievements/api/browser-achievements'
import { MamDockSlot } from './MamDockSlot'
import * as celebrations from './mam-celebrations'
import { useMamCelebrations } from './use-mam-celebrations'

const client = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/api/browser-client', () => ({ browserApiClient: client }))

// The reader has its own tests; here the host is fed by hand.
vi.mock('./use-mam-award-reads', () => ({ useMamAwardReads: vi.fn() }))

vi.mock('./mam-celebrations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./mam-celebrations')>()
  return {
    ...actual,
    reserveMamNext: vi.fn(actual.reserveMamNext),
    returnMamAppearance: vi.fn(actual.returnMamAppearance),
  }
})

const { observeMamAwardRead, reserveMamNext, returnMamAppearance } =
  vi.mocked(celebrations)
const realReserve = reserveMamNext.getMockImplementation()!

const MIN = 60_000
const NOW = new Date(2026, 9, 27, 10, 0, 0).getTime()
const JOURNAL = 'achievements:JOURNAL'

const award = (id: string, at: number) => ({
  key: `achievement:${id}:${new Date(at).toISOString()}`,
  kind: 'achievement' as const,
  at,
  title: `Thành tựu ${id}`,
})
const read = (awards: ReturnType<typeof award>[]) => ({
  scope: JOURNAL,
  available: true,
  visible: true,
  readAt: Date.now(),
  awards,
})

const flush = () => act(() => vi.advanceTimersByTimeAsync(0))
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

function renderHost(accountId: string, pathname = '/dashboard') {
  return renderHook(
    (props: { accountId: string; pathname: string }) =>
      useMamCelebrations({ ...props, allowed: true, blocked: false }),
    { initialProps: { accountId, pathname } },
  )
}

/** A baselined account with one new achievement queued, ready 10 s later. */
async function queueOne(accountId = 'u1', id = 'a') {
  await observeMamAwardRead(accountId, read([]))
  await observeMamAwardRead(accountId, read([award(id, Date.now() - MIN)]))
}

describe('useMamCelebrations', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    window.localStorage.clear()
    window.sessionStorage.clear()
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: (_name: string, callback: () => unknown) =>
          Promise.resolve().then(callback),
      },
    })
    reserveMamNext.mockReset()
    reserveMamNext.mockImplementation(realReserve)
    returnMamAppearance.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('plays once the coalescing window closes, from the host alone', async () => {
    await queueOne()
    const { result } = renderHost('u1')
    await advance(9_000)
    expect(result.current.oneShot).toBeNull()
    await advance(1_500)
    expect(result.current.oneShot?.kind).toBe('celebrate_hero')
  })

  it('returns a reservation that completes after unmount, never adopting it', async () => {
    await queueOne()
    vi.setSystemTime(NOW + 10_000)
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => (release = resolve))
    reserveMamNext.mockImplementationOnce(async (id) => {
      await gate
      return realReserve(id)
    })
    const { result, unmount } = renderHost('u1')
    await flush()
    unmount()
    release()
    await flush()
    expect(result.current.oneShot).toBeNull()
    expect(returnMamAppearance).toHaveBeenCalledTimes(1)
    expect(returnMamAppearance.mock.calls[0][0]).toBe('u1')
    // The slot and the entry are back: the same award can still be reserved.
    expect((await realReserve('u1'))?.reservation).not.toBeNull()
  })

  it('returns a stale reservation to the account it was made for after an account change', async () => {
    await queueOne('u1')
    vi.setSystemTime(NOW + 10_000)
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => (release = resolve))
    reserveMamNext.mockImplementationOnce(async (id) => {
      await gate
      return realReserve(id)
    })
    const { result, rerender } = renderHost('u1')
    await flush()
    rerender({ accountId: 'u2', pathname: '/dashboard' })
    release()
    await flush()
    expect(result.current.oneShot).toBeNull()
    expect(returnMamAppearance.mock.calls.map((call) => call[0])).toEqual([
      'u1',
    ])
  })

  it('wakes at the budget deadline without another read (minute 29 to 31)', async () => {
    await queueOne('u1', 'a')
    vi.setSystemTime(NOW + 10_000)
    expect((await realReserve('u1'))?.reservation).not.toBeNull()
    // A second award is read at minute 29, while the budget is closed.
    vi.setSystemTime(NOW + 29 * MIN)
    await observeMamAwardRead(
      'u1',
      read([award('a', NOW - MIN), award('b', NOW + 29 * MIN - MIN)]),
    )
    const { result } = renderHost('u1')
    await advance(60_000)
    expect(result.current.oneShot).toBeNull()
    // Minute 30 and 10 s: the budget is open, the read is 70 s old.
    await advance(11_000)
    expect(result.current.oneShot?.kind).toBe('celebrate_soft')
    expect(reserveMamNext.mock.calls.length).toBeLessThanOrEqual(3)
  })

  it('asks again when the route changes between eligible routes', async () => {
    reserveMamNext.mockResolvedValue({ reservation: null, retryAt: null })
    const { rerender } = renderHost('u1', '/resources')
    await flush()
    expect(reserveMamNext).toHaveBeenCalledTimes(1)
    rerender({ accountId: 'u1', pathname: '/achievements' })
    await flush()
    expect(reserveMamNext).toHaveBeenCalledTimes(2)
  })

  describe('a page read that resolves after the host changed account', () => {
    const response = (title: string) => ({
      data: {
        visibilityState: 'VISIBLE',
        sources: [{ domain: 'JOURNAL', availability: 'AVAILABLE' }],
        items: [
          {
            definitionId: 'journal.a',
            domain: 'JOURNAL',
            status: 'EARNED',
            unlockedAt: new Date(NOW - MIN).toISOString(),
            title,
          },
        ],
      },
      headers: { etag: '"1"' },
    })
    const record = (accountId: string) =>
      window.localStorage.getItem(`mentalbridge_mam_celebrations:${accountId}`)
    const seen: unknown[] = []
    const listen = (event: Event) => seen.push((event as CustomEvent).detail)
    beforeEach(() => {
      seen.length = 0
      client.get.mockReset()
      window.addEventListener(celebrations.MAM_AWARD_READ_EVENT, listen)
    })
    afterEach(() =>
      window.removeEventListener(celebrations.MAM_AWARD_READ_EVENT, listen),
    )

    it.each(['switches to B', 'unmounts and B mounts'])(
      'never reaches account B when A %s',
      async (how) => {
        let resolve!: (value: unknown) => void
        client.get.mockReturnValue(new Promise((done) => (resolve = done)))
        const a = renderHost('uA')
        await observeMamAwardRead('uA', read([]))
        const pending = getAchievements('Asia/Ho_Chi_Minh')
        let b = a
        if (how === 'switches to B')
          a.rerender({ accountId: 'uB', pathname: '/dashboard' })
        else {
          a.unmount()
          b = renderHost('uB')
        }
        await flush()
        await observeMamAwardRead('uB', read([]))
        const before = record('uB')
        const recordA = record('uA')

        resolve(response('Tiêu đề riêng của A'))
        await pending
        await flush()
        expect(seen).toEqual([])
        expect(record('uB')).toBe(before)
        expect(record('uA')).toBe(recordA)
        expect(record('uB')).not.toContain('Tiêu đề riêng của A')
        b.unmount()
      },
    )

    it('still publishes a read that starts and resolves in one session', async () => {
      client.get.mockResolvedValue(response('Của A'))
      renderHost('uA')
      await observeMamAwardRead('uA', read([]))
      await getAchievements('Asia/Ho_Chi_Minh')
      await flush()
      expect(seen).toHaveLength(1)
      expect(record('uA')).toContain('Của A')
    })
  })
  // MB-781: the host loads lazily, after the page may already have read. Reads
  // are kept for the signed-in account (the USER layout slot) until it listens.
  describe('reads before the lazy host listens', () => {
    const record = (accountId: string) =>
      window.localStorage.getItem(`mentalbridge_mam_celebrations:${accountId}`)
    const slot = (accountId: string) =>
      render(<MamDockSlot accountId={accountId} />)
    // Reads still kept for an account, read without leaving the module listening.
    const leftover = (accountId: string) => {
      const reads = celebrations.takeUnheardMamAwardReads(accountId)
      celebrations.stopHearingMamAwardReads()
      return reads
    }

    it('hears a read that landed before the host mounted, once', async () => {
      const a = slot('u1')
      celebrations.dispatchMamAwardRead(read([award('early', NOW - MIN)]))
      const first = renderHost('u1')
      await flush()
      expect(record('u1')).toContain('achievement:early:')
      first.unmount()

      renderHost('u1').unmount()
      await flush()
      expect(leftover('u1')).toEqual([])
      a.unmount()
    })

    it('keeps the first baseline apart from an award earned while loading', async () => {
      const a = slot('u1')
      celebrations.dispatchMamAwardRead(read([]))
      celebrations.dispatchMamAwardRead(read([award('new', NOW - MIN)]))
      const host = renderHost('u1')
      await flush()
      // As with the eager host: the first read is only the baseline, the award
      // earned after it plays once its coalescing window has passed.
      await advance(11_000)
      expect(host.result.current.oneShot).not.toBeNull()
      host.unmount()
      a.unmount()
    })

    it('applies live reads after buffered reads while the owner lock is busy', async () => {
      const pendingLocks: (() => void)[] = []
      Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: {
          request: (_name: string, callback: () => unknown) =>
            new Promise((resolve) => {
              pendingLocks.push(() => resolve(callback()))
            }),
        },
      })
      const a = slot('u1')
      celebrations.dispatchMamAwardRead(read([]))
      celebrations.dispatchMamAwardRead(read([award('new', NOW - MIN)]))
      const host = renderHook(() =>
        useMamCelebrations({
          accountId: 'u1',
          pathname: '/dashboard',
          allowed: false,
          blocked: false,
        }),
      )
      await flush()
      expect(pendingLocks).toHaveLength(1)

      // The latest owner read no longer lists the award. It must reconcile
      // after both old buffered reads, even while their lock is held elsewhere.
      celebrations.dispatchMamAwardRead(read([]))
      for (let index = 0; index < 3; index += 1) {
        expect(pendingLocks.length).toBeGreaterThan(0)
        await act(async () => pendingLocks.shift()!())
        await flush()
      }
      const saved = JSON.parse(record('u1')!)
      expect(saved.queue).toEqual([])
      expect(saved.lastReads[JOURNAL].eligible).toEqual([])
      host.unmount()
      a.unmount()
    })

    it('never hands a read to another account, buffered or still in flight', async () => {
      const a = slot('uA')
      celebrations.dispatchMamAwardRead(read([award('private-A', NOW - MIN)]))
      let resolve!: (value: unknown) => void
      client.get.mockReturnValue(new Promise((done) => (resolve = done)))
      const pending = getAchievements('Asia/Ho_Chi_Minh')
      a.unmount()

      // B signs in in the same tab before any host loaded.
      const b = slot('uB')
      resolve({
        data: {
          visibilityState: 'VISIBLE',
          preferenceVersion: '0',
          policyVersion: 'achievement-rules-v1',
          calculatedAt: new Date(NOW).toISOString(),
          sources: [{ domain: 'JOURNAL', availability: 'AVAILABLE' }],
          items: [
            {
              definitionId: 'private-in-flight-A',
              domain: 'JOURNAL',
              status: 'EARNED',
              unlockedAt: new Date(NOW - MIN).toISOString(),
              title: 'Private in-flight A',
            },
          ],
        },
        headers: { etag: '"1"' },
      })
      await pending
      const host = renderHost('uB')
      await flush()
      expect(record('uB') ?? '').not.toContain('private-A')
      expect(record('uB') ?? '').not.toContain('private-in-flight-A')
      expect(leftover('uB')).toEqual([])
      host.unmount()
      b.unmount()
    })

    it('does not hand a read the host already heard to the next host', async () => {
      const a = slot('u1')
      const first = renderHost('u1')
      await flush()
      celebrations.dispatchMamAwardRead(read([award('heard', NOW - MIN)]))
      await flush()
      expect(record('u1')).toContain('achievement:heard:')
      first.unmount()

      const next = renderHost('u1')
      await flush()
      expect(leftover('u1')).toEqual([])
      next.unmount()
      a.unmount()
    })
  })
})
