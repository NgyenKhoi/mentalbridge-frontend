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
import { isJournalId } from '@/lib/journal/journal-validation'

type Context = { params: Promise<{ jobId: string }> }

export async function GET(request: NextRequest, { params }: Context) {
  const correlationId = correlationIdFrom(request)
  const { jobId } = await params
  if (!isJournalId(jobId))
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Mã yêu cầu phân tích không hợp lệ.',
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
        await journalClient.analysisJob(user.accessToken, jobId, correlationId),
        correlationId,
      ),
      user,
    )
  } catch (error) {
    return carryJournalSession(journalErrorResponse(error, correlationId), user)
  }
}
