import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { supportPlanFixture } from '@/features/support-plan/testing/support-plan-fixture'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const supportPlanId = '10000000-0000-4000-8000-000000000372'
const careMocks = vi.hoisted(() => ({ supportPlan: vi.fn() }))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/care/care-client', () => ({ careClient: careMocks }))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { GET } from './route'

function request(id = supportPlanId) {
  return new NextRequest(`http://localhost/api/care/support-plans/${id}`, {
    headers: { cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret` },
  })
}

function context(id = supportPlanId) {
  return {
    params: Promise.resolve({ supportPlanId: id }),
  } as RouteContext<'/api/care/support-plans/[supportPlanId]'>
}

describe('GET /api/care/support-plans/[supportPlanId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: { accountId: crypto.randomUUID(), roles: ['USER'] },
    })
  })

  it('returns an owner snapshot with its authoritative version', async () => {
    careMocks.supportPlan.mockResolvedValue({
      ...supportPlanFixture(),
      status: 'COMPLETED',
      version: 4,
      activatedAt: '2026-09-20T05:00:00Z',
      completedAt: '2026-09-21T05:00:00Z',
      completionReason: 'USER_DECISION',
    })

    const response = await GET(request(), context())

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"4"')
    expect(careMocks.supportPlan).toHaveBeenCalledWith(
      'identity-access-secret',
      supportPlanId,
      expect.any(String),
    )
  })

  it('rejects a malformed identifier before calling Care', async () => {
    const response = await GET(request('not-a-uuid'), context('not-a-uuid'))

    expect(response.status).toBe(400)
    expect(careMocks.supportPlan).not.toHaveBeenCalled()
  })
})
