import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedCommunityUser,
  carryCommunitySession,
  communityAuthenticationFailure,
} from '@/lib/community/authenticated-user'
import {
  communityErrorResponse,
  communitySuccessResponse,
  localProblem,
} from '@/lib/community/bff-response'
import { communityClient } from '@/lib/community/community-client'
import { isCommunityMediaId } from '@/lib/community/community-validation'

type Context = Readonly<{ params: Promise<{ mediaId: string }> }>

export async function POST(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCommunityUser>>
  try {
    user = await authenticatedCommunityUser(request, correlationId)
  } catch (error) {
    return communityAuthenticationFailure(error, correlationId)
  }
  const { mediaId } = await context.params
  if (!isCommunityMediaId(mediaId)) {
    return carryCommunitySession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Community media identifier is invalid.',
        correlationId,
      ),
      user,
    )
  }
  try {
    const result = await communityClient.finalizeMedia(
      user.accessToken,
      mediaId,
      correlationId,
    )
    return carryCommunitySession(
      communitySuccessResponse(result, correlationId),
      user,
    )
  } catch (error) {
    return carryCommunitySession(
      communityErrorResponse(error, correlationId),
      user,
    )
  }
}
