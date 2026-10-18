import type {
  ActionOccurrence,
  PlanAction,
  SupportPlanV3,
} from '../api/support-plan-contract'

export type PlannedOccurrence = Readonly<{
  occurrence: ActionOccurrence
  action: PlanAction
}>

export type TodayFocus =
  | { kind: 'RESUME' }
  | { kind: 'REVIEW_DUE'; action?: PlanAction }
  | (PlannedOccurrence & { kind: 'OCCURRENCE'; later: PlannedOccurrence[] })
  | { kind: 'DONE_FOR_TODAY'; nextDate?: string }
  | { kind: 'NOTHING_TODAY'; nextDate?: string }

export type ProgressSummary = Readonly<{
  activities: { done: number; skipped: number }
  emotionDays: number
  journalDays: number
  from: string
  through: string
}>

const FALLBACK_TIMEZONE = 'Asia/Ho_Chi_Minh'
const MAX_WINDOW_DAYS = 31

export function planActions(plan: SupportPlanV3) {
  return plan.focuses.flatMap((focus) => focus.actions)
}

export function planTimezone(plan: SupportPlanV3) {
  return (
    plan.cycle?.timezone ??
    planActions(plan)
      .flatMap((action) => action.schedules)
      .find((schedule) => schedule.status !== 'ENDED')?.timezone ??
    FALLBACK_TIMEZONE
  )
}

export function localDateIn(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

/** Milliseconds until the next local calendar day starts in the plan timezone. */
export function msUntilNextLocalDay(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)
  const elapsed = value('hour') * 3600 + value('minute') * 60 + value('second')
  // One extra second lands safely inside the new day.
  return (86400 - elapsed + 1) * 1000
}

/**
 * Authoritative state never moves backwards: a fetched row older than the one
 * a command already returned is ignored, whichever response arrives last.
 */
export function mergeOccurrences(
  local: ActionOccurrence[],
  fetched: ActionOccurrence[],
) {
  const known = new Map(local.map((item) => [item.occurrenceId, item]))
  return fetched.map((item) => {
    const mine = known.get(item.occurrenceId)
    return mine && mine.version > item.version ? mine : item
  })
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function maxDate(left: string, right: string) {
  return left > right ? left : right
}

/** Today-centred read window; the Care occurrence endpoint accepts at most 31 days. */
export function occurrenceWindow(plan: SupportPlanV3, today: string) {
  const through = addDays(today, 7)
  const earliest = addDays(through, -(MAX_WINDOW_DAYS - 1))
  const start = plan.cycle?.startedOn ?? addDays(today, -6)
  return { from: maxDate(start, earliest), through }
}

export function joinOccurrences(
  plan: SupportPlanV3,
  occurrences: ActionOccurrence[],
): PlannedOccurrence[] {
  const actions = new Map(
    planActions(plan).map((action) => [action.actionId, action]),
  )
  return occurrences.flatMap((occurrence) => {
    const action = actions.get(occurrence.actionId)
    return action && action.actionType === occurrence.actionType
      ? [{ occurrence, action }]
      : []
  })
}

/** The 14-day review is driven by the cycle state, never by its reminder row. */
export const isDailyWork = ({ action }: PlannedOccurrence) =>
  action.actionType !== 'REASSESSMENT_SCREENING'

const isOpen = (item: PlannedOccurrence) =>
  item.occurrence.state === 'SCHEDULED' && isDailyWork(item)

export function selectTodayFocus(
  plan: SupportPlanV3,
  occurrences: ActionOccurrence[],
  today: string,
): TodayFocus {
  if (plan.status === 'PAUSED') return { kind: 'RESUME' }
  if (plan.cycle?.state === 'REVIEW_DUE')
    return {
      kind: 'REVIEW_DUE',
      action: planActions(plan).find(
        (action) =>
          action.actionType === 'REASSESSMENT_SCREENING' &&
          action.status !== 'ENDED',
      ),
    }
  const joined = joinOccurrences(plan, occurrences).sort((left, right) =>
    left.occurrence.scheduledAt.localeCompare(right.occurrence.scheduledAt),
  )
  const todays = joined.filter(
    ({ occurrence }) => occurrence.localDate === today,
  )
  const open = todays.filter(isOpen)
  if (open.length > 0) {
    const [first, ...later] = open
    return { kind: 'OCCURRENCE', ...first, later }
  }
  const nextDate = joined.find(
    (item) => item.occurrence.localDate > today && isOpen(item),
  )?.occurrence.localDate
  return todays.some(({ occurrence }) => occurrence.state === 'COMPLETED')
    ? { kind: 'DONE_FOR_TODAY', nextDate }
    : { kind: 'NOTHING_TODAY', nextDate }
}

export function summarizeProgress(
  plan: SupportPlanV3,
  occurrences: ActionOccurrence[],
  window: { from: string; through: string },
  today: string,
): ProgressSummary {
  const past = joinOccurrences(plan, occurrences).filter(
    ({ occurrence }) =>
      occurrence.localDate >= window.from && occurrence.localDate <= today,
  )
  const days = (type: PlanAction['actionType']) =>
    new Set(
      past
        .filter(
          ({ action, occurrence }) =>
            action.actionType === type && occurrence.state === 'COMPLETED',
        )
        .map(({ occurrence }) => occurrence.localDate),
    ).size
  const activities = past.filter(({ action }) =>
    ['RESOURCE', 'ROUTINE_SELF_MANAGEMENT'].includes(action.actionType),
  )
  return {
    activities: {
      done: activities.filter(
        ({ occurrence }) => occurrence.state === 'COMPLETED',
      ).length,
      skipped: activities.filter(
        ({ occurrence }) => occurrence.state === 'SKIPPED',
      ).length,
    },
    emotionDays: days('EMOTION_CHECK_IN'),
    journalDays: days('JOURNAL'),
    from: window.from,
    through: today,
  }
}

/** Average minutes per day of the current schedules, rounded to the nearest 5. */
export function estimateDailyMinutes(plan: SupportPlanV3) {
  const weekly = planActions(plan)
    .filter((action) => action.status !== 'ENDED')
    .flatMap((action) =>
      action.schedules.filter((schedule) => schedule.status !== 'ENDED'),
    )
  // One unknown duration makes any total a guess; 0 tells the caller to hide it.
  if (weekly.some((schedule) => schedule.estimatedDurationMinutes === null))
    return 0
  const minutes = weekly.reduce((total, schedule) => {
    const each = schedule.estimatedDurationMinutes ?? 0
    if (schedule.recurrenceType === 'DAILY') return total + each * 7
    if (schedule.recurrenceType === 'WEEKLY')
      return total + each * Math.max(schedule.daysOfWeek.length, 1)
    return total
  }, 0)
  return minutes === 0 ? 0 : Math.max(5, Math.round(minutes / 7 / 5) * 5)
}

export function cycleLine(cycle: SupportPlanV3['cycle']) {
  if (!cycle) return undefined
  if (cycle.state === 'REVIEW_DUE') return 'Đến lúc xem lại kế hoạch'
  if (cycle.state === 'PAUSED') return 'Đang tạm dừng'
  if (cycle.state === 'IN_PROGRESS' && cycle.currentDay)
    return `Ngày ${Math.min(cycle.currentDay, cycle.lengthDays)}/${cycle.lengthDays}`
  return undefined
}
