import type { NextRequest } from 'next/server'

import { ApiError } from '@/lib/api/api-error'
import {
  correlationIdFrom,
  identityErrorResponse,
  successResponse,
} from '@/lib/auth/bff-response'
import {
  applySessionCookies,
  clearSessionCookies,
  readSessionCredentials,
} from '@/lib/auth/session-cookies'
import { RefreshFailedError, resolveSession } from '@/lib/auth/session-service'

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)

  try {
    const session = await resolveSession(
      readSessionCredentials(request.cookies),
      correlationId,
    )
    const response = successResponse(
      { account: session.account },
      correlationId,
    )

    if (session.rotatedTokens) {
      applySessionCookies(response, session.rotatedTokens)
    }

    return response
  } catch (error) {
    const response = identityErrorResponse(
      error instanceof RefreshFailedError ? error.cause : error,
      correlationId,
    )

    if (
      error instanceof RefreshFailedError ||
      (error instanceof ApiError && error.status === 401)
    ) {
      clearSessionCookies(response)
    }
    return response
  }
}
