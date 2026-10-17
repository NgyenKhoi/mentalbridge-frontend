import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedCommunityAdmin,
  carryCommunityAdminSession,
  communityAdminAuthenticationFailure,
} from '@/lib/community/authenticated-admin'
import {
  communityErrorResponse,
  communitySuccessResponse,
  localProblem,
} from '@/lib/community/bff-response'
import { communityClient } from '@/lib/community/community-client'

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let admin: Awaited<ReturnType<typeof authenticatedCommunityAdmin>>
  try {
    admin = await authenticatedCommunityAdmin(request, correlationId)
  } catch (error) {
    return communityAdminAuthenticationFailure(error, correlationId)
  }
  const query = new URLSearchParams()
  const state = request.nextUrl.searchParams.get('state')
  const targetType = request.nextUrl.searchParams.get('targetType')
  const priority = request.nextUrl.searchParams.get('priority')
  if (state && !['OPEN', 'IN_REVIEW', 'RESOLVED'].includes(state))
    return carryCommunityAdminSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Moderation filter is invalid.',
        correlationId,
      ),
      admin,
    )
  if (targetType && !['POST', 'COMMENT'].includes(targetType))
    return carryCommunityAdminSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Moderation filter is invalid.',
        correlationId,
      ),
      admin,
    )
  if (priority && !['NORMAL', 'HIGH'].includes(priority))
    return carryCommunityAdminSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Moderation filter is invalid.',
        correlationId,
      ),
      admin,
    )
  if (state) query.set('state', state)
  if (targetType) query.set('targetType', targetType)
  if (priority) query.set('priority', priority)
  try {
    return carryCommunityAdminSession(
      communitySuccessResponse(
        await communityClient.moderationCases(
          admin.accessToken,
          query,
          correlationId,
        ),
        correlationId,
      ),
      admin,
    )
  } catch (error) {
    return carryCommunityAdminSession(
      communityErrorResponse(error, correlationId),
      admin,
    )
  }
}
