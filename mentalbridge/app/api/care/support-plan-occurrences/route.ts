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

function isDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
}

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }

  const from = request.nextUrl.searchParams.get('from')
  const through = request.nextUrl.searchParams.get('through')
  if (!isDate(from) || !isDate(through)) {
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'Valid from and through local dates are required.',
        correlationId,
      ),
      user,
    )
  }

  try {
    return carryCareSession(
      careSuccessResponse(
        await careClient.supportPlanOccurrences(
          user.accessToken,
          from,
          through,
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
