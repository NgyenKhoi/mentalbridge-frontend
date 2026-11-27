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

const INTEGER = /^(0|[1-9]\d*)$/

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }

  const rawLimit = request.nextUrl.searchParams.get('limit') ?? '10'
  const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined
  const limit = INTEGER.test(rawLimit) ? Number(rawLimit) : Number.NaN
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 50 ||
    (cursor !== undefined && (cursor.length < 1 || cursor.length > 256))
  ) {
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'A limit from 1 through 50 and a bounded cursor are required.',
        correlationId,
      ),
      user,
    )
  }

  try {
    return carryCareSession(
      careSuccessResponse(
        await careClient.supportPlanHistory(
          user.accessToken,
          limit,
          cursor,
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
