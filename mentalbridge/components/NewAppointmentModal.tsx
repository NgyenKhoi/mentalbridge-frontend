'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import './NewAppointmentModal.css'

export type NewAppointment = {
  specialistId: number
  specialist: string
  avatar: string
  date: string
  time: string
  type: string
  price: string
  notes: string
}

type Props = {
  initialSpecialistId?: number | null
  onClose: () => void
  onBooked: (appointment: NewAppointment) => void
}

const SPECIALISTS = [
  { id: 1, name: 'TS. Nguyễn Thị Lan', initials: 'NL', role: 'Tâm lý lâm sàng', focus: 'Trầm cảm · Lo âu', price: '500.000đ', tone: 'sage', avatar: '👩‍⚕️' },
  { id: 2, name: 'ThS. Trần Văn Minh', initials: 'TM', role: 'Tư vấn tâm lý', focus: 'Stress · Công việc', price: '400.000đ', tone: 'amber', avatar: '👨‍⚕️' },
  { id: 4, name: 'ThS. Phạm Thu Hà', initials: 'TH', role: 'Trị liệu CBT', focus: 'Lo âu · OCD', price: '450.000đ', tone: 'terra', avatar: '👩‍⚕️' },
]

const TIME_SLOTS = ['09:00', '10:30', '14:00', '15:30', '17:00']
const FORMATS = ['Video call', 'Tại phòng tư vấn', 'Điện thoại']

const getEndTime = (startTime: string) => {
  const [hours, minutes] = startTime.split(':').map(Number)
  const end = new Date(2000, 0, 1, hours, minutes + 60)
  return end.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

export default function NewAppointmentModal({ initialSpecialistId, onClose, onBooked }: Props) {
  const [specialistId, setSpecialistId] = useState(initialSpecialistId && SPECIALISTS.some(item => item.id === initialSpecialistId) ? initialSpecialistId : SPECIALISTS[0].id)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [format, setFormat] = useState(FORMATS[0])
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const selectedSpecialist = SPECIALISTS.find(item => item.id === specialistId) ?? SPECIALISTS[0]

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) onClose()
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isSubmitting, onClose])

  const submit = async () => {
    if (!date || !time) {
      setError('Vui lòng chọn ngày và khung giờ tư vấn.')
      return
    }
    setError('')
    setIsSubmitting(true)
    await new Promise(resolve => setTimeout(resolve, 750))
    onBooked({
      specialistId: selectedSpecialist.id,
      specialist: selectedSpecialist.name,
      avatar: selectedSpecialist.avatar,
      date,
      time: `${time} - ${getEndTime(time)}`,
      type: format,
      price: selectedSpecialist.price,
      notes: notes.trim(),
    })
  }

  return <AnimatePresence>
    <>
      <motion.button className="new-booking-backdrop" aria-label="Đóng cửa sổ đặt lịch" onClick={() => !isSubmitting && onClose()} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <div className="new-booking-shell">
        <motion.section className="new-booking-modal" role="dialog" aria-modal="true" aria-labelledby="new-booking-title" initial={{ opacity: 0, y: 26, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: .98 }} transition={{ duration: .3, ease: [0.16, 1, 0.3, 1] }}>
          <header className="new-booking-header">
            <div><span>Đặt lịch tư vấn</span><h2 id="new-booking-title">Chọn một thời gian phù hợp</h2><p>Bạn có thể thay đổi hoặc hủy lịch trước phiên tư vấn.</p></div>
            <button onClick={onClose} disabled={isSubmitting} aria-label="Đóng">×</button>
          </header>

          <div className="new-booking-scroll">
            <div className="new-booking-form">
              <fieldset className="new-booking-specialists">
                <legend><span>01</span><div><strong>Chọn chuyên gia</strong><small>Người bạn muốn đồng hành trong phiên này</small></div></legend>
                <div>{SPECIALISTS.map(specialist => <button type="button" key={specialist.id} className={specialistId === specialist.id ? 'selected' : ''} onClick={() => setSpecialistId(specialist.id)} aria-pressed={specialistId === specialist.id}>
                  <i className={specialist.tone}>{specialist.initials}</i>
                  <span><strong>{specialist.name}</strong><small>{specialist.role}</small><em>{specialist.focus}</em></span>
                  <b>{specialist.price}</b>
                </button>)}</div>
              </fieldset>

              <fieldset className="new-booking-schedule">
                <legend><span>02</span><div><strong>Ngày và giờ</strong><small>Các khung giờ đang nhận lịch</small></div></legend>
                <label><span>Ngày tư vấn</span><input type="date" value={date} min={new Date().toISOString().split('T')[0]} onChange={event => setDate(event.target.value)} /></label>
                <div className="new-booking-times"><span>Khung giờ</span><div>{TIME_SLOTS.map(slot => <button type="button" key={slot} className={time === slot ? 'selected' : ''} onClick={() => setTime(slot)} aria-pressed={time === slot}>{slot}</button>)}</div></div>
              </fieldset>

              <fieldset className="new-booking-format">
                <legend><span>03</span><div><strong>Hình thức tư vấn</strong><small>Chọn cách bạn cảm thấy thoải mái nhất</small></div></legend>
                <div>{FORMATS.map(item => <button type="button" key={item} className={format === item ? 'selected' : ''} onClick={() => setFormat(item)} aria-pressed={format === item}><i aria-hidden="true">{item === 'Video call' ? '▻' : item === 'Điện thoại' ? '⌕' : '⌂'}</i><span>{item}</span></button>)}</div>
              </fieldset>

              <label className="new-booking-notes"><span>Điều bạn muốn chuyên gia biết <small>(tùy chọn)</small></span><textarea value={notes} onChange={event => setNotes(event.target.value)} rows={3} maxLength={400} placeholder="Ví dụ: Chủ đề bạn muốn trao đổi hoặc điều khiến bạn lo lắng..." /><small>{notes.length}/400</small></label>
              {error && <p className="new-booking-error" role="alert">{error}</p>}
            </div>

            <aside className="new-booking-summary">
              <span>Tóm tắt phiên tư vấn</span>
              <div className="new-booking-summary-person"><i className={selectedSpecialist.tone}>{selectedSpecialist.initials}</i><div><strong>{selectedSpecialist.name}</strong><small>{selectedSpecialist.role}</small></div></div>
              <dl>
                <div><dt>Ngày</dt><dd>{date ? new Date(`${date}T12:00:00`).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Chưa chọn'}</dd></div>
                <div><dt>Thời gian</dt><dd>{time ? `${time} – ${getEndTime(time)}` : 'Chưa chọn'}</dd></div>
                <div><dt>Hình thức</dt><dd>{format}</dd></div>
              </dl>
              <div className="new-booking-price"><span>Phí dự kiến</span><strong>{selectedSpecialist.price}</strong></div>
              <p><i>i</i><span>Lịch hẹn sẽ ở trạng thái <strong>Chờ xác nhận</strong> cho đến khi chuyên gia phản hồi.</span></p>
            </aside>
          </div>

          <footer className="new-booking-footer"><p>Bằng việc đặt lịch, bạn đồng ý với chính sách thay đổi và hủy lịch.</p><div><button onClick={onClose} disabled={isSubmitting}>Hủy</button><button onClick={submit} disabled={isSubmitting}>{isSubmitting ? 'Đang gửi yêu cầu...' : 'Xác nhận đặt lịch'} <span>→</span></button></div></footer>
        </motion.section>
      </div>
    </>
  </AnimatePresence>
}
