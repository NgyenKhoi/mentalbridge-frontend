import { describe, expect, it } from 'vitest'

import type { ActivityDashboardDay } from '@/features/analytics/api/activity-dashboard-contract'
import type { ReassessmentSummary } from '@/features/assessment/api/care-contract'
import { makeSummary } from '@/tests/fixtures/reassessment-review'

import {
  buildJourney,
  defaultClosedChapter,
  pickableChapters,
} from './look-back-chapters'

const tz = 'Asia/Ho_Chi_Minh'
// Local midnight of `date` in Ho Chi Minh (UTC+7).
const at = (date: string) => `${date}T00:00:00+07:00`
const summary = (
  id: string,
  start: string,
  end: string,
  overrides: Record<string, unknown> = {},
) =>
  makeSummary({
    summaryId: id,
    composedAt: at(end),
    currentPeriod: { startAt: at(start), endAt: at(end) },
    previousPeriod: { startAt: at('2026-01-01'), endAt: at(start) },
    ...overrides,
  }) as unknown as ReassessmentSummary

const day = (
  localDate: string,
  emotionLevel: number | null,
): ActivityDashboardDay => ({
  localDate,
  assessments: 0,
  journals: 0,
  emotions: emotionLevel === null ? 0 : 1,
  emotionLevel,
  supportCompleted: 1,
  supportSkipped: 0,
  appointments: 0,
  total: 1,
})
const dashboard = (daily: ActivityDashboardDay[]) => ({
  daily,
  sources: {
    assessments: 'available',
    journals: 'available',
    emotions: 'available',
    supportPlans: 'available',
    appointments: 'available',
  } as const,
})
const cycle = (patch: Record<string, unknown> = {}) =>
  ({
    policyVersion: 'support-plan-cycle-v1',
    lengthDays: 14,
    timezone: tz,
    cycleNumber: 2,
    startedOn: '2026-11-20',
    reviewDueOn: '2026-12-03',
    currentDay: 5,
    pausedDays: 0,
    state: 'IN_PROGRESS',
    ...patch,
  }) as never
const build = (input: Partial<Parameters<typeof buildJourney>[0]>) =>
  buildJourney({
    summaries: [],
    dashboard: null,
    cycle: null,
    timeZone: tz,
    ...input,
  })

