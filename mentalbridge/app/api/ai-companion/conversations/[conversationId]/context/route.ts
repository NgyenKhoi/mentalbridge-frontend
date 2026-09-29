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
  parseContextInput,
} from '@/lib/companion/companion-validation'

type Context =
  RouteContext<'/api/ai-companion/conversations/[conversationId]/context'>

export async function PUT(request: NextRequest, { params }: Context) {
  const correlationId = correlationIdFrom(request)
  const { conversationId } = await params
  if (!isConversationId(conversationId))
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Mã cuộc trò chuyện không hợp lệ.',
      correlationId,
    )
  let user: Awaited<ReturnType<typeof authenticatedJournalUser>>
  try {
    user = await authenticatedJournalUser(request, correlationId)
  } catch (error) {
    return journalAuthenticationFailure(error, correlationId)
  }
  try {
    const body = parseContextInput(await readBoundedJson(request, 16 * 1024))
    if (!body)
      return carryJournalSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Nguồn thông tin đã chọn không hợp lệ.',
          correlationId,
        ),
        user,
      )
    return carryJournalSession(
      companionSuccessResponse(
        await companionClient.updateContext(
          user.accessToken,
          conversationId,
          body,
          correlationId,
        ),
        correlationId,
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
