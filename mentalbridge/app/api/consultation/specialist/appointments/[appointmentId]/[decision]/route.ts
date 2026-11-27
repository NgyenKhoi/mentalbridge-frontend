import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
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
  validEtag,
  validIdempotencyKey,
  validUuid,
} from '@/lib/consultation/consultation-validation'

export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/consultation/specialist/appointments/[appointmentId]/[decision]'>,
) {
  const correlationId = correlationIdFrom(request)
  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'SPECIALIST',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const { appointmentId, decision } = await context.params
  const etag = request.headers.get('If-Match')
  const idempotencyKey = request.headers.get('Idempotency-Key')
  if (
    !validUuid(appointmentId) ||
    !['accept', 'reject'].includes(decision) ||
    !validEtag(etag) ||
    !validIdempotencyKey(idempotencyKey)
  )
    return carryConsultationSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Yêu cầu xử lý lịch hẹn không hợp lệ.',
        correlationId,
      ),
      actor,
    )
  try {
    const result = await consultationClient.decideAppointment(
      actor.accessToken,
      correlationId,
      appointmentId,
      decision as 'accept' | 'reject',
      etag,
      idempotencyKey,
    )
    return carryConsultationSession(
      consultationSuccess(result.data, correlationId, result.etag),
      actor,
    )
  } catch (error) {
    return carryConsultationSession(
      consultationFailure(error, correlationId),
      actor,
    )
  }
}
