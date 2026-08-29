import type { NextRequest } from 'next/server'

import {
  correlationIdFrom,
  identityErrorResponse,
  localProblem,
  noContentResponse,
} from '@/lib/auth/bff-response'
import { refreshCoordinator } from '@/lib/auth/refresh-coordinator'
import {
  applySessionCookies,
  clearSessionCookies,
  readSessionCredentials,
} from '@/lib/auth/session-cookies'

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const { refreshToken } = readSessionCredentials(request.cookies)

  if (!refreshToken) {
    const response = localProblem(
      401,
      'SESSION_REQUIRED',
      'Authentication is required.',
      correlationId,
    )
    clearSessionCookies(response)
    return response
  }

  try {
    const tokenPair = await refreshCoordinator.refresh(
      refreshToken,
      correlationId,
    )
    const response = noContentResponse(correlationId)
    applySessionCookies(response, tokenPair)
    return response
  } catch (error) {
    const response = identityErrorResponse(error, correlationId)
    clearSessionCookies(response)
    return response
  }
}
