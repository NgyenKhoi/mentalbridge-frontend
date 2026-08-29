'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { AppointmentDetail } from './AppointmentDetailModal'
import './RescheduleAppointmentModal.css'

export type RescheduleUpdate = {
  date: string
  time: string
  type: string
}

type Props = {
  appointment: AppointmentDetail
  onClose: () => void
  onConfirm: (update: RescheduleUpdate) => void
}

const TIME_SLOTS = ['09:00', '10:30', '14:00', '15:30', '17:00']
const FORMATS = [
  { value: 'Video call', icon: '▷', note: 'Tham gia trực tuyến' },
  { value: 'Tại phòng khám', icon: '⌂', note: 'Gặp trực tiếp' },
  { value: 'Điện thoại', icon: '⌕', note: 'Chuyên gia gọi cho bạn' },
]

const getEndTime = (startTime: string) => {
  const [hours, minutes] = startTime.split(':').map(Number)
  const end = new Date(2000, 0, 1, hours, minutes + 60)
  return end.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

export default function RescheduleAppointmentModal({ appointment, onClose, onConfirm }: Props) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [format, setFormat] = useState(appointment.type)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const today = useMemo(() => new Date().toLocaleDateString('en-CA'), [])
  const currentDate = new Date(`${appointment.date}T12:00:00`).toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const selectedDate = date
    ? new Date(`${date}T12:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'Chưa chọn ngày mới'

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

  const submit = () => {
    if (!date || !time) {
      setError('Vui lòng chọn ngày và khung giờ mới cho lịch hẹn.')
      return
    }
    setError('')
    setSubmitting(true)
    window.setTimeout(() => onConfirm({ date, time: `${time} - ${getEndTime(time)}`, type: format }), 700)
  }

  return <>
    <motion.button
      className="reschedule-backdrop"
      aria-label="Đóng cửa sổ đổi lịch hẹn"
      onClick={submitting ? undefined : onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    />
    <div className="reschedule-shell">
      <motion.section
        className="reschedule-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reschedule-title"
        initial={{ opacity: 0, y: 24, scale: .97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: .98 }}
        transition={{ duration: .3, ease: [0.16, 1, 0.3, 1] }}
      >
        <header className="reschedule-header">
          <div>
            <span>Reschedule appointment</span>
            <h2 id="reschedule-title">Chọn thời gian mới</h2>
            <p>Chuyên gia sẽ xác nhận lại sau khi bạn gửi yêu cầu đổi lịch.</p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="Đóng">×</button>
        </header>

        <div className="reschedule-scroll">
          <section className="reschedule-person">
            <div className="reschedule-avatar">{appointment.avatar}</div>
            <div><span>Chuyên gia</span><strong>{appointment.specialist}</strong><small>Mã lịch hẹn #{appointment.code}</small></div>
            <i>Đã xác minh</i>
          </section>

          <section className="reschedule-comparison" aria-label="So sánh lịch hẹn hiện tại và lịch hẹn mới">
            <article>
              <span>Lịch hiện tại</span>
              <strong>{currentDate}</strong>
              <p>{appointment.time} · {appointment.type}</p>
            </article>
            <b aria-hidden="true">→</b>
            <article className={date && time ? 'ready' : ''}>
              <span>Lịch mới</span>
              <strong>{selectedDate}</strong>
              <p>{time ? `${time} - ${getEndTime(time)}` : 'Chưa chọn giờ'} · {format}</p>
            </article>
          </section>

          <div className="reschedule-form">
            <fieldset className="reschedule-schedule">
              <legend><span>01</span><div><strong>Ngày và giờ mới</strong><small>Chọn một khung giờ phù hợp với bạn</small></div></legend>
              <label>
                <span>Ngày tư vấn</span>
                <input type="date" min={today} value={date} onChange={event => { setDate(event.target.value); setError('') }} />
              </label>
              <div className="reschedule-times">
                <span>Khung giờ còn trống</span>
                <div>{TIME_SLOTS.map(slot => <button key={slot} type="button" className={time === slot ? 'selected' : ''} onClick={() => { setTime(slot); setError('') }}>{slot}</button>)}</div>
              </div>
            </fieldset>

            <fieldset className="reschedule-formats">
              <legend><span>02</span><div><strong>Hình thức tư vấn</strong><small>Bạn có thể thay đổi hình thức cho lịch mới</small></div></legend>
              <div>{FORMATS.map(item => <button key={item.value} type="button" className={format === item.value ? 'selected' : ''} onClick={() => setFormat(item.value)}><i>{item.icon}</i><span><strong>{item.value}</strong><small>{item.note}</small></span></button>)}</div>
            </fieldset>

            {error && <p className="reschedule-error" role="alert">{error}</p>}
            <aside className="reschedule-note"><i>i</i><p><strong>Trạng thái sẽ chuyển về “Chờ xác nhận”</strong><span>Lịch hiện tại vẫn được giữ cho đến khi yêu cầu đổi lịch được gửi thành công.</span></p></aside>
          </div>
        </div>

        <footer className="reschedule-footer">
          <p>Hãy kiểm tra lại ngày, giờ và hình thức tư vấn trước khi gửi yêu cầu.</p>
          <div><button type="button" onClick={onClose} disabled={submitting}>Giữ lịch hiện tại</button><button type="button" onClick={submit} disabled={submitting}>{submitting ? <><i /> Đang gửi...</> : <>Xác nhận đổi lịch <span>→</span></>}</button></div>
        </footer>
      </motion.section>
    </div>
  </>
}
