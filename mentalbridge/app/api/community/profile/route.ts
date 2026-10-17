import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
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
  isCommunityEtag,
  parseCommunityProfileInput,
} from '@/lib/community/community-validation'

async function authorize(request: NextRequest, correlationId: string) {
  return authenticatedCommunityUser(request, correlationId)
}

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user
  try {
    user = await authorize(request, correlationId)
  } catch (error) {
    return communityAuthenticationFailure(error, correlationId)
  }
  try {
    const result = await communityClient.profile(
      user.accessToken,
      correlationId,
    )
    return carryCommunitySession(
      communitySuccessResponse(
        result.data,
        correlationId,
        result.etag ? { ETag: result.etag } : undefined,
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

export async function PUT(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user
  try {
    user = await authorize(request, correlationId)
  } catch (error) {
    return communityAuthenticationFailure(error, correlationId)
  }
  try {
    const input = parseCommunityProfileInput(
      await readBoundedJson(request, 4 * 1024),
    )
    const etag = request.headers.get('If-Match')
    if (!input || (etag !== null && !isCommunityEtag(etag))) {
      return carryCommunitySession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Thông tin hiển thị cộng đồng không hợp lệ.',
          correlationId,
        ),
        user,
      )
    }
    const result = await communityClient.putProfile(
      user.accessToken,
      correlationId,
      input,
      etag ?? undefined,
    )
    return carryCommunitySession(
      communitySuccessResponse(
        result.data,
        correlationId,
        result.etag ? { ETag: result.etag } : undefined,
        etag ? 200 : 201,
      ),
      user,
    )
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return carryCommunitySession(
        localProblem(
          error.status,
          error.code,
          error.message,
          correlationId,
          error.violations,
        ),
        user,
      )
    }
    return carryCommunitySession(
      communityErrorResponse(error, correlationId),
      user,
    )
  }
}
