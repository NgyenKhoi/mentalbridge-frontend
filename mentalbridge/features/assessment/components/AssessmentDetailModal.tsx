'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

import { lockBodyScroll } from '@/lib/dom/body-scroll-lock'
import type { AssessmentSummary } from '@/features/assessment/api/care-contract'
import {
  formatShortDateTime,
  getLevelClass,
  levelLabels,
  screeningMeanings,
} from './assessment-meanings'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function AssessmentDetailModal({
  item,
  onClose,
}: {
  item: AssessmentSummary
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const releaseScrollLock = lockBodyScroll()
    headingRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      )
      const first = focusable[0]
      const last = focusable.at(-1)

      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      releaseScrollLock()
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const maxScore = item.instrument === 'PHQ9' ? 27 : 21
  const meaning =
    screeningMeanings[item.instrument]?.[item.result.screeningLevel]
  const isSafetyPositive = item.result.safetyStatus === 'POSITIVE_SAFETY_SCREEN'

  return (
    <>
      <div
        className="assessment-modal-overlay"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assessment-detail-title"
        className="assessment-modal-dialog assessment-modal-detail"
      >
        <header className="assessment-modal-header">
          <div>
            <h2 id="assessment-detail-title" ref={headingRef} tabIndex={-1}>
              Chi tiết kết quả sàng lọc
            </h2>
            <p className="assessment-modal-subtitle">
              {item.instrument === 'PHQ9' ? 'PHQ-9' : 'GAD-7'} ·{' '}
              {item.instrument === 'PHQ9'
                ? 'Đánh giá tâm trạng'
                : 'Đánh giá lo âu'}
            </p>
          </div>
          <button
            type="button"
            className="assessment-modal-close-btn"
            onClick={onClose}
            aria-label="Đóng chi tiết"
          >
            ×
          </button>
        </header>

        <div className="assessment-modal-body">
          {/* Thẻ điểm lớn + mức độ + ngày giờ */}
          <div className="assessment-detail-score-banner">
            <div className="assessment-detail-score-box">
              <span className="assessment-detail-score">
                {item.result.totalScore}
              </span>
              <span className="assessment-detail-total">/ {maxScore} điểm</span>
            </div>
            <div className="assessment-detail-meta-box">
              <span
                className={`screening-level-pill ${getLevelClass(item.result.screeningLevel)}`}
              >
                Mức{' '}
                {levelLabels[item.result.screeningLevel]?.toLowerCase() ?? ''}
              </span>
              <time
                className="assessment-detail-time"
                dateTime={item.submittedAt}
              >
                {formatShortDateTime(item.submittedAt)}
              </time>
            </div>
          </div>

          {/* Cảnh báo an toàn nếu có */}
          {isSafetyPositive && (
            <div className="assessment-detail-safety-box" role="alert">
              <strong>Ưu tiên thông tin an toàn</strong>
              <p>
                Kết quả ghi nhận câu trả lời cần lưu ý an toàn. Nếu bạn đang cảm
                thấy bế tắc hoặc cần hỗ trợ ngay, MentalBridge luôn sẵn sàng
                danh sách các đường dây hỗ trợ khẩn cấp 24/7.
              </p>
            </div>
          )}

          {/* Diễn giải ý nghĩa kết quả */}
          {meaning && (
            <section className="assessment-detail-section">
              <h3 className="assessment-detail-section-title">
                Ý nghĩa kết quả
              </h3>
              <p className="assessment-detail-text">{meaning.text}</p>
            </section>
          )}

          {/* Lưu ý phạm vi & giới hạn */}
          {meaning?.limitation && (
            <details className="assessment-modal-tech">
              <summary>Lưu ý về phạm vi và giới hạn kết quả</summary>
              <p className="assessment-modal-tech-body">{meaning.limitation}</p>
            </details>
          )}

          {/* Thông tin kỹ thuật */}
          <details className="assessment-modal-tech">
            <summary>Thông tin kỹ thuật</summary>
            <dl className="assessment-modal-tech-list">
              <div>
                <dt>Mã bài đánh giá:</dt>
                <dd>{item.assessmentId}</dd>
              </div>
              <div>
                <dt>Phiên bản câu hỏi:</dt>
                <dd>{item.questionnaireVersion}</dd>
              </div>
              <div>
                <dt>Phiên bản chấm điểm:</dt>
                <dd>{item.result.scoringVersion}</dd>
              </div>
              <div>
                <dt>Chính sách an toàn:</dt>
                <dd>{item.result.safetyPolicyVersion}</dd>
              </div>
            </dl>
          </details>

          {/* Ghi chú pháp lý cuối popup */}
          <div className="assessment-modal-disclaimer">
            <p>
              Kết quả sàng lọc chỉ mang tính tham khảo triệu chứng, không phải
              chẩn đoán y khoa. MentalBridge không thay thế chuyên gia hay dịch
              vụ khẩn cấp.
            </p>
          </div>
        </div>

        <footer className="assessment-modal-footer">
          <Link
            href={`/assessment/${item.instrument.toLowerCase()}?assessmentId=${encodeURIComponent(item.assessmentId)}`}
            className="btn btn-primary"
          >
            Xem toàn bài
          </Link>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Đóng
          </button>
        </footer>
      </div>
    </>
  )
}
