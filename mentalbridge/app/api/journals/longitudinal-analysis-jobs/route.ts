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
  parseCreateLongitudinalAnalysisRequest,
} from '@/lib/journal/journal-validation'

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
    const body = parseCreateLongitudinalAnalysisRequest(
      await readBoundedJson(request),
    )
    if (!isIdempotencyKey(key) || !body)
      return carryJournalSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Dữ liệu phân tích theo thời gian không hợp lệ.',
          correlationId,
        ),
        user,
      )
    return carryJournalSession(
      journalSuccessResponse(
        await journalClient.createLongitudinalAnalysis(
          user.accessToken,
          body,
          key,
          correlationId,
        ),
        correlationId,
        202,
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
