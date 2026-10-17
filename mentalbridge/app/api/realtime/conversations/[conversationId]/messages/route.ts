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

export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/realtime/conversations/[conversationId]/messages'>,
) {
  const correlationId = correlationIdFrom(request)
  const { conversationId } = await context.params
  if (!/^[0-9a-f-]{36}$/i.test(conversationId))
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Conversation is invalid.',
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
  const query = new URLSearchParams()
  const limit = request.nextUrl.searchParams.get('limit')
  const cursor = request.nextUrl.searchParams.get('cursor')
  if (limit) query.set('limit', limit)
  if (cursor) query.set('cursor', cursor)
  try {
    const suffix = query.size ? `?${query.toString()}` : ''
    return carryConsultationSession(
      consultationSuccess(
        await realtimeServerClient.history(
          actor.accessToken,
          correlationId,
          conversationId,
          suffix,
        ),
        correlationId,
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
        'Không thể tải lịch sử chat lúc này.',
        correlationId,
      ),
      actor,
    )
  }
}
