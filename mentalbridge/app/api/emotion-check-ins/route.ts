import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  emotionErrorResponse,
  emotionSuccessResponse,
  localProblem,
} from '@/lib/emotion-check-in/bff-response'
import { emotionCheckInClient } from '@/lib/emotion-check-in/client'
import {
  isIdempotencyKey,
  parseEmotionCreate,
} from '@/lib/emotion-check-in/validation'
import {
  authenticatedJournalUser,
  carryJournalSession,
  journalAuthenticationFailure,
} from '@/lib/journal/authenticated-user'

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedJournalUser>>
  try {
    user = await authenticatedJournalUser(request, correlationId)
  } catch (error) {
    return journalAuthenticationFailure(error, correlationId)
  }
  try {
    const key = request.headers.get('Idempotency-Key')
    const body = parseEmotionCreate(await readBoundedJson(request))
    if (!isIdempotencyKey(key) || !body)
      return carryJournalSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Dữ liệu ghi nhận cảm xúc không hợp lệ.',
          correlationId,
        ),
        user,
      )
    return carryJournalSession(
      emotionSuccessResponse(
        await emotionCheckInClient.create(
          user.accessToken,
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
    return carryJournalSession(emotionErrorResponse(error, correlationId), user)
  }
}
