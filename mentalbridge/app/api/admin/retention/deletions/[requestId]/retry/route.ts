import type { NextRequest } from 'next/server'
import {
  correlationIdFrom,
  identityErrorResponse,
  localProblem,
  successResponse,
} from '@/lib/auth/bff-response'
import {
  adminAuthenticationFailure,
  authenticatedAdminActor,
  carryAdminSession,
} from '@/lib/auth/admin-actor'
import { identityClient } from '@/lib/auth/identity-client'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  const correlationId = correlationIdFrom(request)
  const { requestId } = await context.params

  if (!requestId) {
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Request ID is required.',
      correlationId,
    )
  }

  let actor
  try {
    actor = await authenticatedAdminActor(request, correlationId)
  } catch (error) {
    return adminAuthenticationFailure(error, correlationId)
  }

  try {
    const updated = await identityClient.retryDeletion(
      actor.accessToken,
      requestId,
      correlationId,
    )
    return carryAdminSession(successResponse(updated, correlationId), actor)
  } catch (error) {
    return carryAdminSession(identityErrorResponse(error, correlationId), actor)
  }
}
