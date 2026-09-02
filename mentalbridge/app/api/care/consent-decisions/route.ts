import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  authenticatedCareUser,
  careAuthenticationFailure,
  carryCareSession,
} from '@/lib/care/authenticated-user'
import {
  careErrorResponse,
  careSuccessResponse,
  localProblem,
} from '@/lib/care/bff-response'
import { careClient } from '@/lib/care/care-client'
import {
  isCareIdempotencyKey,
  parseConsentRequest,
} from '@/lib/care/care-validation'

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }
  try {
    const key = request.headers.get('Idempotency-Key')
    const decision = parseConsentRequest(await readBoundedJson(request))
    if (!isCareIdempotencyKey(key) || !decision)
      return carryCareSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Request validation failed.',
          correlationId,
        ),
        user,
      )
    return carryCareSession(
      careSuccessResponse(
        await careClient.recordConsent(
          user.accessToken,
          decision,
          key,
          correlationId,
        ),
        correlationId,
        201,
      ),
      user,
    )
  } catch (error) {
    if (error instanceof RequestBodyError)
      return carryCareSession(
        localProblem(
          error.status,
          error.code,
          error.message,
          correlationId,
          error.violations,
        ),
        user,
      )
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}
