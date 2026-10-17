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
import { validEtag } from '@/lib/consultation/consultation-validation'

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
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
        'PROFILE_VERSION_REQUIRED',
        'Cần phiên bản hồ sơ hiện tại.',
        correlationId,
      ),
      actor,
    )
  try {
    const result = await consultationClient.submit(
      actor.accessToken,
      correlationId,
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
