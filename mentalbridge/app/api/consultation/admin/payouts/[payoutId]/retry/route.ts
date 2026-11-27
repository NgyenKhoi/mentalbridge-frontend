import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  authenticatedConsultationActor,
  carryConsultationSession,
  consultationAuthenticationFailure,
} from '@/lib/consultation/authenticated-actor'
import {
  consultationFailure,
  consultationSuccess,
  localProblem,
} from '@/lib/consultation/bff-response'
import { consultationClient } from '@/lib/consultation/consultation-client'
import {
  ConsultationInputError,
  parseRetryPayoutInput,
  validIdempotencyKey,
} from '@/lib/consultation/consultation-validation'

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ payoutId: string }> },
) {
  const correlationId = correlationIdFrom(request)
  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'ADMIN',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const idempotencyKey = request.headers.get('Idempotency-Key')
  if (!validIdempotencyKey(idempotencyKey))
    return carryConsultationSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Idempotency-Key không hợp lệ.',
        correlationId,
      ),
      actor,
    )
  const { payoutId } = await props.params
  try {
    const body = parseRetryPayoutInput(await readBoundedJson(request, 4 * 1024))
    const result = await consultationClient.retryAdminPayout(
      actor.accessToken,
      correlationId,
      payoutId,
      body,
      idempotencyKey,
    )
    return carryConsultationSession(
      consultationSuccess(result.data, correlationId),
      actor,
    )
  } catch (error) {
    if (error instanceof ConsultationInputError)
      return carryConsultationSession(
        localProblem(
          422,
          'VALIDATION_FAILED',
          'Yêu cầu chuyển lại không hợp lệ.',
          correlationId,
          [{ field: error.field, code: 'INVALID_VALUE' }],
        ),
        actor,
      )
    if (error instanceof RequestBodyError)
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
    return carryConsultationSession(
      consultationFailure(error, correlationId),
      actor,
    )
  }
}
