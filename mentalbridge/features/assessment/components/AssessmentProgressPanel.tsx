'use client'

import { useEffect, useRef, useState } from 'react'

import { lockBodyScroll } from '@/lib/dom/body-scroll-lock'
import { ApiError } from '@/lib/api/api-error'
import type {
  AssessmentProgress,
  AssessmentProgressPoint,
} from '../api/care-contract'
import { getAssessmentProgress } from '../api/browser-care'
import {
  formatShortDateTime,
  friendlyDuration,
  getLevelClass,
  levelLabels,
} from './assessment-meanings'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

function directionLabel(progress: AssessmentProgress) {
  const amount = Math.abs(progress.rawDelta)
  if (progress.scoreDirection === 'INCREASED')
    return `Điểm đã tăng ${amount} điểm.`
  if (progress.scoreDirection === 'DECREASED')
    return `Điểm đã giảm ${amount} điểm.`
  return 'Điểm không thay đổi.'
}

function errorState(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'INSUFFICIENT_COMPARABLE_DATA')
      return {
        title: 'Chưa đủ kết quả để so sánh',
        message:
          'Bạn cần ít nhất hai kết quả của cùng một bài sàng lọc được chấm theo cùng cách.',
        retryable: false,
      }
    if (error.status === 401 || error.status === 403 || error.status === 404)
      return {
        title: 'Không thể truy cập so sánh này',
        message:
          'Kết quả không thuộc phiên đăng nhập hiện tại hoặc không còn khả dụng.',
        retryable: false,
      }
    if (error.code === 'VALIDATION_FAILED')
      return {
        title: 'Yêu cầu so sánh không hợp lệ',
        message:
          'Kết quả đã chọn không thể dùng để so sánh. Hãy đóng bảng này và chọn lại.',
        retryable: false,
      }
    if (error.code === 'CARE_TIMEOUT' || error.code === 'REQUEST_TIMEOUT')
      return {
        title: 'So sánh mất nhiều thời gian hơn dự kiến',
        message:
          'Kết quả sàng lọc hiện tại không bị thay đổi. Bạn có thể thử lại.',
        retryable: true,
      }
    if (error.code === 'CARE_UNAVAILABLE' || error.code === 'NETWORK_ERROR')
      return {
        title: 'Chưa thể tải so sánh lúc này',
        message:
          'Kết quả sàng lọc hiện tại vẫn được giữ nguyên. Bạn có thể thử lại.',
        retryable: true,
      }
    if (error.code === 'CARE_MALFORMED_RESPONSE')
      return {
        title: 'Chưa thể xác nhận dữ liệu so sánh',
        message:
          'MentalBridge không hiển thị dữ liệu chưa được xác nhận. Bạn có thể thử lại.',
        retryable: true,
      }
  }
  return {
    title: 'Không thể tải so sánh',
    message: 'Kết quả sàng lọc hiện tại không bị thay đổi. Bạn có thể thử lại.',
    retryable: true,
  }
}

function ProgressCard({
  label,
  point,
  isCurrent,
}: {
  label: string
  point: AssessmentProgressPoint
  isCurrent?: boolean
}) {
  return (
    <article
      className={`assessment-compare-card ${isCurrent ? 'card-current' : 'card-previous'}`}
    >
      <span className="compare-card-label">{label}</span>
      <div className="compare-card-score-row">
        <span className="compare-card-score">{point.totalScore}</span>
        <span className="compare-card-unit">điểm</span>
      </div>
      <span
        className={`screening-level-pill ${getLevelClass(point.screeningLevel)}`}
      >
        Mức {levelLabels[point.screeningLevel]?.toLowerCase() ?? ''}
      </span>
      <time className="compare-card-time" dateTime={point.submittedAt}>
        {formatShortDateTime(point.submittedAt)}
      </time>
    </article>
  )
}

