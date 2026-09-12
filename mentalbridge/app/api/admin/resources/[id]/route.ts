import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { readBoundedJson, RequestBodyError } from '@/lib/auth/request-body'
import {
  RESOURCE_BODY_LIMIT,
  updateResourceSchema,
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
  contentNoContentResponse,
  contentSuccessResponse,
  localProblem,
} from '@/lib/content/bff-response'
import { contentAdminClient } from '@/lib/content/content-client'
import { isResourceId } from '@/lib/content/content-validation'

type Context = { params: Promise<{ id: string }> }

async function authorize(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  const { id } = await context.params
  if (!isResourceId(id)) return { correlationId, id, invalid: true as const }
  try {
    return {
      correlationId,
      id,
      admin: await authenticatedContentAdmin(request, correlationId),
    }
  } catch (error) {
    return {
      correlationId,
      id,
      authFailure: contentAuthenticationFailure(error, correlationId),
    }
  }
}

export async function GET(request: NextRequest, context: Context) {
  const auth = await authorize(request, context)
  if ('invalid' in auth)
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Invalid resource ID.',
      auth.correlationId,
    )
  if ('authFailure' in auth) return auth.authFailure
  try {
    return carryContentSession(
      contentSuccessResponse(
        await contentAdminClient.detail(
          auth.admin.accessToken,
          auth.id,
          auth.correlationId,
        ),
        auth.correlationId,
      ),
      auth.admin,
    )
  } catch (error) {
    return carryContentSession(
      contentErrorResponse(error, auth.correlationId),
      auth.admin,
    )
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  const auth = await authorize(request, context)
  if ('invalid' in auth)
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Invalid resource ID.',
      auth.correlationId,
    )
  if ('authFailure' in auth) return auth.authFailure
  const version = versionFrom(request.nextUrl.searchParams)
  if (version === null) {
    return carryContentSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'A valid version is required.',
        auth.correlationId,
      ),
      auth.admin,
    )
  }
  try {
    const body = updateResourceSchema.parse(
      await readBoundedJson(request, RESOURCE_BODY_LIMIT),
    )
    return carryContentSession(
      contentSuccessResponse(
        await contentAdminClient.update(
          auth.admin.accessToken,
          auth.id,
          version,
          body,
          auth.correlationId,
        ),
        auth.correlationId,
      ),
      auth.admin,
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return carryContentSession(
        localProblem(
          422,
          'VALIDATION_ERROR',
          'Request validation failed.',
          auth.correlationId,
          zodViolations(error),
        ),
        auth.admin,
      )
    }
    if (error instanceof RequestBodyError) {
      return carryContentSession(
        localProblem(
          error.status,
          error.code,
          error.message,
          auth.correlationId,
          error.violations,
        ),
        auth.admin,
      )
    }
    return carryContentSession(
      contentErrorResponse(error, auth.correlationId),
      auth.admin,
    )
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const auth = await authorize(request, context)
  if ('invalid' in auth)
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Invalid resource ID.',
      auth.correlationId,
    )
  if ('authFailure' in auth) return auth.authFailure
  const version = versionFrom(request.nextUrl.searchParams)
  if (version === null) {
    return carryContentSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'A valid version is required.',
        auth.correlationId,
      ),
      auth.admin,
    )
  }
  try {
    await contentAdminClient.delete(
      auth.admin.accessToken,
      auth.id,
      version,
      auth.correlationId,
    )
    return carryContentSession(
      contentNoContentResponse(auth.correlationId),
      auth.admin,
    )
  } catch (error) {
    return carryContentSession(
      contentErrorResponse(error, auth.correlationId),
      auth.admin,
    )
  }
}
