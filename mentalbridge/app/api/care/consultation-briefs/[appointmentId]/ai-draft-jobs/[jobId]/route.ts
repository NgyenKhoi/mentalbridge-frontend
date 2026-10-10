import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedCareUser,
  careAuthenticationFailure,
  carryCareSession,
} from '@/lib/care/authenticated-user'
import {
  careErrorResponse,
  careSuccessResponse,
  localProblem,
} from '@/lib/care/bff-response'
import { careClient } from '@/lib/care/care-client'
import { isUuid } from '@/lib/care/care-validation'

export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/care/consultation-briefs/[appointmentId]/ai-draft-jobs/[jobId]'>,
) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }
  const { appointmentId, jobId } = await context.params
  if (!isUuid(appointmentId) || !isUuid(jobId))
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'AI consultation brief draft job is invalid.',
        correlationId,
      ),
      user,
    )
  try {
    return carryCareSession(
      careSuccessResponse(
        await careClient.consultationBriefAiDraftJob(
          user.accessToken,
          appointmentId,
          jobId,
          correlationId,
        ),
        correlationId,
      ),
      user,
    )
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}
