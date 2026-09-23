import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
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
  isJournalId,
  isJournalRevision,
} from '@/lib/journal/journal-validation'

type Context = {
  params: Promise<{ journalId: string; revision: string }>
}

export async function POST(request: NextRequest, { params }: Context) {
  const correlationId = correlationIdFrom(request)
  const { journalId, revision: revisionValue } = await params
  const revision = Number(revisionValue)
  const key = request.headers.get('Idempotency-Key')
  if (
    !isJournalId(journalId) ||
    !/^\d+$/.test(revisionValue) ||
    !isJournalRevision(revision) ||
    !isIdempotencyKey(key)
  )
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Yêu cầu phân tích nhật ký không hợp lệ.',
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
        await journalClient.requestAnalysis(
          user.accessToken,
          journalId,
          revision,
          key,
          correlationId,
        ),
        correlationId,
        202,
      ),
      user,
    )
  } catch (error) {
    return carryJournalSession(journalErrorResponse(error, correlationId), user)
  }
}
