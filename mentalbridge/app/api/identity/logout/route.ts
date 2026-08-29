import type { NextRequest } from 'next/server'

import {
  correlationIdFrom,
  identityErrorResponse,
  localProblem,
  noContentResponse,
} from '@/lib/auth/bff-response'
import { identityClient } from '@/lib/auth/identity-client'
import {
  clearSessionCookies,
  readSessionCredentials,
} from '@/lib/auth/session-cookies'

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const { accessToken, refreshToken } = readSessionCredentials(request.cookies)

  let response

  if (!accessToken && !refreshToken) {
    response = noContentResponse(correlationId)
  } else if (!accessToken || !refreshToken) {
    response = localProblem(
      401,
      'LOGOUT_REVOCATION_UNCONFIRMED',
      'The local session was cleared, but backend revocation was not confirmed.',
      correlationId,
    )
  } else {
    try {
      await identityClient.logout(accessToken, refreshToken, correlationId)
      response = noContentResponse(correlationId)
    } catch (error) {
      response = identityErrorResponse(error, correlationId)
    }
  }

  clearSessionCookies(response)
  return response
}
