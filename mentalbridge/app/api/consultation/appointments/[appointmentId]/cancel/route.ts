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
  context: RouteContext<'/api/consultation/appointments/[appointmentId]/cancel'>,
) {
  const correlationId = correlationIdFrom(request)
  let current
  try {
    current = await authenticatedConsultationActor(request, correlationId, [
      'USER',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const { appointmentId } = await context.params
  const etag = request.headers.get('If-Match')
  const key = request.headers.get('Idempotency-Key')
  if (!validUuid(appointmentId) || !validIdempotencyKey(key))
    return carryConsultationSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Lịch hẹn hoặc khóa yêu cầu không hợp lệ.',
        correlationId,
      ),
      current,
    )
  if (!validEtag(etag))
    return carryConsultationSession(
      localProblem(
        428,
        'APPOINTMENT_VERSION_REQUIRED',
        'Phiên bản hiện tại của lịch hẹn là bắt buộc.',
        correlationId,
      ),
      current,
    )
  try {
    const result = await consultationClient.cancelAppointment(
      current.accessToken,
      correlationId,
      appointmentId,
      etag,
      key,
    )
    return carryConsultationSession(
      consultationSuccess(result.data, correlationId, result.etag),
      current,
    )
  } catch (error) {
    return carryConsultationSession(
      consultationFailure(error, correlationId),
      current,
    )
  }
}
