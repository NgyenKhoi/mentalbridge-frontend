import 'server-only'

import type { NextRequest, NextResponse } from 'next/server'

import { ApiError } from '@/lib/api/api-error'
import { identityErrorResponse } from '@/lib/auth/bff-response'
import {
  applySessionCookies,
  clearSessionCookies,
  readSessionCredentials,
} from '@/lib/auth/session-cookies'
import {
  ensureRole,
  RefreshFailedError,
  resolveSession,
} from '@/lib/auth/session-service'

export async function authenticatedCareUser(
  request: NextRequest,
  correlationId: string,
) {
  const credentials = readSessionCredentials(request.cookies)
  const session = await resolveSession(credentials, correlationId)
  ensureRole(session.account, ['USER'])
  const accessToken =
    session.rotatedTokens?.accessToken ?? credentials.accessToken
  if (!accessToken)
    throw new Error('Resolved session has no access credential.')
  return { accessToken, rotatedTokens: session.rotatedTokens }
}

export function careAuthenticationFailure(
  error: unknown,
  correlationId: string,
) {
  const response = identityErrorResponse(
    error instanceof RefreshFailedError ? error.cause : error,
    correlationId,
  )
  if (
    error instanceof RefreshFailedError ||
    (error instanceof ApiError && error.status === 401)
  )
    clearSessionCookies(response)
  return response
}

export function carryCareSession<T>(
  response: NextResponse<T>,
  user: Awaited<ReturnType<typeof authenticatedCareUser>>,
) {
  if (user.rotatedTokens) applySessionCookies(response, user.rotatedTokens)
  return response
}
