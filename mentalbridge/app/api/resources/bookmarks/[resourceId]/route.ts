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
  contentSuccessResponse,
  localProblem,
} from '@/lib/content/bff-response'
import { contentResourceEngagementClient } from '@/lib/content/content-client'
import { isResourceId } from '@/lib/content/content-validation'

type Context = Readonly<{ params: Promise<{ resourceId: string }> }>

async function withUser(
  request: NextRequest,
  context: Context,
  action: 'save' | 'delete',
) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedContentUser>>
  try {
    user = await authenticatedContentUser(request, correlationId)
  } catch (error) {
    return contentAuthenticationFailure(error, correlationId)
  }

  const { resourceId } = await context.params
  if (!isResourceId(resourceId)) {
    return carryContentSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Resource bookmark target is invalid.',
        correlationId,
      ),
      user,
    )
  }

  try {
    if (action === 'delete') {
      await contentResourceEngagementClient.deleteBookmark(
        user.accessToken,
        resourceId,
        correlationId,
      )
      return carryContentSession(contentNoContentResponse(correlationId), user)
    }
    const bookmark = await contentResourceEngagementClient.saveBookmark(
      user.accessToken,
      resourceId,
      correlationId,
    )
    return carryContentSession(
      contentSuccessResponse(bookmark, correlationId),
      user,
    )
  } catch (error) {
    return carryContentSession(contentErrorResponse(error, correlationId), user)
  }
}

export function PUT(request: NextRequest, context: Context) {
  return withUser(request, context, 'save')
}

export function DELETE(request: NextRequest, context: Context) {
  return withUser(request, context, 'delete')
}
