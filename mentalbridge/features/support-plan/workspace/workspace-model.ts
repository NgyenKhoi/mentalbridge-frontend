import type {
  ActionOccurrence,
  PlanAction,
  SupportPlanV3,
} from '../api/support-plan-contract'
import { actionDestination } from './workspace-links'

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
  return (plan.focuses ?? []).flatMap((focus) => focus.actions ?? [])
}

function validTimezone(timezone: unknown): timezone is string {
  if (typeof timezone !== 'string' || !timezone) return false
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

/** An unknown or malformed zone never reaches Intl, where it would throw. */
export function planTimezone(plan: SupportPlanV3) {
  const candidates = [
    plan.cycle?.timezone,
    ...planActions(plan)
      .flatMap((action) => action.schedules ?? [])
      .filter((schedule) => schedule.status !== 'ENDED')
      .map((schedule) => schedule.timezone),
  ]
  return candidates.find(validTimezone) ?? FALLBACK_TIMEZONE
}

/** HH:mm in the plan timezone, or '' when the instant or zone is unusable. */
export function formatTimeIn(
  timezone: string,
  instant: string | null | undefined,
) {
  const date = new Date(instant ?? '')
  if (!instant || Number.isNaN(date.getTime())) return ''
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: validTimezone(timezone) ? timezone : FALLBACK_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date)
  } catch {
    return ''
  }
}

const dayFormat = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: 'numeric',
  month: 'numeric',
  timeZone: 'UTC',
})

/** "Thứ Sáu, 30/10"; '' for a value that is not a local date. */
export function dayLabel(date: string | null | undefined) {
  const value = new Date(`${date}T00:00:00Z`)
  return date && !Number.isNaN(value.getTime()) ? dayFormat.format(value) : ''
}

