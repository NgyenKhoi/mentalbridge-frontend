import type { ActivityDashboard } from '@/features/analytics/api/activity-dashboard-contract'

import type { ReassessmentSummary } from '../api/care-contract'

type Period = ReassessmentSummary['currentPeriod']
type ReflectionSource = NonNullable<
  ReassessmentSummary['activityReflection']
>['sources'][number]

const DAY_MS = 86_400_000

const ordinal = (localDate: string) => {
  const [year, month, day] = localDate.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS)
}
const fromOrdinal = (value: number) =>
  new Date(value * DAY_MS).toISOString().slice(0, 10)

const two = (value: number) => String(value).padStart(2, '0')

/** "dd/mm" (and "dd/mm/yyyy" with year) in the user's local time; vi-VN locale output varies by browser. */
export function formatDayMonth(iso: string, withYear = false) {
  const date = new Date(iso)
  return `${two(date.getDate())}/${two(date.getMonth() + 1)}${
    withYear ? `/${date.getFullYear()}` : ''
  }`
}

export function localDateIn(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

/** Care periods are half-open UTC ranges (normally 14 days); the dots follow the user's calendar days. */
export function periodDates(period: Period, timeZone: string) {
  const days = Math.max(
    1,
    Math.round(
      (Date.parse(period.endAt) - Date.parse(period.startAt)) / DAY_MS,
    ),
  )
  const start = ordinal(localDateIn(period.startAt, timeZone))
  return Array.from({ length: days }, (_, index) => fromOrdinal(start + index))
}

/** Smallest activity-dashboard window that still reaches the previous period, or null when it is older than 90 days. */
export function moodRangeFor(previous: Period, now = Date.now()) {
  const age = (now - Date.parse(previous.startAt)) / DAY_MS
  return age <= 29 ? 30 : age <= 89 ? 90 : null
}

export type MoodRow = Readonly<{
  days: ReadonlyArray<Readonly<{ localDate: string; level: number | null }>>
  checkedDays: number
  goodDays: number
}>

export function moodRow(
  dashboard: ActivityDashboard,
  period: Period,
  timeZone: string,
): MoodRow {
  const levels = new Map(
    dashboard.daily.map((day) => [day.localDate, day.emotionLevel]),
  )
  const days = periodDates(period, timeZone).map((localDate) => ({
    localDate,
    level: levels.get(localDate) ?? null,
  }))
  return {
    days,
    checkedDays: days.filter((day) => day.level !== null).length,
    goodDays: days.filter((day) => (day.level ?? 0) >= 4).length,
  }
}

const helpRank: Record<string, number> = { VERY_HELPFUL: 2, HELPFUL: 1 }

/** Up to three current-period activities the user found helpful, most helpful then most recent. */
export function helpfulSources(summary: ReassessmentSummary) {
  return (summary.activityReflection?.sources ?? [])
    .filter(
      (source): source is ReflectionSource =>
        source.period === 'CURRENT' &&
        (helpRank[source.helpfulness ?? ''] ?? 0) > 0,
    )
    .sort(
      (a, b) =>
        helpRank[b.helpfulness ?? ''] - helpRank[a.helpfulness ?? ''] ||
        Date.parse(b.engagementUpdatedAt) - Date.parse(a.engagementUpdatedAt),
    )
    .slice(0, 3)
}

const barrierLabels: Record<string, string> = {
  LOW_ENERGY: 'Ít năng lượng',
  NOT_ENOUGH_TIME: 'Không đủ thời gian',
  DIFFICULT_TO_START: 'Khó bắt đầu',
  NOT_A_GOOD_FIT: 'Chưa hợp với bạn',
  OTHER: 'Lý do khác',
}

/** The two most common reasons for skipping in the current period. */
export function topBarriers(summary: ReassessmentSummary) {
  const counts = new Map<string, number>()
  for (const source of summary.supportPlanEngagement.sources ?? []) {
    if (
      source.period === 'CURRENT' &&
      source.state === 'SKIPPED' &&
      source.barrierCode
    )
      counts.set(source.barrierCode, (counts.get(source.barrierCode) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([code]) => barrierLabels[code] ?? barrierLabels.OTHER)
}
