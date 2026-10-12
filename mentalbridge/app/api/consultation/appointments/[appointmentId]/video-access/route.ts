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
import { validUuid } from '@/lib/consultation/consultation-validation'

export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/consultation/appointments/[appointmentId]/video-access'>,
) {
  const correlationId = correlationIdFrom(request)
  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'USER',
      'SPECIALIST',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const { appointmentId } = await context.params
  if (
    !validUuid(appointmentId) ||
    request.nextUrl.search ||
    request.body !== null
  )
    return carryConsultationSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Yêu cầu tham gia không hợp lệ.',
        correlationId,
      ),
      actor,
    )
  try {
    const result = await consultationClient.videoAccess(
      actor.accessToken,
      correlationId,
      appointmentId,
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
