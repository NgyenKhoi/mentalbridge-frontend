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
  validEtag,
  validUuid,
} from '@/lib/consultation/consultation-validation'

type Context = { params: Promise<{ slotId: string }> }

export async function DELETE(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  const { slotId } = await context.params
  if (!validUuid(slotId))
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Mã khung giờ không hợp lệ.',
      correlationId,
    )
  let actor
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'SPECIALIST',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const etag = request.headers.get('If-Match')
  if (!validEtag(etag))
    return carryConsultationSession(
      localProblem(
        428,
        'AVAILABILITY_SLOT_VERSION_REQUIRED',
        'Cần phiên bản hiện tại của khung giờ.',
        correlationId,
      ),
      actor,
    )
  try {
    const result = await consultationClient.withdrawAvailability(
      actor.accessToken,
      correlationId,
      slotId,
      etag,
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
