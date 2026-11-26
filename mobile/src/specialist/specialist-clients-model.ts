import type { SpecialistClientContinuityItem } from '@/specialist-continuity/specialist-continuity-contract'

export const CLIENT_TIME_ZONE = 'Asia/Ho_Chi_Minh'
export const SESSION_LABEL = {
  CONFIRMED: 'Đã xác nhận',
  IN_PROGRESS: 'Đang diễn ra',
  SESSION_ENDED: 'Đang hoàn tất',
  COMPLETED: 'Đã hoàn thành',
} as const

export const ACCESS_LABEL = {
  NOT_SHARED: 'Chưa được chia sẻ',
  REVOKED: 'Đã thu hồi',
  STALE: 'Lịch hẹn đã thay đổi',
  TOO_EARLY: 'Chưa đến giờ xem',
  AVAILABLE: 'Có thể xem lúc này',
  EXPIRED: 'Đã hết hạn',
  UNAVAILABLE: 'Không khả dụng ở trạng thái này',
} as const

const timeFormat = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: CLIENT_TIME_ZONE,
})
const dayFormat = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  year: 'numeric',
  day: '2-digit',
  month: '2-digit',
  timeZone: CLIENT_TIME_ZONE,
})
const fullTimeFormat = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: CLIENT_TIME_ZONE,
})

export const visitDay = (value: string) => dayFormat.format(new Date(value))
export const visitTime = (value: string) => timeFormat.format(new Date(value))
export const visitDateTime = (value: string) =>
  fullTimeFormat.format(new Date(value))

export function normalizeClientSearch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replaceAll('đ', 'd')
}

export function clientInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((word) => word[0])
    .join('')
    .toLocaleUpperCase('vi-VN')
}

type Client = {
  id: string
  name: string
  appointments: [
    SpecialistClientContinuityItem,
    ...SpecialistClientContinuityItem[],
  ]
}

const statusRank = {
  IN_PROGRESS: 0,
  CONFIRMED: 1,
  SESSION_ENDED: 2,
  COMPLETED: 3,
} as const

function orderVisits(
  left: SpecialistClientContinuityItem,
  right: SpecialistClientContinuityItem,
) {
  const rank = statusRank[left.status] - statusRank[right.status]
  if (rank !== 0) return rank
  const delta =
    Date.parse(left.scheduledStartAt) - Date.parse(right.scheduledStartAt)
  return left.status === 'CONFIRMED' ? delta : -delta
}

export function groupClientVisits(items: SpecialistClientContinuityItem[]) {
  const clients = new Map<string, Client>()
  for (const visit of new Map(
    items.map((item) => [item.appointmentId, item]),
  ).values()) {
    const client = clients.get(visit.userAccountId)
    if (client) client.appointments.push(visit)
    else
      clients.set(visit.userAccountId, {
        id: visit.userAccountId,
        name: visit.userDisplayName,
        appointments: [visit],
      })
  }
  for (const client of clients.values()) client.appointments.sort(orderVisits)
  return [...clients.values()]
}
