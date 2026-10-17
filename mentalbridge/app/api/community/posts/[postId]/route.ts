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
  isCommunityPostId,
  parseCommunityPostWrite,
} from '@/lib/community/community-validation'

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
    const result = await communityClient.detail(
      user.accessToken,
      postId,
      correlationId,
    )
    return carryCommunitySession(
      communitySuccessResponse(
        result.post,
        correlationId,
        result.version === null ? undefined : { ETag: `"${result.version}"` },
      ),
      user,
    )
  } catch (error) {
    return carryCommunitySession(
      communityErrorResponse(error, correlationId),
      user,
    )
  }
}

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
  const { postId } = await context.params
  const ifMatch = request.headers.get('If-Match')
  let input = null
  if (method === 'PATCH') {
    try {
      input = parseCommunityPostWrite(await request.json())
    } catch {
      input = null
    }
  }
  if (
    !isCommunityPostId(postId) ||
    !ifMatch ||
    !/^"(?:0|[1-9]\d*)"$/.test(ifMatch) ||
    (method === 'PATCH' && !input)
  ) {
    return carryCommunitySession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Community post command is invalid.',
        correlationId,
      ),
      user,
    )
  }
  try {
    if (method === 'DELETE') {
      await communityClient.delete(
        user.accessToken,
        postId,
        ifMatch,
        correlationId,
      )
      return carryCommunitySession(
        communityNoContentResponse(correlationId),
        user,
      )
    }
    const result = await communityClient.update(
      user.accessToken,
      postId,
      input!,
      ifMatch,
      correlationId,
    )
    return carryCommunitySession(
      communitySuccessResponse(result.post, correlationId, {
        ETag: `"${result.version}"`,
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
