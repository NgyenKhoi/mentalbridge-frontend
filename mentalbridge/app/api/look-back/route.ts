import type { NextRequest } from 'next/server'

import { buildJourney } from '@/features/look-back/look-back-chapters'
import {
  composeLookBack,
  localDateOf,
  latestPerInstrument,
  latestScreeningLevels,
  validTimezone,
} from '@/features/look-back/look-back-model'
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
import { supportPlanActionClient } from '@/lib/care/support-plan-action-client'
import { companionClient } from '@/lib/companion/companion-client'
import { consultationClient } from '@/lib/consultation/consultation-client'

// Missing consent or no access (403/404) hides a section quietly; a timeout, a rate limit or an outage also says so.
const quietlyHidden = (error: unknown) =>
  error instanceof ApiError && (error.status === 403 || error.status === 404)

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
  const [dashboard, history, companion, appointments, summaries, plan] =
    await Promise.allSettled([
      // 90 days reach the older chapters; the rolling view keeps the last 14 local days.
      careClient.activityDashboard(token, timezone, 90, correlationId),
      careClient.history(token, undefined, 20, correlationId),
      companionClient.list(token, correlationId),
      consultationClient.appointments(token, correlationId),
      careClient.reassessmentSummaryHistory(
        token,
        undefined,
        50,
        correlationId,
      ),
      supportPlanActionClient.current(token, correlationId),
    ])
  // The mood chart is the point of the page: without it there is nothing to show.
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
      // A single screening is not a failure; there is just nothing to compare.
      !(
        result.reason instanceof ApiError &&
        result.reason.code === 'INSUFFICIENT_COMPARABLE_DATA'
      )
    )
      degraded = true
  if (companion.status === 'rejected' && !quietlyHidden(companion.reason))
    degraded = true
  if (appointments.status === 'rejected') degraded = true
  // No plan (or no access to one) is normal; any other failure leaves the running chapter out.
  if (plan.status === 'rejected' && !quietlyHidden(plan.reason)) degraded = true
  // Without the summaries nothing can say which chapter is open or closed.
  if (summaries.status === 'rejected') degraded = true
  const journey =
    summaries.status === 'fulfilled'
      ? buildJourney({
          summaries: summaries.value.items,
          dashboard: dashboard.value,
          cycle:
            plan.status === 'fulfilled' ? (plan.value.cycle ?? null) : null,
          timeZone: timezone,
        })
      : null

  const from = journey?.running?.startLocalDate
  const last14 = dashboard.value.daily.slice(-14)
  // The same window the composition uses: a running chapter's own days, else the last 14.
  const firstDate = (
    last14.find((day) => !from || day.localDate >= from) ?? last14[0]
  ).localDate
  const lastDate = dashboard.value.asOfLocalDate
  const completedSessions =
    appointments.status === 'fulfilled'
      ? appointments.value.data.items.filter((item) => {
          if (item.status !== 'COMPLETED' || !item.sessionEndedAt) return false
          const endedOn = localDateOf(
            item.sessionEndedAt,
            dashboard.value.timezone,
          )
          return endedOn >= firstDate && endedOn <= lastDate
        }).length
      : null

  return carryCareSession(
    careSuccessResponse(
      composeLookBack({
        dashboard: dashboard.value,
        conversations:
          companion.status === 'fulfilled' ? companion.value.items : null,
        latestLevels: latest.levels,
        completedSessions,
        progress: progress.flatMap((result) =>
          result.status === 'fulfilled' ? [result.value] : [],
        ),
        degraded,
        journey,
        fromLocalDate: from,
      }),
      correlationId,
    ),
    user,
  )
}
