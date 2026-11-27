import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mockServer } from '@/tests/mocks/server'
import { resetCompanionStateForTests } from './companion-state'
import { dispatchMamGuide, resetGuideSyncForTests } from './mam-guide'
import { useMamGuide } from './use-mam-guide'

const ACCOUNT = 'acc-1'
const seed = (pending: unknown) =>
  window.localStorage.setItem(
    `mb:mam-guide:v1:${ACCOUNT}`,
    JSON.stringify({
      version: 1,
      startedAt: '2026-11-26T08:00:00.000Z',
      done: {},
      declined: {},
      pending,
      unwindKind: null,
      plan: null,
      graduatedAt: null,
    }),
  )

describe('useMamGuide', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('plays a stored pending sequence once Mầm is free, and holds it while she is not', () => {
    seed({ after: 'result', next: 'journal' })
    const { result, rerender } = renderHook(
      ({ allowed }) => useMamGuide(ACCOUNT, allowed),
      { initialProps: { allowed: false } },
    )
    act(() => vi.advanceTimersByTime(10))
    expect(result.current.bubble).toBeNull()
    rerender({ allowed: true })
    expect(result.current.bubble).toMatchObject({
      kind: 'story',
      text: expect.stringContaining('Mầm đọc kết quả của bạn rồi nè.'),
      motion: { loop: 'curious', shot: 'nod' },
    })
    expect(result.current.progress).toEqual({ at: 0, total: 4 })
    expect(result.current.motion).toEqual({ loop: 'curious', shot: 'nod' })
    act(() => result.current.next())
    expect(result.current.bubble?.kind).toBe('story')
    expect(result.current.key).toBe('result:1')
  })

  it('resumes at the stored bubble after a reload', () => {
    seed({ after: 'result', next: 'journal' })
    const first = renderHook(() => useMamGuide(ACCOUNT, true))
    act(() => vi.advanceTimersByTime(10))
    act(() => first.result.current.next())
    first.unmount()
    const second = renderHook(() => useMamGuide(ACCOUNT, true))
    act(() => vi.advanceTimersByTime(10))
    expect(second.result.current.step).toBe(1)
  })

  it('a decline closes the sequence and is offered again next session', () => {
    seed({ after: 'result', next: 'journal' })
    const { result } = renderHook(() => useMamGuide(ACCOUNT, true))
    act(() => vi.advanceTimersByTime(10))
    act(() => result.current.close())
    expect(result.current.bubble).toBeNull()
  })

  it('ignores guide events when no layout slot is mounted and no account is given', () => {
    dispatchMamGuide({ type: 'journal-created' })
    expect(window.localStorage.length).toBe(0)
  })
})

