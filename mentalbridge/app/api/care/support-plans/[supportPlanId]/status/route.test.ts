import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { supportPlanFixture } from '@/features/support-plan/testing/support-plan-fixture'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const supportPlanId = '10000000-0000-4000-8000-000000000372'
const careMocks = vi.hoisted(() => ({ changeSupportPlanStatus: vi.fn() }))
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

import { PUT } from './route'

const context = {
  params: Promise.resolve({ supportPlanId }),
} as RouteContext<'/api/care/support-plans/[supportPlanId]/status'>

function request(status: string, ifMatch = '"1"') {
  return new NextRequest(
    `http://localhost/api/care/support-plans/${supportPlanId}/status`,
    {
      method: 'PUT',
      headers: {
        cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret`,
        'content-type': 'application/json',
        'if-match': ifMatch,
      },
      body: JSON.stringify({ status }),
    },
  )
}

describe('PUT /api/care/support-plans/[supportPlanId]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: { accountId: crypto.randomUUID(), roles: ['USER'] },
    })
  })

  it('forwards the explicit lifecycle decision with optimistic concurrency', async () => {
    careMocks.changeSupportPlanStatus.mockResolvedValue({
      ...supportPlanFixture(),
      status: 'PAUSED',
      version: 2,
      activatedAt: '2026-09-20T05:00:00Z',
    })

    const response = await PUT(request('PAUSED'), context)

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"2"')
    expect(careMocks.changeSupportPlanStatus).toHaveBeenCalledWith(
      'identity-access-secret',
      supportPlanId,
      1,
      { status: 'PAUSED' },
      expect.any(String),
    )
  })

  it('rejects a server-owned terminal status from the browser', async () => {
    const response = await PUT(request('SUPERSEDED'), context)

    expect(response.status).toBe(400)
    expect(careMocks.changeSupportPlanStatus).not.toHaveBeenCalled()
  })
})
