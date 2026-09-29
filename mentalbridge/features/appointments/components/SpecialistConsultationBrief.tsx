'use client'

import { useState } from 'react'
import { ApiError } from '@/lib/api/api-error'
import type { SpecialistConsultationBrief as Brief } from '../api/consultation-brief-contract'
import { consultationBriefBrowserClient } from '../api/consultation-brief-browser-client'
import styles from './ConsultationBriefPanel.module.css'

function denied(error: unknown) {
  if (!(error instanceof ApiError)) return 'Chưa thể tải tóm tắt lúc này.'
  const values: Record<string, string> = {
    CONSULTATION_BRIEF_ACCESS_TOO_EARLY:
      'Tóm tắt chỉ mở trong 24 giờ trước lịch hẹn.',
    CONSULTATION_BRIEF_ACCESS_EXPIRED:
      'Khung thời gian đọc tóm tắt đã kết thúc.',
    CONSULTATION_BRIEF_ACCESS_DENIED:
      'Người dùng chưa phê duyệt hoặc đã thu hồi quyền truy cập.',
    CONSULTATION_BRIEF_APPOINTMENT_CHANGED:
      'Lịch hẹn đã thay đổi. Người dùng cần xem lại và phê duyệt một bản tóm tắt mới.',
    CONSULTATION_BRIEF_UNAVAILABLE: 'Bản tóm tắt hoặc nguồn đã bị xóa.',
  }
  return (
    values[error.code] ?? 'Bạn không có quyền đọc tóm tắt của lịch hẹn này.'
  )
}

export function SpecialistConsultationBrief({
  appointmentId,
}: Readonly<{ appointmentId: string }>) {
  const [brief, setBrief] = useState<Brief | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    setBrief(null)
    try {
      setBrief(await consultationBriefBrowserClient.specialist(appointmentId))
    } catch (caught) {
      setError(denied(caught))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section
      className={styles.specialist}
      aria-label="Tóm tắt được người dùng phê duyệt"
    >
      <div className={styles.heading}>
        <div>
          <h4>Tóm tắt trước buổi tư vấn</h4>
          <p>Chỉ đọc bản chụp người dùng đã phê duyệt cho lịch hẹn này.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>
          {loading ? 'Đang tải…' : brief ? 'Tải lại' : 'Xem tóm tắt'}
        </button>
      </div>
      {error && (
        <p className={styles.notice} role="status">
          {error}
        </p>
      )}
      {brief && (
        <div className={styles.snapshot}>
          <div>
            <strong>Tình hình hiện tại</strong>
            <p>{brief.currentSituation}</p>
          </div>
          <div>
            <strong>Mục tiêu trao đổi</strong>
            <ul>
              {brief.userGoals.map((goal) => (
                <li key={goal}>{goal}</li>
              ))}
            </ul>
          </div>
          <div>
            <strong>Bối cảnh sàng lọc</strong>
            <ul>
              {brief.screeningContext.map((item) => (
                <li key={item.instrument}>
                  {item.instrument} · {item.screeningLevel}
                </li>
              ))}
            </ul>
            <small>Kết quả sàng lọc không phải chẩn đoán y khoa.</small>
          </div>
        </div>
      )}
    </section>
  )
}
