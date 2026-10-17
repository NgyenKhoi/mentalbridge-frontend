import type { NextRequest } from 'next/server'

import type { AnalyticsRange } from '@/features/analytics/api/activity-dashboard-contract'
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

const RANGES = new Set<AnalyticsRange>([7, 30, 90])

function validTimezone(value: string | null): value is string {
  if (!value || value.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const timezone = request.nextUrl.searchParams.get('timezone')
  const range = Number(request.nextUrl.searchParams.get('range'))
  if (
    [...request.nextUrl.searchParams.keys()].some(
      (key) => !['timezone', 'range'].includes(key),
    ) ||
    request.nextUrl.searchParams.getAll('timezone').length !== 1 ||
    request.nextUrl.searchParams.getAll('range').length !== 1 ||
    !validTimezone(timezone) ||
    !RANGES.has(range as AnalyticsRange)
  )
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Khoảng thời gian hoặc múi giờ thống kê không hợp lệ.',
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
        await careClient.activityDashboard(
          user.accessToken,
          timezone,
          range as AnalyticsRange,
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
