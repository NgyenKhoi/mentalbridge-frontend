import type {
  ActivityDashboard,
  ActivityDashboardDay,
} from '@/features/analytics/api/activity-dashboard-contract'
import type {
  AssessmentProgress,
  AssessmentSummary,
  Instrument,
  ScreeningLevel,
} from '@/features/assessment/api/care-contract'
import type { CompanionConversationSummary } from '@/lib/companion/companion-contract'

export const WINDOW_DAYS = 14
export const MIN_RECORD_DAYS = 5
const MOOD_THRESHOLD = 0.5
// A "bordering" screening: the earlier one may sit just before the window.
const SCREENING_REACH_DAYS = 30
const MAX_CONVERSATIONS = 30

// UNKNOWN: Care could not read the mood source, so nothing can be said about the mood either way.
export type LookBackNarrative =
  'IMPROVING' | 'STEADY' | 'HARDER' | 'SPARSE' | 'UNKNOWN'
export type LookBackNextStep = 'PLAN' | 'SUPPORT' | 'CHECK_IN'

export type LookBackWeek = Readonly<{
  moodAverage: number | null
  // null when Care could not read that source: unknown is not zero.
  checkInDays: number | null
  journalDays: number | null
  supportCompleted: number | null
  supportSkipped: number | null
}>

export type LookBackScreening = Readonly<{
  instrument: Instrument
  previous: Readonly<{
    level: ScreeningLevel
    score: number
    localDate: string
  }>
  current: Readonly<{ level: ScreeningLevel; score: number; localDate: string }>
  direction: 'LOWER' | 'SAME' | 'HIGHER'
}>

export type LookBack = Readonly<{
  startLocalDate: string
  asOfLocalDate: string
  days: ReadonlyArray<
    Readonly<{ localDate: string; emotionLevel: number | null }>
  >
  weeks: readonly [LookBackWeek, LookBackWeek]
  recordDays: number
  narrative: LookBackNarrative
  appointments: number | null
  /** null hides the section: no consent, or the list could not be read. */
  conversations: ReadonlyArray<
    Readonly<{ id: string; title: string | null; localDate: string }>
  > | null
  screening: readonly LookBackScreening[]
  professionalPointer: boolean
  nextStep: LookBackNextStep
  partial: boolean
}>

const LEVEL_ORDER: readonly ScreeningLevel[] = [
  'MINIMAL',
  'MILD',
  'MODERATE',
  'MODERATELY_SEVERE',
  'SEVERE',
]

const average = (values: readonly number[]) =>
  values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length

export function narrativeFor(
  recordDays: number,
  firstWeek: number | null,
  secondWeek: number | null,
): LookBackNarrative {
  // A week with no mood has nothing to compare, so the chart would pretend.
  if (recordDays < MIN_RECORD_DAYS || firstWeek === null || secondWeek === null)
    return 'SPARSE'
  const delta = Math.round((secondWeek - firstWeek) * 1000) / 1000
  if (delta >= MOOD_THRESHOLD) return 'IMPROVING'
  if (delta <= -MOOD_THRESHOLD) return 'HARDER'
  return 'STEADY'
}

/** The narrative of the last 14 days; the page and the Home card share it so the card never opens an empty page. */
export function narrativeOfDashboard(
  dashboard: ActivityDashboard,
): LookBackNarrative {
  if (dashboard.sources.emotions === 'unavailable') return 'UNKNOWN'
  const days = dashboard.daily.slice(-WINDOW_DAYS)
  const mean = (part: typeof days) =>
    average(
      part.flatMap((day) =>
        day.emotionLevel === null ? [] : [day.emotionLevel],
      ),
    )
  return narrativeFor(
    days.filter((day) => day.total > 0).length,
    mean(days.slice(0, 7)),
    mean(days.slice(7)),
  )
}

