import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
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

function isMonday(value: string) {
  return (
    isLocalDate(value) && new Date(`${value}T00:00:00.000Z`).getUTCDay() === 1
  )
}

export async function GET(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedContentUser>>
  try {
    user = await authenticatedContentUser(request, correlationId)
  } catch (error) {
    return contentAuthenticationFailure(error, correlationId)
  }

  const { weekStart } = await context.params
  if (!isMonday(weekStart)) {
    return carryContentSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Bingo week must start on Monday.',
        correlationId,
      ),
      user,
    )
  }

  try {
    const result = await contentResourceEngagementClient.getBingo(
      user.accessToken,
      weekStart,
      correlationId,
    )
    const response = contentSuccessResponse(result.board, correlationId)
    response.headers.set('ETag', result.etag)
    return carryContentSession(response, user)
  } catch (error) {
    return carryContentSession(contentErrorResponse(error, correlationId), user)
  }
}
