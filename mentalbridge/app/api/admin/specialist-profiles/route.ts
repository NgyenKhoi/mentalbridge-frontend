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
import { validSpecialistStatus } from '@/lib/consultation/consultation-validation'

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const status = request.nextUrl.searchParams.get('status') ?? 'PENDING'
  if (!validSpecialistStatus(status))
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Trạng thái hồ sơ không hợp lệ.',
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
    const result = await consultationClient.profiles(
      actor.accessToken,
      correlationId,
      status,
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
