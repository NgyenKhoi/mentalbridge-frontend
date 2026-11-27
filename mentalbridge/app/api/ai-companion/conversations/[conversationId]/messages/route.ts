import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  authenticatedJournalUser,
  carryJournalSession,
  journalAuthenticationFailure,
} from '@/lib/journal/authenticated-user'
import {
  companionErrorResponse,
  companionSuccessResponse,
  localProblem,
} from '@/lib/companion/bff-response'
import { companionClient } from '@/lib/companion/companion-client'
import {
  isConversationId,
  isIdempotencyKey,
  parseSendInput,
} from '@/lib/companion/companion-validation'

type Context =
  RouteContext<'/api/ai-companion/conversations/[conversationId]/messages'>

export async function POST(request: NextRequest, { params }: Context) {
  const correlationId = correlationIdFrom(request)
  const { conversationId } = await params
  const key = request.headers.get('Idempotency-Key')
  if (!isConversationId(conversationId) || !isIdempotencyKey(key))
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Yêu cầu gửi tin nhắn không hợp lệ.',
      correlationId,
    )
  let user: Awaited<ReturnType<typeof authenticatedJournalUser>>
  try {
    user = await authenticatedJournalUser(request, correlationId)
  } catch (error) {
    return journalAuthenticationFailure(error, correlationId)
  }
  try {
    const body = parseSendInput(await readBoundedJson(request, 16 * 1024))
    if (!body)
      return carryJournalSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Tin nhắn hoặc lựa chọn bối cảnh không hợp lệ.',
          correlationId,
        ),
        user,
      )
    return carryJournalSession(
      companionSuccessResponse(
        await companionClient.send(
          user.accessToken,
          conversationId,
          body,
          key,
          correlationId,
        ),
        correlationId,
        201,
      ),
      user,
    )
  } catch (error) {
    if (error instanceof RequestBodyError)
      return carryJournalSession(
        localProblem(
          error.status,
          error.code,
          error.message,
          correlationId,
          error.violations,
        ),
        user,
      )
    return carryJournalSession(
      companionErrorResponse(error, correlationId),
      user,
    )
  }
}
