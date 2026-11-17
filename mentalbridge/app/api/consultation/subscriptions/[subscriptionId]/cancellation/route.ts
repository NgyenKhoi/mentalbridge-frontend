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
  validIdempotencyKey,
  validUuid,
} from '@/lib/consultation/consultation-validation'

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ subscriptionId: string }> },
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
  const { subscriptionId } = await props.params
  const idempotencyKey = request.headers.get('Idempotency-Key')
  if (!validUuid(subscriptionId) || !validIdempotencyKey(idempotencyKey)) {
    return carryConsultationSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'YÃªu cáº§u há»§y gÃ³i khÃ´ng há»£p lá»‡.',
        correlationId,
      ),
      actor,
    )
  }
  try {
    const result = await consultationClient.cancelSubscription(
      actor.accessToken,
      correlationId,
      subscriptionId,
      idempotencyKey,
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
