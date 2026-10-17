import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({ currentGuidedJourney: vi.fn() }))
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

import { ApiError } from '@/lib/api/api-error'
import { GET } from './route'

function request(cookie = true) {
  return new NextRequest('http://localhost/api/care/guided-journey', {
    headers: cookie
      ? { cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret` }
      : {},
  })
}

describe('/api/care/guided-journey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: '30000000-0000-4000-8000-000000000668',
        status: 'ACTIVE',
        roles: ['USER'],
        emailVerified: true,
      },
    })
  })

  it('returns the Care pointer for the authenticated owner without caching', async () => {
    careMocks.currentGuidedJourney.mockResolvedValue({ stage: 'GUIDE_READY' })

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({ stage: 'GUIDE_READY' })
    expect(careMocks.currentGuidedJourney).toHaveBeenCalledWith(
      'identity-access-secret',
      expect.any(String),
    )
  })

  it('passes Care dependency failures through as a retryable problem', async () => {
    careMocks.currentGuidedJourney.mockRejectedValue(
      new ApiError({
        message: 'Care unavailable',
        code: 'SERVICE_UNAVAILABLE',
        status: 503,
      }),
    )

    const response = await GET(request())

    expect(response.status).toBe(503)
  })

  it('requires a session before calling Care', async () => {
    sessionMocks.resolveSession.mockRejectedValue(
      new ApiError({
        code: 'SESSION_REQUIRED',
        status: 401,
        message: 'secret',
      }),
    )
    const response = await GET(request(false))

    expect(response.status).toBe(401)
    expect(careMocks.currentGuidedJourney).not.toHaveBeenCalled()
  })
})
