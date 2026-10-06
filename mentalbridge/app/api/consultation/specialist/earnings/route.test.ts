import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const consultationMocks = vi.hoisted(() => ({ specialistEarnings: vi.fn() }))
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

import { GET } from './route'

describe('specialist earnings BFF', () => {
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
    consultationMocks.specialistEarnings.mockResolvedValue({
      data: { currency: 'VND', earnings: [] },
    })
  })

  it('loads earnings only through a specialist-authenticated server boundary', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/consultation/specialist/earnings', {
        headers: { cookie: `${ACCESS_COOKIE_NAME}=access-token` },
      }),
    )
    expect(response.status).toBe(200)
    expect(sessionMocks.ensureRole).toHaveBeenCalledWith(expect.anything(), [
      'SPECIALIST',
    ])
    expect(consultationMocks.specialistEarnings).toHaveBeenCalledWith(
      'access-token',
      expect.any(String),
    )
  })
})
