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
  context: { params: Promise<{ policyId: string }> },
) {
  const correlationId = correlationIdFrom(request)
  const { policyId } = await context.params

  if (!policyId) {
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Policy ID is required.',
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
    const record = await identityClient.triggerRetentionSweep(
      actor.accessToken,
      policyId,
      correlationId,
    )
    return carryAdminSession(successResponse(record, correlationId), actor)
  } catch (error) {
    return carryAdminSession(identityErrorResponse(error, correlationId), actor)
  }
}
