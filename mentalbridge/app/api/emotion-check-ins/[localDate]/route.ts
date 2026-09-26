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
  isLocalDate,
  parseEmotionValue,
} from '@/lib/emotion-check-in/validation'
import {
  authenticatedJournalUser,
  carryJournalSession,
  journalAuthenticationFailure,
} from '@/lib/journal/authenticated-user'

type Context = RouteContext<'/api/emotion-check-ins/[localDate]'>

async function user(request: NextRequest, correlationId: string) {
  try {
    return { value: await authenticatedJournalUser(request, correlationId) }
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
      'Ngày ghi nhận cảm xúc không hợp lệ.',
      correlationId,
    )
  const resolved = await user(request, correlationId)
  if (!resolved.value) return resolved.response
  try {
    return carryJournalSession(
      emotionSuccessResponse(
        await emotionCheckInClient.get(
          resolved.value.accessToken,
          localDate,
          correlationId,
        ),
        correlationId,
      ),
      resolved.value,
    )
  } catch (error) {
    return carryJournalSession(
      emotionErrorResponse(error, correlationId),
      resolved.value,
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
      'Ngày ghi nhận cảm xúc không hợp lệ.',
      correlationId,
    )
  const resolved = await user(request, correlationId)
  if (!resolved.value) return resolved.response
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
          'Dữ liệu ghi nhận cảm xúc không hợp lệ.',
          correlationId,
        ),
        resolved.value,
      )
    return carryJournalSession(
      emotionSuccessResponse(
        await emotionCheckInClient.update(
          resolved.value.accessToken,
          localDate,
          revision,
          body,
          key,
          correlationId,
        ),
        correlationId,
      ),
      resolved.value,
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
        resolved.value,
      )
    return carryJournalSession(
      emotionErrorResponse(error, correlationId),
      resolved.value,
    )
  }
}
