import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  contentErrorResponse,
  contentSuccessResponse,
  localProblem,
} from '@/lib/content/bff-response'
import { contentPublicClient } from '@/lib/content/content-client'
import {
  isContentVersion,
  isResourceId,
} from '@/lib/content/content-validation'

type Context = Readonly<{ params: Promise<{ resourceId: string }> }>

export async function GET(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  const { resourceId } = await context.params
  const contentVersion = request.nextUrl.searchParams.get('contentVersion')
  if (!isResourceId(resourceId)) {
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Invalid resource ID.',
      correlationId,
    )
  }
  if (contentVersion !== null && !isContentVersion(contentVersion)) {
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Invalid content version.',
      correlationId,
    )
  }

  try {
    const resource = await contentPublicClient.detail(
      resourceId,
      correlationId,
      contentVersion ?? undefined,
    )
    if (contentVersion !== null && resource.contentVersion !== contentVersion) {
      return localProblem(
        502,
        'CONTENT_VERSION_MISMATCH',
        'Resource version could not be verified.',
        correlationId,
      )
    }
    return contentSuccessResponse(resource, correlationId)
  } catch (error) {
    return contentErrorResponse(error, correlationId)
  }
}
