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

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }
  const purpose = request.nextUrl.searchParams.get('purpose') ?? 'INITIAL_CHECK'
  if (purpose !== 'INITIAL_CHECK' && purpose !== 'REASSESSMENT')
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Invalid screening purpose.',
        correlationId,
      ),
      user,
    )
  try {
    const episode = await careClient.currentScreeningEpisode(
      user.accessToken,
      purpose,
      correlationId,
    )
    if (episode.purpose !== purpose)
      return carryCareSession(
        localProblem(
          502,
          'CARE_MALFORMED_RESPONSE',
          'Invalid screening response.',
          correlationId,
        ),
        user,
      )
    if (
      episode.status !== 'COMPLETED' ||
      !episode.supportEvaluationId ||
      !isUuid(episode.supportEvaluationId)
    )
      return carryCareSession(
        localProblem(
          409,
          purpose === 'REASSESSMENT'
            ? 'REASSESSMENT_INCOMPLETE'
            : 'INITIAL_CHECK_INCOMPLETE',
          'Complete the current screening before proposing a plan.',
          correlationId,
        ),
        user,
      )
    return carryCareSession(
      careSuccessResponse(
        { sourceSupportEvaluationId: episode.supportEvaluationId },
        correlationId,
      ),
      user,
    )
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}
