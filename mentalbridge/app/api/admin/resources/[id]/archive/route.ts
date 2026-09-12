import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import { versionFrom } from '@/lib/content/admin-input'
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
    return carryContentSession(
      contentSuccessResponse(
        await contentAdminClient.archive(
          admin.accessToken,
          id,
          version,
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
