export type AnalyticsRange = 7 | 30 | 90

export type ActivitySourceState =
  'available' | 'empty' | 'limited' | 'unavailable'

export type ActivityDashboardSummary = Readonly<{
  totalActivities: number
  activeDays: number
  assessmentSubmissions: number
  journalEntries: number
  journalActiveDays: number
  emotionCheckIns: number
  emotionActiveDays: number
  supportCompleted: number
  supportSkipped: number
  appointmentEvents: number
  currentEmotionStreak: number
  latestAssessmentInstrument: 'PHQ9' | 'GAD7' | null
  latestAssessmentSubmittedAt: string | null
}>

export type ActivityDashboardDay = Readonly<{
  localDate: string
  assessments: number
  journals: number
  emotions: number
  emotionLevel: number | null
  supportCompleted: number
  supportSkipped: number
  appointments: number
  total: number
}>

export type ActivityDashboard = Readonly<{
  asOfLocalDate: string
  startLocalDate: string
  timezone: string
  summary: ActivityDashboardSummary
  daily: ActivityDashboardDay[]
  sources: Readonly<{
    assessments: ActivitySourceState
    journals: ActivitySourceState
    emotions: ActivitySourceState
    supportPlans: ActivitySourceState
    appointments: ActivitySourceState
  }>
  partial: boolean
  bounded: Readonly<{
    windowDays: AnalyticsRange
    assessmentLimit: number
    journalLimit: number
    emotionLimit: number
    appointmentLimit: number
  }>
}>

const SOURCE_STATES = new Set<ActivitySourceState>([
  'available',
  'empty',
  'limited',
  'unavailable',
])
const RANGES = new Set<AnalyticsRange>([7, 30, 90])

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort()
  return (
    actual.length === keys.length && keys.every((key) => actual.includes(key))
  )
}

function count(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0
}

function localDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  )
}

function instant(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function addDays(value: string, days: number) {
  const result = new Date(`${value}T00:00:00.000Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

function parseDay(value: unknown): ActivityDashboardDay | null {
  const day = record(value)
  const keys = [
    'localDate',
    'assessments',
    'journals',
    'emotions',
    'emotionLevel',
    'supportCompleted',
    'supportSkipped',
    'appointments',
    'total',
  ] as const
  if (!day || !exactKeys(day, keys) || !localDate(day.localDate)) return null
  if (
    !keys
      .filter((key) => !['localDate', 'emotionLevel'].includes(key))
      .every((key) => count(day[key]))
  )
    return null
  if (
    day.emotionLevel !== null &&
    (!count(day.emotionLevel) || day.emotionLevel < 1 || day.emotionLevel > 5)
  )
    return null
  if (
    (day.emotions === 0 && day.emotionLevel !== null) ||
    (Number(day.emotions) > 0 && day.emotionLevel === null)
  )
    return null
  const total =
    Number(day.assessments) +
    Number(day.journals) +
    Number(day.emotions) +
    Number(day.supportCompleted) +
    Number(day.supportSkipped) +
    Number(day.appointments)
  if (day.total !== total) return null
  return day as ActivityDashboardDay
}

export function parseActivityDashboard(
  value: unknown,
): ActivityDashboard | null {
  const dashboard = record(value)
  if (
    !dashboard ||
    !exactKeys(dashboard, [
      'asOfLocalDate',
      'startLocalDate',
      'timezone',
      'summary',
      'daily',
      'sources',
      'partial',
      'bounded',
    ]) ||
    !localDate(dashboard.asOfLocalDate) ||
    !localDate(dashboard.startLocalDate) ||
    typeof dashboard.timezone !== 'string' ||
    typeof dashboard.partial !== 'boolean' ||
    !Array.isArray(dashboard.daily)
  )
    return null

  const summary = record(dashboard.summary)
  const numericSummaryKeys = [
    'totalActivities',
    'activeDays',
    'assessmentSubmissions',
    'journalEntries',
    'journalActiveDays',
    'emotionCheckIns',
    'emotionActiveDays',
    'supportCompleted',
    'supportSkipped',
    'appointmentEvents',
    'currentEmotionStreak',
  ] as const
  const summaryKeys = [
    ...numericSummaryKeys,
    'latestAssessmentInstrument',
    'latestAssessmentSubmittedAt',
  ] as const
  const sources = record(dashboard.sources)
  const sourceKeys = [
    'assessments',
    'journals',
    'emotions',
    'supportPlans',
    'appointments',
  ] as const
  const bounded = record(dashboard.bounded)
  const boundKeys = [
    'windowDays',
    'assessmentLimit',
    'journalLimit',
    'emotionLimit',
    'appointmentLimit',
  ] as const

  if (
    !summary ||
    !exactKeys(summary, summaryKeys) ||
    !numericSummaryKeys.every((key) => count(summary[key])) ||
    ![null, 'PHQ9', 'GAD7'].includes(
      summary.latestAssessmentInstrument as null | string,
    ) ||
    !(
      summary.latestAssessmentSubmittedAt === null ||
      instant(summary.latestAssessmentSubmittedAt)
    ) ||
    (summary.latestAssessmentInstrument === null) !==
      (summary.latestAssessmentSubmittedAt === null) ||
    !sources ||
    !exactKeys(sources, sourceKeys) ||
    !sourceKeys.every(
      (key) =>
        typeof sources[key] === 'string' &&
        SOURCE_STATES.has(sources[key] as ActivitySourceState),
    ) ||
    !bounded ||
    !exactKeys(bounded, boundKeys) ||
    !boundKeys.every((key) => count(bounded[key])) ||
    !RANGES.has(bounded.windowDays as AnalyticsRange)
  )
    return null

  const range = bounded.windowDays as AnalyticsRange
  const daily = dashboard.daily.map(parseDay)
  if (
    daily.length !== range ||
    daily.some((day) => !day) ||
    daily[0]?.localDate !== dashboard.startLocalDate ||
    daily.at(-1)?.localDate !== dashboard.asOfLocalDate ||
    daily.some(
      (day, index) =>
        day?.localDate !== addDays(dashboard.startLocalDate as string, index),
    )
  )
    return null

  const validDays = daily as ActivityDashboardDay[]
  const sum = (field: keyof ActivityDashboardDay) =>
    validDays.reduce((total, day) => total + Number(day[field] ?? 0), 0)
  if (
    summary.totalActivities !== sum('total') ||
    summary.assessmentSubmissions !== sum('assessments') ||
    summary.journalEntries !== sum('journals') ||
    summary.emotionCheckIns !== sum('emotions') ||
    summary.supportCompleted !== sum('supportCompleted') ||
    summary.supportSkipped !== sum('supportSkipped') ||
    summary.appointmentEvents !== sum('appointments') ||
    summary.activeDays !== validDays.filter((day) => day.total > 0).length ||
    summary.journalActiveDays !==
      validDays.filter((day) => day.journals > 0).length ||
    summary.emotionActiveDays !==
      validDays.filter((day) => day.emotions > 0).length ||
    Number(summary.currentEmotionStreak) > range
  )
    return null

  return dashboard as ActivityDashboard
}
