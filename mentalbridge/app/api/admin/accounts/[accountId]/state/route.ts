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
import {
  isUuid,
  validateAccountStateChangeRequest,
} from '@/lib/auth/identity-validation'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'

type Context = { params: Promise<{ accountId: string }> }
const ETAG_PATTERN = /^"[0-9]+"$/

export async function PUT(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  if (!hasSameOrigin(request)) {
    return localProblem(
      403,
      'FORBIDDEN',
      'Request origin is invalid.',
      correlationId,
    )
  }
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

  const ifMatch = request.headers.get('If-Match')
  if (!ifMatch || !ETAG_PATTERN.test(ifMatch)) {
    return carryAdminSession(
      localProblem(
        428,
        'ACCOUNT_VERSION_REQUIRED',
        'A quoted account version is required.',
        correlationId,
      ),
      actor,
    )
  }

  let body: unknown
  try {
    body = await readBoundedJson(request)
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return carryAdminSession(
        localProblem(
          error.status,
          error.code,
          error.message,
          correlationId,
          error.violations,
        ),
        actor,
      )
    }
    return carryAdminSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Request body is invalid.',
        correlationId,
      ),
      actor,
    )
  }
  const validation = validateAccountStateChangeRequest(body)
  if (!validation.success) {
    return carryAdminSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Account state request is invalid.',
        correlationId,
        validation.violations,
      ),
      actor,
    )
  }

  try {
    const detail = await identityClient.changeAccountState(
      actor.accessToken,
      accountId,
      validation.value,
      ifMatch,
      correlationId,
    )
    const response = successResponse(detail, correlationId)
    response.headers.set('ETag', `"${detail.version}"`)
    return carryAdminSession(response, actor)
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
