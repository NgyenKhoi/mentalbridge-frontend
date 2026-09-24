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
import { validUtcInstant } from '@/lib/consultation/consultation-validation'

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'USER',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const from = request.nextUrl.searchParams.get('from')
  const to = request.nextUrl.searchParams.get('to')
  if ((from && !validUtcInstant(from)) || (to && !validUtcInstant(to)))
    return carryConsultationSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Khoảng thời gian không hợp lệ.',
        correlationId,
      ),
      actor,
    )
  const query = new URLSearchParams()
  if (from) query.set('from', from)
  if (to) query.set('to', to)
  try {
    const result = await consultationClient.bookableSlots(
      actor.accessToken,
      correlationId,
      query.size ? `?${query}` : '',
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
