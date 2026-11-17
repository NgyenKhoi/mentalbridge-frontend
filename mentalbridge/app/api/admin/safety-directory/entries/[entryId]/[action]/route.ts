import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
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
import { safetyDirectoryVersion } from '@/lib/content/safety-directory-admin-input'

type Context = { params: Promise<{ entryId: string; action: string }> }

export async function POST(request: NextRequest, context: Context) {
  const correlationId = correlationIdFrom(request)
  const { entryId, action } = await context.params
  if (
    !isResourceId(entryId) ||
    (action !== 'review' && action !== 'deactivate')
  )
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Invalid lifecycle action.',
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
    return carryContentSession(
      contentSuccessResponse(
        await contentSafetyDirectoryAdminClient.transition(
          admin.accessToken,
          entryId,
          version,
          action,
          correlationId,
        ),
        correlationId,
      ),
      admin,
    )
  } catch (error) {
    return carryContentSession(
      contentErrorResponse(error, correlationId),
      admin,
    )
  }
}
