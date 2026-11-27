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

// Returns the full account number and holder name for the manual check: never log or cache it.
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ destinationId: string }> },
) {
  const correlationId = correlationIdFrom(request)
  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'ADMIN',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const { destinationId } = await props.params
  try {
    const result = await consultationClient.adminPayoutDestinationDetail(
      actor.accessToken,
      correlationId,
      destinationId,
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
