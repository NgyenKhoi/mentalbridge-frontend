import type { PlanResourceAction } from '@/features/support-plan/api/support-plan-contract'
import { resourceDetailHref } from '@/features/support-plan/workspace/workspace-links'

export function planResourceStatus(action: PlanResourceAction) {
  if (!action.today) return 'Không có lịch hôm nay'
  if (action.today.displayState === 'SKIPPED') return 'Để hôm khác'
  return action.today.displayState === 'COMPLETED' ? 'Đã ghi nhận' : 'Chưa làm'
}

export function planResourceSchedule(action: PlanResourceAction) {
  if (action.today) return 'Hôm nay'
  const schedule = action.schedule
  if (!schedule) return 'Không có lịch hôm nay'
  if (schedule.recurrenceType === 'DAILY') return 'Hằng ngày'
  if (schedule.recurrenceType === 'WEEKLY') {
    return schedule.daysOfWeek
      .map((day) => (day === 7 ? 'Chủ nhật' : `Thứ ${day + 1}`))
      .join(', ')
  }
  return new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'numeric',
  }).format(new Date(`${schedule.effectiveFrom}T12:00:00Z`))
}

export function planResourceHref(
  action: PlanResourceAction,
  localDate: string,
) {
  return resourceDetailHref({
    resourceId: action.resource.resourceId,
    contentVersion: action.resource.resourceVersion,
    actionId: action.actionId,
    occurrenceId: action.today?.occurrenceId,
    localDate,
  })
}

export function localWeekStart(date: string) {
  const monday = new Date(`${date}T00:00:00Z`)
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  return monday.toISOString().slice(0, 10)
}
