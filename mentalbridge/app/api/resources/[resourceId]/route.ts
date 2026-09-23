import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  contentErrorResponse,
  contentSuccessResponse,
  localProblem,
} from '@/lib/content/bff-response'
import { contentPublicClient } from '@/lib/content/content-client'
import { isResourceId } from '@/lib/content/content-validation'

type Context = Readonly<{ params: Promise<{ resourceId: string }> }>

export async function GET(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  const { resourceId } = await context.params
  if (!isResourceId(resourceId)) {
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Invalid resource ID.',
      correlationId,
    )
  }

  try {
    return contentSuccessResponse(
      await contentPublicClient.detail(resourceId, correlationId),
      correlationId,
    )
  } catch (error) {
    return contentErrorResponse(error, correlationId)
  }
}
