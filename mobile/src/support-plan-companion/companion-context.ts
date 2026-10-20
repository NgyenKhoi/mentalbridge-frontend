import type {
  ActionOccurrence,
  CanonicalSupportPlan,
} from '@/support-plan/support-plan-action-contract'

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

export function selectMobileCompanionContext(
  plan: CanonicalSupportPlan,
  occurrences: readonly ActionOccurrence[],
): MobileCompanionContext | null {
  const actions = plan.focuses.flatMap((focus) => focus.actions)
  const occurrence = occurrences.find((item) =>
    actions.some((action) => action.actionId === item.actionId),
  )
  const action = occurrence
    ? actions.find((item) => item.actionId === occurrence.actionId)
    : actions[0]
  if (!action) return null
  return {
    supportPlanId: plan.supportPlanId,
    action,
    ...(occurrence ? { occurrence } : {}),
    surface: occurrence ? 'TODAY' : 'PLAN',
  }
}

export function mobileCompanionNavigation(
  context: MobileCompanionContext,
): MobileCompanionNavigation | null {
  const { action, occurrence } = context
  switch (action.actionType) {
    case 'JOURNAL':
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
