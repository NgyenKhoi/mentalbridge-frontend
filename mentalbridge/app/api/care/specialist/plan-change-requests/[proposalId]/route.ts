import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedCareActor,
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
  context: RouteContext<'/api/care/specialist/plan-change-requests/[proposalId]'>,
) {
  const correlationId = correlationIdFrom(request)
  let specialist: Awaited<ReturnType<typeof authenticatedCareActor>>
  try {
    specialist = await authenticatedCareActor(request, correlationId, [
      'SPECIALIST',
    ])
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }
  const { proposalId } = await context.params
  if (!isUuid(proposalId)) {
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'A valid proposal id is required.',
        correlationId,
      ),
      specialist,
    )
  }
  try {
    return carryCareSession(
      careSuccessResponse(
        await careClient.specialistPlanChangeRequestByProposal(
          specialist.accessToken,
          proposalId,
          correlationId,
        ),
        correlationId,
      ),
      specialist,
    )
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), specialist)
  }
}
