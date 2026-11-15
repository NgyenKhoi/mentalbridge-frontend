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

export async function DELETE(
  request: NextRequest,
  context: RouteContext<'/api/realtime/conversations/[conversationId]/messages/[messageId]'>,
) {
  const correlationId = correlationIdFrom(request)
  const { conversationId, messageId } = await context.params
  const idempotencyKey = request.headers.get('idempotency-key')
  if (!validId(conversationId) || !validId(messageId) || !idempotencyKey)
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Yêu cầu xóa tin nhắn không hợp lệ.',
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
        await realtimeServerClient.removeOwnMessage(
          actor.accessToken,
          correlationId,
          conversationId,
          messageId,
          idempotencyKey,
        ),
        correlationId,
      ),
      actor,
    )
  } catch (error) {
    return failure(error, correlationId, actor)
  }
}

function validId(value: string) {
  return /^[0-9a-f-]{36}$/i.test(value)
}

function failure(
  error: unknown,
  correlationId: string,
  actor: Awaited<ReturnType<typeof authenticatedConsultationActor>>,
) {
  const response =
    error instanceof RealtimeServiceError
      ? localProblem(error.status, error.code, error.message, correlationId)
      : localProblem(
          503,
          'REALTIME_UNAVAILABLE',
          'Chưa thể xóa tin nhắn lúc này.',
          correlationId,
        )
  return carryConsultationSession(response, actor)
}
