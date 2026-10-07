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
  parseResolveAppointmentDisputeInput,
  validEtag,
  validIdempotencyKey,
  validUuid,
} from '@/lib/consultation/consultation-validation'

type Context =
  RouteContext<'/api/consultation/admin/appointment-disputes/[disputeId]/resolve'>

export async function POST(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'ADMIN',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const { disputeId } = await context.params
  const etag = request.headers.get('If-Match')
  const idempotencyKey = request.headers.get('Idempotency-Key')
  if (
    !validUuid(disputeId) ||
    !validEtag(etag) ||
    !validIdempotencyKey(idempotencyKey)
  )
    return carryConsultationSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Quyết định xem xét không hợp lệ.',
        correlationId,
      ),
      actor,
    )
  try {
    const body = parseResolveAppointmentDisputeInput(
      await readBoundedJson(request, 512),
    )
    const result = await consultationClient.resolveAppointmentDispute(
      actor.accessToken,
      correlationId,
      disputeId,
      body,
      etag,
      idempotencyKey,
    )
    return carryConsultationSession(
      consultationSuccess(result.data, correlationId, result.etag),
      actor,
    )
  } catch (error) {
    if (error instanceof RequestBodyError)
      return carryConsultationSession(
        localProblem(error.status, error.code, error.message, correlationId),
        actor,
      )
    if (error instanceof ConsultationInputError)
      return carryConsultationSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Quyết định xem xét không hợp lệ.',
          correlationId,
        ),
        actor,
      )
    return carryConsultationSession(
      consultationFailure(error, correlationId),
      actor,
    )
  }
}
