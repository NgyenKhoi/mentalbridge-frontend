import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import type {
  AnalyticsOverview,
  OverviewSource,
  SupportActivityOverview,
} from '@/features/analytics/api/analytics-overview-contract'
import { ApiError } from '@/lib/api/api-error'
import {
  CORRELATION_HEADER,
  correlationIdFrom,
  localProblem,
} from '@/lib/auth/bff-response'
import {
  authenticatedCareUser,
  careAuthenticationFailure,
  carryCareSession,
} from '@/lib/care/authenticated-user'
import { careClient } from '@/lib/care/care-client'
import { consultationClient } from '@/lib/consultation/consultation-client'
import { emotionCheckInClient } from '@/lib/emotion-check-in/client'

const WINDOW_DAYS = 30 as const

function validTimezone(value: string | null): value is string {
  if (!value || value.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

function localDateIn(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)?.value
  const year = part('year')
  const month = part('month')
  const day = part('day')
  if (!year || !month || !day) throw new Error('Local date is unavailable.')
  return `${year}-${month}-${day}`
}

function minusDays(localDate: string, days: number) {
  const date = new Date(`${localDate}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

function available<T>(data: T): OverviewSource<T> {
  return { state: 'available', data }
}

const unavailable = { state: 'unavailable' } as const

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
      'Múi giờ xem tổng quan không hợp lệ.',
      correlationId,
    )

  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }

  const asOfLocalDate = localDateIn(timezone)
  const fromLocalDate = minusDays(asOfLocalDate, WINDOW_DAYS - 1)
  const [emotion, assessments, supportActivities, appointments] =
    await Promise.allSettled([
      emotionCheckInClient.progress(user.accessToken, timezone, correlationId),
      careClient.history(user.accessToken, undefined, 50, correlationId),
      careClient.supportPlanOccurrences(
        user.accessToken,
        fromLocalDate,
        asOfLocalDate,
        correlationId,
      ),
      consultationClient.appointments(user.accessToken, correlationId),
    ])

  const overview: AnalyticsOverview = {
    asOfLocalDate,
    timezone,
    emotion: emotionSource(emotion),
    assessments:
      assessments.status === 'fulfilled'
        ? available({
            count: assessments.value.items.length,
            countIsLowerBound: assessments.value.hasMore,
            latestSubmittedAt: assessments.value.items[0]?.submittedAt ?? null,
            latestInstrument: assessments.value.items[0]?.instrument ?? null,
          })
        : unavailable,
    supportActivities: supportSource(supportActivities),
    appointments:
      appointments.status === 'fulfilled'
        ? available({
            totalCount: appointments.value.data.count,
            activeCount: appointments.value.data.items.filter((appointment) =>
              ['REQUESTED', 'CONFIRMED', 'IN_PROGRESS'].includes(
                appointment.status,
              ),
            ).length,
          })
        : unavailable,
  }

  const response = NextResponse.json(overview)
  response.headers.set(CORRELATION_HEADER, correlationId)
  response.headers.set('Cache-Control', 'no-store')
  return carryCareSession(response, user)
}

function emotionSource(
  result: PromiseSettledResult<
    Awaited<ReturnType<typeof emotionCheckInClient.progress>>
  >,
): AnalyticsOverview['emotion'] {
  if (result.status === 'rejected') return unavailable
  const window = result.value.windows.find(
    (candidate) => candidate.days === WINDOW_DAYS,
  )
  if (!window) return unavailable
  return available({
    currentStreak: result.value.currentStreak,
    checkedInDays: window.checkedInDays,
    windowDays: WINDOW_DAYS,
  })
}

function supportSource(
  result: PromiseSettledResult<
    Awaited<ReturnType<typeof careClient.supportPlanOccurrences>>
  >,
): OverviewSource<SupportActivityOverview> {
  if (result.status === 'rejected') {
    if (result.reason instanceof ApiError && result.reason.status === 404)
      return { state: 'empty' }
    return unavailable
  }

  return available({
    completedCount: result.value.occurrences.filter(
      (occurrence) => occurrence.state === 'COMPLETED',
    ).length,
    skippedCount: result.value.occurrences.filter(
      (occurrence) => occurrence.state === 'SKIPPED',
    ).length,
    scheduledOrMissedCount: result.value.occurrences.filter((occurrence) =>
      ['SCHEDULED', 'MISSED'].includes(occurrence.displayState),
    ).length,
    windowDays: WINDOW_DAYS,
  })
}
