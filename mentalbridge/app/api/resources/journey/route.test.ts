import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({ resourceActions: vi.fn() }))
const journeyMocks = vi.hoisted(() => ({ materialize: vi.fn() }))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/care/support-plan-action-client', () => ({
  supportPlanActionClient: careMocks,
}))
vi.mock('@/lib/content/content-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/content/content-client')>()),
  contentResourceJourneyClient: journeyMocks,
}))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { GET } from './route'

const planId = '10000000-0000-4000-8000-000000000373'
const resourceId = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const action = (n: number) => ({ resource: { resourceId: resourceId(n) } })
const activePlan = (over: Record<string, unknown> = {}) => ({
  planState: 'ACTIVE',
  localDate: '2026-09-29',
  supportPlanId: planId,
  supportPlanVersion: 4,
  representationMode: 'NATIVE_V3',
  timeZone: 'Asia/Ho_Chi_Minh',
  activatedAt: '2026-09-20T00:00:00.000Z',
  targetDomains: ['ANXIETY_SYMPTOMS'],
  actions: [action(202)],
  ...over,
})
const journeyRequest = (
  query = 'date=2026-09-29&timeZone=Asia%2FHo_Chi_Minh',
) =>
  new NextRequest(`http://localhost/api/resources/journey?${query}`, {
    headers: { cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret` },
  })

describe('GET /api/resources/journey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: { accountId: crypto.randomUUID(), roles: ['USER'] },
    })
    journeyMocks.materialize.mockResolvedValue({
      assignmentId: '00000000-0000-4000-8000-000000000301',
      localDate: '2026-09-29',
      items: [],
      bingo: [],
    })
  })

  it('derives the journey from the native v3 active plan projection', async () => {
    careMocks.resourceActions.mockResolvedValue(
      activePlan({
        targetDomains: ['DEPRESSIVE_SYMPTOMS', 'ANXIETY_SYMPTOMS'],
      }),
    )

    const response = await GET(journeyRequest())

    expect(response.status).toBe(200)
    expect(careMocks.resourceActions).toHaveBeenCalledWith(
      'identity-access-secret',
      '2026-09-29',
      expect.any(String),
    )
    expect(journeyMocks.materialize).toHaveBeenCalledWith(
      'identity-access-secret',
      '2026-09-29',
      {
        timeZone: 'Asia/Ho_Chi_Minh',
        supportPlan: {
          supportPlanId: planId,
          version: 4,
          status: 'ACTIVE',
          activatedAt: '2026-09-20T00:00:00.000Z',
          domains: ['DEPRESSIVE_SYMPTOMS', 'ANXIETY_SYMPTOMS'],
          selectedResourceIds: [resourceId(202)],
        },
      },
      expect.any(String),
    )
  })

  it('de-duplicates resource ids in plan order and caps them at 12', async () => {
    careMocks.resourceActions.mockResolvedValue(
      activePlan({
        actions: [
          action(1),
          action(2),
          action(1),
          ...Array.from({ length: 12 }, (_, i) => action(10 + i)),
        ],
      }),
    )

    await GET(journeyRequest())

    const sent = journeyMocks.materialize.mock.calls[0][2].supportPlan
    expect(sent.selectedResourceIds).toEqual([
      resourceId(1),
      resourceId(2),
      ...Array.from({ length: 10 }, (_, i) => resourceId(10 + i)),
    ])
  })

  it.each([
    ['PAUSED', { planState: 'PAUSED' }],
    [
      'NONE',
      {
        planState: 'NONE',
        supportPlanId: undefined,
        supportPlanVersion: undefined,
        representationMode: undefined,
        timeZone: undefined,
        activatedAt: undefined,
        targetDomains: undefined,
        actions: [],
      },
    ],
    ['missing activatedAt', { activatedAt: undefined }],
    ['missing targetDomains', { targetDomains: undefined }],
  ])('does not materialize for %s', async (_name, over) => {
    careMocks.resourceActions.mockResolvedValue(activePlan(over))

    const response = await GET(journeyRequest())

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      code: 'ACTIVE_SUPPORT_PLAN_REQUIRED',
    })
    expect(journeyMocks.materialize).not.toHaveBeenCalled()
  })

  it('accepts UTC as a valid IANA time zone', async () => {
    careMocks.resourceActions.mockResolvedValue(activePlan({ actions: [] }))

    const response = await GET(journeyRequest('date=2026-09-29&timeZone=UTC'))

    expect(response.status).toBe(200)
    expect(journeyMocks.materialize).toHaveBeenCalledWith(
      'identity-access-secret',
      '2026-09-29',
      expect.objectContaining({ timeZone: 'UTC' }),
      expect.any(String),
    )
  })
})
