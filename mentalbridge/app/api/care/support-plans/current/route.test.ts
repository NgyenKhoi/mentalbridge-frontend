import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({ currentSupportPlan: vi.fn() }))
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

describe('GET /api/care/support-plans/current', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: { accountId: crypto.randomUUID(), roles: ['USER'] },
    })
  })

  it('returns the authoritative current plan and version', async () => {
    careMocks.currentSupportPlan.mockResolvedValue({
      supportPlanId: '10000000-0000-4000-8000-000000000373',
      version: 4,
    })
    const request = new NextRequest(
      'http://localhost/api/care/support-plans/current',
      { headers: { cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret` } },
    )

    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"4"')
    expect(careMocks.currentSupportPlan).toHaveBeenCalledWith(
      'identity-access-secret',
      expect.any(String),
    )
  })
})
