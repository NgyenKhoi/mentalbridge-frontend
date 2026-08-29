import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from '@/lib/auth/session-cookies'

const identityMocks = vi.hoisted(() => ({
  logout: vi.fn(),
}))

vi.mock('@/lib/auth/identity-client', () => ({
  identityClient: { logout: identityMocks.logout },
}))

import { POST } from './route'

function request(cookie?: string) {
  return new NextRequest('http://localhost/api/identity/logout', {
    method: 'POST',
    headers: cookie ? { cookie } : undefined,
  })
}

function sessionCookie() {
  return `${ACCESS_COOKIE_NAME}=access-token; ${REFRESH_COOKIE_NAME}=refresh-token`
}

function expectCookiesCleared(response: Response) {
  const cookies = response.headers.get('set-cookie') ?? ''
  expect(cookies).toContain(`${ACCESS_COOKIE_NAME}=`)
  expect(cookies).toContain(`${REFRESH_COOKIE_NAME}=`)
}

describe('POST /api/identity/logout', () => {
  beforeEach(() => {
    identityMocks.logout.mockReset()
  })

  it('revokes the current backend session before clearing cookies', async () => {
    identityMocks.logout.mockResolvedValue(undefined)

    const response = await POST(request(sessionCookie()))

    expect(identityMocks.logout).toHaveBeenCalledWith(
      'access-token',
      'refresh-token',
      expect.any(String),
    )
    expect(response.status).toBe(204)
    expectCookiesCleared(response)
  })

  it('treats an already-cleared session as an idempotent success', async () => {
    const response = await POST(request())

    expect(identityMocks.logout).not.toHaveBeenCalled()
    expect(response.status).toBe(204)
    expectCookiesCleared(response)
  })

  it.each([
    [401, 'INVALID_SESSION'],
    [503, 'IDENTITY_UNAVAILABLE'],
  ])(
    'clears local cookies when backend revocation returns %s',
    async (status, code) => {
      identityMocks.logout.mockRejectedValue(
        new ApiError({ message: 'revocation failed', code, status }),
      )

      const response = await POST(request(sessionCookie()))

      expect(response.status).toBe(status)
      expectCookiesCleared(response)
    },
  )
})
