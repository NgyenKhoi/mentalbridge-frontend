// Shared by the look-back unit tests and the look-back E2E spec.
import type {
  ActivityDashboard,
  ActivityDashboardDay,
} from '../../features/analytics/api/activity-dashboard-contract'
import type {
  AssessmentProgress,
  Instrument,
  ScreeningLevel,
} from '../../features/assessment/api/care-contract'
import { composeLookBack } from '../../features/look-back/look-back-model'

export const asOf = '2026-11-22'
export const timezone = 'Asia/Ho_Chi_Minh'

const addDays = (localDate: string, days: number) => {
  const date = new Date(`${localDate}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

type DayExtra = Partial<
  Pick<
    ActivityDashboardDay,
    'journals' | 'supportCompleted' | 'supportSkipped' | 'appointments'
  >
>

/**
 * A 30-day dashboard ending on `asOf`. `moods` are the last 14 days, oldest first
 * (null = no check-in); older days are empty. `extra` adds journals or support.
 */
export function makeDashboard(
  moods: ReadonlyArray<number | null>,
  extra: Record<number, DayExtra> = {},
  overrides: Partial<ActivityDashboard> = {},
): ActivityDashboard {
  const daily: ActivityDashboardDay[] = Array.from(
    { length: 30 },
    (_, index) => {
      const slot = index - 16
      const level = slot >= 0 ? (moods[slot] ?? null) : null
      const more = slot >= 0 ? (extra[slot] ?? {}) : {}
      const day = {
        localDate: addDays(asOf, index - 29),
        assessments: 0,
        journals: more.journals ?? 0,
        emotions: level === null ? 0 : 1,
        emotionLevel: level,
        supportCompleted: more.supportCompleted ?? 0,
        supportSkipped: more.supportSkipped ?? 0,
        appointments: more.appointments ?? 0,
      }
      return {
        ...day,
        total:
          day.journals +
          day.emotions +
          day.supportCompleted +
          day.supportSkipped +
          day.appointments,
      }
    },
  )
  return {
    asOfLocalDate: asOf,
    startLocalDate: daily[0].localDate,
    timezone,
    summary: {} as ActivityDashboard['summary'],
    daily,
    sources: {
      assessments: 'available',
      journals: 'available',
      emotions: 'available',
      supportPlans: 'available',
      appointments: 'available',
    },
    partial: false,
    bounded: {
      windowDays: 30,
      assessmentLimit: 20,
      journalLimit: 20,
      emotionLimit: 30,
      appointmentLimit: 20,
    },
    ...overrides,
  }
}

const point = (
  assessmentId: string,
  submittedAt: string,
  screeningLevel: ScreeningLevel,
  totalScore: number,
) => ({
  assessmentId,
  questionnaireVersion: 'v1',
  submittedAt,
  totalScore,
  screeningLevel,
})

export function makeProgress(
  instrument: Instrument,
  previous: readonly [string, ScreeningLevel, number],
  current: readonly [string, ScreeningLevel, number],
): AssessmentProgress {
  return {
    instrument,
    scoringVersion: 'v1',
    previous: point(
      `prev-${instrument}`,
      previous[0],
      previous[1],
      previous[2],
    ),
    current: point(`cur-${instrument}`, current[0], current[1], current[2]),
    rawDelta: current[2] - previous[2],
    scoreDirection:
      current[2] === previous[2]
        ? 'UNCHANGED'
        : current[2] > previous[2]
          ? 'INCREASED'
          : 'DECREASED',
    bandTransition: { previous: previous[1], current: current[1] },
    elapsedDuration: 'P13D',
  }
}

export const conversation = (id: string, title: string, updatedAt: string) => ({
  conversationId: id,
  title,
  createdAt: updatedAt,
  updatedAt,
  expiresAt: '2027-01-01T00:00:00Z',
})

const rising = [2, 2, 3, 2, 3, 3, 2, 4, 3, 4, 4, 3, 4, 4]
const busy = {
  0: { journals: 1, supportCompleted: 1 },
  2: { supportCompleted: 1, supportSkipped: 1 },
  5: { journals: 1 },
  8: { journals: 1, supportCompleted: 2 },
  10: { journals: 1, appointments: 1 },
  12: { supportCompleted: 2 },
}

export const improving = () =>
  composeLookBack({
    dashboard: makeDashboard(rising, busy),
    conversations: [
      conversation('c1', 'Ngủ ngon hơn', '2026-11-20T09:00:00+07:00'),
      conversation('c2', 'Áp lực công việc', '2026-11-12T09:00:00+07:00'),
    ],
    progress: [
      makeProgress(
        'PHQ9',
        ['2026-11-09T09:00:00+07:00', 'MODERATE', 12],
        ['2026-11-22T09:00:00+07:00', 'MILD', 7],
      ),
    ],
    degraded: false,
  })

export const harder = () =>
  composeLookBack({
    dashboard: makeDashboard([4, 3, 4, 3, 4, 3, 3, 2, 2, 3, 2, 2, 1, 2], busy),
    conversations: [],
    progress: [
      makeProgress(
        'PHQ9',
        ['2026-11-09T09:00:00+07:00', 'MILD', 7],
        ['2026-11-22T09:00:00+07:00', 'MODERATE', 12],
      ),
    ],
    degraded: false,
  })

export const sparse = () =>
  composeLookBack({
    dashboard: makeDashboard([null, null, 3, null, null, null, 2, null, null]),
    conversations: null,
    progress: [],
    degraded: false,
  })
