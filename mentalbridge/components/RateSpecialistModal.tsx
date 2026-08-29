'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { AppointmentDetail } from './AppointmentDetailModal'
import './RateSpecialistModal.css'

export type SpecialistReview = {
  rating: number
  highlights: string[]
  comment: string
  anonymous: boolean
}

type Props = {
  appointment: AppointmentDetail
  onClose: () => void
  onSubmit: (review: SpecialistReview) => void
}

const HIGHLIGHTS = [
  'Lắng nghe và thấu hiểu',
  'Giải thích dễ hiểu',
  'Tạo cảm giác an toàn',
  'Đúng giờ',
  'Gợi ý hữu ích',
]

const RATING_COPY = [
  'Chọn mức độ hài lòng của bạn',
  'Chưa đáp ứng mong đợi',
  'Cần cải thiện thêm',
  'Khá hài lòng',
  'Rất hài lòng',
  'Trải nghiệm tuyệt vời',
]

export default function RateSpecialistModal({ appointment, onClose, onSubmit }: Props) {
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [highlights, setHighlights] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const formattedDate = new Date(`${appointment.date}T12:00:00`).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
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

  const toggleHighlight = (item: string) => {
    setHighlights(current => current.includes(item)
      ? current.filter(value => value !== item)
      : [...current, item])
  }

  const submitReview = () => {
    if (!rating) {
      setError('Vui lòng chọn số sao trước khi gửi đánh giá.')
      return
    }
    setSubmitting(true)
    window.setTimeout(() => onSubmit({ rating, highlights, comment: comment.trim(), anonymous }), 650)
  }

  const visibleRating = hoveredRating || rating

  return <>
    <motion.button
      type="button"
      className="rate-specialist-backdrop"
      aria-label="Đóng cửa sổ đánh giá chuyên gia"
      onClick={submitting ? undefined : onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    />
    <div className="rate-specialist-shell">
      <motion.section
        className="rate-specialist-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rate-specialist-title"
        initial={{ opacity: 0, y: 24, scale: .97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: .98 }}
        transition={{ duration: .28, ease: [0.16, 1, 0.3, 1] }}
      >
        <header className="rate-specialist-header">
          <div>
            <span>Đánh giá sau phiên tư vấn</span>
            <h2 id="rate-specialist-title">Chia sẻ trải nghiệm của bạn</h2>
            <p>Phản hồi của bạn giúp chuyên gia cải thiện chất lượng đồng hành.</p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="Đóng">×</button>
        </header>

        <div className="rate-specialist-content">
          <section className="rate-specialist-summary" aria-label="Phiên tư vấn được đánh giá">
            <div className="rate-specialist-avatar">{appointment.avatar}</div>
            <div><span>Phiên tư vấn với</span><strong>{appointment.specialist}</strong><p>{formattedDate} · {appointment.time} · {appointment.type}</p></div>
            <i aria-hidden="true">✓</i>
          </section>

          <section className={`rate-specialist-score ${error ? 'has-error' : ''}`}>
            <span>Mức độ hài lòng <b>*</b></span>
            <div className="rate-specialist-stars" role="radiogroup" aria-label="Chọn số sao đánh giá" onMouseLeave={() => setHoveredRating(0)}>
              {[1, 2, 3, 4, 5].map(value => <button
                type="button"
                key={value}
                className={value <= visibleRating ? 'active' : ''}
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} sao`}
                onMouseEnter={() => setHoveredRating(value)}
                onFocus={() => setHoveredRating(value)}
                onBlur={() => setHoveredRating(0)}
                onClick={() => { setRating(value); setError('') }}
              >★</button>)}
            </div>
            <strong>{RATING_COPY[visibleRating]}</strong>
            {error && <p role="alert">{error}</p>}
          </section>

          <fieldset className="rate-specialist-highlights">
            <legend>Điều bạn đánh giá cao <small>Chọn nhiều mục nếu phù hợp</small></legend>
            <div>{HIGHLIGHTS.map(item => <button type="button" className={highlights.includes(item) ? 'selected' : ''} key={item} onClick={() => toggleHighlight(item)}><i>{highlights.includes(item) ? '✓' : '+'}</i>{item}</button>)}</div>
          </fieldset>

          <label className="rate-specialist-comment">
            <span>Nhận xét của bạn <small>Không bắt buộc</small></span>
            <textarea rows={4} maxLength={500} value={comment} onChange={event => setComment(event.target.value)} placeholder="Điều gì khiến phiên tư vấn hữu ích với bạn?" />
            <small>{comment.length}/500</small>
          </label>

          <label className="rate-specialist-anonymous">
            <input type="checkbox" checked={anonymous} onChange={event => setAnonymous(event.target.checked)} />
            <i aria-hidden="true" />
            <span><strong>Đăng đánh giá ẩn danh</strong><small>Tên và ảnh đại diện của bạn sẽ không xuất hiện công khai.</small></span>
          </label>

          <aside className="rate-specialist-privacy"><i>i</i><p><strong>Chỉ chia sẻ trải nghiệm dịch vụ</strong><span>Không đưa thông tin sức khỏe, nội dung riêng tư hoặc chi tiết phiên tư vấn vào nhận xét công khai.</span></p></aside>
        </div>

        <footer className="rate-specialist-footer">
          <button type="button" onClick={onClose} disabled={submitting}>Để sau</button>
          <button type="button" className="rate-specialist-submit" onClick={submitReview} disabled={submitting}>{submitting ? <><i /> Đang gửi...</> : 'Gửi đánh giá'}</button>
        </footer>
      </motion.section>
    </div>
  </>
}
