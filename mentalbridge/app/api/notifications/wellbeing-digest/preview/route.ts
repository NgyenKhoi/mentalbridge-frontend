import type { NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedContentUser,
  carryContentSession,
  contentAuthenticationFailure,
} from '@/lib/content/authenticated-user'
import {
  contentErrorResponse,
  contentSuccessResponse,
} from '@/lib/content/bff-response'
import { contentWellbeingDigestClient } from '@/lib/content/content-client'

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedContentUser>>
  try {
    user = await authenticatedContentUser(request, correlationId)
  } catch (error) {
    return contentAuthenticationFailure(error, correlationId)
  }
  try {
    const preview = await contentWellbeingDigestClient.preview(
      user.accessToken,
      correlationId,
    )
    return carryContentSession(
      contentSuccessResponse(preview, correlationId),
      user,
    )
  } catch (error) {
    return carryContentSession(contentErrorResponse(error, correlationId), user)
  }
}
