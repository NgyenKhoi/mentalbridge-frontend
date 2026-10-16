'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'

import { Skeleton } from '@/components/ui/Skeleton'
import type {
  AssessmentSummary,
  ScreeningLevel,
} from '@/features/assessment/api/care-contract'
import AssessmentDetailModal from './AssessmentDetailModal'
import AssessmentProgressPanel from './AssessmentProgressPanel'

const levelLabels: Record<ScreeningLevel, string> = {
  MINIMAL: 'Tối thiểu',
  MILD: 'Nhẹ',
  MODERATE: 'Trung bình',
  MODERATELY_SEVERE: 'Khá nặng',
  SEVERE: 'Nặng',
}

function levelClass(level: ScreeningLevel) {
  return `level-${level.toLowerCase().replace(/_/g, '-')}`
}

type Props = Readonly<{
  items: AssessmentSummary[]
  loading: boolean
  error: boolean
  hasMore: boolean
  onRetry: () => void
  onLoadMore: () => void
}>

export function IndividualAssessmentHistory({
  items,
  loading,
  error,
  hasMore,
  onRetry,
  onLoadMore,
}: Props) {
  const [instrumentFilter, setInstrumentFilter] = useState<
    'ALL' | 'PHQ9' | 'GAD7'
  >('ALL')
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [progressAssessmentId, setProgressAssessmentId] = useState<string>()
  const [reviewItem, setReviewItem] = useState<AssessmentSummary | null>(null)
  const progressTriggerRef = useRef<HTMLButtonElement | null>(null)
  const reviewTriggerRef = useRef<HTMLElement | null>(null)

  const filteredItems = items.filter((item) =>
    instrumentFilter === 'ALL' ? true : item.instrument === instrumentFilter,
  )
  const displayedItems = showAllHistory
    ? filteredItems
    : filteredItems.slice(0, 5)

  return (
    <section
      className="individual-assessment-history"
      aria-labelledby="individual-assessment-history-title"
    >
      <header className="individual-assessment-history-header">
        <div>
          <h3 id="individual-assessment-history-title">Kết quả từng bài</h3>
          <p>
            Xem lại các bản PHQ-9 hoặc GAD-7 riêng lẻ đã lưu, kể cả những bản cũ
            chưa thuộc một lượt sàng lọc hoàn chỉnh.
          </p>
        </div>
        <div className="history-filter-chips" aria-label="Bộ lọc bộ câu hỏi">
          {(
            [
              ['ALL', 'Tất cả'],
              ['PHQ9', 'PHQ-9'],
              ['GAD7', 'GAD-7'],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              className="history-filter-chip"
              aria-pressed={instrumentFilter === value}
              onClick={() => setInstrumentFilter(value)}
              key={value}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {error ? (
        <div className="assessment-history-unavailable" role="alert">
          <strong>Không thể tải lịch sử từng bài</strong>
          <p>Thông tin đã lưu chưa tải được. Vui lòng thử lại.</p>
          <button type="button" className="select-card-btn" onClick={onRetry}>
            Thử lại
          </button>
        </div>
      ) : items.length === 0 && loading ? (
        <div
          className="assessment-history-skeleton"
          role="status"
          aria-live="polite"
        >
          <span className="sr-only">Đang tải lịch sử từng bài…</span>
          <Skeleton width="32%" height={16} />
          <Skeleton width="100%" height={48} />
          <Skeleton width="100%" height={48} />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="assessment-history-unavailable">
          <strong>Chưa có kết quả phù hợp</strong>
          <p>
            Mỗi lần làm lại sẽ tạo một kết quả mới, không ghi đè kết quả cũ.
          </p>
        </div>
      ) : (
        <div className="history-rows-list">
          {displayedItems.map((item) => {
            const occurredAt = new Date(item.submittedAt)
            return (
              <article key={item.assessmentId} className="history-row-card">
                <div className="history-row-main">
                  <div className="history-row-date">
                    <strong>{occurredAt.toLocaleDateString('vi-VN')}</strong>
                    <small>
                      {occurredAt.toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </small>
                  </div>

                  {instrumentFilter === 'ALL' && (
                    <span className="history-row-instrument">
                      {item.instrument}
                    </span>
                  )}
                  <span
                    className={`screening-level-pill ${levelClass(item.result.screeningLevel)}`}
                  >
                    {levelLabels[item.result.screeningLevel]}
                  </span>
                  <span className="history-row-score">
                    {item.result.totalScore} điểm
                  </span>
                </div>

                <div className="history-row-actions">
                  <Link
                    className="btn-row-action"
                    href={`/assessment/${item.instrument.toLowerCase()}?assessmentId=${encodeURIComponent(item.assessmentId)}`}
                    onClick={(event) => {
                      event.preventDefault()
                      reviewTriggerRef.current = event.currentTarget
                      setReviewItem(item)
                    }}
                  >
                    Xem lại
                  </Link>
                  <button
                    type="button"
                    className="btn-row-action"
                    aria-expanded={progressAssessmentId === item.assessmentId}
                    aria-controls="assessment-progress-panel"
                    onClick={(event) => {
                      progressTriggerRef.current = event.currentTarget
                      setProgressAssessmentId(item.assessmentId)
                    }}
                  >
                    So sánh
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {!showAllHistory && filteredItems.length > 5 && (
        <div className="history-show-more-wrap">
          <button
            type="button"
            className="btn-show-more"
            onClick={() => setShowAllHistory(true)}
          >
            Xem thêm ({filteredItems.length - 5} mục khác) ↓
          </button>
        </div>
      )}
      {hasMore && !loading && (
        <div className="history-show-more-wrap">
          <button type="button" className="btn-show-more" onClick={onLoadMore}>
            Tải thêm lịch sử
          </button>
        </div>
      )}
      {loading && items.length > 0 && (
        <p className="assessment-history-loading" aria-live="polite">
          Đang tải thêm lịch sử…
        </p>
      )}

      {progressAssessmentId && (
        <AssessmentProgressPanel
          key={progressAssessmentId}
          assessmentId={progressAssessmentId}
          onClose={() => {
            progressTriggerRef.current?.focus()
            setProgressAssessmentId(undefined)
          }}
        />
      )}
      {reviewItem && (
        <AssessmentDetailModal
          key={reviewItem.assessmentId}
          item={reviewItem}
          onClose={() => {
            reviewTriggerRef.current?.focus()
            setReviewItem(null)
          }}
        />
      )}
    </section>
  )
}
