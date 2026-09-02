import 'server-only'

import type { NextRequest, NextResponse } from 'next/server'

import type { AnonymousSession } from '@/features/assessment/api/care-contract'

export const ANONYMOUS_SESSION_ID_COOKIE = 'mentalbridge_care_anonymous_id'
export const ANONYMOUS_SESSION_TOKEN_COOKIE =
  'mentalbridge_care_anonymous_token'
export const ANONYMOUS_SESSION_EXPIRY_COOKIE =
  'mentalbridge_care_anonymous_expiry'
export const ANONYMOUS_ASSESSMENT_COOKIE =
  'mentalbridge_care_anonymous_assessment'
export const AUTHENTICATED_ASSESSMENT_COOKIE =
  'mentalbridge_care_authenticated_assessment'

type CookieReader = Pick<NextRequest['cookies'], 'get'>

const anonymousCookieNames = [
  ANONYMOUS_SESSION_ID_COOKIE,
  ANONYMOUS_SESSION_TOKEN_COOKIE,
  ANONYMOUS_SESSION_EXPIRY_COOKIE,
  ANONYMOUS_ASSESSMENT_COOKIE,
] as const

function securityOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    priority: 'high' as const,
  }
}

export function readAnonymousSession(cookies: CookieReader) {
  return {
    sessionId: cookies.get(ANONYMOUS_SESSION_ID_COOKIE)?.value,
    sessionToken: cookies.get(ANONYMOUS_SESSION_TOKEN_COOKIE)?.value,
    expiresAt: cookies.get(ANONYMOUS_SESSION_EXPIRY_COOKIE)?.value,
    assessmentId: cookies.get(ANONYMOUS_ASSESSMENT_COOKIE)?.value,
  }
}

export function applyAnonymousSessionCookies(
  response: NextResponse,
  session: AnonymousSession,
  now = Date.now(),
) {
  const expiry = Date.parse(session.expiresAt)
  if (!Number.isFinite(expiry) || expiry <= now) {
    throw new Error('Care returned an expired anonymous session.')
  }
  const options = {
    ...securityOptions(),
    expires: new Date(expiry),
    maxAge: Math.floor((expiry - now) / 1_000),
  }

  response.cookies.set(ANONYMOUS_SESSION_ID_COOKIE, session.sessionId, options)
  response.cookies.set(
    ANONYMOUS_SESSION_TOKEN_COOKIE,
    session.sessionToken,
    options,
  )
  response.cookies.set(
    ANONYMOUS_SESSION_EXPIRY_COOKIE,
    session.expiresAt,
    options,
  )
  response.cookies.set(ANONYMOUS_ASSESSMENT_COOKIE, '', {
    ...securityOptions(),
    expires: new Date(0),
    maxAge: 0,
  })
}

export function rememberAnonymousAssessment(
  response: NextResponse,
  assessmentId: string,
  expiresAt: string,
  now = Date.now(),
) {
  const expiry = Date.parse(expiresAt)
  if (!Number.isFinite(expiry) || expiry <= now) return
  response.cookies.set(ANONYMOUS_ASSESSMENT_COOKIE, assessmentId, {
    ...securityOptions(),
    expires: new Date(expiry),
    maxAge: Math.floor((expiry - now) / 1_000),
  })
}

export function clearAnonymousSessionCookies(response: NextResponse) {
  for (const name of anonymousCookieNames) {
    response.cookies.set(name, '', {
      ...securityOptions(),
      expires: new Date(0),
      maxAge: 0,
    })
  }
}

export function readAuthenticatedAssessmentId(cookies: CookieReader) {
  return cookies.get(AUTHENTICATED_ASSESSMENT_COOKIE)?.value
}

export function rememberAuthenticatedAssessment(
  response: NextResponse,
  assessmentId: string,
) {
  response.cookies.set(AUTHENTICATED_ASSESSMENT_COOKIE, assessmentId, {
    ...securityOptions(),
  })
}
