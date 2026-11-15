import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const consultationMocks = vi.hoisted(() => ({ cancelSubscription: vi.fn() }))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))
vi.mock('@/lib/consultation/consultation-client', () => ({
  consultationClient: consultationMocks,
}))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { POST } from './route'

const subscriptionId = '62200000-0000-4000-8000-000000000005'

function request(key = 'subscription-cancel-123456') {
  return new NextRequest(
    `http://localhost/api/consultation/subscriptions/${subscriptionId}/cancellation`,
    {
      method: 'POST',
      headers: {
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        'Idempotency-Key': key,
      },
    },
  )
}

describe('subscription cancellation BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: subscriptionId,
        status: 'ACTIVE',
        roles: ['USER'],
        emailVerified: true,
      },
    })
    consultationMocks.cancelSubscription.mockResolvedValue({
      data: { subscriptionId },
    })
  })

  it('forwards only the authenticated owner command identity and stable key', async () => {
    const response = await POST(request(), {
      params: Promise.resolve({ subscriptionId }),
    })
    expect(response.status).toBe(200)
    expect(consultationMocks.cancelSubscription).toHaveBeenCalledWith(
      'token',
      expect.any(String),
      subscriptionId,
      'subscription-cancel-123456',
    )
  })

  it('fails closed before the backend for invalid identifiers and keys', async () => {
    const invalidId = await POST(request(), {
      params: Promise.resolve({ subscriptionId: 'not-a-uuid' }),
    })
    const invalidKey = await POST(request('short'), {
      params: Promise.resolve({ subscriptionId }),
    })
    expect(invalidId.status).toBe(400)
    expect(invalidKey.status).toBe(400)
    expect(consultationMocks.cancelSubscription).not.toHaveBeenCalled()
  })
})
