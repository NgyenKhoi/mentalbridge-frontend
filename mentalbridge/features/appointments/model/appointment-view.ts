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

type Viewer = 'USER' | 'SPECIALIST'

const STATUS_LABELS: Record<
  Viewer,
  Record<Exclude<Appointment['status'], 'SESSION_ENDED'>, string>
> = {
  USER: {
    REQUESTED: 'Chờ xác nhận',
    CONFIRMED: 'Đã xác nhận',
    IN_PROGRESS: 'Đang diễn ra',
    COMPLETED: 'Đã hoàn thành',
    REJECTED: 'Chuyên gia chưa thể nhận lịch',
    EXPIRED: 'Hết thời gian xác nhận',
    CANCELLED: 'Đã hủy',
  },
  SPECIALIST: {
    REQUESTED: 'Chờ phản hồi',
    CONFIRMED: 'Đã xác nhận',
    IN_PROGRESS: 'Đang diễn ra',
    COMPLETED: 'Đã hoàn thành',
    REJECTED: 'Đã từ chối',
    EXPIRED: 'Đã hết hạn',
    CANCELLED: 'Đã hủy',
  },
}

/** Label of a session that ended but is not COMPLETED yet; the outcome says why. */
function sessionEndedLabel(
  outcome: Appointment['sessionOutcome'],
  viewer: Viewer,
) {
  const mine = viewer === 'USER'
  switch (outcome) {
    case 'USER_NO_SHOW':
      return mine ? 'Bạn vắng mặt' : 'Khách hàng vắng mặt'
    case 'SPECIALIST_NO_SHOW':
      return mine ? 'Chuyên gia vắng mặt' : 'Bạn vắng mặt'
    case 'BOTH_NO_SHOW':
      return 'Cả hai vắng mặt'
    case 'INSUFFICIENT_EVIDENCE':
      return 'Chưa đủ dữ liệu xác nhận'
    case 'EVIDENCE_REVIEW':
      return 'Đang xem xét'
    default:
      return 'Đang xác nhận kết quả'
  }
}

/** The single status wording for lists, badges and pills (SESSION_ENDED is never "done"). */
export function appointmentStatusLabel(
  appointment: Pick<Appointment, 'status'> &
    Partial<Pick<Appointment, 'sessionOutcome'>>,
  viewer: Viewer = 'USER',
) {
  return appointment.status === 'SESSION_ENDED'
    ? sessionEndedLabel(appointment.sessionOutcome ?? null, viewer)
    : STATUS_LABELS[viewer][appointment.status]
}
