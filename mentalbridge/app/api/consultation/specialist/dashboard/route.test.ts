import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const consultationMocks = vi.hoisted(() => ({
  specialistDashboard: vi.fn(),
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

import { GET } from './route'

function request() {
  return new NextRequest(
    'http://localhost/api/consultation/specialist/dashboard',
    { headers: { cookie: `${ACCESS_COOKIE_NAME}=access-token` } },
  )
}

describe('specialist dashboard BFF', () => {
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
    consultationMocks.specialistDashboard.mockResolvedValue({
      data: { source: 'CONSULTATION', operationalStatus: 'READY' },
    })
  })

  it('uses only the specialist-authenticated server boundary', async () => {
    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(sessionMocks.ensureRole).toHaveBeenCalledWith(expect.anything(), [
      'SPECIALIST',
    ])
    expect(consultationMocks.specialistDashboard).toHaveBeenCalledWith(
      'access-token',
      expect.any(String),
    )
  })
})
