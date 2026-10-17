import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedCommunityUser,
  carryCommunitySession,
  communityAuthenticationFailure,
} from '@/lib/community/authenticated-user'
import {
  communityErrorResponse,
  communityNoContentResponse,
  localProblem,
} from '@/lib/community/bff-response'
import { communityClient } from '@/lib/community/community-client'
import { isCommunityMediaId } from '@/lib/community/community-validation'

type Context = Readonly<{ params: Promise<{ mediaId: string }> }>

export async function DELETE(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCommunityUser>>
  try {
    user = await authenticatedCommunityUser(request, correlationId)
  } catch (error) {
    return communityAuthenticationFailure(error, correlationId)
  }
  const { mediaId } = await context.params
  const ifMatch = request.headers.get('If-Match')
  if (
    !isCommunityMediaId(mediaId) ||
    !ifMatch ||
    !/^"(?:0|[1-9]\d*)"$/.test(ifMatch)
  ) {
    return carryCommunitySession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Community media command is invalid.',
        correlationId,
      ),
      user,
    )
  }
  try {
    await communityClient.deleteMedia(
      user.accessToken,
      mediaId,
      ifMatch,
      correlationId,
    )
    return carryCommunitySession(
      communityNoContentResponse(correlationId),
      user,
    )
  } catch (error) {
    return carryCommunitySession(
      communityErrorResponse(error, correlationId),
      user,
    )
  }
}
