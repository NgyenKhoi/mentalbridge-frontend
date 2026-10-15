import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  RESOURCE_BODY_LIMIT,
  reviewResourceSchema,
  versionFrom,
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
import { isResourceId } from '@/lib/content/content-validation'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = correlationIdFrom(request)
  const { id } = await params
  if (!isResourceId(id))
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Invalid resource ID.',
      correlationId,
    )

  let admin: Awaited<ReturnType<typeof authenticatedContentAdmin>>
  try {
    admin = await authenticatedContentAdmin(request, correlationId)
  } catch (error) {
    return contentAuthenticationFailure(error, correlationId)
  }
  const version = versionFrom(request.nextUrl.searchParams)
  if (version === null) {
    return carryContentSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'A valid version is required.',
        correlationId,
      ),
      admin,
    )
  }

  try {
    const body = reviewResourceSchema.parse(
      await readBoundedJson(request, RESOURCE_BODY_LIMIT),
    )
    return carryContentSession(
      contentSuccessResponse(
        await contentAdminClient.review(
          admin.accessToken,
          id,
          version,
          body,
          correlationId,
        ),
        correlationId,
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
