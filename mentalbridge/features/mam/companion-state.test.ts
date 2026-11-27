import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CompanionState } from '@/lib/companion-state/contract'
import { mockServer } from '@/tests/mocks/server'
import {
  COMPANION_WRITE_DEBOUNCE_MS,
  MAM_COMPANION_STATE_EVENT,
  createCompanionCommitment,
  loadCompanionState,
  patchCompanionState,
  peekCompanionState,
  queueCompanionWrite,
  refreshCompanionState,
  resetCompanionStateForTests,
  resolveCompanionCommitment,
  subscribeCompanionState,
} from './companion-state'

const ACCOUNT = 'acc-1'
const id = '30000000-0000-4000-8000-000000000001'
const stamp = '2026-11-27T02:00:00.000Z'
const commitment = {
  id,
  kind: 'REST' as const,
  minutes: 5 as const,
  dueOn: '2026-11-28',
  source: 'HOME' as const,
  status: 'OPEN' as const,
  createdAt: stamp,
  resolvedAt: null,
}
const state = (patch: Partial<CompanionState> = {}): CompanionState => ({
  focus: null,
  chapters: [],
  commitments: [],
  ui: { guide: null, seen: [] },
  revision: 1,
  ...patch,
})
const problem = (status: number, code: string) =>
  HttpResponse.json(
    {
      type: `/problems/${code.toLowerCase()}`,
      title: 'x',
      status,
      code,
      correlationId: 'c',
    },
    { status },
  )

