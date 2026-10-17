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
import { contentResourceProgressClient } from '@/lib/content/content-client'
import { isLocalDate } from '@/lib/content/content-validation'

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedContentUser>>
  try {
    user = await authenticatedContentUser(request, correlationId)
  } catch (error) {
    return contentAuthenticationFailure(error, correlationId)
  }

  const from = request.nextUrl.searchParams.get('from')
  const to = request.nextUrl.searchParams.get('to')
  if (!from || !to || !isLocalDate(from) || !isLocalDate(to)) {
    return carryContentSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Resource progress date range is invalid.',
        correlationId,
      ),
      user,
    )
  }
  const days =
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
    86_400_000
  if (days < 0 || days > 31) {
    return carryContentSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Resource progress date range is invalid.',
        correlationId,
      ),
      user,
    )
  }

  try {
    const result = await contentResourceProgressClient.list(
      user.accessToken,
      from,
      to,
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
