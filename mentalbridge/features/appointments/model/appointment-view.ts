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

const ACTIVE_STATUSES: readonly Appointment['status'][] = [
  'REQUESTED',
  'CONFIRMED',
  'IN_PROGRESS',
  'SESSION_ENDED',
]

export function orderAppointmentsForDisplay(
  appointments: readonly Appointment[],
) {
  return [...appointments].sort((left, right) => {
    const leftActive = ACTIVE_STATUSES.includes(left.status)
    const rightActive = ACTIVE_STATUSES.includes(right.status)
    if (leftActive !== rightActive) return leftActive ? -1 : 1

    const difference =
      Date.parse(left.scheduledStartAt) - Date.parse(right.scheduledStartAt)
    return leftActive ? difference : -difference
  })
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

/** Decision deadlines first; no client-side inference of decision eligibility. */
export function orderSpecialistAppointments(
  appointments: readonly Appointment[],
) {
  return orderAppointmentsForDisplay(appointments).sort((left, right) => {
    if (left.status === 'REQUESTED' && right.status === 'REQUESTED') {
      return (
        Date.parse(left.decisionDeadlineAt) -
        Date.parse(right.decisionDeadlineAt)
      )
    }
    if (left.status === 'REQUESTED') return -1
    if (right.status === 'REQUESTED') return 1
    return 0
  })
}
