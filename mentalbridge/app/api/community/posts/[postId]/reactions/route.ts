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
import { isCommunityPostId } from '@/lib/community/community-validation'

type Context = Readonly<{ params: Promise<{ postId: string }> }>

export async function GET(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCommunityUser>>
  try {
    user = await authenticatedCommunityUser(request, correlationId)
  } catch (error) {
    return communityAuthenticationFailure(error, correlationId)
  }
  const { postId } = await context.params
  if (!isCommunityPostId(postId)) {
    return carryCommunitySession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Community post identifier is invalid.',
        correlationId,
      ),
      user,
    )
  }
  try {
    const list = await communityClient.reactions(
      user.accessToken,
      postId,
      correlationId,
    )
    return carryCommunitySession(
      communitySuccessResponse(list, correlationId),
      user,
    )
  } catch (error) {
    return carryCommunitySession(
      communityErrorResponse(error, correlationId),
      user,
    )
  }
}
