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
  ConsultationInputError,
  discoveryQuery,
  validUuid,
} from '@/lib/consultation/consultation-validation'

type Context = { params: Promise<{ specialistId: string }> }

export async function GET(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'USER',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  try {
    const { specialistId } = await context.params
    if (!validUuid(specialistId))
      throw new ConsultationInputError('specialistId')
    const query = discoveryQuery(request.nextUrl.searchParams, true)
    const result = await consultationClient.discoveredSpecialist(
      actor.accessToken,
      correlationId,
      specialistId,
      query,
    )
    return carryConsultationSession(
      consultationSuccess(result.data, correlationId),
      actor,
    )
  } catch (error) {
    if (error instanceof ConsultationInputError)
      return carryConsultationSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Yêu cầu xem chuyên gia không hợp lệ.',
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
