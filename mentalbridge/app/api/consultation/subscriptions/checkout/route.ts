import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  authenticatedConsultationActor,
  carryConsultationSession,
  consultationAuthenticationFailure,
} from '@/lib/consultation/authenticated-actor'
import { parseCheckoutInput } from '@/lib/consultation/billing-validation'
import {
  consultationFailure,
  consultationSuccess,
  localProblem,
} from '@/lib/consultation/bff-response'
import { consultationClient } from '@/lib/consultation/consultation-client'
import { validIdempotencyKey } from '@/lib/consultation/consultation-validation'

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'USER',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const idempotencyKey = request.headers.get('Idempotency-Key')
  if (!validIdempotencyKey(idempotencyKey)) {
    return carryConsultationSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Yêu cầu thanh toán không hợp lệ.',
        correlationId,
      ),
      actor,
    )
  }
  try {
    const input = parseCheckoutInput(await readBoundedJson(request, 2 * 1024))
    const result = await consultationClient.planCheckout(
      actor.accessToken,
      correlationId,
      input.planVersionId,
      idempotencyKey,
    )
    return carryConsultationSession(
      consultationSuccess(result.data, correlationId, null, 201),
      actor,
    )
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return carryConsultationSession(
        localProblem(
          error.status,
          error.code,
          error.message,
          correlationId,
          error.violations,
        ),
        actor,
      )
    }
    if (error instanceof Error && error.message === 'planVersionId') {
      return carryConsultationSession(
        localProblem(
          422,
          'VALIDATION_FAILED',
          'Phiên bản gói không hợp lệ.',
          correlationId,
        ),
        actor,
      )
    }
    return carryConsultationSession(
      consultationFailure(error, correlationId),
      actor,
    )
  }
}
