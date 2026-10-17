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
import { parseCreateMediaUploadIntent } from '@/lib/community/community-validation'

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCommunityUser>>
  try {
    user = await authenticatedCommunityUser(request, correlationId)
  } catch (error) {
    return communityAuthenticationFailure(error, correlationId)
  }
  const idempotencyKey = request.headers.get('Idempotency-Key')
  let input = null
  try {
    input = parseCreateMediaUploadIntent(await request.json())
  } catch {
    input = null
  }
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
        'Community media request is invalid.',
        correlationId,
      ),
      user,
    )
  }
  try {
    const intent = await communityClient.createMediaIntent(
      user.accessToken,
      input,
      idempotencyKey,
      correlationId,
    )
    return carryCommunitySession(
      communitySuccessResponse(intent, correlationId, undefined, 201),
      user,
    )
  } catch (error) {
    return carryCommunitySession(
      communityErrorResponse(error, correlationId),
      user,
    )
  }
}