export default function AssessmentProgressPanel({
  assessmentId,
  onClose,
}: {
  assessmentId: string
  onClose: () => void
}) {
  const [progress, setProgress] = useState<AssessmentProgress | null>(null)
  const [error, setError] = useState<unknown>()
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  const dialogRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let active = true
    void getAssessmentProgress(assessmentId)
      .then((value) => {
        if (active) setProgress(value)
      })
      .catch((reason: unknown) => {
        if (active) setError(reason)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [assessmentId, attempt])

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

  const failure = errorState(error)
  const retry = () => {
    setLoading(true)
    setProgress(null)
    setError(undefined)
    setAttempt((value) => value + 1)
  }

  const instrumentLabel =
    progress?.instrument === 'PHQ9'
      ? 'PHQ-9 · Đánh giá tâm trạng'
      : progress?.instrument === 'GAD7'
        ? 'GAD-7 · Đánh giá lo âu'
        : 'Bài sàng lọc'

  return (
    <>
      <div
        className="assessment-modal-overlay"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        id="assessment-progress-panel"
        className="assessment-modal-dialog assessment-modal-compare"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assessment-progress-title"
      >
        <header className="assessment-modal-header">
          <div>
            <h2 id="assessment-progress-title" ref={headingRef} tabIndex={-1}>
              Thay đổi giữa các lần sàng lọc
            </h2>
            <p className="assessment-modal-subtitle">
              {loading ? 'Đang tải thông tin…' : instrumentLabel}
            </p>
          </div>
          <button
            type="button"
            className="assessment-modal-close-btn"
            onClick={onClose}
            aria-label="Đóng so sánh"
          >
            ×
          </button>
        </header>

        <div className="assessment-modal-body">
          {loading ? (
            <div className="assessment-modal-loading">
              <p className="assessment-progress-status">
                Đang tải dữ liệu so sánh…
              </p>
            </div>
          ) : progress ? (
            <>
              {/* Pill kết luận thay đổi */}
              <div className="assessment-change-pill-row">
                <div
                  className={`assessment-change-pill pill-${progress.scoreDirection.toLowerCase()}`}
                >
                  <span className="pill-arrow-icon" aria-hidden="true">
                    {progress.scoreDirection === 'DECREASED'
                      ? '↓'
                      : progress.scoreDirection === 'INCREASED'
                        ? '↑'
                        : '—'}
                  </span>
                  <span className="pill-text">{directionLabel(progress)}</span>
                </div>
              </div>

              {/* Hai thẻ kết quả cạnh nhau */}
              <div className="assessment-modal-compare-cards">
                <ProgressCard label="Lần trước" point={progress.previous} />
                <div className="assessment-compare-divider" aria-hidden="true">
                  <span className="divider-arrow-desktop">→</span>
                  <span className="divider-arrow-mobile">↓</span>
                </div>
                <ProgressCard
                  label="Lần được chọn"
                  point={progress.current}
                  isCurrent
                />
              </div>

              {/* Khoảng thời gian */}
              <div className="assessment-modal-elapsed">
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>
                  Cách nhau{' '}
                  <strong>{friendlyDuration(progress.elapsedDuration)}</strong>
                </span>
              </div>

              {/* Thông tin kỹ thuật */}
              <details className="assessment-modal-tech">
                <summary>Thông tin kỹ thuật</summary>
                <dl className="assessment-modal-tech-list">
                  <div>
                    <dt>Kết quả trước:</dt>
                    <dd>{progress.previous.questionnaireVersion}</dd>
                  </div>
                  <div>
                    <dt>Kết quả được chọn:</dt>
                    <dd>{progress.current.questionnaireVersion}</dd>
                  </div>
                  <div>
                    <dt>Cách chấm điểm:</dt>
                    <dd>{progress.scoringVersion}</dd>
                  </div>
                </dl>
              </details>

              {/* Ghi chú cuối popup */}
              <div className="assessment-modal-disclaimer">
                <p>
                  Đây chỉ là chênh lệch mô tả giữa hai lần sàng lọc. Không phải
                  chẩn đoán, không xác định nguyên nhân và không cho biết trạng
                  thái an toàn đã được giải quyết.
                </p>
              </div>
            </>
          ) : (
            <div className="assessment-progress-error" role="alert">
              <strong>{failure.title}</strong>
              <p>{failure.message}</p>
              {failure.retryable && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={retry}
                >
                  Thử lại
                </button>
              )}
            </div>
          )}
        </div>

        <footer className="assessment-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Đóng
          </button>
        </footer>
      </div>
    </>
  )
}
