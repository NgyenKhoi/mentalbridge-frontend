import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedConsultationActor,
  carryConsultationSession,
  consultationAuthenticationFailure,
} from '@/lib/consultation/authenticated-actor'
import {
  consultationSuccess,
  localProblem,
} from '@/lib/consultation/bff-response'
import {
  RealtimeServiceError,
  realtimeServerClient,
} from '@/lib/realtime/server-client'

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  if (!sameOrigin(request))
    return localProblem(
      403,
      'INVALID_ORIGIN',
      'Request origin is invalid.',
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
    return carryConsultationSession(
      consultationSuccess(
        await realtimeServerClient.credential(actor.accessToken, correlationId),
        correlationId,
        null,
        201,
      ),
      actor,
    )
  } catch (error) {
    if (error instanceof RealtimeServiceError)
      return carryConsultationSession(
        localProblem(error.status, error.code, error.message, correlationId),
        actor,
      )
    return carryConsultationSession(
      localProblem(
        503,
        'REALTIME_UNAVAILABLE',
        'Không thể kết nối phòng chat lúc này.',
        correlationId,
      ),
      actor,
    )
  }
}

function sameOrigin(request: NextRequest) {
  const supplied = request.headers.get('origin')
  const host = request.headers.get('host')
  if (!supplied || !host) return false
  try {
    const origin = new URL(supplied)
    return origin.host === host && origin.protocol === request.nextUrl.protocol
  } catch {
    return false
  }
}
