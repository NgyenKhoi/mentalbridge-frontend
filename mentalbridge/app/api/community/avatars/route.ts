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

const ACCOUNT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCommunityUser>>
  try {
    user = await authenticatedCommunityUser(request, correlationId, [
      'USER',
      'SPECIALIST',
    ])
  } catch (error) {
    return communityAuthenticationFailure(error, correlationId)
  }

  const query = request.nextUrl.searchParams
  const accountIds = query.get('accountIds')?.split(',') ?? []
  if (
    accountIds.length < 1 ||
    accountIds.length > 50 ||
    new Set(accountIds).size !== accountIds.length ||
    accountIds.some((id) => !ACCOUNT_ID.test(id)) ||
    [...query.keys()].some((key) => key !== 'accountIds')
  ) {
    return carryCommunitySession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Community avatar query is invalid.',
        correlationId,
      ),
      user,
    )
  }

  try {
    const result = await communityClient.avatars(
      user.accessToken,
      accountIds.join(','),
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
