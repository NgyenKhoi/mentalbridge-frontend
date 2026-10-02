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

export function appointmentTimingCopy(appointment: Appointment) {
  if (appointment.status === 'IN_PROGRESS') {
    return 'Phiên nhắn tin đang diễn ra'
  }
  if (appointment.status === 'CONFIRMED') {
    return 'Buổi tư vấn đã được xác nhận'
  }
  return 'Mở tin nhắn để xem trạng thái phiên'
}
