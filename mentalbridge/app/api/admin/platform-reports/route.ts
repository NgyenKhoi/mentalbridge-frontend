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
  isValidIdempotencyKey,
  validatePlatformReportRequest,
} from '@/lib/auth/identity-validation'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const cursor = request.nextUrl.searchParams.get('cursor')
  const rawLimit = request.nextUrl.searchParams.get('limit')
  const limit = rawLimit === null ? undefined : Number(rawLimit)
  if (
    (cursor !== null && (cursor.length < 1 || cursor.length > 512)) ||
    (limit !== undefined &&
      (!Number.isInteger(limit) || limit < 1 || limit > 50))
  ) {
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Report history parameters are invalid.',
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
    const page = await identityClient.platformReportHistory(
      actor.accessToken,
      {
        ...(cursor === null ? {} : { cursor }),
        ...(limit === undefined ? {} : { limit }),
      },
      correlationId,
    )
    return carryAdminSession(successResponse(page, correlationId), actor)
  } catch (error) {
    return carryAdminSession(identityErrorResponse(error, correlationId), actor)
  }
}

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  if (!hasSameOrigin(request)) {
    return localProblem(
      403,
      'FORBIDDEN',
      'Request origin is invalid.',
      correlationId,
    )
  }
  const idempotencyKey = request.headers.get('Idempotency-Key')
  let body: unknown
  try {
    body = await readBoundedJson(request)
  } catch (cause) {
    if (cause instanceof RequestBodyError) {
      return localProblem(
        cause.status,
        cause.code,
        cause.message,
        correlationId,
        cause.violations,
      )
    }
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Report request is invalid.',
      correlationId,
    )
  }
  const validation = validatePlatformReportRequest(body)
  if (!isValidIdempotencyKey(idempotencyKey) || !validation.success) {
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Report request is invalid.',
      correlationId,
      validation.success ? undefined : validation.violations,
    )
  }
  let actor
  try {
    actor = await authenticatedAdminActor(request, correlationId)
  } catch (error) {
    return adminAuthenticationFailure(error, correlationId)
  }
  try {
    const report = await identityClient.requestPlatformReport(
      actor.accessToken,
      validation.value,
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
