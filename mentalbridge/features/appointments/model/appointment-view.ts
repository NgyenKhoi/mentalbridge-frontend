import type { Appointment } from '@/lib/consultation/consultation-validation'

export type AppointmentFilter = 'all' | 'requested' | 'upcoming' | 'history'

const TERMINAL_STATUSES: readonly Appointment['status'][] = [
  'SESSION_ENDED',
  'COMPLETED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
]

export function matchesAppointmentFilter(
  appointment: Appointment,
  filter: AppointmentFilter,
  now: number,
) {
  if (filter === 'all') return true
  if (filter === 'requested') return appointment.status === 'REQUESTED'
  if (filter === 'upcoming') {
    return (
      ['CONFIRMED', 'IN_PROGRESS'].includes(appointment.status) &&
      Date.parse(appointment.scheduledEndAt) > now
    )
  }
  return (
    TERMINAL_STATUSES.includes(appointment.status) ||
    Date.parse(appointment.scheduledEndAt) <= now
  )
}

export function nextAppointment(
  appointments: readonly Appointment[],
  now: number,
) {
  return [...appointments]
    .filter(
      (appointment) =>
        ['CONFIRMED', 'IN_PROGRESS'].includes(appointment.status) &&
        Date.parse(appointment.scheduledEndAt) > now,
    )
    .sort(
      (left, right) =>
        Date.parse(left.scheduledStartAt) - Date.parse(right.scheduledStartAt),
    )[0]
}

export function appointmentTimingCopy(appointment: Appointment, now: number) {
  const start = Date.parse(appointment.scheduledStartAt)
  const end = Date.parse(appointment.scheduledEndAt)
  if (now >= start && now < end) return 'Phiên nhắn tin đang diễn ra'
  if (now >= end) return 'Xem lại hội thoại'
  const opensAt = new Date(start - 10 * 60 * 1000)
  const time = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(opensAt)
  return `Tin nhắn sẽ mở lúc ${time}`
}
