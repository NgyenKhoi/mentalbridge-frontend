'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import './AppointmentDetailModal.css'

export type AppointmentDetail = {
  id: number
  specialistId: number
  specialist: string
  avatar: string
  date: string
  time: string
  type: string
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled'
  price: string
  notes: string
  code: string
}

type Props = {
  appointment: AppointmentDetail
  onClose: () => void
  onReschedule: (appointment: AppointmentDetail) => void
  onCancel: (appointment: AppointmentDetail) => void
}

const STATUS = {
  confirmed: { label: 'Đã xác nhận', description: 'Chuyên gia đã xác nhận phiên tư vấn của bạn.' },
  pending: { label: 'Chờ xác nhận', description: 'Yêu cầu đang chờ chuyên gia phản hồi.' },
  completed: { label: 'Đã hoàn thành', description: 'Phiên tư vấn này đã kết thúc.' },
  cancelled: { label: 'Đã hủy', description: 'Lịch hẹn đã được hủy theo yêu cầu của bạn.' },
}

const ROLES: Record<number, string> = {
  1: 'Bác sĩ tâm lý lâm sàng',
  2: 'Chuyên gia tư vấn tâm lý',
  4: 'Chuyên gia trị liệu CBT',
}

function CalendarIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" strokeLinecap="round" /></svg>
}

function ClockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" strokeLinecap="round" /></svg>
}

export default function AppointmentDetailModal({ appointment, onClose, onReschedule, onCancel }: Props) {
  const status = STATUS[appointment.status]
  const formattedDate = new Date(`${appointment.date}T12:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const isHistory = appointment.status === 'completed' || appointment.status === 'cancelled'
  const paymentStatus = appointment.status === 'completed'
    ? 'Đã thanh toán'
    : appointment.status === 'cancelled'
      ? 'Xử lý theo chính sách hủy'
      : 'Thanh toán khi xác nhận'

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose])

  return <>
    <motion.button className="appointment-detail-backdrop" aria-label="Đóng chi tiết lịch hẹn" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
    <div className="appointment-detail-shell">
      <motion.section className="appointment-detail-modal" role="dialog" aria-modal="true" aria-labelledby="appointment-detail-title" initial={{ opacity: 0, y: 24, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: .98 }} transition={{ duration: .3, ease: [0.16, 1, 0.3, 1] }}>
        <header className="appointment-detail-header">
          <div><span>Chi tiết lịch hẹn</span><h2 id="appointment-detail-title">Phiên tư vấn của bạn</h2><p>Mã lịch hẹn <strong>#{appointment.code}</strong></p></div>
          <div className={`appointment-detail-status ${appointment.status}`}><i /><span><strong>{status.label}</strong><small>{status.description}</small></span></div>
          <button onClick={onClose} aria-label="Đóng">×</button>
        </header>

        <div className="appointment-detail-scroll">
          <section className="appointment-detail-specialist">
            <div className="appointment-detail-avatar"><span>{appointment.avatar}</span><i>✓</i></div>
            <div><span>Chuyên gia phụ trách</span><h3>{appointment.specialist}</h3><p>{ROLES[appointment.specialistId] ?? 'Chuyên gia tâm lý'}</p></div>
            <button onClick={() => onReschedule(appointment)}>{isHistory ? 'Đặt phiên mới' : 'Xem lịch trống'} <span>↗</span></button>
          </section>

          <section className="appointment-detail-facts" aria-label="Thời gian và hình thức tư vấn">
            <article><i><CalendarIcon /></i><div><span>Ngày tư vấn</span><strong>{formattedDate}</strong></div></article>
            <article><i><ClockIcon /></i><div><span>Thời gian</span><strong>{appointment.time}</strong><small>Thời lượng 60 phút</small></div></article>
            <article><i>{appointment.type === 'Video call' ? '▻' : appointment.type === 'Điện thoại' ? '⌕' : '⌂'}</i><div><span>Hình thức</span><strong>{appointment.type}</strong><small>{appointment.type === 'Video call' ? 'Liên kết tham gia sẽ hiển thị trước giờ hẹn' : appointment.type === 'Điện thoại' ? 'Chuyên gia sẽ gọi vào số đã xác minh' : 'Địa chỉ được gửi sau khi xác nhận'}</small></div></article>
          </section>

          <div className="appointment-detail-columns">
            <section className="appointment-detail-notes"><span>Ghi chú cho chuyên gia</span><p>{appointment.notes || 'Bạn chưa thêm ghi chú cho phiên tư vấn này.'}</p></section>
            <section className="appointment-detail-payment"><span>Thông tin thanh toán</span><dl><div><dt>Phí tư vấn</dt><dd>{appointment.price}</dd></div><div><dt>Trạng thái</dt><dd>{paymentStatus}</dd></div></dl></section>
          </div>

          <section className={`appointment-detail-progress ${appointment.status}`}>
            <span>Tiến trình lịch hẹn</span>
            {appointment.status === 'cancelled'
              ? <div className="appointment-detail-cancelled-progress"><article className="done"><i>✓</i><p><strong>Đã gửi yêu cầu</strong><small>Thông tin lịch hẹn đã được ghi nhận</small></p></article><b /><article className="cancelled-step"><i>×</i><p><strong>Đã hủy lịch hẹn</strong><small>Lịch hẹn không còn hiệu lực</small></p></article></div>
              : <div><article className="done"><i>✓</i><p><strong>Đã gửi yêu cầu</strong><small>Thông tin lịch hẹn đã được ghi nhận</small></p></article><b /><article className={appointment.status !== 'pending' ? 'done' : ''}><i>{appointment.status !== 'pending' ? '✓' : '2'}</i><p><strong>Chuyên gia xác nhận</strong><small>{appointment.status === 'pending' ? 'Đang chờ phản hồi' : 'Lịch hẹn đã được xác nhận'}</small></p></article><b /><article className={appointment.status === 'completed' ? 'done' : ''}><i>{appointment.status === 'completed' ? '✓' : '3'}</i><p><strong>Phiên tư vấn</strong><small>{appointment.status === 'completed' ? 'Đã hoàn thành' : 'Sẵn sàng theo lịch đã chọn'}</small></p></article></div>}
          </section>

          <aside className={`appointment-detail-reminder ${appointment.status === 'cancelled' ? 'cancelled' : ''}`}><i>i</i><div><strong>{appointment.status === 'cancelled' ? 'Bạn vẫn có thể đặt một lịch hẹn khác' : 'Một lưu ý nhỏ trước phiên tư vấn'}</strong><p>{appointment.status === 'cancelled' ? 'Chọn “Đặt lại với chuyên gia” nếu bạn muốn tìm một khung giờ phù hợp hơn.' : 'Hãy chọn một không gian riêng tư, kiểm tra kết nối và có mặt trước giờ hẹn khoảng 5 phút.'}</p></div></aside>
        </div>

        <footer className={`appointment-detail-footer ${!isHistory ? 'has-cancel' : ''}`}>
          {!isHistory && <button className="appointment-detail-cancel" onClick={() => onCancel(appointment)}>Hủy lịch hẹn</button>}
          <button onClick={onClose}>Đóng</button>
          <button onClick={() => onReschedule(appointment)}>{isHistory ? 'Đặt lại với chuyên gia' : 'Đổi lịch hẹn'} <span>→</span></button>
        </footer>
      </motion.section>
    </div>
  </>
}
