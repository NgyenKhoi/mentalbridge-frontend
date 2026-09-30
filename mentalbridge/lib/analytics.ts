import type {
  ActivityDashboard,
  AnalyticsRange,
} from '@/features/analytics/api/activity-dashboard-contract'

export const ACTIVITY_KINDS = [
  'assessments',
  'journals',
  'emotions',
  'support',
  'appointments',
] as const

export type ActivityKind = (typeof ACTIVITY_KINDS)[number]

export type AnalyticsDay = Readonly<{
  localDate: string
  total: number
  byKind: Readonly<Record<ActivityKind, number>>
}>

export type Analytics = Readonly<{
  range: AnalyticsRange
  total: number
  byKind: Readonly<Record<ActivityKind, number>>
  byDay: AnalyticsDay[]
  activeDays: number
  emotionSeries: ReadonlyArray<
    Readonly<{ localDate: string; level: number | null }>
  >
  emotionActiveDays: number
  supportCompleted: number
  supportSkipped: number
  streak: number
  latestAssessment: Readonly<{
    instrument: 'PHQ9' | 'GAD7'
    submittedAt: string
  }> | null
  appointmentCount: number
  startLocalDate: string
  asOfLocalDate: string
  timezone: string
  partial: boolean
}>

export function buildAnalytics(
  events: ActivityDashboard,
  range: AnalyticsRange,
): Analytics {
  if (events.bounded.windowDays !== range)
    throw new Error('Analytics payload does not match the selected range.')

  const byKind = {
    assessments: events.summary.assessmentSubmissions,
    journals: events.summary.journalEntries,
    emotions: events.summary.emotionCheckIns,
    support: events.summary.supportCompleted + events.summary.supportSkipped,
    appointments: events.summary.appointmentEvents,
  }
  const byDay = events.daily.map((day) => ({
    localDate: day.localDate,
    total: day.total,
    byKind: {
      assessments: day.assessments,
      journals: day.journals,
      emotions: day.emotions,
      support: day.supportCompleted + day.supportSkipped,
      appointments: day.appointments,
    },
  }))
  const computedTotal = ACTIVITY_KINDS.reduce(
    (sum, kind) => sum + byKind[kind],
    0,
  )
  if (computedTotal !== events.summary.totalActivities)
    throw new Error('Analytics totals are inconsistent.')

  const instrument = events.summary.latestAssessmentInstrument
  const submittedAt = events.summary.latestAssessmentSubmittedAt
  return {
    range,
    total: computedTotal,
    byKind,
    byDay,
    activeDays: events.summary.activeDays,
    emotionSeries: events.daily.map((day) => ({
      localDate: day.localDate,
      level: day.emotionLevel,
    })),
    emotionActiveDays: events.summary.emotionActiveDays,
    supportCompleted: events.summary.supportCompleted,
    supportSkipped: events.summary.supportSkipped,
    streak: events.summary.currentEmotionStreak,
    latestAssessment:
      instrument && submittedAt ? { instrument, submittedAt } : null,
    appointmentCount: events.summary.appointmentEvents,
    startLocalDate: events.startLocalDate,
    asOfLocalDate: events.asOfLocalDate,
    timezone: events.timezone,
    partial: events.partial,
  }
}
