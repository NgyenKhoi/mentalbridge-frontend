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
import { contentResourceEngagementClient } from '@/lib/content/content-client'
import {
  isLocalDate,
  parseResourceBingoSelfConfirmationUpdate,
} from '@/lib/content/content-validation'

type Context = Readonly<{
  params: Promise<{ weekStart: string; position: string }>
}>

export async function PUT(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedContentUser>>
  try {
    user = await authenticatedContentUser(request, correlationId)
  } catch (error) {
    return contentAuthenticationFailure(error, correlationId)
  }

  const { weekStart, position: rawPosition } = await context.params
  const position = Number(rawPosition)
  const validWeek =
    isLocalDate(weekStart) &&
    new Date(`${weekStart}T00:00:00.000Z`).getUTCDay() === 1
  const ifMatch = request.headers.get('If-Match')
  if (
    !validWeek ||
    !Number.isSafeInteger(position) ||
    position < 1 ||
    position > 9 ||
    !ifMatch ||
    !/^\"(0|[1-9]\d*)\"$/.test(ifMatch)
  ) {
    return carryContentSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Bingo target and version are required.',
        correlationId,
      ),
      user,
    )
  }

  try {
    const update = parseResourceBingoSelfConfirmationUpdate(
      await readBoundedJson(request),
    )
    if (!update) {
      return carryContentSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Bingo confirmation is invalid.',
          correlationId,
        ),
        user,
      )
    }
    const result =
      await contentResourceEngagementClient.setBingoSelfConfirmation(
        user.accessToken,
        weekStart,
        position,
        update,
        ifMatch,
        correlationId,
      )
    const response = contentSuccessResponse(result.board, correlationId)
    response.headers.set('ETag', result.etag)
    return carryContentSession(response, user)
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
