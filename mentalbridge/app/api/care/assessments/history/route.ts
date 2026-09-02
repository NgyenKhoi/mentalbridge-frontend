import type { NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedCareUser,
  careAuthenticationFailure,
  carryCareSession,
} from '@/lib/care/authenticated-user'
import {
  careErrorResponse,
  careSuccessResponse,
  localProblem,
} from '@/lib/care/bff-response'
import { careClient } from '@/lib/care/care-client'

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined
  const rawLimit = request.nextUrl.searchParams.get('limit') ?? '10'
  const limit = Number(rawLimit)
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50 ||
    (cursor?.length ?? 0) > 256
  )
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Request validation failed.',
      correlationId,
    )
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }
  try {
    return carryCareSession(
      careSuccessResponse(
        await careClient.history(
          user.accessToken,
          cursor,
          limit,
          correlationId,
        ),
        correlationId,
      ),
      user,
    )
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}
