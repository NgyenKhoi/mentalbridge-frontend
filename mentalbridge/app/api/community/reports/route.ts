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
import { parseCommunityReportInput } from '@/lib/community/community-validation'

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCommunityUser>>
  try {
    user = await authenticatedCommunityUser(request, correlationId)
  } catch (error) {
    return communityAuthenticationFailure(error, correlationId)
  }
  const key = request.headers.get('Idempotency-Key')
  let input = null
  try {
    input = parseCommunityReportInput(await request.json())
  } catch {
    input = null
  }
  if (
    !input ||
    !key ||
    key.length < 16 ||
    key.length > 128 ||
    !/^[!-~]+$/.test(key)
  ) {
    return carryCommunitySession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Community report is invalid.',
        correlationId,
      ),
      user,
    )
  }
  try {
    await communityClient.report(user.accessToken, input, key, correlationId)
    return carryCommunitySession(
      communityNoContentResponse(correlationId, 202),
      user,
    )
  } catch (error) {
    return carryCommunitySession(
      communityErrorResponse(error, correlationId),
      user,
    )
  }
}