describe('buildJourney', () => {
  it('numbers chapters oldest to newest', () => {
    const journey = build({
      summaries: [
        summary('c', '2026-11-15', '2026-11-29'),
        summary('a', '2026-10-01', '2026-10-15'),
        summary('b', '2026-10-16', '2026-10-30'),
      ],
    })
    expect(journey.chapters.map((c) => [c.number, c.summaryId])).toEqual([
      [1, 'a'],
      [2, 'b'],
      [3, 'c'],
    ])
    expect(journey.chapters[0].startLocalDate).toBe('2026-10-01')
    // Half-open: the last day shown is the day before endAt.
    expect(journey.chapters[0].endLocalDate).toBe('2026-10-14')
  })

  it('keeps the newer of two overlapping summaries', () => {
    const journey = build({
      summaries: [
        summary('old', '2026-11-01', '2026-11-15'),
        summary('new', '2026-11-05', '2026-11-19'),
      ],
    })
    expect(journey.chapters.map((c) => c.summaryId)).toEqual(['new'])
  })

  it('slices daily mood to the chapter and counts good days', () => {
    const journey = build({
      summaries: [summary('a', '2026-11-01', '2026-11-05')],
      dashboard: dashboard([
        day('2026-10-31', 5),
        day('2026-11-01', 5),
        day('2026-11-02', 4),
        day('2026-11-03', 3),
        day('2026-11-04', null),
        day('2026-11-05', 5),
      ]),
    })
    const [chapter] = journey.chapters
    expect(chapter.days?.map((d) => d.localDate)).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
    ])
    expect(chapter.goodDays).toBe(2)
    expect(chapter.checkInDays).toBe(3)
  })

  it('marks chapters outside the 90-day window', () => {
    const journey = build({
      summaries: [summary('a', '2026-08-01', '2026-08-15')],
      dashboard: dashboard([day('2026-09-01', 4), day('2026-09-02', 4)]),
    })
    const [chapter] = journey.chapters
    expect(chapter.days).toBeNull()
    expect(chapter.goodDays).toBeNull()
    expect(chapter.checkInDays).toBeNull()
  })

  it('takes the baseline from chapter 1 previous points', () => {
    const journey = build({
      summaries: [summary('a', '2026-11-01', '2026-11-15')],
    })
    expect(journey.baseline.map((b) => [b.instrument, b.level])).toEqual([
      ['PHQ9', 'MODERATE'],
      ['GAD7', 'MODERATE'],
    ])
    expect(journey.chapters[0].screening[0]).toMatchObject({
      previous: { level: 'MODERATE', score: 14 },
      current: { level: 'MILD', score: 8 },
      direction: 'DECREASED',
    })
  })

  it('runs a chapter from an open cycle after the newest summary', () => {
    const journey = build({
      summaries: [summary('a', '2026-11-01', '2026-11-15')],
      dashboard: dashboard([
        day('2026-11-19', 5),
        day('2026-11-20', 5),
        day('2026-11-21', 4),
        day('2026-11-22', null),
      ]),
      cycle: cycle(),
    })
    expect(journey.closedAwaitingChoice).toBe(false)
    expect(journey.running).toMatchObject({
      number: 2,
      startLocalDate: '2026-11-20',
      currentDay: 5,
      lengthDays: 14,
      state: 'IN_PROGRESS',
      goodDays: 2,
      supportCompleted: 3,
    })
  })

  it('has no running chapter without a cycle', () => {
    const journey = build({
      summaries: [summary('a', '2026-11-01', '2026-11-15')],
    })
    expect(journey.running).toBeNull()
    expect(journey.closedAwaitingChoice).toBe(false)
  })

  it('treats a cycle already closed by a reassessment as awaiting the choice', () => {
    const journey = build({
      summaries: [summary('a', '2026-11-10', '2026-11-24')],
      cycle: cycle({ startedOn: '2026-11-10', state: 'REVIEW_DUE' }),
    })
    expect(journey.running).toBeNull()
    expect(journey.closedAwaitingChoice).toBe(true)
  })

  it('runs the next chapter when the rhythm was kept on the reassessment day', () => {
    const journey = build({
      summaries: [summary('a', '2026-11-10', '2026-11-24')],
      cycle: cycle({
        startedOn: '2026-11-24',
        state: 'IN_PROGRESS',
        currentDay: 1,
      }),
    })
    expect(journey.closedAwaitingChoice).toBe(false)
    expect(journey.running?.number).toBe(2)
  })

  it('does not count a summary composed before the cycle began', () => {
    const journey = build({
      summaries: [summary('a', '2026-10-01', '2026-10-15')],
      cycle: cycle({ startedOn: '2026-11-10' }),
    })
    expect(journey.running?.number).toBe(2)
  })

  it('shows missing engagement as null, not zero', () => {
    const journey = build({
      summaries: [
        summary('a', '2026-11-01', '2026-11-15', {
          supportPlanEngagement: {
            state: 'UNAVAILABLE',
            previousPeriod: { completedCount: 0, skippedCount: 0 },
            currentPeriod: { completedCount: 0, skippedCount: 0 },
            sources: [],
          },
          journalContext: {
            ...makeSummary().journalContext,
            state: 'UNAVAILABLE',
            dataCoverage: null,
          },
        }),
      ],
    })
    const [chapter] = journey.chapters
    expect(chapter.support.completed).toBeNull()
    expect(chapter.support.previousCompleted).toBeNull()
    expect(chapter.journal).toEqual({ current: null, previous: null })
  })

  it('has no mood days when the mood source cannot be read', () => {
    const journey = build({
      summaries: [summary('a', '2026-11-01', '2026-11-05')],
      dashboard: {
        ...dashboard([day('2026-11-01', 5)]),
        sources: { ...dashboard([]).sources, emotions: 'unavailable' },
      },
    })
    expect(journey.chapters[0].days).toBeNull()
  })

  describe('which chặng can be looked at', () => {
    const daily = Array.from({ length: 20 }, (_, i) =>
      day(`2026-11-${String(i + 1).padStart(2, '0')}`, 3),
    )
    const journey = (cycleArg: ReturnType<typeof cycle> | null) =>
      buildJourney({
        summaries: [
          summary('old', '2026-10-01', '2026-10-10'),
          summary('in', '2026-11-02', '2026-11-16'),
        ],
        dashboard: dashboard(daily),
        cycle: cycleArg,
        timeZone: tz,
      })

    it('offers only chặng whose days the activity window holds', () => {
      expect(pickableChapters(journey(null)).map((c) => c.summaryId)).toEqual([
        'in',
      ])
      expect(pickableChapters(null)).toEqual([])
    })

    it('opens the newest pickable chặng only when none is running', () => {
      expect(defaultClosedChapter(journey(null))?.summaryId).toBe('in')
      expect(defaultClosedChapter(journey(cycle()))).toBeUndefined()
      expect(defaultClosedChapter(null)).toBeUndefined()
    })

    it('a cycle awaiting the choice has no running chặng, so the newest closed one opens', () => {
      const waiting = journey(
        cycle({ startedOn: '2026-11-02', state: 'REVIEW_DUE', currentDay: 14 }),
      )
      expect(waiting.closedAwaitingChoice).toBe(true)
      expect(defaultClosedChapter(waiting)?.summaryId).toBe('in')
    })
  })
})
