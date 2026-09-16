import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  authenticatedJournalUser,
  carryJournalSession,
  journalAuthenticationFailure,
} from '@/lib/journal/authenticated-user'
import {
  emotionErrorResponse,
  emotionSuccessResponse,
  localProblem,
} from '@/lib/emotion-check-in/bff-response'
import { emotionCheckInClient } from '@/lib/emotion-check-in/client'
import {
  isIdempotencyKey,
  isLocalDate,
  parseEmotionValue,
} from '@/lib/emotion-check-in/validation'

type Context = RouteContext<'/api/emotion-check-ins/[localDate]'>

async function authenticated(request: NextRequest, correlationId: string) {
  try {
    return { user: await authenticatedJournalUser(request, correlationId) }
  } catch (error) {
    return { response: journalAuthenticationFailure(error, correlationId) }
  }
}

export async function GET(request: NextRequest, { params }: Context) {
  const correlationId = correlationIdFrom(request)
  const { localDate } = await params
  if (!isLocalDate(localDate))
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Ngày ghi nhận không hợp lệ.',
      correlationId,
    )
  const session = await authenticated(request, correlationId)
  if (!session.user) return session.response
  try {
    return carryJournalSession(
      emotionSuccessResponse(
        await emotionCheckInClient.get(
          session.user.accessToken,
          localDate,
          correlationId,
        ),
        correlationId,
      ),
      session.user,
    )
  } catch (error) {
    return carryJournalSession(
      emotionErrorResponse(error, correlationId),
      session.user,
    )
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const correlationId = correlationIdFrom(request)
  const { localDate } = await params
  if (!isLocalDate(localDate))
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Ngày ghi nhận không hợp lệ.',
      correlationId,
    )
  const session = await authenticated(request, correlationId)
  if (!session.user) return session.response
  try {
    const key = request.headers.get('Idempotency-Key')
    const revision = Number(request.headers.get('If-Match-Revision'))
    const body = parseEmotionValue(await readBoundedJson(request))
    if (
      !isIdempotencyKey(key) ||
      !Number.isInteger(revision) ||
      revision < 1 ||
      revision > 32 ||
      !body
    )
      return carryJournalSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Dữ liệu cảm xúc chưa hợp lệ.',
          correlationId,
        ),
        session.user,
      )
    return carryJournalSession(
      emotionSuccessResponse(
        await emotionCheckInClient.update(
          session.user.accessToken,
          localDate,
          revision,
          body,
          key,
          correlationId,
        ),
        correlationId,
      ),
      session.user,
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
        session.user,
      )
    return carryJournalSession(
      emotionErrorResponse(error, correlationId),
      session.user,
    )
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const correlationId = correlationIdFrom(request)
  const { localDate } = await params
  const key = request.headers.get('Idempotency-Key')
  if (!isLocalDate(localDate) || !isIdempotencyKey(key))
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Yêu cầu xóa không hợp lệ.',
      correlationId,
    )
  const session = await authenticated(request, correlationId)
  if (!session.user) return session.response
  try {
    return carryJournalSession(
      emotionSuccessResponse(
        await emotionCheckInClient.remove(
          session.user.accessToken,
          localDate,
          key,
          correlationId,
        ),
        correlationId,
      ),
      session.user,
    )
  } catch (error) {
    return carryJournalSession(
      emotionErrorResponse(error, correlationId),
      session.user,
    )
  }
}
