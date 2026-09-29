import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({ currentSupportPlan: vi.fn() }))
const journeyMocks = vi.hoisted(() => ({ materialize: vi.fn() }))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/care/care-client', () => ({ careClient: careMocks }))
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

describe('GET /api/resources/journey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: { accountId: crypto.randomUUID(), roles: ['USER'] },
    })
  })

  it('derives the journey only from the authoritative active support plan', async () => {
    careMocks.currentSupportPlan.mockResolvedValue({
      supportPlanId: '10000000-0000-4000-8000-000000000373',
      version: 4,
      status: 'ACTIVE',
      activatedAt: '2026-09-20T00:00:00.000Z',
      templateFamilies: [
        { targetDomain: 'ANXIETY_SYMPTOMS' },
        { targetDomain: 'ANXIETY_SYMPTOMS' },
      ],
      slots: [
        {
          selectedResource: {
            resourceId: '00000000-0000-4000-8000-000000000202',
          },
        },
      ],
    })
    journeyMocks.materialize.mockResolvedValue({
      assignmentId: '00000000-0000-4000-8000-000000000301',
      localDate: '2026-09-29',
      items: [],
      bingo: [],
    })
    const request = new NextRequest(
      'http://localhost/api/resources/journey?date=2026-09-29&timeZone=Asia%2FHo_Chi_Minh',
      { headers: { cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret` } },
    )

    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(journeyMocks.materialize).toHaveBeenCalledWith(
      'identity-access-secret',
      '2026-09-29',
      {
        timeZone: 'Asia/Ho_Chi_Minh',
        supportPlan: {
          supportPlanId: '10000000-0000-4000-8000-000000000373',
          version: 4,
          status: 'ACTIVE',
          activatedAt: '2026-09-20T00:00:00.000Z',
          domains: ['ANXIETY_SYMPTOMS'],
          selectedResourceIds: ['00000000-0000-4000-8000-000000000202'],
        },
      },
      expect.any(String),
    )
  })

  it('does not materialize without an active plan', async () => {
    careMocks.currentSupportPlan.mockResolvedValue({
      status: 'PAUSED',
      activatedAt: '2026-09-20T00:00:00.000Z',
    })
    const request = new NextRequest(
      'http://localhost/api/resources/journey?date=2026-09-29&timeZone=Asia%2FHo_Chi_Minh',
      { headers: { cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret` } },
    )

    const response = await GET(request)

    expect(response.status).toBe(409)
    expect(journeyMocks.materialize).not.toHaveBeenCalled()
  })
})
