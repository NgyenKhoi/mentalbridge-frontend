// Mầm's daily read of the user's own check-ins (MB-897). Pure: the last 14 local days of check-in level
// (1 very low ... 5 great; the look-back series) in, one state out. Only levels are read, never text, and
// intensity is the strength of a feeling, not wellness, so it is not an input. A day without a check-in is a
// gap, never a zero.
import type { MamGrade, MamIntent } from './mam-orchestrator'

export const MAM_TRAJECTORY_STATES = [
  'PERSISTENT_LOW',
  'DIP_AFTER_GOOD',
  'FIRST_LOW',
  'BOUNCE_BACK',
  'IMPROVING',
  'STEADY_GOOD',
  'FLAT',
  'WELCOME_BACK',
  'NO_DATA',
] as const
export type MamTrajectoryState = (typeof MAM_TRAJECTORY_STATES)[number]

export type MamDayLevel = Readonly<{ localDate: string; level: number | null }>

export const MAM_WINDOW_DAYS = 14
const LOW_AT_MOST = 2
const GOOD_AT_LEAST = 4
const IMPROVE_BY = 0.7
const ABSENT_DAYS = 3
const BOUNCE_BACK_GAP_DAYS = 1
const FLAT_SPREAD = 1
const FLAT_MID: readonly [number, number] = [2.5, 3.5]

const DAY_MS = 86_400_000
const dayNumber = (localDate: string) =>
  Math.round(Date.parse(`${localDate}T00:00:00.000Z`) / DAY_MS)
export const daysBetween = (from: string, to: string) =>
  dayNumber(to) - dayNumber(from)

const low = (level: number) => level <= LOW_AT_MOST
const good = (level: number) => level >= GOOD_AT_LEAST
const mean = (values: readonly number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length

/**
 * Precedence: PERSISTENT_LOW > DIP_AFTER_GOOD > FIRST_LOW (any other low today) > BOUNCE_BACK > IMPROVING > STEADY_GOOD > FLAT >
 * WELCOME_BACK > NO_DATA. Three guards keep a state true to what the user did:
 * - fewer than 2 records in the window: NO_DATA, a single point is no trajectory;
 * - the latest record 3 or more days old: WELCOME_BACK, so old records never speak for "these days";
 * - the "today" states (FIRST_LOW, DIP_AFTER_GOOD, BOUNCE_BACK) need a record dated `today`; BOUNCE_BACK also
 *   needs a low record dated yesterday; and
 *   PERSISTENT_LOW and IMPROVING need the latest record not to contradict them (low and not low).
 * NO_DATA is also the answer when there is data but nothing worth saying.
 */
export function mamTrajectory(
  days: readonly MamDayLevel[],
  today: string,
): MamTrajectoryState {
  const records = days
    .flatMap((day) =>
      day.level === null ? [] : [{ ...day, level: day.level }],
    )
    .filter((day) => {
      const age = daysBetween(day.localDate, today)
      return age >= 0 && age < MAM_WINDOW_DAYS
    })
    .sort((a, b) => a.localDate.localeCompare(b.localDate))
  if (records.length < 2) return 'NO_DATA'
  const levels = records.map((record) => record.level)
  const latest = records[records.length - 1]
  if (daysBetween(latest.localDate, today) >= ABSENT_DAYS) return 'WELCOME_BACK'

  const hasToday = latest.localDate === today
  const before = levels.slice(0, -1)
  const lowNow = low(latest.level)

  if (lowNow && levels.slice(-4).filter(low).length >= 3)
    return 'PERSISTENT_LOW'
  if (hasToday && lowNow && before.length >= 3 && before.slice(-3).every(good))
    return 'DIP_AFTER_GOOD'
  // A low today that is neither a dip after good days nor persistent (a low after mixed days) is answered
  // the same way: the user just reported a hard day.
  if (hasToday && lowNow) return 'FIRST_LOW'

  // The record before today must be yesterday's, and low: the lines may then say "after a heavy day".
  const previous = records[records.length - 2]
  if (
    hasToday &&
    good(latest.level) &&
    low(previous.level) &&
    daysBetween(previous.localDate, today) === BOUNCE_BACK_GAP_DAYS
  )
    return 'BOUNCE_BACK'

  if (
    !lowNow &&
    levels.length >= 6 &&
    // Rounded so 0.7 itself counts (a mean of thirds is not exact in floating point).
    Math.round((mean(levels.slice(-3)) - mean(levels.slice(-6, -3))) * 1e6) /
      1e6 >=
      IMPROVE_BY
  )
    return 'IMPROVING'

  const lastFive = levels.slice(-5)
  if (good(latest.level) && lastFive.filter(good).length >= 4)
    return 'STEADY_GOOD'
  if (
    lastFive.length >= 5 &&
    Math.max(...lastFive) - Math.min(...lastFive) <= FLAT_SPREAD &&
    mean(lastFive) >= FLAT_MID[0] &&
    mean(lastFive) <= FLAT_MID[1]
  )
    return 'FLAT'
  return 'NO_DATA'
}

/** The animation a state asks the orchestrator for; NO_DATA stays silent. */
export const MAM_STATE_REACTION: Record<
  MamTrajectoryState,
  Readonly<{ intent: MamIntent; grade?: MamGrade }> | null
> = {
  PERSISTENT_LOW: { intent: 'COMFORT' },
  DIP_AFTER_GOOD: { intent: 'COMFORT' },
  FIRST_LOW: { intent: 'COMFORT' },
  BOUNCE_BACK: { intent: 'CELEBRATE', grade: 'soft' },
  IMPROVING: { intent: 'ENCOURAGE' },
  STEADY_GOOD: { intent: 'HAPPY' },
  FLAT: { intent: 'LISTEN' },
  // A short look: the session's welcome (the airplane) is the host's own, once per tab.
  WELCOME_BACK: { intent: 'HAPPY' },
  NO_DATA: null,
}

/** States that cheer: never on a harder look-back, a moderate-or-higher band or a reassessment that rose. */
export const MAM_CELEBRATORY_STATES: ReadonlySet<MamTrajectoryState> = new Set([
  'BOUNCE_BACK',
  'IMPROVING',
  'STEADY_GOOD',
])

/** The check-in level of an emotion (the Care dashboard's own mapping). */
export const MAM_EMOTION_LEVEL = {
  VERY_LOW: 1,
  LOW: 2,
  OKAY: 3,
  GOOD: 4,
  GREAT: 5,
} as const
