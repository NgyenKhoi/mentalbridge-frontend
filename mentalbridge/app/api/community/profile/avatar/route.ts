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
  parseCommunityAvatarInput,
} from '@/lib/community/community-validation'

export async function PUT(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user
  try {
    user = await authenticatedCommunityUser(request, correlationId)
  } catch (error) {
    return communityAuthenticationFailure(error, correlationId)
  }
  try {
    if (request.headers.get('origin') !== request.nextUrl.origin) {
      return carryCommunitySession(
        localProblem(
          403,
          'FORBIDDEN',
          'Hãy thay đổi ảnh từ trang cộng đồng.',
          correlationId,
        ),
        user,
      )
    }
    const input = parseCommunityAvatarInput(
      await readBoundedJson(request, 1024),
    )
    const etag = request.headers.get('If-Match')
    if (!input || !isCommunityEtag(etag)) {
      return carryCommunitySession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Ảnh đại diện chưa hợp lệ. Hãy tải lại hồ sơ và chọn ảnh.',
          correlationId,
        ),
        user,
      )
    }
    const result = await communityClient.putAvatar(
      user.accessToken,
      correlationId,
      input,
      etag,
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
