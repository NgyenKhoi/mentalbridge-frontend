import type { NextRequest } from 'next/server'

import {
  composeLookBack,
  latestPerInstrument,
  latestScreeningLevels,
  validTimezone,
} from '@/features/look-back/look-back-model'
import { toMamTrajectoryView } from '@/features/mam/mam-trajectory-source'
import { ApiError } from '@/lib/api/api-error'
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

// Mầm's slim read (MB-897): 14 local days of check-in level and the latest band status. It composes the same
// look-back view but never asks the companion for conversations, so no text of the user's own is fetched.
export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  const timezone = request.nextUrl.searchParams.get('timezone')
  if (
    [...request.nextUrl.searchParams.keys()].some(
      (key) => key !== 'timezone',
    ) ||
    request.nextUrl.searchParams.getAll('timezone').length !== 1 ||
    !validTimezone(timezone)
  )
    return localProblem(
      400,
      'VALIDATION_FAILED',
      'Múi giờ không hợp lệ.',
      correlationId,
    )

  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }

  const token = user.accessToken
  const [dashboard, history] = await Promise.allSettled([
    careClient.activityDashboard(token, timezone, 30, correlationId),
    careClient.history(token, undefined, 20, correlationId),
  ])
  if (dashboard.status === 'rejected')
    return carryCareSession(
      careErrorResponse(dashboard.reason, correlationId),
      user,
    )

  const latest =
    history.status === 'fulfilled'
      ? latestScreeningLevels(history.value.items)
      : { levels: [], unknown: false }
  let degraded = history.status === 'rejected' || latest.unknown
  const progress = await Promise.allSettled(
    (history.status === 'fulfilled'
      ? latestPerInstrument(history.value.items)
      : []
    ).map((item) =>
      careClient.progress(token, item.assessmentId, correlationId),
    ),
  )
  for (const result of progress)
    if (
      result.status === 'rejected' &&
      !(
        result.reason instanceof ApiError &&
        result.reason.code === 'INSUFFICIENT_COMPARABLE_DATA'
      )
    )
      degraded = true

  return carryCareSession(
    careSuccessResponse(
      toMamTrajectoryView(
        composeLookBack({
          dashboard: dashboard.value,
          conversations: null,
          latestLevels: latest.levels,
          progress: progress.flatMap((result) =>
            result.status === 'fulfilled' ? [result.value] : [],
          ),
          degraded,
        }),
        degraded,
      ),
      correlationId,
    ),
    user,
  )
}
