import { ApiError } from '@/api/api-error'
import type { SlotSelection } from '@/discovery/discovery-model'

import type {
  Appointment,
  AppointmentList,
  RequestAppointment,
} from './appointment-contract'

export const statusLabels: Record<Appointment['status'], string> = {
  REQUESTED: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  IN_PROGRESS: 'Đang diễn ra',
  SESSION_ENDED: 'Phiên đã kết thúc',
  COMPLETED: 'Đã hoàn thành',
  REJECTED: 'Chuyên gia đã từ chối',
  EXPIRED: 'Yêu cầu đã hết hạn',
  CANCELLED: 'Đã hủy',
}
export const sessionLabels = {
  COMPLETED: 'Phiên đã hoàn thành',
  USER_NO_SHOW: 'Bạn không tham gia phiên',
  SPECIALIST_NO_SHOW: 'Chuyên gia không tham gia phiên',
  BOTH_NO_SHOW: 'Hai bên không tham gia phiên',
  INSUFFICIENT_EVIDENCE: 'Chưa đủ thông tin xác nhận hoàn thành',
  EVIDENCE_REVIEW: 'Thông tin phiên đang được rà soát',
} as const
export const creditLabels = {
  AVAILABLE: 'Đã trả lại lượt tư vấn',
  HELD: 'Lượt tư vấn đang được giữ cho lịch hẹn',
  CONSUMED: 'Lượt tư vấn đã được sử dụng',
  FORFEITED: 'Lượt tư vấn không được hoàn lại',
} as const
export const cancellationLabels = {
  RELEASED: 'Lượt tư vấn đã được trả lại.',
  FORFEITED: 'Lượt tư vấn không được hoàn lại.',
  TRANSFERRED_TO_REPLACEMENT: 'Lượt tư vấn đã chuyển sang lịch mới.',
} as const
export function appointmentLabel(item: Appointment) {
  return item.cancellationReason === 'USER_RESCHEDULED'
    ? 'Đã đổi lịch'
    : statusLabels[item.status]
}
export function changeCandidate(item: Appointment, list: AppointmentList) {
  // Presentation only, against the authoritative list's server timestamp.
  // Every command still re-reads the owner list and the server enforces eligibility.
  return (
    ['REQUESTED', 'CONFIRMED'].includes(item.status) &&
    item.replacedByAppointmentId === null &&
    Date.parse(item.scheduledStartAt) > Date.parse(list.generatedAt)
  )
}
export type AppointmentFilter = 'all' | 'requested' | 'upcoming' | 'history'
export function matchesFilter(item: Appointment, filter: AppointmentFilter) {
  if (filter === 'all') return true
  if (filter === 'requested') return item.status === 'REQUESTED'
  const upcoming = ['CONFIRMED', 'IN_PROGRESS'].includes(item.status)
  return filter === 'upcoming'
    ? upcoming
    : !upcoming && item.status !== 'REQUESTED'
}
export function appointmentError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    if (error.code === 'PAID_PLAN_REQUIRED')
      return 'Quyền lợi hiện tại chưa cho phép đặt lịch. Bạn vẫn có thể xem chuyên gia.'
    if (error.status === 403 || error.status === 404)
      return 'Không thể thực hiện với lịch hẹn hoặc khung giờ này. Hãy tải lại danh sách.'
    if (error.code === 'APPOINTMENT_CREDIT_UNAVAILABLE')
      return 'Chưa có lượt tư vấn phù hợp với giờ hẹn này. Hãy cập nhật quyền lợi và chọn lại.'
    if (error.code === 'APPOINTMENT_RESERVATION_LIMIT_REACHED')
      return 'Bạn đã đạt số lịch hẹn được giữ cùng lúc. Hãy quản lý lịch hiện tại rồi thử lại.'
    if (error.status === 412 || error.status === 428)
      return 'Lịch hẹn vừa thay đổi. Hãy tải lại và kiểm tra trước khi xác nhận.'
    if (error.status === 409)
      return 'Khung giờ hoặc điều kiện đặt lịch vừa thay đổi. Hãy tải lại và chọn lại.'
  }
  return 'Chưa thể hoàn tất thao tác lúc này. Vui lòng thử lại.'
}
export type AppointmentCommand = Readonly<
  { key: string } & (
    | { kind: 'request'; body: RequestAppointment; version?: number }
    | { kind: 'cancel'; id: string; version: number }
  )
>
// In-memory correlation only: no ledger, credentials, offline queue or automatic replay.
// Retain across screen remounts so an ambiguous response is explicitly replayed
// with the SAME actor-scoped command/body/version. Server state is always read anew.
const pending = new Map<string, AppointmentCommand>()
export const appointmentCommands = {
  read: (subject: string) => pending.get(subject) ?? null,
  write: (subject: string, command: AppointmentCommand) =>
    pending.set(subject, command),
  remove: (subject: string) => pending.delete(subject),
}
export function ambiguous(error: unknown) {
  return (
    !(error instanceof ApiError) ||
    error.status === undefined ||
    error.status >= 500 ||
    error.status === 401
  )
}
export function sameSlot(
  slot: SlotSelection['slot'],
  current: {
    id: string
    specialistAccountId: string
    startAt: string
    endAt: string
    timezone: string
    modality: string
  },
) {
  return (
    slot.id === current.id &&
    slot.specialistAccountId === current.specialistAccountId &&
    slot.startAt === current.startAt &&
    slot.endAt === current.endAt &&
    slot.timezone === current.timezone &&
    slot.modality === current.modality
  )
}
