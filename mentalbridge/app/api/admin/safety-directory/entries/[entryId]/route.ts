import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import { zodViolations } from '@/lib/content/admin-input'
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
import { contentSafetyDirectoryAdminClient } from '@/lib/content/content-client'
import { isResourceId } from '@/lib/content/content-validation'
import {
  SAFETY_DIRECTORY_BODY_LIMIT,
  safetyDirectoryEntryWriteSchema,
  safetyDirectoryVersion,
} from '@/lib/content/safety-directory-admin-input'

type Context = { params: Promise<{ entryId: string }> }

export async function PATCH(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  const { entryId } = await context.params
  if (!isResourceId(entryId))
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Invalid directory entry ID.',
      correlationId,
    )
  let admin: Awaited<ReturnType<typeof authenticatedContentAdmin>>
  try {
    admin = await authenticatedContentAdmin(request, correlationId)
  } catch (error) {
    return contentAuthenticationFailure(error, correlationId)
  }
  const version = safetyDirectoryVersion(request.nextUrl.searchParams)
  if (version === null)
    return carryContentSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'A valid version is required.',
        correlationId,
      ),
      admin,
    )
  try {
    const body = safetyDirectoryEntryWriteSchema.parse(
      await readBoundedJson(request, SAFETY_DIRECTORY_BODY_LIMIT),
    )
    return carryContentSession(
      contentSuccessResponse(
        await contentSafetyDirectoryAdminClient.update(
          admin.accessToken,
          entryId,
          version,
          body,
          correlationId,
        ),
        correlationId,
      ),
      admin,
    )
  } catch (error) {
    if (error instanceof z.ZodError)
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
    if (error instanceof RequestBodyError)
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
    return carryContentSession(
      contentErrorResponse(error, correlationId),
      admin,
    )
  }
}
