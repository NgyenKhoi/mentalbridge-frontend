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

export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/consultation/appointments/[appointmentId]/chat-eligibility'>,
) {
  const correlationId = correlationIdFrom(request)
  const { appointmentId } = await context.params
  const operation = request.nextUrl.searchParams.get('operation')?.toUpperCase()
  if (!['SUBSCRIBE', 'SEND', 'HISTORY'].includes(operation ?? ''))
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Operation is invalid.',
      correlationId,
    )
  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'USER',
      'SPECIALIST',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  try {
    const result = await consultationClient.chatEligibility(
      actor.accessToken,
      correlationId,
      appointmentId,
      operation as 'SUBSCRIBE' | 'SEND' | 'HISTORY',
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
