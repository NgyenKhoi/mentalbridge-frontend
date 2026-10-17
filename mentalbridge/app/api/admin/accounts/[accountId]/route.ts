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
import { isUuid } from '@/lib/auth/identity-validation'

type Context = { params: Promise<{ accountId: string }> }

export async function GET(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  const { accountId } = await context.params
  if (!isUuid(accountId)) {
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Account id is invalid.',
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
    const detail = await identityClient.getAccountById(
      actor.accessToken,
      accountId,
      correlationId,
    )
    const response = successResponse(detail, correlationId)
    response.headers.set('ETag', `"${detail.version}"`)
    return carryAdminSession(response, actor)
  } catch (error) {
    return carryAdminSession(identityErrorResponse(error, correlationId), actor)
  }
}
