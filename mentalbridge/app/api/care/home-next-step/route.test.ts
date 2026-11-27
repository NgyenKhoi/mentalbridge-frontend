import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({ homeNextStep: vi.fn() }))
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

function request(query = '', cookie = true) {
  return new NextRequest(`http://localhost/api/care/home-next-step${query}`, {
    headers: cookie
      ? { cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret` }
      : {},
  })
}

describe('/api/care/home-next-step', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: '30000000-0000-4000-8000-000000000672',
        status: 'ACTIVE',
        roles: ['USER'],
        emailVerified: true,
      },
    })
    careMocks.homeNextStep.mockResolvedValue({
      homePolicyVersion: 'mb-home-next-step-v1',
      plan: null,
    })
  })

  it('returns the owner read with browser IANA time zone and no-store', async () => {
    const response = await GET(request('?timezone=Asia%2FBangkok'))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({
      homePolicyVersion: 'mb-home-next-step-v1',
      plan: null,
    })
    expect(sessionMocks.ensureRole).toHaveBeenCalledWith(
      expect.objectContaining({ roles: ['USER'] }),
      ['USER'],
    )
    expect(careMocks.homeNextStep).toHaveBeenCalledWith(
      'identity-access-secret',
      'Asia/Bangkok',
      expect.any(String),
    )
  })

  it('leaves an absent time zone to the plan schedule default', async () => {
    await GET(request())
    expect(careMocks.homeNextStep).toHaveBeenCalledWith(
      'identity-access-secret',
      undefined,
      expect.any(String),
    )
  })

  it.each(['', 'Mars%2FOlympus', '%2B07%3A00'])(
    'rejects an invalid supplied time zone %s before calling Care',
    async (timezone) => {
      const response = await GET(request(`?timezone=${timezone}`))
      expect(response.status).toBe(400)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(careMocks.homeNextStep).not.toHaveBeenCalled()
    },
  )

  it.each([
    [503, 'SUPPORT_POLICY_UNAVAILABLE'],
    [503, 'CARE_UNAVAILABLE'],
    [502, 'CARE_MALFORMED_RESPONSE'],
  ])(
    'preserves retryable Care status %s/%s without upstream detail',
    async (status, code) => {
      careMocks.homeNextStep.mockRejectedValue(
        new ApiError({ message: 'private upstream detail', code, status }),
      )
      const response = await GET(request())
      expect(response.status).toBe(status)
      expect(response.headers.get('cache-control')).toBe('no-store')
      const body = await response.json()
      expect(body.code).toBe(code)
      expect(JSON.stringify(body)).not.toContain('private upstream detail')
    },
  )

  it('requires a session before calling Care', async () => {
    sessionMocks.resolveSession.mockRejectedValue(
      new ApiError({
        code: 'SESSION_REQUIRED',
        status: 401,
        message: 'secret',
      }),
    )
    const response = await GET(request('', false))
    expect(response.status).toBe(401)
    expect(careMocks.homeNextStep).not.toHaveBeenCalled()
  })

  it('rejects a non-USER role before calling Care', async () => {
    sessionMocks.ensureRole.mockImplementation(() => {
      throw new ApiError({ code: 'FORBIDDEN', status: 403, message: 'secret' })
    })
    const response = await GET(request())
    expect(response.status).toBe(403)
    expect(careMocks.homeNextStep).not.toHaveBeenCalled()
  })

  it('uses rotated credentials and carries the refreshed HttpOnly session', async () => {
    sessionMocks.resolveSession.mockResolvedValue({
      account: { roles: ['USER'] },
      rotatedTokens: {
        accessToken: 'rotated-access',
        refreshToken: 'rotated-refresh',
        expiresIn: 300,
        refreshExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    })
    const response = await GET(request())
    expect(careMocks.homeNextStep).toHaveBeenCalledWith(
      'rotated-access',
      undefined,
      expect.any(String),
    )
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(JSON.stringify(await response.json())).not.toContain('rotated-')
  })
})
