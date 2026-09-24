'use client'

import { useEffect, useRef, useState } from 'react'

import { Disclosure } from '@/components/ui/Disclosure'
import { ApiError } from '@/lib/api/api-error'
import type {
  AssessmentProgress,
  AssessmentProgressPoint,
  ScreeningLevel,
} from '../api/care-contract'
import { getAssessmentProgress } from '../api/browser-care'

const levelLabels: Record<ScreeningLevel, string> = {
  MINIMAL: 'Tối thiểu',
  MILD: 'Nhẹ',
  MODERATE: 'Trung bình',
  MODERATELY_SEVERE: 'Khá nặng',
  SEVERE: 'Nặng',
}

function directionLabel(progress: AssessmentProgress) {
  const amount = Math.abs(progress.rawDelta)
  if (progress.scoreDirection === 'INCREASED')
    return `Điểm đã tăng ${amount} điểm.`
  if (progress.scoreDirection === 'DECREASED')
    return `Điểm đã giảm ${amount} điểm.`
  return 'Điểm không thay đổi.'
}

function elapsedLabel(duration: string) {
  const match = duration.match(
    /^PT(?=\d)(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d{1,9})?)S)?$/,
  )
  if (!match) return duration
  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2] ?? 0)
  const seconds = Number(match[3] ?? 0)
  const days = Math.floor(hours / 24)
  const parts = [
    days > 0 ? `${days} ngày` : null,
    hours % 24 > 0 ? `${hours % 24} giờ` : null,
    minutes > 0 ? `${minutes} phút` : null,
    seconds > 0 ? `${seconds} giây` : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : '0 giây'
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

function ProgressPoint({
  label,
  point,
}: {
  label: string
  point: AssessmentProgressPoint
}) {
  return (
    <article className="assessment-progress-point">
      <span>{label}</span>
      <strong>{point.totalScore} điểm</strong>
      <p>{levelLabels[point.screeningLevel]}</p>
      <time dateTime={point.submittedAt}>
        {new Date(point.submittedAt).toLocaleString('vi-VN')}
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
    headingRef.current?.focus()
  }, [assessmentId])

  const failure = errorState(error)
  const retry = () => {
    setLoading(true)
    setProgress(null)
    setError(undefined)
    setAttempt((value) => value + 1)
  }
  return (
    <section
      id="assessment-progress-panel"
      className="assessment-progress-panel"
      aria-labelledby="assessment-progress-title"
      aria-live="polite"
    >
      <div className="assessment-progress-heading">
        <div>
          <span>So sánh mô tả</span>
          <h3 id="assessment-progress-title" ref={headingRef} tabIndex={-1}>
            Thay đổi giữa các lần sàng lọc
          </h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng so sánh">
          ×
        </button>
      </div>

      {loading ? (
        <p className="assessment-progress-status">Đang tải dữ liệu so sánh…</p>
      ) : progress ? (
        <>
          <p className="assessment-progress-direction">
            {directionLabel(progress)}
          </p>
          <div className="assessment-progress-points">
            <ProgressPoint label="Kết quả trước" point={progress.previous} />
            <span className="assessment-progress-arrow" aria-hidden="true">
              →
            </span>
            <ProgressPoint label="Kết quả được chọn" point={progress.current} />
          </div>
          <dl className="assessment-progress-meta">
            <div>
              <dt>Khoảng thời gian</dt>
              <dd>{elapsedLabel(progress.elapsedDuration)}</dd>
            </div>
          </dl>
          <Disclosure summary="Thông tin kỹ thuật">
            <dl>
              <div>
                <dt>Kết quả trước</dt>
                <dd>{progress.previous.questionnaireVersion}</dd>
              </div>
              <div>
                <dt>Kết quả được chọn</dt>
                <dd>{progress.current.questionnaireVersion}</dd>
              </div>
              <div>
                <dt>Cách chấm điểm</dt>
                <dd>{progress.scoringVersion}</dd>
              </div>
            </dl>
          </Disclosure>
          <p className="assessment-progress-boundary">
            Đây chỉ là chênh lệch mô tả giữa hai lần sàng lọc. Kết quả không
            phải chẩn đoán, không xác định nguyên nhân và không cho biết trạng
            thái an toàn đã được giải quyết.
          </p>
        </>
      ) : (
        <div className="assessment-progress-error" role="alert">
          <strong>{failure.title}</strong>
          <p>{failure.message}</p>
          {failure.retryable && (
            <button type="button" onClick={retry}>
              Thử lại
            </button>
          )}
        </div>
      )}
    </section>
  )
}
