import type { NextRequest } from 'next/server'

import {
  correlationIdFrom,
  identityErrorResponse,
  localProblem,
  successResponse,
} from '@/lib/auth/bff-response'
import { identityClient } from '@/lib/auth/identity-client'
import { validateLoginRequest } from '@/lib/auth/identity-validation'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import { applySessionCookies } from '@/lib/auth/session-cookies'

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)

  try {
    const body = await readBoundedJson(request)
    const validation = validateLoginRequest(body)

    if (!validation.success) {
      return localProblem(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
        correlationId,
        validation.violations,
      )
    }

    const tokenPair = await identityClient.login(
      validation.value,
      correlationId,
    )
    const response = successResponse({ authenticated: true }, correlationId)
    applySessionCookies(response, tokenPair)
    return response
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return localProblem(
        error.status,
        error.code,
        error.message,
        correlationId,
        error.violations,
      )
    }

    return identityErrorResponse(error, correlationId)
  }
}