describe('useMamGuide with the server copy', () => {
  const guide = (patch: Record<string, unknown>) => ({
    version: 1,
    startedAt: '2026-11-26T08:00:00.000Z',
    done: {},
    declined: {},
    pending: null,
    unwindKind: null,
    plan: null,
    graduatedAt: null,
    ...patch,
  })
  const server = (raw: string | null) => ({
    focus: null,
    chapters: [],
    commitments: [],
    ui: { guide: raw, seen: [] },
    revision: 1,
  })
  const localKey = (account: string) => `mb:mam-guide:v1:${account}`
  const local = (account: string) =>
    JSON.parse(window.localStorage.getItem(localKey(account))!)

  beforeEach(() => {
    resetCompanionStateForTests()
    resetGuideSyncForTests()
  })
  afterEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('lets the server guide win on load and refreshes the local cache', async () => {
    const account = 'acc-server-wins'
    window.localStorage.setItem(
      localKey(account),
      JSON.stringify(guide({ done: { journal: '2026-11-26T08:30:00.000Z' } })),
    )
    const remote = guide({
      done: { journal: '2026-11-26T09:00:00.000Z' },
      pending: { after: 'result', next: 'journal' },
    })
    mockServer.use(
      http.get('/api/companion-state', () =>
        HttpResponse.json(server(JSON.stringify(remote))),
      ),
    )

    const { result } = renderHook(() => useMamGuide(account, true))

    await waitFor(() => expect(result.current.status).toBe('pending'))
    expect(result.current.bubble).toMatchObject({ kind: 'story' })
    expect(local(account)).toEqual(remote)
  })

  it('keeps a local guide that is further along and moves it up (a lost PATCH must not undo progress)', async () => {
    const account = 'acc-local-ahead'
    const mine = guide({
      done: { journal: '2026-11-26T09:00:00.000Z' },
      pending: { after: 'journal', next: 'chat' },
    })
    window.localStorage.setItem(localKey(account), JSON.stringify(mine))
    const older = guide({ done: {} })
    const bodies: unknown[] = []
    mockServer.use(
      http.get('/api/companion-state', () =>
        HttpResponse.json(server(JSON.stringify(older))),
      ),
      http.patch('/api/companion-state', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json(server(null))
      }),
    )

    renderHook(() => useMamGuide(account, true))

    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(JSON.parse((bodies[0] as { guide: string }).guide)).toEqual(mine)
    expect(local(account)).toEqual(mine)
  })

  it('ignores a server guide of another version and keeps the local one', async () => {
    const account = 'acc-bad-version'
    const mine = guide({ pending: { after: 'result', next: 'journal' } })
    window.localStorage.setItem(localKey(account), JSON.stringify(mine))
    mockServer.use(
      http.get('/api/companion-state', () =>
        HttpResponse.json(server(JSON.stringify({ ...mine, version: 2 }))),
      ),
    )

    const { result } = renderHook(() => useMamGuide(account, true))

    await waitFor(() => expect(result.current.status).toBe('pending'))
    expect(local(account)).toEqual(mine)
  })

  it('moves the local guide up once when the server has none', async () => {
    const account = 'acc-migrate'
    const mine = guide({ pending: { after: 'result', next: 'journal' } })
    window.localStorage.setItem(localKey(account), JSON.stringify(mine))
    const bodies: unknown[] = []
    mockServer.use(
      http.patch('/api/companion-state', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json(server(null))
      }),
    )

    renderHook(() => useMamGuide(account, true))

    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(JSON.parse((bodies[0] as { guide: string }).guide)).toEqual(mine)
  })

  it('writes an answer to the server after the debounce, and keeps it locally when that fails', async () => {
    const account = 'acc-write'
    window.localStorage.setItem(
      localKey(account),
      JSON.stringify(guide({ pending: { after: 'result', next: 'journal' } })),
    )
    const bodies: { guide?: string }[] = []
    mockServer.use(
      http.patch('/api/companion-state', async ({ request }) => {
        const body = (await request.json()) as { guide?: string }
        // The migration copy still has the sequence pending; only the answer matters here.
        if (body.guide && !JSON.parse(body.guide).pending) bodies.push(body)
        return HttpResponse.error()
      }),
    )
    const { result } = renderHook(() => useMamGuide(account, true))
    await waitFor(() => expect(result.current.status).toBe('pending'))
    const answeredAt = Date.now()

    act(() => result.current.close())

    expect(bodies).toHaveLength(0)
    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(Date.now() - answeredAt).toBeGreaterThanOrEqual(350)
    expect(JSON.parse(bodies[0]!.guide!).declined.journal).toBeDefined()
    expect(local(account).declined.journal).toBeDefined()
  })

  it('without a layout slot, a result event reads the server first and leaves a finished guide alone', async () => {
    const account = 'acc-no-slot'
    const finished = guide({ graduatedAt: '2026-11-26T09:00:00.000Z' })
    mockServer.use(
      http.get('/api/companion-state', () =>
        HttpResponse.json(server(JSON.stringify(finished))),
      ),
    )

    dispatchMamGuide({ type: 'result', tier: 'SELF_GUIDED_SUPPORT' }, account)

    await waitFor(() =>
      expect(local(account).graduatedAt).toBe(finished.graduatedAt),
    )
    expect(local(account).pending).toBeNull()
  })
})
