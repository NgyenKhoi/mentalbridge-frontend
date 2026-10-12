import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  authenticatedContentUser,
  carryContentSession,
  contentAuthenticationFailure,
} from '@/lib/content/authenticated-user'
import {
  contentErrorResponse,
  contentSuccessResponse,
  localProblem,
} from '@/lib/content/bff-response'
import { contentResourceRewardClient } from '@/lib/content/content-client'
import { parseResourceRewardVisibilityUpdate } from '@/lib/content/content-validation'

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedContentUser>>
  try {
    user = await authenticatedContentUser(request, correlationId)
  } catch (error) {
    return contentAuthenticationFailure(error, correlationId)
  }
  try {
    const result = await contentResourceRewardClient.read(
      user.accessToken,
      correlationId,
    )
    return carryContentSession(
      contentSuccessResponse(result, correlationId),
      user,
    )
  } catch (error) {
    return carryContentSession(contentErrorResponse(error, correlationId), user)
  }
}

export async function PUT(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedContentUser>>
  try {
    user = await authenticatedContentUser(request, correlationId)
  } catch (error) {
    return contentAuthenticationFailure(error, correlationId)
  }
  try {
    const update = parseResourceRewardVisibilityUpdate(
      await readBoundedJson(request),
    )
    if (!update) {
      return carryContentSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Resource reward preference is invalid.',
          correlationId,
        ),
        user,
      )
    }
    const result = await contentResourceRewardClient.setVisibility(
      user.accessToken,
      update,
      correlationId,
    )
    return carryContentSession(
      contentSuccessResponse(result, correlationId),
      user,
    )
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return carryContentSession(
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
    return carryContentSession(contentErrorResponse(error, correlationId), user)
  }
}