export function localDateIn(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: validTimezone(timezone) ? timezone : FALLBACK_TIMEZONE,
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
    timeZone: validTimezone(timezone) ? timezone : FALLBACK_TIMEZONE,
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
    // Read-only rows (ended action, unsupported type) must not take the one expansion.
    const usable = (item: PlannedOccurrence) => {
      const capability = rowCapability(plan, item, false)
      return (
        capability.complete ||
        capability.skip ||
        Boolean(actionDestination(plan, item, today))
      )
    }
    const first = open.find(usable) ?? open[0]
    return {
      kind: 'OCCURRENCE',
      ...first,
      later: open.filter((item) => item !== first),
    }
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

/** Cycle header copy; only the status part changes with the cycle state. */
export function cycleLine(cycle: SupportPlanV3['cycle']) {
  if (!cycle) return undefined
  const name =
    Number.isFinite(cycle.cycleNumber) && cycle.cycleNumber > 0
      ? `Chu kỳ ${cycle.cycleNumber}`
      : 'Chu kỳ'
  switch (cycle.state) {
    case 'NOT_STARTED':
      return 'Chu kỳ chưa bắt đầu'
    case 'CLOSED':
      return `${name} đã kết thúc`
    case 'PAUSED':
      return `${name} · Đang tạm dừng`
    case 'REVIEW_DUE':
      return `${name} · Đến lúc xem lại`
    case 'IN_PROGRESS':
      return cycle.currentDay
        ? `${name} · Ngày ${Math.min(cycle.currentDay, cycle.lengthDays)}/${cycle.lengthDays}`
        : name
    default:
      // A state this client does not know reads as a plain cycle, never as a raw token.
      return name
  }
}

export const STATE_REASON_COPY: Readonly<Record<string, string>> = {
  PLAN_PAUSED: 'Kế hoạch đang tạm dừng',
  PLAN_COMPLETED: 'Kế hoạch đã kết thúc',
  PLAN_REPLACED: 'Đã chuyển sang kế hoạch mới',
  ACTION_ENDED: 'Việc này đã dừng',
  SCHEDULE_CHANGED: 'Lịch đã đổi',
}

export type Barrier = 'NOT_ENOUGH_TIME' | 'LOW_ENERGY' | 'NOT_A_GOOD_FIT'
export const BARRIERS: ReadonlyArray<readonly [Barrier, string]> = [
  ['NOT_ENOUGH_TIME', 'Không đủ thời gian'],
  ['LOW_ENERGY', 'Thiếu năng lượng'],
  ['NOT_A_GOOD_FIT', 'Chưa hợp với mình'],
]

/** Plain line for a reason code; an unknown code says nothing instead of a raw token. */
export const stateReasonLine = (reason: string | null | undefined) =>
  reason ? STATE_REASON_COPY[reason] : undefined
export const barrierLine = (code: string | null | undefined) =>
  BARRIERS.find(([value]) => value === code)?.[1]

const COMPLETE_TYPES = ['RESOURCE', 'ROUTINE_SELF_MANAGEMENT']
const SKIP_TYPES = [...COMPLETE_TYPES, 'JOURNAL', 'EMOTION_CHECK_IN']

export type RowCapability = Readonly<{
  /** Manual "Đã làm xong" (a Care acknowledgement); opening a destination never completes. */
  complete: boolean
  /** "Để hôm khác" on an open row. */
  skip: boolean
  /** Reopen the user's own skip; accepted completion evidence is never reopened. */
  reopen: boolean
  /** Optional helpfulness and barrier follow-ups on the saved row. */
  rate: boolean
  barrier: boolean
}>

/**
 * Commands Care accepts for one occurrence, from its type, mode, state and
 * engagement availability, never from the plan status alone. Unknown types and
 * states get none: a plain read-only row.
 */
export function rowCapability(
  plan: SupportPlanV3,
  { occurrence, action }: PlannedOccurrence,
  engageable: boolean,
): RowCapability {
  const editable = plan.status === 'ACTIVE' && action.status === 'ACTIVE'
  const open = editable && occurrence.state === 'SCHEDULED'
  const skipped = editable && occurrence.state === 'SKIPPED'
  const skippable = SKIP_TYPES.includes(action.actionType)
  return {
    complete: open && COMPLETE_TYPES.includes(action.actionType),
    skip: open && skippable,
    reopen: skipped && skippable && engageable,
    rate:
      editable &&
      skippable &&
      occurrence.state === 'COMPLETED' &&
      engageable &&
      !occurrence.helpfulness,
    barrier:
      skipped &&
      skippable &&
      occurrence.representationMode === 'NATIVE_V3' &&
      engageable &&
      !occurrence.barrierCode,
  }
}

export type RowStatus =
  'done' | 'skipped' | 'cancelled' | 'missed' | 'upcoming' | 'unknown'

export type TodayRow = PlannedOccurrence & Readonly<{ status: RowStatus }>

function rowStatus(occurrence: ActionOccurrence, now: number): RowStatus {
  switch (occurrence.state) {
    case 'COMPLETED':
      return 'done'
    case 'SKIPPED':
      return 'skipped'
    case 'CANCELLED':
      return 'cancelled'
    case 'SCHEDULED':
      return Date.parse(occurrence.scheduledAt) > now ? 'upcoming' : 'missed'
    default:
      return 'unknown'
  }
}

/** Today's daily work in time order; an open row is missed once its time has passed. */
export function todayRows(
  plan: SupportPlanV3,
  occurrences: ActionOccurrence[],
  today: string,
  now = Date.now(),
): TodayRow[] {
  return joinOccurrences(plan, occurrences)
    .filter((item) => item.occurrence.localDate === today && isDailyWork(item))
    .sort((left, right) =>
      left.occurrence.scheduledAt.localeCompare(right.occurrence.scheduledAt),
    )
    .map((item) => ({ ...item, status: rowStatus(item.occurrence, now) }))
}

export type TodayCounts = Readonly<{
  done: number
  skipped: number
  total: number
}>

/** Cancelled rows are not work; skipped rows are resolved but not done. */
export function todayCounts(rows: ReadonlyArray<TodayRow>): TodayCounts {
  const counted = rows.filter(({ status }) => status !== 'cancelled')
  return {
    done: counted.filter(({ status }) => status === 'done').length,
    skipped: counted.filter(({ status }) => status === 'skipped').length,
    total: counted.length,
  }
}

/** Unresolved daily work of earlier days still inside the loaded window, newest first. */
export function earlierOpenRows(
  plan: SupportPlanV3,
  occurrences: ActionOccurrence[],
  today: string,
) {
  return joinOccurrences(plan, occurrences)
    .filter((item) => item.occurrence.localDate < today && isOpen(item))
    .sort((left, right) =>
      right.occurrence.scheduledAt.localeCompare(left.occurrence.scheduledAt),
    )
}

export type CycleDayStatus = 'done' | 'partial' | 'none' | 'unknown' | 'future'

export type CycleDay = Readonly<{
  date: string
  /** 1-based position in the cycle. */
  number: number
  status: CycleDayStatus
  isToday: boolean
  isReviewDay: boolean
  done: number
  /** Non-cancelled daily work that day. */
  total: number
}>

const MAX_CYCLE_DAYS = 45

/**
 * One entry per calendar day of the current cycle, for the header strip and the
 * progress map. A day the loaded window does not cover, or any day before the
 * occurrences are known, is "unknown", never "none".
 */
export function cycleDays(
  plan: SupportPlanV3,
  occurrences: ActionOccurrence[],
  today: string,
  known = true,
): CycleDay[] {
  const cycle = plan.cycle
  const start = cycle?.startedOn
  if (
    !cycle ||
    !start ||
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !['IN_PROGRESS', 'PAUSED', 'REVIEW_DUE'].includes(cycle.state)
  )
    return []
  const window = occurrenceWindow(plan, today)
  const joined = joinOccurrences(plan, occurrences).filter(
    (item) => isDailyWork(item) && item.occurrence.state !== 'CANCELLED',
  )
  // Paused days push the review date out, so the strip follows the review date.
  const span = cycle.reviewDueOn
    ? Math.round((Date.parse(cycle.reviewDueOn) - Date.parse(start)) / 864e5) +
      1
    : cycle.lengthDays
  const length = Math.min(span > 0 ? span : cycle.lengthDays, MAX_CYCLE_DAYS)
  return Array.from({ length }, (_, index) =>
    projectDay(
      joined,
      addDays(start, index),
      index + 1,
      today,
      known,
      window.from,
      cycle.reviewDueOn,
    ),
  )
}

const RECENT_DAYS = 7

/**
 * History days for a plan without a usable cycle (historical or adapter plans):
 * the last week through today, never before the loaded window.
 */
export function recentDays(
  plan: SupportPlanV3,
  occurrences: ActionOccurrence[],
  today: string,
  known = true,
): CycleDay[] {
  const window = occurrenceWindow(plan, today)
  const joined = joinOccurrences(plan, occurrences).filter(
    (item) => isDailyWork(item) && item.occurrence.state !== 'CANCELLED',
  )
  const days: CycleDay[] = []
  let date = maxDate(addDays(today, -(RECENT_DAYS - 1)), window.from)
  while (date <= today) {
    days.push(
      projectDay(
        joined,
        date,
        days.length + 1,
        today,
        known,
        window.from,
        null,
      ),
    )
    date = addDays(date, 1)
  }
  return days
}

function projectDay(
  joined: PlannedOccurrence[],
  date: string,
  number: number,
  today: string,
  known: boolean,
  windowFrom: string,
  reviewDueOn: string | null,
): CycleDay {
  const rows = joined.filter(({ occurrence }) => occurrence.localDate === date)
  const done = rows.filter(
    ({ occurrence }) => occurrence.state === 'COMPLETED',
  ).length
  const status: CycleDayStatus =
    date > today
      ? 'future'
      : !known || date < windowFrom
        ? 'unknown'
        : rows.length > 0 && done === rows.length
          ? 'done'
          : done > 0
            ? 'partial'
            : 'none'
  return {
    date,
    number,
    status,
    isToday: date === today,
    isReviewDay: date === reviewDueOn,
    done,
    total: rows.length,
  }
}

/** First open daily work on a later local day, when the loaded window has one. */
export function nextOpenAfter(
  plan: SupportPlanV3,
  occurrences: ActionOccurrence[],
  today: string,
) {
  return joinOccurrences(plan, occurrences)
    .filter((item) => item.occurrence.localDate > today && isOpen(item))
    .sort((left, right) =>
      left.occurrence.scheduledAt.localeCompare(right.occurrence.scheduledAt),
    )[0]
}

/** Identity of one read: a new plan or a moved window must not reuse the old rows. */
export function occurrenceKey(plan: SupportPlanV3, today: string) {
  const { from, through } = occurrenceWindow(plan, today)
  return `${plan.supportPlanId}|${from}|${through}`
}

/** Monday-first local dates of the week that holds `today`. */
export function weekDates(today: string) {
  const sinceMonday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7
  const monday = addDays(today, -sinceMonday)
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index))
}

