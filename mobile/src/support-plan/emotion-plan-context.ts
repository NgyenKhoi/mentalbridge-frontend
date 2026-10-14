import { z } from 'zod'

import type { SupportPlanActionApi } from './support-plan-action-api'
import type {
  ActionOccurrence,
  CanonicalSupportPlan,
} from './support-plan-action-contract'

export type EmotionPlanOrigin = Readonly<{
  occurrenceId: string
  actionId: string
}>
export type OriginInput =
  | Readonly<{ state: 'none' }>
  | Readonly<{ state: 'invalid' }>
  | Readonly<{ state: 'valid'; value: EmotionPlanOrigin }>

export function parseEmotionPlanOrigin(
  occurrenceId: unknown,
  actionId: unknown,
): OriginInput {
  if (occurrenceId === undefined && actionId === undefined)
    return { state: 'none' }
  const value = z
    .object({ occurrenceId: z.uuid(), actionId: z.uuid() })
    .strict()
    .safeParse({ occurrenceId, actionId })
  return value.success
    ? { state: 'valid', value: value.data }
    : { state: 'invalid' }
}

export function localPlanDate(now: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function occurrenceWindow(now: Date, timezone: string) {
  const today = localPlanDate(now, timezone)
  return { from: addDays(today, -14), through: addDays(today, 16) }
}

export type ResolvedEmotionPlanOrigin = Readonly<{
  origin: EmotionPlanOrigin
  plan: CanonicalSupportPlan
  occurrence: ActionOccurrence
  title: string
  timezone: string
  isToday: boolean
}>

/** Navigation IDs are hints; only the authenticated owner projection supplies day/zone. */
export async function resolveEmotionPlanOrigin(
  api: Pick<SupportPlanActionApi, 'getCurrent' | 'getOccurrences'>,
  origin: EmotionPlanOrigin,
  now: Date,
): Promise<ResolvedEmotionPlanOrigin | null> {
  const plan = await api.getCurrent()
  if (
    plan.representationMode !== 'NATIVE_V3' ||
    !['ACTIVE', 'PAUSED'].includes(plan.status)
  )
    return null
  const action = plan.focuses
    .flatMap((focus) => focus.actions)
    .find(
      (item) =>
        item.actionId === origin.actionId &&
        item.actionType === 'EMOTION_CHECK_IN' &&
        item.representationMode === 'NATIVE_V3' &&
        item.status === 'ACTIVE',
    )
  const defaultSchedule = action?.schedules.find(
    (schedule) => schedule.status === 'ACTIVE',
  )
  if (!action || !defaultSchedule) return null
  const window = occurrenceWindow(now, defaultSchedule.timezone)
  const list = await api.getOccurrences(window.from, window.through)
  if (
    list.supportPlanId !== plan.supportPlanId ||
    list.supportPlanStatus !== plan.status ||
    list.representationMode !== 'NATIVE_V3'
  )
    return null
  const occurrence = list.occurrences.find(
    (item) =>
      item.occurrenceId === origin.occurrenceId &&
      item.actionId === action.actionId &&
      item.actionType === 'EMOTION_CHECK_IN' &&
      item.representationMode === 'NATIVE_V3',
  )
  const schedule = action.schedules.find(
    (item) =>
      item.scheduleId === occurrence?.scheduleId &&
      item.version === occurrence.scheduleVersion,
  )
  if (
    !occurrence ||
    !schedule ||
    ['CANCELLED', 'SKIPPED'].includes(occurrence.state)
  )
    return null
  return {
    origin,
    plan,
    occurrence,
    title: action.presentation.title,
    timezone: schedule.timezone,
    isToday: occurrence.localDate === localPlanDate(now, schedule.timezone),
  }
}

export function emotionReconciliationMessage(
  source: 'RECORDED' | 'MISSING' | 'DELETED',
  completed: boolean,
) {
  if (source === 'RECORDED')
    return completed
      ? 'Đã kiểm tra: hoạt động này đã được ghi nhận hoàn thành.'
      : 'Ghi nhận chưa phù hợp với hoạt động này. Trạng thái trước đó vẫn được giữ.'
  if (source === 'DELETED')
    return completed
      ? 'Ghi nhận cảm xúc đã được xóa. Hoạt động đã được ghi nhận trước khi xóa vẫn giữ nguyên.'
      : 'Ghi nhận của ngày này đã được xóa. Chưa ghi nhận hoàn thành hoạt động.'
  return completed
    ? 'Không còn ghi nhận cảm xúc cho ngày này. Lịch sử hoạt động đã ghi nhận vẫn giữ nguyên.'
    : 'Chưa có ghi nhận cảm xúc cho ngày này. Hoạt động vẫn chưa hoàn thành.'
}
