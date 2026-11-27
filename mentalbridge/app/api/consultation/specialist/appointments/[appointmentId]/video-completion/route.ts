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
  validUuid,
  validEtag,
  validIdempotencyKey,
} from '@/lib/consultation/consultation-validation'

export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/consultation/specialist/appointments/[appointmentId]/video-completion'>,
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
  const { appointmentId } = await context.params
  const etag = request.headers.get('If-Match')
  const key = request.headers.get('Idempotency-Key')
  if (
    !validUuid(appointmentId) ||
    !validIdempotencyKey(key) ||
    request.nextUrl.search
  )
    return carryConsultationSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Xác nhận không hợp lệ.',
        correlationId,
      ),
      actor,
    )
  if (!validEtag(etag))
    return carryConsultationSession(
      localProblem(
        428,
        'APPOINTMENT_VERSION_REQUIRED',
        'Cần tải trạng thái lịch hẹn hiện tại.',
        correlationId,
      ),
      actor,
    )
  try {
    const body = await readBoundedJson(request)
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !('confirmation' in body) ||
      body.confirmation !== 'CONSULTATION_FINISHED'
    )
      return carryConsultationSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Xác nhận không hợp lệ.',
          correlationId,
        ),
        actor,
      )
    const result = await consultationClient.videoCompletion(
      actor.accessToken,
      correlationId,
      appointmentId,
      etag,
      key,
    )
    return carryConsultationSession(
      consultationSuccess(
        result.data,
        correlationId,
        result.etag,
        result.status,
      ),
      actor,
    )
  } catch (error) {
    if (error instanceof RequestBodyError)
      return carryConsultationSession(
        localProblem(error.status, error.code, error.message, correlationId),
        actor,
      )
    return carryConsultationSession(
      consultationFailure(error, correlationId),
      actor,
    )
  }
}
