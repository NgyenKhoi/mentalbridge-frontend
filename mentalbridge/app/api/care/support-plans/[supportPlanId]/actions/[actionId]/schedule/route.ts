import type { NextRequest } from 'next/server'

import type { UpdateActionScheduleRequest } from '@/features/support-plan/api/support-plan-contract'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedCareUser,
  careAuthenticationFailure,
  carryCareSession,
} from '@/lib/care/authenticated-user'
import {
  careErrorResponse,
  careSuccessResponse,
  localProblem,
} from '@/lib/care/bff-response'
import { careClient } from '@/lib/care/care-client'
import { isUuid } from '@/lib/care/care-validation'

const VERSION = /^"(0|[1-9]\d*)"$/
const IDEMPOTENCY_KEY = /^[!-~]{16,128}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/

function expectedVersion(request: NextRequest) {
  const match = VERSION.exec(request.headers.get('if-match') ?? '')
  if (!match) return null
  const value = Number(match[1])
  return Number.isSafeInteger(value) ? value : null
}

function scheduleRequest(value: unknown): UpdateActionScheduleRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (!Object.hasOwn(record, 'schedule')) return null
  if (record.schedule === null) return { schedule: null }
  if (
    !record.schedule ||
    typeof record.schedule !== 'object' ||
    Array.isArray(record.schedule)
  )
    return null

  const schedule = record.schedule as Record<string, unknown>
  const days = schedule.daysOfWeek
  const recurrence = schedule.recurrenceType
  if (
    !['ONCE', 'DAILY', 'WEEKLY'].includes(String(recurrence)) ||
    !Array.isArray(days) ||
    days.length > 7 ||
    new Set(days).size !== days.length ||
    !days.every(
      (day) => Number.isInteger(day) && Number(day) >= 1 && Number(day) <= 7,
    ) ||
    (recurrence === 'WEEKLY' ? days.length === 0 : days.length !== 0) ||
    !(
      schedule.preferredDaypart === null ||
      ['MORNING', 'AFTERNOON', 'EVENING', 'FLEXIBLE'].includes(
        String(schedule.preferredDaypart),
      )
    ) ||
    typeof schedule.localTime !== 'string' ||
    !TIME.test(schedule.localTime) ||
    !Number.isInteger(schedule.estimatedDurationMinutes) ||
    Number(schedule.estimatedDurationMinutes) < 5 ||
    Number(schedule.estimatedDurationMinutes) > 180 ||
    Number(schedule.estimatedDurationMinutes) % 5 !== 0 ||
    typeof schedule.timezone !== 'string' ||
    schedule.timezone.length < 1 ||
    schedule.timezone.length > 64 ||
    typeof schedule.effectiveFrom !== 'string' ||
    !DATE.test(schedule.effectiveFrom) ||
    !(
      schedule.effectiveUntil === null ||
      (typeof schedule.effectiveUntil === 'string' &&
        DATE.test(schedule.effectiveUntil))
    ) ||
    typeof schedule.reminderEnabled !== 'boolean'
  )
    return null

  return value as UpdateActionScheduleRequest
}

export async function PUT(
  request: NextRequest,
  context: RouteContext<'/api/care/support-plans/[supportPlanId]/actions/[actionId]/schedule'>,
) {
  const correlationId = correlationIdFrom(request)
  let user: Awaited<ReturnType<typeof authenticatedCareUser>>
  try {
    user = await authenticatedCareUser(request, correlationId)
  } catch (error) {
    return careAuthenticationFailure(error, correlationId)
  }

  const { supportPlanId, actionId } = await context.params
  const version = expectedVersion(request)
  const key = request.headers.get('idempotency-key') ?? ''
  let body: UpdateActionScheduleRequest | null = null
  try {
    body = scheduleRequest(await request.json())
  } catch {
    // The stable validation response below covers malformed JSON.
  }

  if (
    !isUuid(supportPlanId) ||
    !isUuid(actionId) ||
    version === null ||
    !IDEMPOTENCY_KEY.test(key) ||
    !body
  ) {
    return carryCareSession(
      localProblem(
        400,
        'VALIDATION_FAILED',
        'A valid plan, action, If-Match, Idempotency-Key, and schedule are required.',
        correlationId,
      ),
      user,
    )
  }

  try {
    const plan = await careClient.replaceSupportPlanActionSchedule(
      user.accessToken,
      supportPlanId,
      actionId,
      body,
      version,
      key,
      correlationId,
    )
    const response = careSuccessResponse(plan, correlationId)
    response.headers.set('ETag', `"${plan.version}"`)
    return carryCareSession(response, user)
  } catch (error) {
    return carryCareSession(careErrorResponse(error, correlationId), user)
  }
}
