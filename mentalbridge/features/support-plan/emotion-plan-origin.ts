import { isUuid } from '@/lib/care/care-validation'
import { isSupportPlanLocalDate } from '@/lib/care/support-plan-action-validation'
import {
  getCurrentSupportPlanActions,
  getSupportPlanActionOccurrences,
} from './api/browser-support-plan-actions'

export type EmotionPlanOrigin = Readonly<{
  occurrenceId: string
  actionId: string
  localDate: string
}>

export function parseEmotionPlanOrigin(
  params: URLSearchParams,
): EmotionPlanOrigin | null {
  if (
    ['occurrenceId', 'actionId', 'localDate'].some(
      (key) => params.getAll(key).length !== 1,
    )
  )
    return null
  const occurrenceId = params.get('occurrenceId')
  const actionId = params.get('actionId')
  const localDate = params.get('localDate')
  return occurrenceId &&
    actionId &&
    isUuid(occurrenceId) &&
    isUuid(actionId) &&
    isSupportPlanLocalDate(localDate)
    ? { occurrenceId, actionId, localDate }
    : null
}

export function emotionPlanHref(
  origin: EmotionPlanOrigin,
  destination: '/dashboard' | '/support-plan',
) {
  const params = new URLSearchParams({
    occurrenceId: origin.occurrenceId,
    actionId: origin.actionId,
    localDate: origin.localDate,
  })
  return `${destination}?${params}${destination === '/dashboard' ? '#emotion-check-in' : `#activity-${origin.occurrenceId}`}`
}

/** URL values identify the desired target; only owned API data supplies context. */
export async function resolveEmotionPlanOrigin(origin: EmotionPlanOrigin) {
  const plan = await getCurrentSupportPlanActions()
  if (plan.representationMode !== 'NATIVE_V3')
    throw new Error('EMOTION_PLAN_ORIGIN_UNAVAILABLE')
  const window = await getSupportPlanActionOccurrences(
    origin.localDate,
    origin.localDate,
  )
  if (
    window.supportPlanId !== plan.supportPlanId ||
    window.representationMode !== 'NATIVE_V3'
  )
    throw new Error('EMOTION_PLAN_ORIGIN_UNAVAILABLE')
  const occurrence = window.occurrences.find(
    (item) =>
      item.occurrenceId === origin.occurrenceId &&
      item.actionId === origin.actionId &&
      item.actionType === 'EMOTION_CHECK_IN' &&
      item.localDate === origin.localDate &&
      ['SCHEDULED', 'COMPLETED'].includes(item.state),
  )
  const action = plan.focuses
    .flatMap((focus) => focus.actions)
    .find(
      (item) =>
        item.actionId === origin.actionId &&
        item.actionType === 'EMOTION_CHECK_IN',
    )
  const schedule = action?.schedules.find(
    (item) =>
      item.scheduleId === occurrence?.scheduleId &&
      item.version === occurrence.scheduleVersion,
  )
  if (
    !occurrence ||
    !action ||
    !schedule ||
    !action.activatedAt ||
    (occurrence.state === 'SCHEDULED' &&
      (plan.status !== 'ACTIVE' || action.status !== 'ACTIVE'))
  )
    throw new Error('EMOTION_PLAN_ORIGIN_UNAVAILABLE')
  // Validated against the owner schedule, never a free-form query timezone.
  new Intl.DateTimeFormat('en-CA', { timeZone: schedule.timezone }).format(
    new Date(),
  )
  return {
    ...origin,
    timezone: schedule.timezone,
    title: action.presentation.title,
    planId: plan.supportPlanId,
    planStatus: plan.status,
    actionStatus: action.status,
    activatedAt: action.activatedAt,
    occurrence,
  }
}

export type ResolvedEmotionPlanOrigin = Awaited<
  ReturnType<typeof resolveEmotionPlanOrigin>
>