describe('companion state (browser)', () => {
  beforeEach(() => resetCompanionStateForTests())
  afterEach(() => vi.useRealTimers())

  it('reads once, shares the in-flight request and announces the change', async () => {
    let reads = 0
    mockServer.use(
      http.get('/api/companion-state', () => {
        reads += 1
        return HttpResponse.json(state({ revision: 4 }))
      }),
    )
    const changed = vi.fn()
    const stop = subscribeCompanionState(ACCOUNT, changed)
    const other = vi.fn()
    const stopOther = subscribeCompanionState('acc-2', other)

    const [a, b] = await Promise.all([
      refreshCompanionState(ACCOUNT),
      refreshCompanionState(ACCOUNT),
    ])
    await loadCompanionState(ACCOUNT)

    expect(a).toBe(b)
    expect(reads).toBe(1)
    expect(peekCompanionState(ACCOUNT)?.revision).toBe(4)
    expect(changed).toHaveBeenCalledTimes(1)
    expect(other).not.toHaveBeenCalled()
    stop()
    stopOther()
    expect(MAM_COMPANION_STATE_EVENT).toBe('mam:companion-state')
  })

  it('returns null and keeps the last state when a call fails or the answer is malformed', async () => {
    mockServer.use(
      http.get('/api/companion-state', () =>
        HttpResponse.json(state({ revision: 2 })),
      ),
    )
    await refreshCompanionState(ACCOUNT)

    mockServer.use(
      http.get('/api/companion-state', () =>
        problem(503, 'DEPENDENCY_UNAVAILABLE'),
      ),
      http.patch('/api/companion-state', () =>
        HttpResponse.json({ revision: 'x' }),
      ),
    )
    await expect(refreshCompanionState(ACCOUNT)).resolves.toBeNull()
    await expect(
      patchCompanionState(ACCOUNT, { guide: null }),
    ).resolves.toBeNull()

    expect(peekCompanionState(ACCOUNT)?.revision).toBe(2)
  })

  it('publishes the state a patch answers with', async () => {
    const focus = { goal: 'SLEEP' as const, chosenOn: '2026-11-27' }
    mockServer.use(
      http.patch('/api/companion-state', async ({ request }) => {
        expect(await request.json()).toEqual({ focus })
        return HttpResponse.json(state({ focus, revision: 5 }))
      }),
    )

    await patchCompanionState(ACCOUNT, { focus })

    expect(peekCompanionState(ACCOUNT)?.focus).toEqual(focus)
  })

  it('adds a created commitment to the cached state and says when three are open', async () => {
    mockServer.use(
      http.get('/api/companion-state', () => HttpResponse.json(state())),
      http.post('/api/companion-state/commitments', () =>
        HttpResponse.json(commitment, { status: 201 }),
      ),
    )
    await refreshCompanionState(ACCOUNT)

    const created = await createCompanionCommitment(ACCOUNT, {
      kind: 'REST',
      minutes: 5,
      dueOn: '2026-11-28',
      source: 'HOME',
    })

    expect(created).toEqual(commitment)
    expect(peekCompanionState(ACCOUNT)?.commitments).toEqual([commitment])

    mockServer.use(
      http.post('/api/companion-state/commitments', () =>
        problem(409, 'COMMITMENT_LIMIT'),
      ),
    )
    await expect(
      createCompanionCommitment(ACCOUNT, {
        kind: 'MOVE',
        minutes: 10,
        dueOn: '2026-11-28',
        source: 'CHAT',
      }),
    ).resolves.toBe('COMMITMENT_LIMIT')
    expect(peekCompanionState(ACCOUNT)?.commitments).toHaveLength(1)
  })

  it('ignores an answer older than the cached state (a slow GET, PATCHes finishing out of order)', async () => {
    const focus = { goal: 'SLEEP' as const, chosenOn: '2026-11-27' }
    let releaseRead = () => {}
    const gate = new Promise<void>((resolve) => (releaseRead = resolve))
    mockServer.use(
      http.get('/api/companion-state', async () => {
        await gate
        return HttpResponse.json(state({ revision: 1 }))
      }),
      http.patch('/api/companion-state', () =>
        HttpResponse.json(state({ focus, revision: 2 })),
      ),
    )

    const slowRead = refreshCompanionState(ACCOUNT)
    await patchCompanionState(ACCOUNT, { focus })
    releaseRead()
    await slowRead

    expect(peekCompanionState(ACCOUNT)).toMatchObject({ focus, revision: 2 })
  })

  it('keeps a new commitment when an older GET answers after it', async () => {
    let reads = 0
    let releaseRead = () => {}
    const gate = new Promise<void>((resolve) => (releaseRead = resolve))
    mockServer.use(
      http.get('/api/companion-state', async () => {
        reads += 1
        if (reads === 2) await gate
        return HttpResponse.json(
          state({
            revision: reads > 2 ? 2 : 1,
            commitments: reads > 2 ? [commitment] : [],
          }),
        )
      }),
      http.post('/api/companion-state/commitments', () =>
        HttpResponse.json(commitment, { status: 201 }),
      ),
    )
    await refreshCompanionState(ACCOUNT)

    const slowRead = refreshCompanionState(ACCOUNT)
    await createCompanionCommitment(ACCOUNT, {
      kind: 'REST',
      minutes: 5,
      dueOn: '2026-11-28',
      source: 'HOME',
    })
    releaseRead()
    await slowRead

    await vi.waitFor(() =>
      expect(peekCompanionState(ACCOUNT)?.commitments).toEqual([commitment]),
    )
  })

  it('resolves a commitment in the cache', async () => {
    const done = { ...commitment, status: 'DONE' as const, resolvedAt: stamp }
    mockServer.use(
      http.get('/api/companion-state', () =>
        HttpResponse.json(state({ commitments: [commitment] })),
      ),
      http.patch(`/api/companion-state/commitments/${id}`, () =>
        HttpResponse.json(done),
      ),
    )
    await refreshCompanionState(ACCOUNT)

    await expect(
      resolveCompanionCommitment(ACCOUNT, id, 'DONE'),
    ).resolves.toEqual(done)
    expect(peekCompanionState(ACCOUNT)?.commitments).toEqual([done])
  })

  it('treats an already answered commitment as done: it refreshes and raises no error', async () => {
    const done = { ...commitment, status: 'DONE' as const, resolvedAt: stamp }
    mockServer.use(
      http.get('/api/companion-state', () =>
        HttpResponse.json(state({ commitments: [done] })),
      ),
      http.patch(`/api/companion-state/commitments/${id}`, () =>
        problem(409, 'COMMITMENT_RESOLVED'),
      ),
    )

    await expect(
      resolveCompanionCommitment(ACCOUNT, id, 'NOT_YET'),
    ).resolves.toEqual(done)
    expect(peekCompanionState(ACCOUNT)?.commitments).toEqual([done])
  })

  it('returns null when a commitment cannot be answered', async () => {
    mockServer.use(
      http.patch(`/api/companion-state/commitments/${id}`, () =>
        problem(404, 'RESOURCE_NOT_FOUND'),
      ),
    )

    await expect(
      resolveCompanionCommitment(ACCOUNT, id, 'DONE'),
    ).resolves.toBeNull()
  })

  it('sends queued guide and seen writes as one PATCH after 400 ms, the last guide winning', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const bodies: unknown[] = []
    mockServer.use(
      http.patch('/api/companion-state', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json(state())
      }),
    )

    queueCompanionWrite(ACCOUNT, { guide: '{"a":1}' })
    queueCompanionWrite(ACCOUNT, { seen: 'done:abc' })
    queueCompanionWrite(ACCOUNT, { seen: 'Not Valid' })
    queueCompanionWrite(ACCOUNT, { guide: '{"a":2}', seen: 'done:abc' })
    await vi.advanceTimersByTimeAsync(COMPANION_WRITE_DEBOUNCE_MS - 1)
    expect(bodies).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(2)
    await vi.waitFor(() => expect(bodies).toHaveLength(1))

    expect(bodies[0]).toEqual({ guide: '{"a":2}', seenAdd: ['done:abc'] })
  })

  it('keeps a guide over the server limit local only', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const bodies: unknown[] = []
    mockServer.use(
      http.patch('/api/companion-state', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json(state())
      }),
    )

    queueCompanionWrite(ACCOUNT, { guide: 'x'.repeat(6145) })
    await vi.advanceTimersByTimeAsync(COMPANION_WRITE_DEBOUNCE_MS + 50)

    expect(bodies).toHaveLength(0)
  })
})
