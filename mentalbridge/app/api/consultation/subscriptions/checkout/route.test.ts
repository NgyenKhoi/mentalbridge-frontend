import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const consultationMocks = vi.hoisted(() => ({
  planCheckout: vi.fn(),
}))
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

const planVersionId = '51500000-0000-4000-8000-000000000003'

function request(body: unknown) {
  return new NextRequest(
    'http://localhost/api/consultation/subscriptions/checkout',
    {
      method: 'POST',
      headers: {
        cookie: `${ACCESS_COOKIE_NAME}=access-token`,
        'content-type': 'application/json',
        'Idempotency-Key': 'subscription-checkout-123456',
      },
      body: JSON.stringify(body),
    },
  )
}

describe('subscription checkout BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: '9e3a8903-3d31-48d0-bf1a-4d81bbcef4b8',
        status: 'ACTIVE',
        roles: ['USER'],
        emailVerified: true,
      },
    })
    consultationMocks.planCheckout.mockResolvedValue({
      data: { paymentId: '61500000-0000-4000-8000-000000000001' },
    })
  })

  it('forwards only the frozen plan version and command key', async () => {
    const response = await POST(request({ planVersionId }))

    expect(response.status).toBe(201)
    expect(consultationMocks.planCheckout).toHaveBeenCalledWith(
      'access-token',
      expect.any(String),
      planVersionId,
      'subscription-checkout-123456',
    )
  })

  it('rejects browser-supplied price or payment provider fields', async () => {
    const response = await POST(
      request({ planVersionId, amountVnd: 1, provider: 'PAYOS' }),
    )

    expect(response.status).toBe(422)
    expect(consultationMocks.planCheckout).not.toHaveBeenCalled()
  })
})
