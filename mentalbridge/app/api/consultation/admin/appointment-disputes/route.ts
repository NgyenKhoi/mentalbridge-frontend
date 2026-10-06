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

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'ADMIN',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const status = new URL(request.url).searchParams.get('status') ?? 'OPEN'
  if (status !== 'OPEN' && status !== 'RESOLVED')
    return carryConsultationSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Trạng thái xem xét không hợp lệ.',
        correlationId,
      ),
      actor,
    )
  try {
    const result = await consultationClient.appointmentDisputes(
      actor.accessToken,
      correlationId,
      status,
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