type PlanSchedule = PlanAction['schedules'][number]

/** ISO weekdays (1 = Monday) of a WEEKLY rule. */
const scheduleWeekdays = (schedule: PlanSchedule) =>
  schedule.daysOfWeek?.length
    ? schedule.daysOfWeek
    : schedule.recurrenceDayOfWeek
      ? [schedule.recurrenceDayOfWeek]
      : []

/** Which of the given dates a schedule lands on. */
function scheduleHits(schedule: PlanSchedule, dates: ReadonlyArray<string>) {
  const weekdays = scheduleWeekdays(schedule)
  return dates.map((date, index) => {
    if (date < schedule.effectiveFrom) return false
    if (schedule.effectiveUntil && date > schedule.effectiveUntil) return false
    if (schedule.recurrenceType === 'DAILY') return true
    if (schedule.recurrenceType === 'WEEKLY')
      return weekdays.includes(index + 1)
    return date === schedule.effectiveFrom
  })
}

const liveSchedules = (action: PlanAction) =>
  (action.schedules ?? []).filter((schedule) => schedule.status !== 'ENDED')

/**
 * One cell per date: the local time(s) the action is scheduled, '' when it is
 * scheduled but the time is unusable, undefined when it is not scheduled.
 */
export function actionWeek(action: PlanAction, dates: ReadonlyArray<string>) {
  const schedules = liveSchedules(action).map((schedule) => ({
    time: /^\d{2}:\d{2}/.test(schedule.localTime ?? '')
      ? schedule.localTime.slice(0, 5)
      : '',
    hits: scheduleHits(schedule, dates),
  }))
  return dates.map((_, index): string | undefined => {
    const hit = schedules.filter(({ hits }) => hits[index])
    return hit.length === 0
      ? undefined
      : [...new Set(hit.map(({ time }) => time).filter(Boolean))]
          .sort()
          .join(', ')
  })
}

