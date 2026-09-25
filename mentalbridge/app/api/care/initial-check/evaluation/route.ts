import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedCareUser,
  careAuthenticationFailure,
  carryCareSession,
} from '@/lib/care/authenticated-user'
import { careErrorResponse, careSuccessResponse } from '@/lib/care/bff-response'
import { careClient } from '@/lib/care/care-client'

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const purpose =
    request.nextUrl.searchParams.get('purpose') === 'REASSESSMENT'
      ? ('REASSESSMENT' as const)
      : ('INITIAL_CHECK' as const)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>

  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }

  try {
    const episode = await careClient.currentScreeningEpisode(
      user.accessToken,
      purpose,
      correlationId,
    )
    const outcome = await careClient.evaluateScreeningEpisode(
      user.accessToken,
      episode.episodeId,
      correlationId,
    )
    return carryCareSession(
      careSuccessResponse(outcome.presentationEvaluation, correlationId, 201),
      user,
    )
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}
