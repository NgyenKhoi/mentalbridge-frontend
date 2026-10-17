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

type Context = { params: Promise<{ specialistId: string }> }

export async function GET(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  const { specialistId } = await context.params
  if (!validUuid(specialistId))
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Mã chuyên gia không hợp lệ.',
      correlationId,
    )
  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'ADMIN',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  try {
    const result = await consultationClient.detail(
      actor.accessToken,
      correlationId,
      specialistId,
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
