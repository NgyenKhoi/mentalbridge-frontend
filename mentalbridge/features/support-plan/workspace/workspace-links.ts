import type { PlanAction, SupportPlanV3 } from '../api/support-plan-contract'
import { emotionPlanHref } from '../emotion-plan-origin'
import { journalPlanHref } from '../journal-plan-origin'
import type { PlannedOccurrence } from './workspace-model'

export type ActionDestination = Readonly<{ href: string; label: string }>

export const REASSESSMENT_HREF = '/initial-check?purpose=reassessment'

/** Only the reviewed short-reflection intention may open writing from a plan. */
export function isPlanJournalAction(action: PlanAction) {
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

/** Where the owning feature lives; the plan never marks anything done by navigating. */
export function actionDestination(
  plan: SupportPlanV3,
  { occurrence, action }: PlannedOccurrence,
  today: string,
): ActionDestination | undefined {
  const open =
    plan.status === 'ACTIVE' &&
    action.status === 'ACTIVE' &&
    occurrence.state === 'SCHEDULED'
  const origin = {
    occurrenceId: occurrence.occurrenceId,
    actionId: occurrence.actionId,
    localDate: occurrence.localDate,
  }
  switch (action.actionType) {
    case 'EMOTION_CHECK_IN':
      return open
        ? {
            href: emotionPlanHref(origin, '/dashboard'),
            label: 'Ghi lại cảm xúc',
          }
        : undefined
    case 'JOURNAL':
      return open &&
        isPlanJournalAction(action) &&
        Boolean(plan.activatedAt && action.activatedAt) &&
        occurrence.localDate === today
        ? {
            href: journalPlanHref({ source: 'journal', ...origin }, '/journal'),
            label: 'Viết vài dòng',
          }
        : undefined
    case 'RESOURCE': {
      if (action.source?.ownerDomain !== 'CONTENT') return undefined
      const query = new URLSearchParams({
        from: 'support-plan',
        contentVersion: action.source.sourceRevision ?? '',
        ...origin,
      })
      return {
        href: `/resources/${encodeURIComponent(action.source.sourceId)}?${query}`,
        label: 'Mở nội dung',
      }
    }
    case 'REASSESSMENT_SCREENING':
      return { href: REASSESSMENT_HREF, label: 'Làm bài kiểm tra lại' }
    case 'PROFESSIONAL_SUPPORT':
      return {
        href: `/specialists?planActionId=${encodeURIComponent(action.actionId)}`,
        label: 'Tìm chuyên gia phù hợp',
      }
    default:
      return undefined
  }
}

/** Manual "done" exists only where Care records a user acknowledgement. */
export function canAcknowledge(plan: SupportPlanV3, item: PlannedOccurrence) {
  return (
    plan.status === 'ACTIVE' &&
    item.action.status === 'ACTIVE' &&
    item.occurrence.state === 'SCHEDULED' &&
    ['RESOURCE', 'ROUTINE_SELF_MANAGEMENT'].includes(item.action.actionType)
  )
}
