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
import { contentNotificationClient } from '@/lib/content/content-client'

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedContentUser>>
  try {
    user = await authenticatedContentUser(request, correlationId)
  } catch (error) {
    return contentAuthenticationFailure(error, correlationId)
  }

  const query = new URL(request.url).searchParams
  const outgoing = new URLSearchParams()
  const limit = query.get('limit')
  const cursor = query.get('cursor')
  if (
    (limit !== null && !/^(?:[1-9]|[1-4]\d|50)$/.test(limit)) ||
    (cursor !== null && !/^[A-Za-z0-9_-]{1,256}$/.test(cursor)) ||
    [...query.keys()].some((key) => key !== 'limit' && key !== 'cursor')
  ) {
    return carryContentSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Notification page is invalid.',
        correlationId,
      ),
      user,
    )
  }
  if (limit) outgoing.set('limit', limit)
  if (cursor) outgoing.set('cursor', cursor)

  try {
    const page = await contentNotificationClient.list(
      user.accessToken,
      outgoing,
      correlationId,
    )
    return carryContentSession(
      contentSuccessResponse(page, correlationId),
      user,
    )
  } catch (error) {
    return carryContentSession(contentErrorResponse(error, correlationId), user)
  }
}
