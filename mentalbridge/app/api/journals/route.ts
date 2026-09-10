import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  authenticatedJournalUser,
  carryJournalSession,
  journalAuthenticationFailure,
} from '@/lib/journal/authenticated-user'
import {
  journalErrorResponse,
  journalSuccessResponse,
  localProblem,
} from '@/lib/journal/bff-response'
import { journalClient } from '@/lib/journal/journal-client'
import {
  isIdempotencyKey,
  parseJournalCreate,
} from '@/lib/journal/journal-validation'

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined
  if ((cursor?.length ?? 0) > 512)
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Dữ liệu nhật ký không hợp lệ.',
      correlationId,
    )
  let user: Awaited<ReturnType<typeof authenticatedJournalUser>>
  try {
    user = await authenticatedJournalUser(request, correlationId)
  } catch (error) {
    return journalAuthenticationFailure(error, correlationId)
  }
  try {
    return carryJournalSession(
      journalSuccessResponse(
        await journalClient.list(user.accessToken, cursor, correlationId),
        correlationId,
      ),
      user,
    )
  } catch (error) {
    return carryJournalSession(journalErrorResponse(error, correlationId), user)
  }
}

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
    const body = parseJournalCreate(await readBoundedJson(request))
    if (!isIdempotencyKey(key) || !body)
      return carryJournalSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Dữ liệu nhật ký không hợp lệ.',
          correlationId,
        ),
        user,
      )
    return carryJournalSession(
      journalSuccessResponse(
        await journalClient.create(user.accessToken, body, key, correlationId),
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
    return carryJournalSession(journalErrorResponse(error, correlationId), user)
  }
}
