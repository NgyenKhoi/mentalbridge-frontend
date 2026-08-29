import 'server-only'

import type { NextRequest, NextResponse } from 'next/server'

import type { TokenPair } from '@/features/auth/api/identity-contract'

export const ACCESS_COOKIE_NAME = 'mentalbridge_access'
export const REFRESH_COOKIE_NAME = 'mentalbridge_refresh'

const COOKIE_PATH = '/'
const MAX_REFRESH_COOKIE_AGE_MS = 30 * 24 * 60 * 60 * 1_000

type CookieReader = Pick<NextRequest['cookies'], 'get'>

export type SessionCredentials = Readonly<{
  accessToken?: string
  refreshToken?: string
}>

function cookieSecurityOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: COOKIE_PATH,
    priority: 'high' as const,
  }
}

export function readSessionCredentials(
  cookies: CookieReader,
): SessionCredentials {
  return {
    accessToken: cookies.get(ACCESS_COOKIE_NAME)?.value,
    refreshToken: cookies.get(REFRESH_COOKIE_NAME)?.value,
  }
}

export function applySessionCookies(
  response: NextResponse,
  tokenPair: TokenPair,
  now = Date.now(),
) {
  const refreshExpiry = Date.parse(tokenPair.refreshExpiresAt)
  const boundedRefreshExpiry = Math.min(
    refreshExpiry,
    now + MAX_REFRESH_COOKIE_AGE_MS,
  )

  if (!Number.isFinite(refreshExpiry) || boundedRefreshExpiry <= now) {
    throw new Error('Identity returned an expired refresh credential.')
  }

  response.cookies.set(ACCESS_COOKIE_NAME, tokenPair.accessToken, {
    ...cookieSecurityOptions(),
    maxAge: tokenPair.expiresIn,
    expires: new Date(now + tokenPair.expiresIn * 1_000),
  })
  response.cookies.set(REFRESH_COOKIE_NAME, tokenPair.refreshToken, {
    ...cookieSecurityOptions(),
    expires: new Date(boundedRefreshExpiry),
    maxAge: Math.floor((boundedRefreshExpiry - now) / 1_000),
  })
}

export function clearSessionCookies(response: NextResponse) {
  const expired = new Date(0)

  response.cookies.set(ACCESS_COOKIE_NAME, '', {
    ...cookieSecurityOptions(),
    expires: expired,
    maxAge: 0,
  })
  response.cookies.set(REFRESH_COOKIE_NAME, '', {
    ...cookieSecurityOptions(),
    expires: expired,
    maxAge: 0,
  })
}
