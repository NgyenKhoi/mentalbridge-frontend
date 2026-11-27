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
import { parseCommunityPostWrite } from '@/lib/community/community-validation'

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCommunityUser>>
  try {
    user = await authenticatedCommunityUser(request, correlationId)
  } catch (error) {
    return communityAuthenticationFailure(error, correlationId)
  }
  const idempotencyKey = request.headers.get('Idempotency-Key')
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    raw = null
  }
  const input = parseCommunityPostWrite(raw)
  if (
    !input ||
    !idempotencyKey ||
    idempotencyKey.length < 16 ||
    idempotencyKey.length > 128 ||
    !/^[!-~]+$/.test(idempotencyKey)
  ) {
    return carryCommunitySession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Community post request is invalid.',
        correlationId,
      ),
      user,
    )
  }
  try {
    const result = await communityClient.create(
      user.accessToken,
      input,
      idempotencyKey,
      correlationId,
    )
    const response = communitySuccessResponse(
      result.post,
      correlationId,
      { ETag: `"${result.version}"` },
      201,
    )
    return carryCommunitySession(response, user)
  } catch (error) {
    return carryCommunitySession(
      communityErrorResponse(error, correlationId),
      user,
    )
  }
}
