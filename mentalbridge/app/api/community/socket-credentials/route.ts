import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { isSameOrigin } from '@/lib/auth/same-origin'
import {
  authenticatedCommunityUser,
  carryCommunitySession,
  communityAuthenticationFailure,
} from '@/lib/community/authenticated-user'
import {
  communitySuccessResponse,
  localProblem,
} from '@/lib/community/bff-response'
import {
  realtimeServerClient,
  RealtimeServiceError,
} from '@/lib/realtime/server-client'

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  if (!isSameOrigin(request))
    return localProblem(
      403,
      'INVALID_ORIGIN',
      'Request origin is invalid.',
      correlationId,
    )
  const body = (await request.text()).trim()
  if ((body !== '' && body !== '{}') || request.nextUrl.searchParams.size > 0)
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'This request does not accept actor or connection parameters.',
      correlationId,
    )
  let user
  try {
    user = await authenticatedCommunityUser(request, correlationId)
  } catch (error) {
    return communityAuthenticationFailure(error, correlationId)
  }
  try {
    return carryCommunitySession(
      communitySuccessResponse(
        await realtimeServerClient.communityCredential(
          user.accessToken,
          correlationId,
        ),
        correlationId,
      ),
      user,
    )
  } catch (error) {
    return carryCommunitySession(
      localProblem(
        error instanceof RealtimeServiceError ? error.status : 503,
        error instanceof RealtimeServiceError
          ? error.code
          : 'REALTIME_UNAVAILABLE',
        'Trạng thái trực tuyến hiện chưa khả dụng.',
        correlationId,
      ),
      user,
    )
  }
}
