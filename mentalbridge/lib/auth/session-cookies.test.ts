import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

import type { TokenPair } from '@/features/auth/api/identity-contract'

import {
  ACCESS_COOKIE_NAME,
  applySessionCookies,
  clearSessionCookies,
  REFRESH_COOKIE_NAME,
} from './session-cookies'

const tokenPair: TokenPair = {
  accessToken: 'access-secret',
  tokenType: 'Bearer',
  expiresIn: 900,
  refreshToken: 'r'.repeat(43),
  refreshExpiresAt: '2026-09-01T00:00:00Z',
}

afterEach(() => vi.unstubAllEnvs())

describe('session cookie policy', () => {
  it('keeps credentials HttpOnly and secure in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const response = NextResponse.json({ authenticated: true })

    applySessionCookies(response, tokenPair, Date.parse('2026-08-20T00:00:00Z'))

    const setCookie = response.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(`${ACCESS_COOKIE_NAME}=access-secret`)
    expect(setCookie).toContain(`${REFRESH_COOKIE_NAME}=${'r'.repeat(43)}`)
    expect(setCookie.match(/HttpOnly/g)).toHaveLength(2)
    expect(setCookie.match(/Secure/g)).toHaveLength(2)
    expect(setCookie.match(/SameSite=lax/gi)).toHaveLength(2)
    expect(setCookie.match(/Path=\//g)).toHaveLength(2)
  })

  it('expires both credentials when clearing a local session', () => {
    const response = NextResponse.json({ cleared: true })

    clearSessionCookies(response)

    const setCookie = response.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(`${ACCESS_COOKIE_NAME}=`)
    expect(setCookie).toContain(`${REFRESH_COOKIE_NAME}=`)
    expect(setCookie.match(/Max-Age=0/g)).toHaveLength(2)
  })
})
