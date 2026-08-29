import type { NextRequest } from 'next/server'

import {
  correlationIdFrom,
  identityErrorResponse,
  localProblem,
  successResponse,
} from '@/lib/auth/bff-response'
import { identityClient } from '@/lib/auth/identity-client'
import { validateChallengeRequest } from '@/lib/auth/identity-validation'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)

  try {
    const body = await readBoundedJson(request)
    const validation = validateChallengeRequest(body)

    if (!validation.success) {
      return localProblem(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
        correlationId,
        validation.violations,
      )
    }

    const account = await identityClient.verifyEmail(
      validation.value,
      correlationId,
    )

    if (account.status !== 'ACTIVE' || !account.emailVerified) {
      return localProblem(
        502,
        'IDENTITY_MALFORMED_RESPONSE',
        'Identity returned an invalid response.',
        correlationId,
      )
    }

    return successResponse({ verified: true }, correlationId)
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
