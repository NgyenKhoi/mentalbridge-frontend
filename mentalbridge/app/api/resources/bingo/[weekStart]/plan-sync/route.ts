import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import { isSameOrigin } from '@/lib/auth/same-origin'
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
import { contentResourceEngagementClient } from '@/lib/content/content-client'
import { isLocalDate } from '@/lib/content/content-validation'

type Context = Readonly<{ params: Promise<{ weekStart: string }> }>

export async function PUT(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedContentUser>>
  try {
    user = await authenticatedContentUser(request, correlationId)
  } catch (error) {
    return contentAuthenticationFailure(error, correlationId)
  }
  try {
    if (!isSameOrigin(request)) {
      throw new RequestBodyError(
        403,
        'CROSS_ORIGIN_REQUEST',
        'Same-origin request required.',
      )
    }
    const { weekStart } = await context.params
    if (
      !isLocalDate(weekStart) ||
      new Date(`${weekStart}T00:00:00Z`).getUTCDay() !== 1
    ) {
      throw new RequestBodyError(
        400,
        'VALIDATION_FAILED',
        'Bingo week must start on Monday.',
      )
    }
    const body = await readBoundedJson(request, 1024)
    if (
      typeof body !== 'object' ||
      body === null ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !('timeZone' in body) ||
      typeof body.timeZone !== 'string' ||
      body.timeZone.length < 1 ||
      body.timeZone.length > 64
    ) {
      throw new RequestBodyError(
        400,
        'VALIDATION_FAILED',
        'A valid time zone is required.',
      )
    }
    try {
      new Intl.DateTimeFormat('en', { timeZone: body.timeZone }).format()
    } catch {
      throw new RequestBodyError(
        400,
        'VALIDATION_FAILED',
        'A valid time zone is required.',
      )
    }
    const result = await contentResourceEngagementClient.syncBingoWithPlan(
      user.accessToken,
      weekStart,
      body.timeZone,
      correlationId,
    )
    const response = contentSuccessResponse(result.board, correlationId)
    response.headers.set('ETag', result.etag)
    return carryContentSession(response, user)
  } catch (error) {
    return carryContentSession(
      error instanceof RequestBodyError
        ? localProblem(error.status, error.code, error.message, correlationId)
        : contentErrorResponse(error, correlationId),
      user,
    )
  }
}
