import { isUuid } from '@/lib/care/care-validation'
import { isSupportPlanLocalDate } from '@/lib/care/support-plan-action-validation'
import {
  getCurrentSupportPlanActions,
  getSupportPlanActionOccurrences,
} from './api/browser-support-plan-actions'

export type JournalPlanOrigin = Readonly<{
  source: 'journal'
  occurrenceId: string
  actionId: string
  localDate: string
  /** A saved-entry candidate, never a claim that the activity is complete. */
  journalId?: string
}>

export function parseJournalPlanOrigin(
  params: URLSearchParams,
): JournalPlanOrigin | null {
  if (
    ['source', 'occurrenceId', 'actionId', 'localDate'].some(
      (key) => params.getAll(key).length !== 1,
    ) ||
    params.getAll('journalId').length > 1 ||
    params.get('source') !== 'journal'
  )
    return null
  const occurrenceId = params.get('occurrenceId')
  const actionId = params.get('actionId')
  const localDate = params.get('localDate')
  const journalId = params.get('journalId')
  if (
    !occurrenceId ||
    !actionId ||
    !localDate ||
    !isUuid(occurrenceId) ||
    !isUuid(actionId) ||
    !isSupportPlanLocalDate(localDate) ||
    (journalId !== null && !isUuid(journalId))
  )
    return null
  return {
    source: 'journal',
    occurrenceId,
    actionId,
    localDate,
    ...(journalId !== null ? { journalId } : {}),
  }
}

export function journalPlanHref(
  origin: JournalPlanOrigin,
  destination: '/journal' | '/support-plan',
) {
  const params = new URLSearchParams({
    source: 'journal',
    occurrenceId: origin.occurrenceId,
    actionId: origin.actionId,
    localDate: origin.localDate,
    ...(origin.journalId ? { journalId: origin.journalId } : {}),
  })
  return `${destination}?${params}${destination === '/support-plan' ? `#activity-${origin.occurrenceId}` : ''}`
}

/** Resolve URL hints through fresh owner reads; never read private Journal text. */
export async function resolveJournalPlanOrigin(origin: JournalPlanOrigin) {
  const plan = await getCurrentSupportPlanActions()
  if (plan.representationMode !== 'NATIVE_V3')
    throw new Error('JOURNAL_PLAN_ORIGIN_UNAVAILABLE')
  const window = await getSupportPlanActionOccurrences(
    origin.localDate,
    origin.localDate,
  )
  if (
    window.supportPlanId !== plan.supportPlanId ||
    window.representationMode !== 'NATIVE_V3'
  )
    throw new Error('JOURNAL_PLAN_ORIGIN_UNAVAILABLE')
  const occurrence = window.occurrences.find(
    (item) =>
      item.occurrenceId === origin.occurrenceId &&
      item.actionId === origin.actionId &&
      item.actionType === 'JOURNAL' &&
      item.representationMode === 'NATIVE_V3' &&
      item.localDate === origin.localDate &&
      ['SCHEDULED', 'COMPLETED'].includes(item.state),
  )
  const action = plan.focuses
    .flatMap((focus) => focus.actions)
    .find(
      (item) =>
        item.actionId === origin.actionId &&
        item.actionType === 'JOURNAL' &&
        item.representationMode === 'NATIVE_V3',
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
    !action.source ||
    action.source.ownerDomain !== 'JOURNAL_AI' ||
    action.source.sourceKind !== 'JOURNAL_TEMPLATE' ||
    action.source.sourceId !== 'short-reflection' ||
    action.source.sourceRevision !== '1' ||
    action.source.sourcePolicyVersion !== 'journal-writing-intent-v1' ||
    (occurrence.state === 'SCHEDULED' &&
      (plan.status !== 'ACTIVE' ||
        action.status !== 'ACTIVE' ||
        !plan.activatedAt ||
        !action.activatedAt))
  )
    throw new Error('JOURNAL_PLAN_ORIGIN_UNAVAILABLE')
  // The frozen schedule owns timezone. No client date grants completion.
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: schedule.timezone })
  } catch {
    throw new Error('JOURNAL_PLAN_ORIGIN_UNAVAILABLE')
  }
  return {
    source: 'journal' as const,
    occurrenceId: origin.occurrenceId,
    actionId: origin.actionId,
    localDate: origin.localDate,
    ...(origin.journalId ? { journalId: origin.journalId } : {}),
    timezone: schedule.timezone,
    title: action.presentation.title,
    planId: plan.supportPlanId,
    planStatus: plan.status,
    actionStatus: action.status,
    activatedAt: action.activatedAt,
    canOpenWriting: occurrence.state === 'SCHEDULED',
    occurrence,
  }
}

export type ResolvedJournalPlanOrigin = Awaited<
  ReturnType<typeof resolveJournalPlanOrigin>
>
