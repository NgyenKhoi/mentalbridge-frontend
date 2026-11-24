import type {
  ActivityDashboard,
  ActivityDashboardDay,
} from '@/features/analytics/api/activity-dashboard-contract'
import type {
  Instrument,
  ReassessmentSummary,
  ScreeningLevel,
} from '@/features/assessment/api/care-contract'
import { helpfulSources } from '@/features/assessment/components/reassessment-review-model'
import type { SupportPlanV3 } from '@/features/support-plan/api/support-plan-contract'

import { isModerateOrAbove, levelRank, localDateOf } from './look-back-model'

export type SupportPlanCycle = NonNullable<SupportPlanV3['cycle']>

export type ChapterBand = Readonly<{
  instrument: Instrument
  level: ScreeningLevel
  score: number
}>
export type ChapterScreening = Readonly<{
  instrument: Instrument
  previous: ChapterBand | null
  current: ChapterBand
  direction: 'INCREASED' | 'DECREASED' | 'UNCHANGED' | 'INSUFFICIENT_DATA'
}>
export type ChapterDay = Readonly<{
  localDate: string
  emotionLevel: number | null
}>
export type ChapterReflection = Readonly<{
  occurrenceId: string
  localDate: string | null
  resourceId: string | null
  helpfulness: 'HELPFUL' | 'VERY_HELPFUL'
  reflection: string | null
}>
export type LookBackChapter = Readonly<{
  number: number
  summaryId: string
  startLocalDate: string
  endLocalDate: string
  composedAt: string
  screening: readonly ChapterScreening[]
  support: Readonly<{
    completed: number | null
    skipped: number | null
    previousCompleted: number | null
    previousSkipped: number | null
  }>
  journal: Readonly<{ current: number | null; previous: number | null }>
  reflections: readonly ChapterReflection[]
  /** null = outside the 90-day activity window (or the mood source could not be read). */
  days: readonly ChapterDay[] | null
  /** Days with a mood of "tốt" or better (level 4+); null when `days` is. */
  goodDays: number | null
  checkInDays: number | null
  /** Check-in days of the 14 days before this chapter; null when those days are not available either. */
  previousCheckInDays: number | null
}>
export type RunningChapter = Readonly<{
  number: number
  startLocalDate: string
  currentDay: number
  lengthDays: number
  state: 'IN_PROGRESS' | 'PAUSED' | 'REVIEW_DUE'
  goodDays: number | null
  supportCompleted: number | null
}>
export type LookBackJourney = Readonly<{
  /** Chapter 1's `previous` bands ("Lúc bắt đầu"); empty when it has none. */
  baseline: readonly ChapterBand[]
  /** Oldest to newest, numbered 1..n. */
  chapters: readonly LookBackChapter[]
  /** null when there is no cycle running, or the cycle is already closed by a reassessment. */
  running: RunningChapter | null
  /** The cycle waits for the owner's keep/change choice although a reassessment already closed it. */
  closedAwaitingChoice: boolean
}>

type Period = ReassessmentSummary['currentPeriod']
const RUNNING_STATES = ['IN_PROGRESS', 'PAUSED', 'REVIEW_DUE'] as const

const overlaps = (a: Period, b: Period) =>
  Date.parse(a.startAt) < Date.parse(b.endAt) &&
  Date.parse(b.startAt) < Date.parse(a.endAt)

// Periods are half-open, so the last local day is the one containing the instant before endAt.
const lastDayOf = (period: Period, timeZone: string) =>
  localDateOf(new Date(Date.parse(period.endAt) - 1).toISOString(), timeZone)

/** The days between two local dates, or null when the window starts after `from` (the rest is not there to read). */
function slice(
  daily: readonly ActivityDashboardDay[] | null,
  from: string,
  to: string,
) {
  if (!daily?.length || daily[0].localDate > from) return null
  return daily.filter((day) => day.localDate >= from && day.localDate <= to)
}

const band = (
  instrument: Instrument,
  point: { screeningLevel: ScreeningLevel; totalScore: number },
): ChapterBand => ({
  instrument,
  level: point.screeningLevel,
  score: point.totalScore,
})

