import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedContentUser,
  carryContentSession,
  contentAuthenticationFailure,
} from '@/lib/content/authenticated-user'
import {
  contentErrorResponse,
  contentNoContentResponse,
  localProblem,
} from '@/lib/content/bff-response'
import { contentNotificationClient } from '@/lib/content/content-client'
import { isResourceId } from '@/lib/content/content-validation'

export async function DELETE(
  request: NextRequest,
  context: RouteContext<'/api/notifications/[id]'>,
) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedContentUser>>
  try {
    user = await authenticatedContentUser(request, correlationId)
  } catch (error) {
    return contentAuthenticationFailure(error, correlationId)
  }
  const { id } = await context.params
  if (!isResourceId(id)) {
    return carryContentSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Notification identifier is invalid.',
        correlationId,
      ),
      user,
    )
  }
  try {
    await contentNotificationClient.delete(user.accessToken, id, correlationId)
    return carryContentSession(contentNoContentResponse(correlationId), user)
  } catch (error) {
    return carryContentSession(contentErrorResponse(error, correlationId), user)
  }
}
