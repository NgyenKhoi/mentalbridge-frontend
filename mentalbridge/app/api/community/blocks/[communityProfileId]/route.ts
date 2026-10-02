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

type Context = { params: Promise<{ communityProfileId: string }> }
const UUID =
  /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i

export async function PUT(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCommunityUser>>
  try {
    user = await authenticatedCommunityUser(request, correlationId)
  } catch (error) {
    return communityAuthenticationFailure(error, correlationId)
  }
  const { communityProfileId } = await context.params
  if (!UUID.test(communityProfileId))
    return carryCommunitySession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Community profile is invalid.',
        correlationId,
      ),
      user,
    )
  try {
    await communityClient.block(
      user.accessToken,
      communityProfileId,
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

export async function DELETE(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCommunityUser>>
  try {
    user = await authenticatedCommunityUser(request, correlationId)
  } catch (error) {
    return communityAuthenticationFailure(error, correlationId)
  }
  const { communityProfileId } = await context.params
  if (!UUID.test(communityProfileId))
    return carryCommunitySession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Community profile is invalid.',
        correlationId,
      ),
      user,
    )
  try {
    await communityClient.unblock(
      user.accessToken,
      communityProfileId,
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