export function validTimezone(value: string | null): value is string {
  if (!value || value.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

export const isModerateOrAbove = (level: ScreeningLevel) =>
  LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf('MODERATE')

export function localDateOf(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

const shiftDate = (localDate: string, days: number) => {
  const date = new Date(`${localDate}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Newest assessment of each instrument, so the route asks Care for at most two progress views. */
export function latestPerInstrument(items: readonly AssessmentSummary[]) {
  const latest = new Map<Instrument, AssessmentSummary>()
  for (const item of items) {
    const known = latest.get(item.instrument)
    if (!known || Date.parse(item.submittedAt) > Date.parse(known.submittedAt))
      latest.set(item.instrument, item)
  }
  return [...latest.values()]
}

/**
 * The band of the LATEST screening of each instrument, whether or not an earlier one exists to compare with:
 * a first moderate-or-higher screening must show the professional pointer and hold celebrations back. A level this
 * client does not know sets `unknown`, which the route reports as partial (fail closed).
 */
export function latestScreeningLevels(items: readonly AssessmentSummary[]): {
  levels: ScreeningLevel[]
  unknown: boolean
} {
  const levels: ScreeningLevel[] = []
  let unknown = false
  for (const item of latestPerInstrument(items)) {
    const level = item.result?.screeningLevel
    if (level && LEVEL_ORDER.includes(level)) levels.push(level)
    else unknown = true
  }
  return { levels, unknown }
}

type Sources = ActivityDashboard['sources']
const readable = (sources: Sources, key: keyof Sources) =>
  sources[key] !== 'unavailable'
const total = (
  days: readonly ActivityDashboardDay[],
  pick: (day: ActivityDashboardDay) => number,
) => days.reduce((sum, day) => sum + pick(day), 0)

function week(
  days: readonly ActivityDashboardDay[],
  sources: Sources,
): LookBackWeek {
  const emotions = readable(sources, 'emotions')
  const support = readable(sources, 'supportPlans')
  return {
    moodAverage: emotions
      ? average(
          days.flatMap((day) =>
            day.emotionLevel === null ? [] : [day.emotionLevel],
          ),
        )
      : null,
    checkInDays: emotions
      ? days.filter((day) => day.emotions > 0).length
      : null,
    journalDays: readable(sources, 'journals')
      ? days.filter((day) => day.journals > 0).length
      : null,
    supportCompleted: support
      ? total(days, (day) => day.supportCompleted)
      : null,
    supportSkipped: support ? total(days, (day) => day.supportSkipped) : null,
  }
}

function screeningFrom(
  progress: AssessmentProgress,
  window: { start: string; asOf: string },
  timeZone: string,
): LookBackScreening | null {
  const { previous, current } = progress
  const from = LEVEL_ORDER.indexOf(previous.screeningLevel)
  const to = LEVEL_ORDER.indexOf(current.screeningLevel)
  const previousDate = localDateOf(previous.submittedAt, timeZone)
  const currentDate = localDateOf(current.submittedAt, timeZone)
  // Unknown levels and screenings outside the look-back fail closed.
  if (
    from < 0 ||
    to < 0 ||
    currentDate < window.start ||
    currentDate > window.asOf ||
    previousDate < shiftDate(window.asOf, 1 - SCREENING_REACH_DAYS)
  )
    return null
  return {
    instrument: progress.instrument,
    previous: {
      level: previous.screeningLevel,
      score: previous.totalScore,
      localDate: previousDate,
    },
    current: {
      level: current.screeningLevel,
      score: current.totalScore,
      localDate: currentDate,
    },
    direction: to < from ? 'LOWER' : to > from ? 'HIGHER' : 'SAME',
  }
}

export function composeLookBack({
  dashboard,
  conversations,
  progress,
  latestLevels = [],
  degraded,
}: Readonly<{
  dashboard: ActivityDashboard
  conversations: readonly CompanionConversationSummary[] | null
  progress: readonly AssessmentProgress[]
  /** The latest screening band of each instrument (`latestScreeningLevels`), with or without a previous one. */
  latestLevels?: readonly ScreeningLevel[]
  /** An optional source failed for a reason other than missing consent. */
  degraded: boolean
}>): LookBack {
  const days = dashboard.daily.slice(-WINDOW_DAYS)
  const start = days[0].localDate
  const asOf = dashboard.asOfLocalDate
  const weeks = [
    week(days.slice(0, 7), dashboard.sources),
    week(days.slice(7), dashboard.sources),
  ] as const
  const recordDays = days.filter((day) => day.total > 0).length
  const narrative = narrativeOfDashboard(dashboard)
  const screening = progress
    .map((item) => screeningFrom(item, { start, asOf }, dashboard.timezone))
    .filter((item): item is LookBackScreening => item !== null)
  const professionalPointer =
    screening.some((item) => isModerateOrAbove(item.current.level)) ||
    latestLevels.some(isModerateOrAbove)

  return {
    startLocalDate: start,
    asOfLocalDate: asOf,
    days: days.map(({ localDate, emotionLevel }) => ({
      localDate,
      emotionLevel,
    })),
    weeks,
    recordDays,
    narrative,
    appointments: readable(dashboard.sources, 'appointments')
      ? total(days, (day) => day.appointments)
      : null,
    conversations:
      conversations === null
        ? null
        : conversations
            .map((item) => ({
              id: item.conversationId,
              title: item.title.trim() || null,
              localDate: localDateOf(item.updatedAt, dashboard.timezone),
              updatedAt: item.updatedAt,
            }))
            .filter((item) => item.localDate >= start && item.localDate <= asOf)
            .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
            .slice(0, MAX_CONVERSATIONS)
            .map(({ id, title, localDate }) => ({ id, title, localDate })),
    screening,
    professionalPointer,
    // Help first: a harder fortnight or a moderate band outranks a thin record.
    nextStep:
      narrative === 'HARDER' || professionalPointer
        ? 'SUPPORT'
        : narrative === 'SPARSE'
          ? 'CHECK_IN'
          : 'PLAN',
    partial: dashboard.partial || degraded || narrative === 'UNKNOWN',
  }
}
