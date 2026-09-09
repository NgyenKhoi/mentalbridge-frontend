import type { NextRequest } from 'next/server'

import {
  acceptedResponse,
  correlationIdFrom,
  identityErrorResponse,
  localProblem,
} from '@/lib/auth/bff-response'
import { identityClient } from '@/lib/auth/identity-client'
import { validateEmailRequest } from '@/lib/auth/identity-validation'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  try {
    const validation = validateEmailRequest(await readBoundedJson(request))
    if (!validation.success)
      return localProblem(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
        correlationId,
        validation.violations,
      )
    await identityClient.requestEmailVerification(
      validation.value,
      correlationId,
    )
    return acceptedResponse(correlationId)
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
