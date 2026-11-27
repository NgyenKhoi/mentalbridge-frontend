export const reminderCategories = {
  'support-plan': 'Kế hoạch hỗ trợ',
  emotion: 'Cảm xúc',
  journal: 'Nhật ký',
  resources: 'Tài nguyên',
  notifications: 'Thông báo',
} as const

export const reminderStatuses = {
  due: 'Cần làm',
  upcoming: 'Sắp tới',
  completed: 'Đã hoàn thành',
  skipped: 'Đã bỏ qua',
  rescheduled: 'Đã đổi lịch',
  unavailable: 'Chưa khả dụng',
} as const

export type ReminderDestination = keyof typeof reminderCategories

export type ReminderAction = Readonly<{
  id: string
  title: string
  category: keyof typeof reminderCategories
  status: keyof typeof reminderStatuses
  scheduledAt: string | null
  destination: ReminderDestination | null
}>

export type ReminderDelivery =
  | Readonly<{ state: 'paused' }>
  | Readonly<{ state: 'quiet-hours'; start: string; end: string }>
  | Readonly<{ state: 'available'; nextEligibleAt: string | null }>
  | Readonly<{ state: 'unavailable' }>

export type ReminderOverview =
  | Readonly<{ state: 'unavailable' }>
  | Readonly<{
      state: 'ready'
      localDate: string
      timeZone: string
      today: readonly ReminderAction[]
      upcoming: readonly ReminderAction[]
      delivery: ReminderDelivery
      deliveryPreviews?: readonly Readonly<{
        id: string
        title: string
        channel: string
        status: string
        nextEligibleAt: string | null
        latestDelivery: Readonly<{ label: string; recordedAt: string }> | null
      }>[]
      unsupportedCategories?: readonly string[]
    }>

export type ReminderSource = Readonly<{
  read: (signal: AbortSignal) => Promise<ReminderOverview>
}>

export function reminderDestination(action: ReminderAction) {
  if (action.status === 'unavailable') return null
  switch (action.destination) {
    case 'support-plan':
      return { pathname: '/(user)/support-plan' as const }
    case 'emotion':
      return { pathname: '/(user)/emotion' as const }
    case 'journal':
      return { pathname: '/(user)/journal' as const }
    case 'resources':
      return { pathname: '/(user)/resources' as const }
    case 'notifications':
      return { pathname: '/(user)/notifications' as const }
    default:
      return null
  }
}

export function reminderTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value))
}

export function reminderDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'full',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`))
}
