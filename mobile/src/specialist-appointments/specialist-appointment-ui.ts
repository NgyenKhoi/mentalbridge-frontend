import { ApiError } from '@/api/api-error'

import type { SpecialistAppointment } from './specialist-appointment-contract'

export const APPOINTMENT_STATUS_LABELS: Record<
  SpecialistAppointment['status'],
  string
> = {
  REQUESTED: 'Chờ phản hồi',
  CONFIRMED: 'Đã xác nhận',
  IN_PROGRESS: 'Đang diễn ra',
  SESSION_ENDED: 'Đang tổng hợp kết quả',
  COMPLETED: 'Đã hoàn thành',
  REJECTED: 'Đã từ chối',
  EXPIRED: 'Đã hết hạn',
  CANCELLED: 'Đã hủy',
}

export function formatAppointmentRange(appointment: SpecialistAppointment) {
  const start = new Intl.DateTimeFormat('vi-VN', {
    timeZone: appointment.timezone,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(appointment.scheduledStartAt))
  const end = new Intl.DateTimeFormat('vi-VN', {
    timeZone: appointment.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(appointment.scheduledEndAt))
  return `${start}–${end}`
}

export function appointmentErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return 'Chưa thể tải lịch hẹn. Vui lòng thử lại.'
  }
  if (error.status === 401) return 'Phiên đăng nhập đã hết hạn.'
  if (error.status === 403) {
    return 'Tài khoản này không có quyền xem hoặc xử lý lịch hẹn chuyên gia.'
  }
  if (error.status === 404) {
    return 'Lịch hẹn không còn khả dụng hoặc không được giao cho bạn.'
  }
  if (error.status === 409 || error.status === 412) {
    return 'Lịch hẹn vừa thay đổi. Cần tải lại trạng thái mới nhất trước khi tiếp tục.'
  }
  return 'Chưa thể kết nối để xác nhận lịch hẹn mới nhất. Vui lòng thử lại.'
}
