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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ specialistId: string }> },
) {
  const correlationId = correlationIdFrom(request)
  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'USER',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const { specialistId } = await context.params
  if (!validUuid(specialistId))
    return carryConsultationSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Mã chuyên gia không hợp lệ.',
        correlationId,
      ),
      actor,
    )
  try {
    const result = await consultationClient.publicCredentialBadges(
      actor.accessToken,
      correlationId,
      specialistId,
    )
    return carryConsultationSession(
      consultationSuccess(result.data, correlationId),
      actor,
    )
  } catch (error) {
    return carryConsultationSession(
      consultationFailure(error, correlationId),
      actor,
    )
  }
}
