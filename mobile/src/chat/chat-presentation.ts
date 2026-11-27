import type { Appointment } from '@/appointments/appointment-contract'
import type { Eligibility } from './chat-contract'

export const chatPhaseLabels: Record<Eligibility['phase'], string> = {
  NOT_AVAILABLE: 'Chưa mở',
  TOO_EARLY: 'Sắp diễn ra',
  WAITING: 'Phòng chờ',
  ACTIVE: 'Đang diễn ra',
  ENDED_PROCESSING: 'Đang xử lý',
  COMPLETED: 'Đã hoàn thành',
  USER_NO_SHOW: 'Người dùng vắng mặt',
  SPECIALIST_NO_SHOW: 'Chuyên gia vắng mặt',
  BOTH_NO_SHOW: 'Hai bên vắng mặt',
  INSUFFICIENT_EVIDENCE: 'Chưa đủ dữ liệu',
  EVIDENCE_REVIEW: 'Cần đối soát',
  CANCELLED: 'Đã hủy',
  RESCHEDULED: 'Đã đổi lịch',
}
export const chatCreditLabels: Record<Eligibility['creditState'], string> = {
  AVAILABLE: 'Đã hoàn lại',
  HELD: 'Đang giữ',
  CONSUMED: 'Đã sử dụng',
  FORFEITED: 'Đã trừ',
}
export type ConversationFilter = 'all' | 'active' | 'waiting' | 'ended'

export function hasConversation(item: Appointment) {
  return (
    item.modality === 'IN_APP_CHAT' &&
    (['CONFIRMED', 'IN_PROGRESS', 'SESSION_ENDED', 'COMPLETED'].includes(
      item.status,
    ) ||
      item.history.some((event) => event.toStatus === 'CONFIRMED'))
  )
}
export function conversationState(
  item: Appointment,
): Exclude<ConversationFilter, 'all'> {
  return item.status === 'IN_PROGRESS'
    ? 'active'
    : item.status === 'CONFIRMED'
      ? 'waiting'
      : 'ended'
}
export function sortedConversations(items: readonly Appointment[]) {
  const order = { active: 0, waiting: 1, ended: 2 }
  return items.filter(hasConversation).sort((a, b) => {
    const state = conversationState(a),
      other = conversationState(b)
    return (
      order[state] - order[other] ||
      (state === 'ended' ? -1 : 1) *
        (Date.parse(a.scheduledStartAt) - Date.parse(b.scheduledStartAt))
    )
  })
}
export function chatTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(new Date(value))
}
export function chatDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone,
  }).format(new Date(value))
}
export function chatDayKey(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).format(new Date(value))
}
export function chatInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((word) => word[0])
    .join('')
    .toLocaleUpperCase('vi-VN')
}
