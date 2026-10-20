import type {
  ActionOccurrence,
  CanonicalSupportPlan,
} from '@/support-plan/support-plan-action-contract'
import { localPlanDate } from '@/support-plan/emotion-plan-context'
import { isSupportedJournalAction } from '@/support-plan/journal-plan-context'

type PlanAction = CanonicalSupportPlan['focuses'][number]['actions'][number]

export type MobileCompanionContext = Readonly<{
  supportPlanId: string
  action: PlanAction
  occurrence?: ActionOccurrence
  surface: 'TODAY' | 'PLAN'
}>

export type MobileCompanionNavigation = Readonly<{
  label: string
  href:
    | '/(user)/journal'
    | '/(user)/emotion'
    | '/(user)/resources/[resourceId]'
    | '/(user)/specialists'
    | '/(user)/assessment'
  params?: Readonly<Record<string, string>>
}>

type CompanionSelection = Readonly<{
  now: Date
  preferredOccurrenceId?: string
}>

function activeActions(plan: CanonicalSupportPlan) {
  return plan.focuses
    .slice()
    .sort((left, right) => left.ordinal - right.ordinal)
    .flatMap((focus) =>
      focus.actions.slice().sort((left, right) => left.ordinal - right.ordinal),
    )
    .filter(
      (action) =>
        action.status === 'ACTIVE' && action.representationMode === 'NATIVE_V3',
    )
}

function isEligibleTodayOccurrence(
  plan: CanonicalSupportPlan,
  action: PlanAction,
  occurrence: ActionOccurrence,
  now: Date,
) {
  if (
    plan.status !== 'ACTIVE' ||
    !['SCHEDULED', 'COMPLETED'].includes(occurrence.state) ||
    occurrence.representationMode !== 'NATIVE_V3' ||
    occurrence.actionId !== action.actionId ||
    occurrence.actionType !== action.actionType ||
    occurrence.actionVersion !== action.actionVersion ||
    (action.actionType === 'JOURNAL' && !isSupportedJournalAction(action))
  )
    return false
  const schedule = action.schedules.find(
    (item) =>
      item.status === 'ACTIVE' &&
      item.scheduleId === occurrence.scheduleId &&
      item.version === occurrence.scheduleVersion,
  )
  if (!schedule) return false
  try {
    return localPlanDate(now, schedule.timezone) === occurrence.localDate
  } catch {
    return false
  }
}

export function selectMobileCompanionContext(
  plan: CanonicalSupportPlan,
  occurrences: readonly ActionOccurrence[],
  selection: CompanionSelection,
): MobileCompanionContext | null {
  const actions = activeActions(plan)
  const byActionId = new Map(actions.map((action) => [action.actionId, action]))
  const eligible = occurrences
    .flatMap((occurrence) => {
      const action = byActionId.get(occurrence.actionId)
      return action &&
        isEligibleTodayOccurrence(plan, action, occurrence, selection.now)
        ? [{ action, occurrence }]
        : []
    })
    .sort((left, right) => {
      const leftPreferred =
        left.occurrence.occurrenceId === selection.preferredOccurrenceId
      const rightPreferred =
        right.occurrence.occurrenceId === selection.preferredOccurrenceId
      if (leftPreferred !== rightPreferred) return leftPreferred ? -1 : 1
      const scheduled = left.occurrence.scheduledAt.localeCompare(
        right.occurrence.scheduledAt,
      )
      if (scheduled !== 0) return scheduled
      return left.occurrence.occurrenceId.localeCompare(
        right.occurrence.occurrenceId,
      )
    })
  const today = eligible[0]
  if (today)
    return {
      supportPlanId: plan.supportPlanId,
      action: today.action,
      occurrence: today.occurrence,
      surface: 'TODAY',
    }
  const action = actions[0]
  if (!action) return null
  return {
    supportPlanId: plan.supportPlanId,
    action,
    surface: 'PLAN',
  }
}

export function mobileCompanionNavigation(
  context: MobileCompanionContext,
): MobileCompanionNavigation | null {
  const { action, occurrence } = context
  switch (action.actionType) {
    case 'JOURNAL':
      if (occurrence && !isSupportedJournalAction(action)) return null
      return {
        label: 'Mở Nhật ký',
        href: '/(user)/journal',
        ...(occurrence
          ? {
              params: {
                source: 'journal',
                occurrenceId: occurrence.occurrenceId,
                actionId: action.actionId,
                localDate: occurrence.localDate,
              },
            }
          : {}),
      }
    case 'EMOTION_CHECK_IN':
      return {
        label: 'Mở Ghi nhận cảm xúc',
        href: '/(user)/emotion',
        ...(occurrence
          ? {
              params: {
                occurrenceId: occurrence.occurrenceId,
                actionId: action.actionId,
              },
            }
          : {}),
      }
    case 'RESOURCE':
      return action.source?.ownerDomain === 'CONTENT'
        ? {
            label: `Mở ${action.presentation.title}`,
            href: '/(user)/resources/[resourceId]',
            params: {
              resourceId: action.source.sourceId,
              ...(occurrence ? { date: occurrence.localDate } : {}),
            },
          }
        : null
    case 'PROFESSIONAL_SUPPORT':
      return {
        label: 'Tìm chuyên gia',
        href: '/(user)/specialists',
        params: { planActionId: action.actionId },
      }
    case 'REASSESSMENT_SCREENING':
      return { label: 'Mở đánh giá lại', href: '/(user)/assessment' }
    default:
      return null
  }
}

export function nextStepCopy(context: MobileCompanionContext) {
  const destination = mobileCompanionNavigation(context)
  if (destination)
    return `Bạn có thể chọn “${destination.label}” khi thấy phù hợp. Việc mở màn hình đó không tự hoàn thành hoặc thay đổi kế hoạch.`
  return `Bạn có thể xem lại “${context.action.presentation.title}” và tự chọn thời điểm phù hợp. Thứ tự hiển thị không phải là đánh giá lâm sàng.`
}
