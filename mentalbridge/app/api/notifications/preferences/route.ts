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
import { contentPreferenceClient } from '@/lib/content/content-client'
import { parseNotificationPreferencePatch } from '@/lib/content/content-validation'

function withEtag<T extends Response>(response: T, etag: string): T {
  response.headers.set('ETag', etag)
  return response
}

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedContentUser>>
  try {
    user = await authenticatedContentUser(request, correlationId)
  } catch (error) {
    return contentAuthenticationFailure(error, correlationId)
  }

  try {
    const result = await contentPreferenceClient.get(
      user.accessToken,
      correlationId,
    )
    return carryContentSession(
      withEtag(
        contentSuccessResponse(result.preferences, correlationId),
        result.etag,
      ),
      user,
    )
  } catch (error) {
    return carryContentSession(contentErrorResponse(error, correlationId), user)
  }
}

export async function PATCH(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedContentUser>>
  try {
    user = await authenticatedContentUser(request, correlationId)
  } catch (error) {
    return contentAuthenticationFailure(error, correlationId)
  }

  try {
    const ifMatch = request.headers.get('If-Match')
    if (!ifMatch || !/^"(0|[1-9]\d*)"$/.test(ifMatch)) {
      return carryContentSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'A valid preference version is required.',
          correlationId,
        ),
        user,
      )
    }
    const patch = parseNotificationPreferencePatch(
      await readBoundedJson(request),
    )
    if (!patch) {
      return carryContentSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Notification preferences are invalid.',
          correlationId,
        ),
        user,
      )
    }
    const result = await contentPreferenceClient.update(
      user.accessToken,
      patch,
      ifMatch,
      correlationId,
    )
    return carryContentSession(
      withEtag(
        contentSuccessResponse(result.preferences, correlationId),
        result.etag,
      ),
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
