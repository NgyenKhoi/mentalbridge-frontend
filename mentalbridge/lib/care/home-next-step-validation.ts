import type {
  HomeNextOccurrence,
  HomeNextStep,
  HomePlanStep,
} from '@/features/assessment/api/care-contract'

import { isUuid } from './care-validation'
import { parseGuidedJourney } from './guided-journey-validation'

export type { HomeNextStep } from '@/features/assessment/api/care-contract'

const FOCUSES = new Set<HomePlanStep['focus']>([
  'RESUME_PAUSED',
  'REVIEW_DUE',
  'DO_TODAY',
  'TODAY_DONE',
  'NOTHING_TODAY',
])
const ACTION_TYPES = new Set<HomeNextOccurrence['actionType']>([
  'RESOURCE',
  'JOURNAL',
  'EMOTION_CHECK_IN',
  'ROUTINE_SELF_MANAGEMENT',
  'PROFESSIONAL_SUPPORT',
  'REASSESSMENT_SCREENING',
  'SELF_REPORT_REVIEW',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= maxLength
  )
}

function date(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const instant = Date.parse(`${value}T00:00:00Z`)
  return (
    Number.isFinite(instant) &&
    new Date(instant).toISOString().slice(0, 10) === value
  )
}

function dateTime(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) &&
    Number.isFinite(Date.parse(value))
  )
}

export function isHomeTimeZone(value: unknown): value is string {
  if (
    !text(value, 64) ||
    !/^[A-Za-z][A-Za-z0-9._+-]*(?:\/[A-Za-z0-9._+-]+)*$/.test(value)
  ) {
    return false
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return true
  } catch {
    return false
  }
}

function parseOccurrence(value: unknown): HomeNextOccurrence | null {
  if (
    !isRecord(value) ||
    !isUuid(value.occurrenceId) ||
    !text(value.actionId, 128) ||
    !ACTION_TYPES.has(value.actionType as HomeNextOccurrence['actionType']) ||
    !text(value.title, 255) ||
    (value.displayState !== 'SCHEDULED' && value.displayState !== 'OVERDUE') ||
    !(value.scheduledAt === null || dateTime(value.scheduledAt)) ||
    !(
      value.estimatedDurationMinutes === null ||
      (typeof value.estimatedDurationMinutes === 'number' &&
        Number.isInteger(value.estimatedDurationMinutes) &&
        value.estimatedDurationMinutes > 0)
    )
  ) {
    return null
  }
  return {
    occurrenceId: value.occurrenceId,
    actionId: value.actionId,
    actionType: value.actionType as HomeNextOccurrence['actionType'],
    title: value.title,
    displayState: value.displayState,
    scheduledAt: value.scheduledAt,
    estimatedDurationMinutes: value.estimatedDurationMinutes,
  }
}

function parsePlan(value: unknown): HomePlanStep | null {
  if (
    !isRecord(value) ||
    !isUuid(value.supportPlanId) ||
    (value.status !== 'ACTIVE' && value.status !== 'PAUSED') ||
    !FOCUSES.has(value.focus as HomePlanStep['focus']) ||
    !(value.reviewDueOn === null || date(value.reviewDueOn)) ||
    !(
      value.cycleDay === null ||
      (typeof value.cycleDay === 'number' && Number.isInteger(value.cycleDay))
    ) ||
    !(
      value.cycleLengthDays === null ||
      (typeof value.cycleLengthDays === 'number' &&
        Number.isInteger(value.cycleLengthDays))
    ) ||
    !date(value.localDate) ||
    !isHomeTimeZone(value.timeZone) ||
    !isRecord(value.today) ||
    typeof value.today.total !== 'number' ||
    !Number.isInteger(value.today.total) ||
    value.today.total < 0 ||
    typeof value.today.completed !== 'number' ||
    !Number.isInteger(value.today.completed) ||
    value.today.completed < 0 ||
    value.today.completed > value.today.total
  ) {
    return null
  }
  const nextOccurrence =
    value.nextOccurrence === null ? null : parseOccurrence(value.nextOccurrence)
  if (
    (value.nextOccurrence !== null && !nextOccurrence) ||
    (value.focus === 'DO_TODAY') !== (nextOccurrence !== null)
  ) {
    return null
  }
  return {
    supportPlanId: value.supportPlanId,
    status: value.status,
    focus: value.focus as HomePlanStep['focus'],
    reviewDueOn: value.reviewDueOn,
    cycleDay: value.cycleDay,
    cycleLengthDays: value.cycleLengthDays,
    localDate: value.localDate,
    timeZone: value.timeZone,
    today: { total: value.today.total, completed: value.today.completed },
    nextOccurrence,
  }
}

export function parseHomeNextStep(value: unknown): HomeNextStep | null {
  if (!isRecord(value) || value.homePolicyVersion !== 'mb-home-next-step-v1') {
    return null
  }
  const journey = parseGuidedJourney(value.journey)
  const plan = value.plan === null ? null : parsePlan(value.plan)
  if (!journey || (value.plan !== null && !plan)) return null

  let lastCompletedPlan: HomeNextStep['lastCompletedPlan'] = null
  if (value.lastCompletedPlan !== null) {
    if (
      plan !== null ||
      journey.currentSupportPlanId !== null ||
      !isRecord(value.lastCompletedPlan) ||
      !isUuid(value.lastCompletedPlan.supportPlanId) ||
      !dateTime(value.lastCompletedPlan.completedAt)
    ) {
      return null
    }
    lastCompletedPlan = {
      supportPlanId: value.lastCompletedPlan.supportPlanId,
      completedAt: value.lastCompletedPlan.completedAt,
    }
  }
  return {
    homePolicyVersion: 'mb-home-next-step-v1',
    journey,
    plan,
    lastCompletedPlan,
  }
}
