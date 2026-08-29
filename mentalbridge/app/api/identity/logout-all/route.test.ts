import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from '@/lib/auth/session-cookies'

const identityMocks = vi.hoisted(() => ({
  logoutAll: vi.fn(),
}))

vi.mock('@/lib/auth/identity-client', () => ({
  identityClient: { logoutAll: identityMocks.logoutAll },
}))

import { POST } from './route'

function request(cookie?: string) {
  return new NextRequest('http://localhost/api/identity/logout-all', {
    method: 'POST',
    headers: cookie ? { cookie } : undefined,
  })
}

describe('POST /api/identity/logout-all', () => {
  beforeEach(() => {
    identityMocks.logoutAll.mockReset()
  })

  it('revokes every backend session and clears local cookies', async () => {
    identityMocks.logoutAll.mockResolvedValue(undefined)

    const response = await POST(request(`${ACCESS_COOKIE_NAME}=access-token`))

    expect(identityMocks.logoutAll).toHaveBeenCalledWith(
      'access-token',
      expect.any(String),
    )
    expect(response.status).toBe(204)
    const cookies = response.headers.get('set-cookie') ?? ''
    expect(cookies).toContain(`${ACCESS_COOKIE_NAME}=`)
    expect(cookies).toContain(`${REFRESH_COOKIE_NAME}=`)
  })

  it('clears cookies and fails safely when no revocable session remains', async () => {
    const response = await POST(request())

    expect(identityMocks.logoutAll).not.toHaveBeenCalled()
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({
      code: 'LOGOUT_REVOCATION_UNCONFIRMED',
    })
    expect(response.headers.get('set-cookie')).toContain(
      `${ACCESS_COOKIE_NAME}=`,
    )
  })
})
