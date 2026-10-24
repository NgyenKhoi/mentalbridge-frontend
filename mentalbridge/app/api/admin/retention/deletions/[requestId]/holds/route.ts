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
import { parseApplyHoldRequest } from '@/lib/auth/identity-validation'
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

  let bodyJson: unknown
  try {
    bodyJson = await request.json()
  } catch {
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Malformed JSON request body.',
      correlationId,
    )
  }

  const holdRequest = parseApplyHoldRequest(bodyJson)
  if (!holdRequest) {
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Hold type and reason are invalid.',
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
    const updated = await identityClient.applyDeletionHold(
      actor.accessToken,
      requestId,
      holdRequest,
      correlationId,
    )
    return carryAdminSession(successResponse(updated, correlationId), actor)
  } catch (error) {
    return carryAdminSession(identityErrorResponse(error, correlationId), actor)
  }
}

export async function DELETE(
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
    const updated = await identityClient.releaseDeletionHold(
      actor.accessToken,
      requestId,
      correlationId,
    )
    return carryAdminSession(successResponse(updated, correlationId), actor)
  } catch (error) {
    return carryAdminSession(identityErrorResponse(error, correlationId), actor)
  }
}
