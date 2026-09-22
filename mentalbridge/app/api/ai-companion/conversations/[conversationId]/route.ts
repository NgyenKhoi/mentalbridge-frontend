import { NextResponse, type NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
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
import { isConversationId } from '@/lib/companion/companion-validation'

type Context = RouteContext<'/api/ai-companion/conversations/[conversationId]'>

async function user(request: NextRequest, correlationId: string) {
  try {
    return { value: await authenticatedJournalUser(request, correlationId) }
  } catch (error) {
    return { response: journalAuthenticationFailure(error, correlationId) }
  }
}

export async function GET(request: NextRequest, { params }: Context) {
  const correlationId = correlationIdFrom(request)
  const { conversationId } = await params
  if (!isConversationId(conversationId))
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Mã cuộc trò chuyện không hợp lệ.',
      correlationId,
    )
  const resolved = await user(request, correlationId)
  if (!resolved.value) return resolved.response
  try {
    return carryJournalSession(
      companionSuccessResponse(
        await companionClient.get(
          resolved.value.accessToken,
          conversationId,
          correlationId,
        ),
        correlationId,
      ),
      resolved.value,
    )
  } catch (error) {
    return carryJournalSession(
      companionErrorResponse(error, correlationId),
      resolved.value,
    )
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const correlationId = correlationIdFrom(request)
  const { conversationId } = await params
  if (!isConversationId(conversationId))
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Mã cuộc trò chuyện không hợp lệ.',
      correlationId,
    )
  const resolved = await user(request, correlationId)
  if (!resolved.value) return resolved.response
  try {
    await companionClient.remove(
      resolved.value.accessToken,
      conversationId,
      correlationId,
    )
    const response = new NextResponse(null, { status: 204 })
    response.headers.set('X-Correlation-Id', correlationId)
    response.headers.set('Cache-Control', 'no-store')
    return carryJournalSession(response, resolved.value)
  } catch (error) {
    return carryJournalSession(
      companionErrorResponse(error, correlationId),
      resolved.value,
    )
  }
}
