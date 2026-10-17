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
import { isCommunityPostId } from '@/lib/community/community-validation'

type Context = Readonly<{ params: Promise<{ postId: string }> }>

export async function PUT(request: NextRequest, context: Context) {
  return mutate(request, context, 'PUT')
}

export async function DELETE(request: NextRequest, context: Context) {
  return mutate(request, context, 'DELETE')
}

async function mutate(
  request: NextRequest,
  context: Context,
  method: 'PUT' | 'DELETE',
) {
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
    if (method === 'PUT') {
      await communityClient.putBookmark(user.accessToken, postId, correlationId)
    } else {
      await communityClient.deleteBookmark(
        user.accessToken,
        postId,
        correlationId,
      )
    }
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
