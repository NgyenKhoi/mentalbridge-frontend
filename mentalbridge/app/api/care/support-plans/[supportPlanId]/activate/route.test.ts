import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({ activateSupportPlan: vi.fn() }))
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

import { POST } from './route'

const planId = '10000000-0000-4000-8000-000000000373'
const context = {
  params: Promise.resolve({ supportPlanId: planId }),
} as RouteContext<'/api/care/support-plans/[supportPlanId]/activate'>

function request(headers: Record<string, string> = {}) {
  return new NextRequest(
    `http://localhost/api/care/support-plans/${planId}/activate`,
    {
      method: 'POST',
      headers: {
        cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret`,
        'if-match': '"3"',
        'idempotency-key': 'support-plan-activate-browser-0373',
        ...headers,
      },
    },
  )
}

describe('POST /api/care/support-plans/[supportPlanId]/activate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: { accountId: crypto.randomUUID(), roles: ['USER'] },
    })
  })

  it('forwards only the explicit versioned activation command', async () => {
    careMocks.activateSupportPlan.mockResolvedValue({
      supportPlanId: planId,
      version: 4,
    })

    const response = await POST(request(), context)

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"4"')
    expect(careMocks.activateSupportPlan).toHaveBeenCalledWith(
      'identity-access-secret',
      planId,
      3,
      'support-plan-activate-browser-0373',
      expect.any(String),
    )
  })

  it('preserves the stable stale-resource error', async () => {
    careMocks.activateSupportPlan.mockRejectedValue(
      new ApiError({
        message: 'stale',
        code: 'RESOURCE_VERSION_STALE',
        status: 409,
      }),
    )

    const response = await POST(request(), context)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'RESOURCE_VERSION_STALE',
    })
  })

  it('requires an exact If-Match version', async () => {
    const response = await POST(request({ 'if-match': '3' }), context)

    expect(response.status).toBe(400)
    expect(careMocks.activateSupportPlan).not.toHaveBeenCalled()
  })
})