function chapterOf(
  summary: ReassessmentSummary,
  number: number,
  daily: readonly ActivityDashboardDay[] | null,
  timeZone: string,
): LookBackChapter {
  const start = localDateOf(summary.currentPeriod.startAt, timeZone)
  const end = lastDayOf(summary.currentPeriod, timeZone)
  const days = slice(daily, start, end)
  const previousDays = slice(
    daily,
    localDateOf(summary.previousPeriod.startAt, timeZone),
    lastDayOf(summary.previousPeriod, timeZone),
  )
  const engagement = summary.supportPlanEngagement
  const engaged = engagement.state === 'AVAILABLE'
  const coverage = summary.journalContext.dataCoverage
  const checkIns = (list: readonly ActivityDashboardDay[] | null) =>
    list ? list.filter((day) => day.emotionLevel !== null).length : null
  return {
    number,
    summaryId: summary.summaryId,
    startLocalDate: start,
    endLocalDate: end,
    composedAt: summary.composedAt,
    screening: summary.screening.trends.map((trend) => {
      const previous =
        trend.state === 'AVAILABLE' && trend.previous
          ? band(trend.instrument, trend.previous)
          : null
      return {
        instrument: trend.instrument,
        previous,
        current: band(trend.instrument, trend.current),
        direction: previous ? trend.direction : 'INSUFFICIENT_DATA',
      }
    }),
    support: {
      completed: engaged ? engagement.currentPeriod.completedCount : null,
      skipped: engaged ? engagement.currentPeriod.skippedCount : null,
      previousCompleted: engaged
        ? engagement.previousPeriod.completedCount
        : null,
      previousSkipped: engaged ? engagement.previousPeriod.skippedCount : null,
    },
    journal: {
      current: coverage?.currentPeriodJournalEntryCount ?? null,
      previous: coverage?.previousPeriodJournalEntryCount ?? null,
    },
    reflections: helpfulSources(summary).map((source) => {
      const origin = engagement.sources?.find(
        (item) => item.occurrenceId === source.occurrenceId,
      )
      return {
        occurrenceId: source.occurrenceId,
        localDate: origin ? localDateOf(origin.scheduledAt, timeZone) : null,
        resourceId: origin?.sourceResourceId ?? null,
        helpfulness: source.helpfulness as 'HELPFUL' | 'VERY_HELPFUL',
        reflection: source.reflection,
      }
    }),
    days:
      days?.map(({ localDate, emotionLevel }) => ({
        localDate,
        emotionLevel,
      })) ?? null,
    goodDays: days
      ? days.filter((day) => (day.emotionLevel ?? 0) >= 4).length
      : null,
    checkInDays: checkIns(days),
    previousCheckInDays: checkIns(previousDays),
  }
}

export function buildJourney({
  summaries,
  dashboard,
  cycle,
  timeZone,
}: Readonly<{
  summaries: readonly ReassessmentSummary[]
  dashboard: Pick<ActivityDashboard, 'daily' | 'sources'> | null
  /** The `cycle` of the current v2 plan; null with no plan or a plan without one. */
  cycle: SupportPlanCycle | null
  timeZone: string
}>): LookBackJourney {
  // Newest first: a retake inside the same window replaces the older summary.
  const kept: ReassessmentSummary[] = []
  for (const summary of [...summaries].sort(
    (a, b) => Date.parse(b.composedAt) - Date.parse(a.composedAt),
  ))
    if (
      !kept.some((item) => overlaps(item.currentPeriod, summary.currentPeriod))
    )
      kept.push(summary)
  kept.sort(
    (a, b) =>
      Date.parse(a.currentPeriod.startAt) - Date.parse(b.currentPeriod.startAt),
  )

  // Unknown is not zero: an unreadable mood source leaves every day out.
  const daily =
    dashboard && dashboard.sources.emotions !== 'unavailable'
      ? dashboard.daily
      : null
  const chapters = kept.map((summary, index) =>
    chapterOf(summary, index + 1, daily, timeZone),
  )
  const newest = chapters.at(-1)

  const open =
    cycle?.startedOn &&
    (RUNNING_STATES as readonly string[]).includes(cycle.state)
      ? cycle
      : null
  // Only a due cycle waits for the user's choice; keeping the rhythm on the reassessment day starts a new IN_PROGRESS cycle.
  const closedAwaitingChoice =
    open?.state === 'REVIEW_DUE' &&
    !!newest &&
    localDateOf(newest.composedAt, timeZone) >= open.startedOn!
  let running: RunningChapter | null = null
  if (open && !closedAwaitingChoice) {
    const days =
      daily?.filter((day) => day.localDate >= open.startedOn!) ?? null
    running = {
      number: chapters.length + 1,
      startLocalDate: open.startedOn!,
      currentDay: open.currentDay ?? 1,
      lengthDays: open.lengthDays,
      state: open.state as RunningChapter['state'],
      goodDays: days
        ? days.filter((day) => (day.emotionLevel ?? 0) >= 4).length
        : null,
      supportCompleted:
        dashboard && days && dashboard.sources.supportPlans !== 'unavailable'
          ? days.reduce((sum, day) => sum + day.supportCompleted, 0)
          : null,
    }
  }
  return {
    baseline:
      newest === undefined
        ? []
        : chapters[0].screening.flatMap((item) =>
            item.previous ? [item.previous] : [],
          ),
    chapters,
    running,
    closedAwaitingChoice,
  }
}

/** A moderate-or-higher band, or a band above the one before: Mầm stays quiet beside it. */
export const hasHardNews = (chapter: LookBackChapter) =>
  chapter.screening.some(
    (item) =>
      isModerateOrAbove(item.current.level) ||
      (item.previous !== null &&
        levelRank(item.current.level) > levelRank(item.previous.level)),
  )

/** Chapters whose days the activity window still holds; only those can be looked at on their own. */
export const pickableChapters = (journey: LookBackJourney | null) =>
  journey?.chapters.filter((chapter) => chapter.days !== null) ?? []

/** The chapter shown first with no running one (a closed cycle waiting for the choice, or no cycle): the newest closed. */
export const defaultClosedChapter = (journey: LookBackJourney | null) =>
  journey && !journey.running ? pickableChapters(journey).at(-1) : undefined