/**
 * Minutes of planned work in a typical week (one-time rules and effective dates
 * do not count); null when any recurring duration is unknown.
 */
export function weeklyMinutes(actions: ReadonlyArray<PlanAction>) {
  let total = 0
  for (const action of actions)
    for (const schedule of liveSchedules(action)) {
      const days =
        schedule.recurrenceType === 'DAILY'
          ? 7
          : schedule.recurrenceType === 'WEEKLY'
            ? new Set(scheduleWeekdays(schedule)).size
            : 0
      if (days === 0) continue
      if (!schedule.estimatedDurationMinutes) return null
      total += schedule.estimatedDurationMinutes * days
    }
  return total > 0 ? total : null
}

export type PeriodCounts = Readonly<{
  done: number
  skipped: number
  missed: number
}>

/** Daily work of the loaded period only: done, put aside, and open past its time. */
export function periodCounts(
  plan: SupportPlanV3,
  occurrences: ActionOccurrence[],
  from: string,
  through: string,
  now = Date.now(),
): PeriodCounts {
  const states = joinOccurrences(plan, occurrences)
    .filter(
      (item) =>
        isDailyWork(item) &&
        item.occurrence.localDate >= from &&
        item.occurrence.localDate <= through,
    )
    .map(({ occurrence }) => rowStatus(occurrence, now))
  const count = (status: RowStatus) =>
    states.filter((state) => state === status).length
  return {
    done: count('done'),
    skipped: count('skipped'),
    missed: count('missed'),
  }
}

/** "30/10" from a local date. */
export const shortDate = (date: string) =>
  `${Number(date.slice(8, 10))}/${Number(date.slice(5, 7))}`
