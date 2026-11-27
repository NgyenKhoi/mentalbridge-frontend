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
  communitySuccessResponse,
  localProblem,
} from '@/lib/community/bff-response'
import { communityClient } from '@/lib/community/community-client'
import {
  isCommunityCommentId,
  parseUpdateCommentRequest,
} from '@/lib/community/community-validation'

type Context = Readonly<{ params: Promise<{ commentId: string }> }>

export async function PATCH(request: NextRequest, context: Context) {
  return mutate(request, context, 'PATCH')
}

export async function DELETE(request: NextRequest, context: Context) {
  return mutate(request, context, 'DELETE')
}

async function mutate(
  request: NextRequest,
  context: Context,
  method: 'PATCH' | 'DELETE',
) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCommunityUser>>
  try {
    user = await authenticatedCommunityUser(request, correlationId)
  } catch (error) {
    return communityAuthenticationFailure(error, correlationId)
  }
  const { commentId } = await context.params
  const ifMatch = request.headers.get('If-Match')
  let input = null
  if (method === 'PATCH') {
    try {
      input = parseUpdateCommentRequest(await request.json())
    } catch {
      input = null
    }
  }
  if (
    !isCommunityCommentId(commentId) ||
    !ifMatch ||
    !/^"(?:0|[1-9]\d*)"$/.test(ifMatch) ||
    (method === 'PATCH' && !input)
  ) {
    return carryCommunitySession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Community comment command is invalid.',
        correlationId,
      ),
      user,
    )
  }
  try {
    if (method === 'DELETE') {
      await communityClient.deleteComment(
        user.accessToken,
        commentId,
        ifMatch,
        correlationId,
      )
      return carryCommunitySession(
        communityNoContentResponse(correlationId),
        user,
      )
    }
    const result = await communityClient.updateComment(
      user.accessToken,
      commentId,
      input!,
      ifMatch,
      correlationId,
    )
    return carryCommunitySession(
      communitySuccessResponse(result.data, correlationId, {
        ETag: result.etag!,
      }),
      user,
    )
  } catch (error) {
    return carryCommunitySession(
      communityErrorResponse(error, correlationId),
      user,
    )
  }
}
