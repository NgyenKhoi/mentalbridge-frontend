'use client'

import { useRef, useState } from 'react'
import { FileText, RefreshCw } from 'lucide-react'
import { Disclosure } from '@/components/ui/Disclosure'
import { Skeleton } from '@/components/ui/Skeleton'
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
  compact = false,
}: Readonly<{ appointmentId: string; compact?: boolean }>) {
  const [brief, setBrief] = useState<Brief | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const request = useRef(0)

  async function load() {
    const sequence = ++request.current
    setLoading(true)
    setError('')
    setBrief(null)
    try {
      const result =
        await consultationBriefBrowserClient.specialist(appointmentId)
      if (sequence === request.current) setBrief(result)
    } catch (caught) {
      if (sequence === request.current) setError(denied(caught))
    } finally {
      if (sequence === request.current) setLoading(false)
    }
  }

  return (
    <Disclosure
      className={styles.specialist}
      aria-label="Tóm tắt được người dùng phê duyệt"
      expanded={open}
      summaryLabel={
        open
          ? 'Thu gọn tóm tắt'
          : compact
            ? 'Xem tóm tắt chuẩn bị'
            : 'Xem tóm tắt'
      }
      summary={
        <span className={styles.briefLabel}>
          <FileText size={18} aria-hidden="true" />
          <span>
            {compact
              ? 'Chuẩn bị cho cuộc hẹn tiếp theo'
              : 'Tóm tắt trước buổi tư vấn'}
          </span>
        </span>
      }
      onToggle={(event) => {
        const expanded = event.currentTarget.open
        setOpen(expanded)
        if (expanded) void load()
        else {
          request.current++
          setBrief(null)
          setError('')
          setLoading(false)
        }
      }}
    >
      <div className={styles.heading}>
        <div>
          <h4>Tóm tắt trước buổi tư vấn</h4>
          <p>Chỉ đọc bản chụp người dùng đã phê duyệt cho lịch hẹn này.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" />{' '}
          {loading ? 'Đang tải…' : 'Tải lại'}
        </button>
      </div>
      {loading && (
        <div
          className={styles.snapshot}
          role="status"
          aria-label="Đang tải tóm tắt"
        >
          <Skeleton width="90%" height={24} />
          <Skeleton width="70%" height={24} />
        </div>
      )}
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
    </Disclosure>
  )
}
