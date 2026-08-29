'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { AppointmentDetail } from './AppointmentDetailModal'
import './CancelAppointmentModal.css'

type Props = {
  appointment: AppointmentDetail
  onClose: () => void
  onConfirm: (reason: string, note: string) => void
}

const REASONS = [
  'Tôi có việc đột xuất',
  'Thời gian không còn phù hợp',
  'Tôi muốn chọn chuyên gia khác',
  'Tôi chưa sẵn sàng cho buổi tư vấn',
  'Lý do khác',
]

export default function CancelAppointmentModal({ appointment, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const formattedDate = new Date(`${appointment.date}T12:00:00`).toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose()
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose, submitting])

  const confirmCancellation = () => {
    if (!reason) {
      setError('Vui lòng chọn một lý do hủy lịch hẹn.')
      return
    }
    setSubmitting(true)
    window.setTimeout(() => onConfirm(reason, note.trim()), 650)
  }

  return <>
    <motion.button
      className="cancel-appointment-backdrop"
      aria-label="Đóng cửa sổ hủy lịch hẹn"
      onClick={submitting ? undefined : onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    />
    <div className="cancel-appointment-shell">
      <motion.section
        className="cancel-appointment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-appointment-title"
        initial={{ opacity: 0, y: 22, scale: .97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: .98 }}
        transition={{ duration: .28, ease: [0.16, 1, 0.3, 1] }}
      >
        <header className="cancel-appointment-header">
          <div className="cancel-appointment-icon" aria-hidden="true">!</div>
          <div>
            <span>Xác nhận thao tác</span>
            <h2 id="cancel-appointment-title">Hủy lịch hẹn này?</h2>
            <p>Lịch hẹn sẽ được chuyển vào lịch sử sau khi xác nhận.</p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="Đóng">×</button>
        </header>

        <div className="cancel-appointment-content">
          <section className="cancel-appointment-summary" aria-label="Lịch hẹn sắp hủy">
            <div className="cancel-appointment-avatar">{appointment.avatar}</div>
            <div>
              <span>Lịch hẹn với</span>
              <strong>{appointment.specialist}</strong>
              <p>{formattedDate} · {appointment.time}</p>
              <small>{appointment.type} · Mã #{appointment.code}</small>
            </div>
          </section>

          <fieldset className={error ? 'has-error' : ''}>
            <legend>Vì sao bạn muốn hủy? <span>*</span></legend>
            <div className="cancel-appointment-reasons">
              {REASONS.map(item => <label key={item} className={reason === item ? 'selected' : ''}>
                <input
                  type="radio"
                  name="cancel-reason"
                  value={item}
                  checked={reason === item}
                  onChange={() => {
                    setReason(item)
                    setError('')
                  }}
                />
                <i aria-hidden="true" />
                <span>{item}</span>
              </label>)}
            </div>
            {error && <p className="cancel-appointment-error" role="alert">{error}</p>}
          </fieldset>

          <label className="cancel-appointment-note">
            <span>Ghi chú thêm <small>Không bắt buộc</small></span>
            <textarea
              value={note}
              onChange={event => setNote(event.target.value.slice(0, 240))}
              placeholder="Chia sẻ thêm để chuyên gia có thể hỗ trợ bạn tốt hơn..."
              rows={3}
            />
            <small>{note.length}/240</small>
          </label>

          <aside className="cancel-appointment-policy">
            <i aria-hidden="true">i</i>
            <p><strong>Lưu ý về chính sách hủy</strong><span>Việc hoàn phí, nếu có, sẽ được xử lý theo chính sách của lịch hẹn. Bạn vẫn có thể đặt lại một khung giờ khác sau khi hủy.</span></p>
          </aside>
        </div>

        <footer className="cancel-appointment-footer">
          <button type="button" onClick={onClose} disabled={submitting}>Giữ lịch hẹn</button>
          <button type="button" onClick={confirmCancellation} disabled={submitting}>
            {submitting ? <><i /> Đang hủy...</> : 'Xác nhận hủy lịch'}
          </button>
        </footer>
      </motion.section>
    </div>
  </>
}
