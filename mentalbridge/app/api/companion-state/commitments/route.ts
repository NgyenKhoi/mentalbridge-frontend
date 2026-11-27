import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  companionErrorResponse,
  companionSuccessResponse,
  localProblem,
} from '@/lib/companion-state/bff-response'
import { companionStateClient } from '@/lib/companion-state/client'
import { parseCreateCommitment } from '@/lib/companion-state/validation'
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
    const body = parseCreateCommitment(await readBoundedJson(request))
    if (!body)
      return carryJournalSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Dữ liệu lời hẹn không hợp lệ.',
          correlationId,
        ),
        user,
      )
    return carryJournalSession(
      companionSuccessResponse(
        await companionStateClient.createCommitment(
          user.accessToken,
          body,
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
