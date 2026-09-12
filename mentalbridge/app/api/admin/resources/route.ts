import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  createResourceSchema,
  listResourceQuerySchema,
  queryObject,
  RESOURCE_BODY_LIMIT,
  zodViolations,
} from '@/lib/content/admin-input'
import {
  authenticatedContentAdmin,
  carryContentSession,
  contentAuthenticationFailure,
} from '@/lib/content/authenticated-admin'
import {
  contentErrorResponse,
  contentSuccessResponse,
  localProblem,
} from '@/lib/content/bff-response'
import { contentAdminClient } from '@/lib/content/content-client'
import { isIdempotencyKey } from '@/lib/content/content-validation'

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let admin: Awaited<ReturnType<typeof authenticatedContentAdmin>>
  try {
    admin = await authenticatedContentAdmin(request, correlationId)
  } catch (error) {
    return contentAuthenticationFailure(error, correlationId)
  }
  try {
    const parsed = listResourceQuerySchema.parse(
      queryObject(request.nextUrl.searchParams),
    )
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(parsed)) {
      if (value !== undefined) query.set(key, String(value))
    }
    return carryContentSession(
      contentSuccessResponse(
        await contentAdminClient.list(admin.accessToken, query, correlationId),
        correlationId,
      ),
      admin,
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return carryContentSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Request validation failed.',
          correlationId,
          zodViolations(error),
        ),
        admin,
      )
    }
    return carryContentSession(
      contentErrorResponse(error, correlationId),
      admin,
    )
  }
}

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let admin: Awaited<ReturnType<typeof authenticatedContentAdmin>>
  try {
    admin = await authenticatedContentAdmin(request, correlationId)
  } catch (error) {
    return contentAuthenticationFailure(error, correlationId)
  }
  try {
    const idempotencyKey = request.headers.get('Idempotency-Key')
    if (!isIdempotencyKey(idempotencyKey)) {
      return carryContentSession(
        localProblem(
          400,
          'VALIDATION_FAILED',
          'Request validation failed.',
          correlationId,
          [{ field: 'Idempotency-Key', code: 'INVALID_FORMAT' }],
        ),
        admin,
      )
    }
    const body = createResourceSchema.parse(
      await readBoundedJson(request, RESOURCE_BODY_LIMIT),
    )
    return carryContentSession(
      contentSuccessResponse(
        await contentAdminClient.create(
          admin.accessToken,
          body,
          idempotencyKey,
          correlationId,
        ),
        correlationId,
        201,
      ),
      admin,
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return carryContentSession(
        localProblem(
          422,
          'VALIDATION_ERROR',
          'Request validation failed.',
          correlationId,
          zodViolations(error),
        ),
        admin,
      )
    }
    if (error instanceof RequestBodyError) {
      return carryContentSession(
        localProblem(
          error.status,
          error.code,
          error.message,
          correlationId,
          error.violations,
        ),
        admin,
      )
    }
    return carryContentSession(
      contentErrorResponse(error, correlationId),
      admin,
    )
  }
}
