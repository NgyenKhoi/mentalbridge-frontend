import type { NextRequest } from 'next/server'

import {
  correlationIdFrom,
  identityErrorResponse,
  localProblem,
  noContentResponse,
} from '@/lib/auth/bff-response'
import { identityClient } from '@/lib/auth/identity-client'
import { validatePasswordChangeRequest } from '@/lib/auth/identity-validation'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  clearSessionCookies,
  readSessionCredentials,
} from '@/lib/auth/session-cookies'

export async function PUT(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  if (!hasSameOrigin(request)) {
    return localProblem(
      403,
      'FORBIDDEN',
      'Request origin is invalid.',
      correlationId,
    )
  }
  const { accessToken } = readSessionCredentials(request.cookies)
  if (!accessToken)
    return localProblem(
      401,
      'SESSION_REQUIRED',
      'Authentication is required.',
      correlationId,
    )
  try {
    const validation = validatePasswordChangeRequest(
      await readBoundedJson(request),
    )
    if (!validation.success)
      return localProblem(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
        correlationId,
        validation.violations,
      )
    await identityClient.changePassword(
      accessToken,
      validation.value,
      correlationId,
    )
    const response = noContentResponse(correlationId)
    clearSessionCookies(response)
    return response
  } catch (error) {
    if (error instanceof RequestBodyError)
      return localProblem(
        error.status,
        error.code,
        error.message,
        correlationId,
        error.violations,
      )
    return identityErrorResponse(error, correlationId)
  }
}

function hasSameOrigin(request: NextRequest) {
  const supplied = request.headers.get('origin')
  const host = request.headers.get('host')
  if (!supplied || !host) return false

  try {
    const origin = new URL(supplied)
    return origin.host === host && origin.protocol === request.nextUrl.protocol
  } catch {
    return false
  }
}
