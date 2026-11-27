import { z } from 'zod'

import type { SupportPlanActionApi } from './support-plan-action-api'
import type {
  CanonicalSupportPlan,
  JournalReconciliation,
} from './support-plan-action-contract'
import { localPlanDate } from './emotion-plan-context'

const originSchema = z
  .object({
    source: z.literal('journal'),
    occurrenceId: z.uuid(),
    actionId: z.uuid(),
    localDate: z.iso.date(),
    journalId: z.uuid().optional(),
  })
  .strict()
export type JournalPlanOrigin = Readonly<z.infer<typeof originSchema>>
export type JournalOriginInput =
  | Readonly<{ state: 'none' }>
  | Readonly<{ state: 'invalid' }>
  | Readonly<{ state: 'valid'; value: JournalPlanOrigin }>
export const noJournalOrigin: JournalOriginInput = { state: 'none' }

export function isSupportedJournalAction(
  action: CanonicalSupportPlan['focuses'][number]['actions'][number],
) {
  return (
    action.actionType === 'JOURNAL' &&
    action.representationMode === 'NATIVE_V3' &&
    action.source?.ownerDomain === 'JOURNAL_AI' &&
    action.source.sourceKind === 'JOURNAL_TEMPLATE' &&
    action.source.sourceId === 'short-reflection' &&
    action.source.sourceRevision === '1' &&
    action.source.sourcePolicyVersion === 'journal-writing-intent-v1'
  )
}

export function parseJournalPlanOrigin(
  params: Record<string, unknown>,
): JournalOriginInput {
  if (Object.keys(params).length === 0) return noJournalOrigin
  const parsed = originSchema.safeParse(params)
  return parsed.success
    ? { state: 'valid', value: parsed.data }
    : { state: 'invalid' }
}

export async function resolveJournalPlanOrigin(
  api: Pick<SupportPlanActionApi, 'getCurrent' | 'getOccurrences'>,
  origin: JournalPlanOrigin,
  now: Date,
) {
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
        item.actionId === origin.actionId && isSupportedJournalAction(item),
    )
  if (!action) return null
  const list = await api.getOccurrences(origin.localDate, origin.localDate)
  if (
    list.supportPlanId !== plan.supportPlanId ||
    list.supportPlanStatus !== plan.status ||
    list.representationMode !== 'NATIVE_V3'
  )
    return null
  const occurrence = list.occurrences.find(
    (item) =>
      item.occurrenceId === origin.occurrenceId &&
      item.actionId === origin.actionId &&
      item.actionType === 'JOURNAL' &&
      item.representationMode === 'NATIVE_V3' &&
      item.localDate === origin.localDate &&
      ['SCHEDULED', 'COMPLETED'].includes(item.state),
  )
  const schedule = action.schedules.find(
    (item) =>
      item.scheduleId === occurrence?.scheduleId &&
      item.version === occurrence.scheduleVersion,
  )
  if (
    !occurrence ||
    !schedule ||
    (occurrence.state === 'SCHEDULED' &&
      (plan.status !== 'ACTIVE' ||
        action.status !== 'ACTIVE' ||
        action.actionVersion !== occurrence.actionVersion ||
        !plan.activatedAt ||
        !action.activatedAt))
  )
    return null
  let isToday = false
  try {
    isToday = localPlanDate(now, schedule.timezone) === occurrence.localDate
  } catch {
    return null
  }
  return {
    origin,
    plan,
    occurrence,
    title: action.presentation.title,
    timezone: schedule.timezone,
    isToday,
    canWrite:
      isToday &&
      occurrence.state === 'SCHEDULED' &&
      plan.status === 'ACTIVE' &&
      action.status === 'ACTIVE',
  }
}
export type ResolvedJournalPlanOrigin = NonNullable<
  Awaited<ReturnType<typeof resolveJournalPlanOrigin>>
>

export function journalReconciliationMessage(
  source: JournalReconciliation['sourceState'],
  completed: boolean,
) {
  if (source === 'RECORDED')
    return completed
      ? 'Đã kiểm tra: lần viết này đã được ghi nhận hoàn thành.'
      : 'Bài viết chưa phù hợp với hoạt động này. Trạng thái trước đó vẫn được giữ.'
  if (source === 'DELETED')
    return completed
      ? 'Bài nhật ký đã được xóa. Lịch sử hoạt động đã ghi nhận trước khi xóa vẫn giữ nguyên.'
      : 'Bài nhật ký đã được xóa. Chưa ghi nhận hoàn thành hoạt động này.'
  return completed
    ? 'Không còn mở được bài nhật ký. Lịch sử hoạt động đã ghi nhận vẫn giữ nguyên.'
    : 'Chưa tìm thấy bài nhật ký này. Hoạt động vẫn chưa hoàn thành.'
}
