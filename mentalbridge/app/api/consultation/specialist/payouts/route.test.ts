import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const consultationMocks = vi.hoisted(() => ({
  createSpecialistPayout: vi.fn(),
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

const destinationId = '1e3a8903-3d31-48d0-bf1a-4d81bbcef4b8'

describe('specialist payout BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: '9e3a8903-3d31-48d0-bf1a-4d81bbcef4b8',
        status: 'ACTIVE',
        roles: ['SPECIALIST'],
        emailVerified: true,
      },
    })
    consultationMocks.createSpecialistPayout.mockResolvedValue({
      data: { currency: 'VND', payouts: [] },
    })
  })

  it('forwards only destination identity and never accepts a client amount', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/consultation/specialist/payouts', {
        method: 'POST',
        headers: {
          cookie: `${ACCESS_COOKIE_NAME}=access-token`,
          'content-type': 'application/json',
          'Idempotency-Key': 'payout-request-123456',
        },
        body: JSON.stringify({ destinationId }),
      }),
    )
    expect(response.status).toBe(200)
    expect(consultationMocks.createSpecialistPayout).toHaveBeenCalledWith(
      'access-token',
      expect.any(String),
      destinationId,
      'payout-request-123456',
    )
  })

  it('rejects a browser-supplied amount instead of forwarding it', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/consultation/specialist/payouts', {
        method: 'POST',
        headers: {
          cookie: `${ACCESS_COOKIE_NAME}=access-token`,
          'content-type': 'application/json',
          'Idempotency-Key': 'payout-request-123456',
        },
        body: JSON.stringify({ destinationId, amountVnd: 1 }),
      }),
    )
    expect(response.status).toBe(422)
    expect(consultationMocks.createSpecialistPayout).not.toHaveBeenCalled()
  })
})
