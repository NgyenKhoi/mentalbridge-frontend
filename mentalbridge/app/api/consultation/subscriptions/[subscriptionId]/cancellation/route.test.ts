import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'
import { ApiError } from '@/lib/api/api-error'
import { ConsultationServiceError } from '@/lib/consultation/consultation-client'

const consultationMocks = vi.hoisted(() => ({ cancelSubscription: vi.fn() }))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))
vi.mock('@/lib/consultation/consultation-client', async (original) => ({
  ...(await original<
    typeof import('@/lib/consultation/consultation-client')
  >()),
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

  it('rejects unauthenticated and unauthorized commands before the provider', async () => {
    sessionMocks.resolveSession.mockRejectedValueOnce(
      new ApiError({
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'Expired.',
      }),
    )
    expect(
      (await POST(request(), { params: Promise.resolve({ subscriptionId }) }))
        .status,
    ).toBe(401)

    sessionMocks.ensureRole.mockImplementationOnce(() => {
      throw new ApiError({
        status: 403,
        code: 'FORBIDDEN',
        message: 'Not allowed.',
      })
    })
    expect(
      (await POST(request(), { params: Promise.resolve({ subscriptionId }) }))
        .status,
    ).toBe(403)
    expect(consultationMocks.cancelSubscription).not.toHaveBeenCalled()
  })

  it('preserves an authoritative invalid-state conflict', async () => {
    consultationMocks.cancelSubscription.mockRejectedValue(
      new ConsultationServiceError(
        409,
        'SUBSCRIPTION_CANCELLATION_INVALID_STATE',
        'Already cancelled.',
      ),
    )
    const response = await POST(request(), {
      params: Promise.resolve({ subscriptionId }),
    })
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe(
      'SUBSCRIPTION_CANCELLATION_INVALID_STATE',
    )
  })
})
