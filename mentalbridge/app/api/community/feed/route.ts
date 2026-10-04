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
import { isCommunityTopic } from '@/lib/community/community-validation'

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCommunityUser>>
  try {
    user = await authenticatedCommunityUser(request, correlationId)
  } catch (error) {
    return communityAuthenticationFailure(error, correlationId)
  }

  const query = request.nextUrl.searchParams
  const topics = query.getAll('topic')
  const limit = query.get('limit')
  const cursor = query.get('cursor')
  if (
    topics.length > 3 ||
    new Set(topics).size !== topics.length ||
    topics.some((topic) => !isCommunityTopic(topic)) ||
    (limit !== null && !/^(?:[1-9]|[1-4]\d|50)$/.test(limit)) ||
    (cursor !== null && !/^[A-Za-z0-9_-]{1,256}$/.test(cursor)) ||
    [...query.keys()].some(
      (key) => key !== 'topic' && key !== 'limit' && key !== 'cursor',
    )
  ) {
    return carryCommunitySession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Community feed query is invalid.',
        correlationId,
      ),
      user,
    )
  }

  const outgoing = new URLSearchParams()
  topics.forEach((topic) => outgoing.append('topic', topic))
  if (limit) outgoing.set('limit', limit)
  if (cursor) outgoing.set('cursor', cursor)
  try {
    const page = await communityClient.feed(
      user.accessToken,
      outgoing,
      correlationId,
    )
    return carryCommunitySession(
      communitySuccessResponse(page, correlationId),
      user,
    )
  } catch (error) {
    return carryCommunitySession(
      communityErrorResponse(error, correlationId),
      user,
    )
  }
}
