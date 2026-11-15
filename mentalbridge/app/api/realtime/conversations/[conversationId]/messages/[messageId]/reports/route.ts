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

const reasons = new Set([
  'HARASSMENT',
  'PRIVACY_CONCERN',
  'SELF_HARM_OR_CRISIS_CONCERN',
  'SPAM',
  'SEXUAL_OR_VIOLENT_CONTENT',
  'OTHER',
])

export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/realtime/conversations/[conversationId]/messages/[messageId]/reports'>,
) {
  const correlationId = correlationIdFrom(request)
  const { conversationId, messageId } = await context.params
  const idempotencyKey = request.headers.get('idempotency-key')
  const body = (await request.json().catch(() => null)) as {
    reason?: unknown
  } | null
  if (
    !validId(conversationId) ||
    !validId(messageId) ||
    !idempotencyKey ||
    typeof body?.reason !== 'string' ||
    !reasons.has(body.reason)
  )
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Yêu cầu báo cáo tin nhắn không hợp lệ.',
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
        await realtimeServerClient.reportMessage(
          actor.accessToken,
          correlationId,
          conversationId,
          messageId,
          idempotencyKey,
          { reason: body.reason },
        ),
        correlationId,
      ),
      actor,
    )
  } catch (error) {
    const response =
      error instanceof RealtimeServiceError
        ? localProblem(error.status, error.code, error.message, correlationId)
        : localProblem(
            503,
            'REALTIME_UNAVAILABLE',
            'Chưa thể gửi báo cáo lúc này.',
            correlationId,
          )
    return carryConsultationSession(response, actor)
  }
}

function validId(value: string) {
  return /^[0-9a-f-]{36}$/i.test(value)
}
