import type {
  AppointmentStatus,
  SpecialistAppointment,
} from './specialist-appointment-contract'

export type AppointmentCollection = 'pending' | 'upcoming' | 'history'

const HISTORY_STATUSES: readonly AppointmentStatus[] = [
  'SESSION_ENDED',
  'COMPLETED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
]

export function appointmentCollection(
  appointment: SpecialistAppointment,
  serverNow: string,
): AppointmentCollection {
  if (appointment.status === 'REQUESTED') return 'pending'
  if (
    ['CONFIRMED', 'IN_PROGRESS'].includes(appointment.status) &&
    Date.parse(appointment.scheduledEndAt) > Date.parse(serverNow)
  ) {
    return 'upcoming'
  }
  return 'history'
}

export function groupAppointments(
  appointments: readonly SpecialistAppointment[],
  serverNow: string,
): Record<AppointmentCollection, SpecialistAppointment[]> {
  const groups: Record<AppointmentCollection, SpecialistAppointment[]> = {
    pending: [],
    upcoming: [],
    history: [],
  }

  for (const appointment of appointments) {
    groups[appointmentCollection(appointment, serverNow)].push(appointment)
  }

  groups.pending.sort(
    (left, right) =>
      Date.parse(left.decisionDeadlineAt) -
      Date.parse(right.decisionDeadlineAt),
  )
  groups.upcoming.sort(
    (left, right) =>
      Date.parse(left.scheduledStartAt) - Date.parse(right.scheduledStartAt),
  )
  groups.history.sort(
    (left, right) =>
      Date.parse(right.scheduledStartAt) - Date.parse(left.scheduledStartAt),
  )
  return groups
}

export function canDecide(
  appointment: SpecialistAppointment,
  serverNow: string,
) {
  return (
    appointment.status === 'REQUESTED' &&
    Date.parse(appointment.decisionDeadlineAt) > Date.parse(serverNow)
  )
}

export function canReadContinuity(appointment: SpecialistAppointment) {
  return ['CONFIRMED', 'IN_PROGRESS', 'SESSION_ENDED', 'COMPLETED'].includes(
    appointment.status,
  )
}

export function canPublishSummary(appointment: SpecialistAppointment) {
  return (
    appointment.status === 'COMPLETED' && appointment.completionFactId !== null
  )
}

export function isHistoryStatus(status: AppointmentStatus) {
  return HISTORY_STATUSES.includes(status)
}
