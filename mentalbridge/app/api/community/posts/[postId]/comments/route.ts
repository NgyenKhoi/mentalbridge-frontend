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
import {
  isCommunityPostId,
  parseCreateCommentRequest,
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
  const input = validateQuery(request.nextUrl.searchParams)
  if (!isCommunityPostId(postId) || !input) {
    return carryCommunitySession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Community comment request is invalid.',
        correlationId,
      ),
      user,
    )
  }
  try {
    const page = await communityClient.comments(
      user.accessToken,
      postId,
      input,
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

export async function POST(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCommunityUser>>
  try {
    user = await authenticatedCommunityUser(request, correlationId)
  } catch (error) {
    return communityAuthenticationFailure(error, correlationId)
  }
  const { postId } = await context.params
  const idempotencyKey = request.headers.get('Idempotency-Key')
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    raw = null
  }
  const input = parseCreateCommentRequest(raw)
  if (
    !isCommunityPostId(postId) ||
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
        'Community comment request is invalid.',
        correlationId,
      ),
      user,
    )
  }
  try {
    const result = await communityClient.createComment(
      user.accessToken,
      postId,
      input,
      idempotencyKey,
      correlationId,
    )
    return carryCommunitySession(
      communitySuccessResponse(
        result.data,
        correlationId,
        { ETag: result.etag! },
        201,
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

function validateQuery(input: URLSearchParams) {
  if ([...input.keys()].some((key) => key !== 'cursor' && key !== 'limit')) {
    return null
  }
  const cursor = input.get('cursor')
  const rawLimit = input.get('limit')
  const limit = rawLimit === null ? 20 : Number(rawLimit)
  if (
    (cursor !== null && (cursor.length < 1 || cursor.length > 256)) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50
  ) {
    return null
  }
  const query = new URLSearchParams({ limit: String(limit) })
  if (cursor) query.set('cursor', cursor)
  return query
}
