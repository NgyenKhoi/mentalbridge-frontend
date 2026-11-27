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
import { contentResourceProgressClient } from '@/lib/content/content-client'
import {
  isLocalDate,
  isResourceId,
  parseResourceProgressUpdate,
} from '@/lib/content/content-validation'

type Context = Readonly<{
  params: Promise<{ resourceId: string; localDate: string }>
}>

export async function PUT(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedContentUser>>
  try {
    user = await authenticatedContentUser(request, correlationId)
  } catch (error) {
    return contentAuthenticationFailure(error, correlationId)
  }

  const { resourceId, localDate } = await context.params
  if (!isResourceId(resourceId) || !isLocalDate(localDate)) {
    return carryContentSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Resource progress target is invalid.',
        correlationId,
      ),
      user,
    )
  }

  try {
    const update = parseResourceProgressUpdate(await readBoundedJson(request))
    if (!update) {
      return carryContentSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Resource progress is invalid.',
          correlationId,
        ),
        user,
      )
    }
    const result = await contentResourceProgressClient.save(
      user.accessToken,
      resourceId,
      localDate,
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
