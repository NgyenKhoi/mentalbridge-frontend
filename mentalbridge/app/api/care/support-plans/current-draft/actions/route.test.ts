import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({
  currentSupportPlanDraftActions: vi.fn(),
}))
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

describe('GET /api/care/support-plans/current-draft/actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: { accountId: crypto.randomUUID(), roles: ['USER'] },
    })
  })

  it('returns the reviewable draft schedules and version', async () => {
    careMocks.currentSupportPlanDraftActions.mockResolvedValue({
      supportPlanId: '10000000-0000-4000-8000-000000000640',
      version: 3,
    })
    const response = await GET(
      new NextRequest(
        'http://localhost/api/care/support-plans/current-draft/actions',
        { headers: { cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret` } },
      ),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"3"')
    expect(careMocks.currentSupportPlanDraftActions).toHaveBeenCalledWith(
      'identity-access-secret',
      expect.any(String),
    )
  })
})
