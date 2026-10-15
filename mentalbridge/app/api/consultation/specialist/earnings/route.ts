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
} from '@/lib/consultation/bff-response'
import { consultationClient } from '@/lib/consultation/consultation-client'
import {
  isSpecialistMockEnabled,
  specialistMockService,
} from '@/lib/mock/specialist-mock-service'

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const mockEnabled = isSpecialistMockEnabled(request)

  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'SPECIALIST',
    ])
  } catch (error) {
    if (mockEnabled) {
      return consultationSuccess(
        specialistMockService.getEarnings(),
        correlationId,
      )
    }
    return consultationAuthenticationFailure(error, correlationId)
  }

  if (mockEnabled) {
    return carryConsultationSession(
      consultationSuccess(
        specialistMockService.getEarnings(),
        correlationId,
      ),
      actor,
    )
  }

  try {
    const result = await consultationClient.specialistEarnings(
      actor.accessToken,
      correlationId,
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
