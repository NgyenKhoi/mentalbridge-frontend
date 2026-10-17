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
import { isUuid, isValidIdempotencyKey } from '@/lib/auth/identity-validation'

export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/admin/platform-reports/[reportId]/retries'>,
) {
  const correlationId = correlationIdFrom(request)
  if (!hasSameOrigin(request)) {
    return localProblem(
      403,
      'FORBIDDEN',
      'Request origin is invalid.',
      correlationId,
    )
  }
  const { reportId } = await context.params
  const idempotencyKey = request.headers.get('Idempotency-Key')
  if (!isUuid(reportId) || !isValidIdempotencyKey(idempotencyKey)) {
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Report retry is invalid.',
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
    const report = await identityClient.retryPlatformReport(
      actor.accessToken,
      reportId,
      idempotencyKey,
      correlationId,
    )
    return carryAdminSession(successResponse(report, correlationId, 202), actor)
  } catch (error) {
    return carryAdminSession(identityErrorResponse(error, correlationId), actor)
  }
}

function hasSameOrigin(request: NextRequest) {
  const supplied = request.headers.get('origin')
  const host = request.headers.get('host')
  if (!supplied || !host) return false
  try {
    const origin = new URL(supplied)
    return origin.host === host && origin.protocol === request.nextUrl.protocol
  } catch {
    return false
  }
}
