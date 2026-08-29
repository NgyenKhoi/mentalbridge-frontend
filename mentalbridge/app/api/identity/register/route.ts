import type { NextRequest } from 'next/server'

import {
  correlationIdFrom,
  identityErrorResponse,
  localProblem,
  successResponse,
} from '@/lib/auth/bff-response'
import { identityClient } from '@/lib/auth/identity-client'
import {
  isValidIdempotencyKey,
  validateRegistrationRequest,
} from '@/lib/auth/identity-validation'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)

  try {
    const idempotencyKey = request.headers.get('Idempotency-Key')

    if (!isValidIdempotencyKey(idempotencyKey)) {
      return localProblem(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
        correlationId,
        [{ field: 'Idempotency-Key', code: 'INVALID_FORMAT' }],
      )
    }

    const body = await readBoundedJson(request)
    const validation = validateRegistrationRequest(body)

    if (!validation.success) {
      return localProblem(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
        correlationId,
        validation.violations,
      )
    }

    await identityClient.register(
      validation.value,
      idempotencyKey,
      correlationId,
    )

    return successResponse({ registrationPending: true }, correlationId, 201)
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
