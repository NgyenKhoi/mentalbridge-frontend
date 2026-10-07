'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { Skeleton } from '@/components/ui/Skeleton'
import { CrisisSupportModal } from '@/components/crisis-support/CrisisSupportWidget'
import type {
  AssessmentSummary,
  ScreeningLevel,
} from '@/features/assessment/api/care-contract'
import { getAssessmentHistory } from '@/features/assessment/api/browser-care'
import AssessmentProgressPanel from '@/features/assessment/components/AssessmentProgressPanel'
import AssessmentDetailModal from '@/features/assessment/components/AssessmentDetailModal'
import { SupportEvaluationHistory } from '@/features/assessment/components/SupportEvaluationHistory'
import { ReassessmentJourney } from '@/features/assessment/components/ReassessmentJourney'

import './assessments.css'

const levelLabels: Record<ScreeningLevel, string> = {
  MINIMAL: 'Tối thiểu',
  MILD: 'Nhẹ',
  MODERATE: 'Trung bình',
  MODERATELY_SEVERE: 'Khá nặng',
  SEVERE: 'Nặng',
}

const PHQ9_BANDS: ScreeningLevel[] = [
  'MINIMAL',
  'MILD',
  'MODERATE',
  'MODERATELY_SEVERE',
  'SEVERE',
]

function getBandIndex(level?: ScreeningLevel, isGad7 = false): number {
  if (!level) return -1
  if (isGad7) {
    if (level === 'MINIMAL') return 0
    if (level === 'MILD') return 1
    if (level === 'MODERATE') return 2
    if (level === 'MODERATELY_SEVERE' || level === 'SEVERE') return 4
    return 3
  }
  return PHQ9_BANDS.indexOf(level)
}

function getLevelClass(level?: ScreeningLevel): string {
  if (!level) return 'level-empty'
  return `level-${level.toLowerCase().replace(/_/g, '-')}`
}

function AssessmentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12c2.2-7 4.4 7 6.6 0s4.4-7 6.6 0 4.4 7 4.8 0" />
    </svg>
  )
}

export default function AssessmentsPage() {
  const [items, setItems] = useState<AssessmentSummary[]>([])
  const [cursor, setCursor] = useState<string | undefined>()
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [progressAssessmentId, setProgressAssessmentId] = useState<string>()
  const [reviewItem, setReviewItem] = useState<AssessmentSummary | null>(null)
  const [isCrisisOpen, setIsCrisisOpen] = useState(false)

  // Tabs: 'history' | 'support' | 'reassessment'
  const [activeTab, setActiveTab] = useState<
    'history' | 'support' | 'reassessment'
  >('history')
  // History filter: 'ALL' | 'PHQ9' | 'GAD7'
  const [instrumentFilter, setInstrumentFilter] = useState<
    'ALL' | 'PHQ9' | 'GAD7'
  >('ALL')
  // History pagination: show 5 rows first
  const [showAllHistory, setShowAllHistory] = useState(false)

  const progressTriggerRef = useRef<HTMLButtonElement | null>(null)
  const reviewTriggerRef = useRef<HTMLElement | null>(null)
  const tabListRef = useRef<HTMLDivElement | null>(null)

  const load = async (next?: string) => {
    setLoading(true)
    setError(false)
    try {
      const page = await getAssessmentHistory(next)
      setItems((current) => (next ? [...current, ...page.items] : page.items))
      setCursor(page.nextCursor ?? undefined)
      setHasMore(page.hasMore)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [])

  // Find latest & previous PHQ-9
  const phq9Items = items.filter((item) => item.instrument === 'PHQ9')
  const latestPhq9 = phq9Items[0]
  const prevPhq9 = phq9Items[1]

  // Find latest & previous GAD-7
  const gad7Items = items.filter((item) => item.instrument === 'GAD7')
  const latestGad7 = gad7Items[0]
  const prevGad7 = gad7Items[1]

  // Filtered history items
  const filteredItems = items.filter((item) =>
    instrumentFilter === 'ALL' ? true : item.instrument === instrumentFilter,
  )
  const displayedItems = showAllHistory
    ? filteredItems
    : filteredItems.slice(0, 5)

  // Keyboard navigation for tab list
  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    tab: 'history' | 'support' | 'reassessment',
  ) => {
    const tabs: ('history' | 'support' | 'reassessment')[] = [
      'history',
      'support',
      'reassessment',
    ]
    const currentIndex = tabs.indexOf(tab)

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      const nextIndex = (currentIndex + 1) % tabs.length
      setActiveTab(tabs[nextIndex])
      const nextBtn = tabListRef.current?.querySelector<HTMLButtonElement>(
        `#tab-${tabs[nextIndex]}`,
      )
      nextBtn?.focus()
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length
      setActiveTab(tabs[prevIndex])
      const prevBtn = tabListRef.current?.querySelector<HTMLButtonElement>(
        `#tab-${tabs[prevIndex]}`,
      )
      prevBtn?.focus()
    }
  }

  return (
    <div className="assessment-page">
      {/* 1. Tiêu đề + Nút Cần hỗ trợ ngay? */}
      <header className="assessment-page-header">
        <div className="assessment-page-title">
          <h1>Bài sàng lọc</h1>
          <p>Làm bài ngắn để hiểu mình đang thế nào.</p>
        </div>
        <button
          type="button"
          className="crisis-pill-btn"
          onClick={() => setIsCrisisOpen(true)}
          aria-label="Cần hỗ trợ ngay?"
        >
          <span className="crisis-dot" aria-hidden="true" />
          <span>Cần hỗ trợ ngay?</span>
        </button>
      </header>

      {/* 2. Khung Chọn bài (3 ô ngang hàng + thanh mint nhỏ) */}
      <section
        className="assessment-selector-section"
        aria-label="Chọn bài sàng lọc"
      >
        <div className="assessment-selector-grid">
          {/* Ô PHQ-9 */}
          <article className="assessment-select-card">
            <div className="select-card-header">
              <div className="select-card-icon" aria-hidden="true">
                <AssessmentIcon />
              </div>
              <span className="select-card-badge">9 câu hỏi</span>
            </div>
            <div className="select-card-body">
              <h2 className="select-card-name">PHQ-9</h2>
              <strong className="select-card-fullname">
                Patient Health Questionnaire-9
              </strong>
              <p className="select-card-desc">
                Tự đánh giá các dấu hiệu trầm cảm trong hai tuần gần đây.
              </p>
            </div>
            <div className="select-card-footer">
              <div className="select-card-meta-row">
                <span className="select-card-duration">3–5 phút</span>
                {latestPhq9 && (
                  <span className="select-card-score">
                    Gần nhất: {latestPhq9.result.totalScore} điểm
                  </span>
                )}
              </div>
              <Link href="/assessment/phq9" className="select-card-btn">
                Bắt đầu <span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>

          {/* Ô GAD-7 */}
          <article className="assessment-select-card">
            <div className="select-card-header">
              <div className="select-card-icon" aria-hidden="true">
                <AssessmentIcon />
              </div>
              <span className="select-card-badge">7 câu hỏi</span>
            </div>
            <div className="select-card-body">
              <h2 className="select-card-name">GAD-7</h2>
              <strong className="select-card-fullname">
                Generalized Anxiety Disorder-7
              </strong>
              <p className="select-card-desc">
                Tự đánh giá các dấu hiệu lo âu trong hai tuần gần đây.
              </p>
            </div>
            <div className="select-card-footer">
              <div className="select-card-meta-row">
                <span className="select-card-duration">3–5 phút</span>
                {latestGad7 && (
                  <span className="select-card-score">
                    Gần nhất: {latestGad7.result.totalScore} điểm
                  </span>
                )}
              </div>
              <Link href="/assessment/gad7" className="select-card-btn">
                Bắt đầu <span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>

          {/* Ô PSQI */}
          <article className="assessment-select-card disabled">
            <div className="select-card-header">
              <div className="select-card-icon" aria-hidden="true">
                <AssessmentIcon />
              </div>
              <span className="select-card-badge">19 câu hỏi</span>
            </div>
            <div className="select-card-body">
              <h2 className="select-card-name">PSQI</h2>
              <strong className="select-card-fullname">
                Pittsburgh Sleep Quality Index
              </strong>
              <p className="select-card-desc">
                Bài sàng lọc này hiện chưa khả dụng.
              </p>
            </div>
            <div className="select-card-footer">
              <div className="select-card-meta-row">
                <span className="select-card-duration">Chưa khả dụng</span>
              </div>
              <button
                type="button"
                disabled
                className="select-card-btn disabled-btn"
              >
                Chưa khả dụng
              </button>
            </div>
          </article>
        </div>

        {/* Thanh mint nhỏ bên dưới */}
        <div className="guided-mint-bar" aria-labelledby="guided-check-title">
          <div className="guided-mint-info">
            <h2 id="guided-check-title" className="sr-only">
              Nhìn lại tâm trạng và lo âu trong cùng một lượt
            </h2>
            <strong>Làm cả PHQ-9 và GAD-7</strong>
            <span>Khoảng 8 phút, kết quả hiển thị riêng từng bài.</span>
            <small className="sr-only">
              Mỗi bài vẫn có kết quả riêng, không gộp thành một điểm chung. Các
              bài làm riêng bên dưới sẽ không tự ghép thành lượt này.
            </small>
          </div>
          <Link
            href="/initial-check"
            aria-label="Bắt đầu PHQ-9 và GAD-7"
            className="guided-mint-action"
          >
            Bắt đầu cả hai <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {/* 3. Hai thẻ kết quả gần nhất cạnh nhau (PHQ-9, GAD-7) */}
      <section
        className="latest-results-section"
        aria-label="Kết quả sàng lọc gần nhất"
      >
        {/* Thẻ PHQ-9 */}
        <article className="latest-result-card">
          <div className="latest-result-header">
            <span className="latest-result-title">PHQ-9</span>
            <span
              className={`screening-level-pill ${getLevelClass(latestPhq9?.result.screeningLevel)}`}
            >
              {latestPhq9
                ? `Mức ${levelLabels[latestPhq9.result.screeningLevel].toLowerCase()}`
                : 'Chưa thực hiện'}
            </span>
          </div>

          <div className="latest-result-score-wrap">
            <span className="latest-result-score">
              {latestPhq9 ? latestPhq9.result.totalScore : '—'}
            </span>
            <span className="latest-result-total">/ 27 điểm</span>
          </div>

          <div
            className="segmented-score-bar"
            role="img"
            aria-label={
              latestPhq9
                ? `Kết quả PHQ-9: ${latestPhq9.result.totalScore} trên 27 điểm, mức độ ${levelLabels[latestPhq9.result.screeningLevel]}`
                : 'Chưa có kết quả PHQ-9'
            }
          >
            {[0, 1, 2, 3, 4].map((index) => {
              const currentBand = getBandIndex(
                latestPhq9?.result.screeningLevel,
              )
              let statusClass = ''
              if (currentBand >= 0) {
                if (index < currentBand) statusClass = 'segment-achieved'
                else if (index === currentBand) statusClass = 'segment-current'
              }
              return (
                <div
                  key={`phq9-seg-${index}`}
                  className={`score-bar-segment ${statusClass}`}
                />
              )
            })}
          </div>

          <p className="latest-result-note">
            {latestPhq9 ? (
              <>
                {new Date(latestPhq9.submittedAt).toLocaleDateString('vi-VN')}
                {prevPhq9
                  ? (() => {
                      const delta =
                        latestPhq9.result.totalScore -
                        prevPhq9.result.totalScore
                      if (delta < 0)
                        return ` · giảm ${Math.abs(delta)} điểm so với ${prevPhq9.result.totalScore} điểm trước đó`
                      if (delta > 0)
                        return ` · tăng ${delta} điểm so với ${prevPhq9.result.totalScore} điểm trước đó`
                      return ` · không đổi so với ${prevPhq9.result.totalScore} điểm trước đó`
                    })()
                  : ' · chưa có lần so sánh'}
              </>
            ) : (
              'Chưa có lần so sánh'
            )}
          </p>
        </article>

        {/* Thẻ GAD-7 */}
        <article className="latest-result-card">
          <div className="latest-result-header">
            <span className="latest-result-title">GAD-7</span>
            <span
              className={`screening-level-pill ${getLevelClass(latestGad7?.result.screeningLevel)}`}
            >
              {latestGad7
                ? `Mức ${levelLabels[latestGad7.result.screeningLevel].toLowerCase()}`
                : 'Chưa thực hiện'}
            </span>
          </div>

          <div className="latest-result-score-wrap">
            <span className="latest-result-score">
              {latestGad7 ? latestGad7.result.totalScore : '—'}
            </span>
            <span className="latest-result-total">/ 21 điểm</span>
          </div>

          <div
            className="segmented-score-bar"
            role="img"
            aria-label={
              latestGad7
                ? `Kết quả GAD-7: ${latestGad7.result.totalScore} trên 21 điểm, mức độ ${levelLabels[latestGad7.result.screeningLevel]}`
                : 'Chưa có kết quả GAD-7'
            }
          >
            {[0, 1, 2, 3, 4].map((index) => {
              const currentBand = getBandIndex(
                latestGad7?.result.screeningLevel,
                true,
              )
              let statusClass = ''
              if (currentBand >= 0) {
                if (index < currentBand) statusClass = 'segment-achieved'
                else if (index === currentBand) statusClass = 'segment-current'
              }
              return (
                <div
                  key={`gad7-seg-${index}`}
                  className={`score-bar-segment ${statusClass}`}
                />
              )
            })}
          </div>

          <p className="latest-result-note">
            {latestGad7 ? (
              <>
                {new Date(latestGad7.submittedAt).toLocaleDateString('vi-VN')}
                {prevGad7
                  ? (() => {
                      const delta =
                        latestGad7.result.totalScore -
                        prevGad7.result.totalScore
                      if (delta < 0)
                        return ` · giảm ${Math.abs(delta)} điểm so với ${prevGad7.result.totalScore} điểm trước đó`
                      if (delta > 0)
                        return ` · tăng ${delta} điểm so với ${prevGad7.result.totalScore} điểm trước đó`
                      return ` · không đổi so với ${prevGad7.result.totalScore} điểm trước đó`
                    })()
                  : ' · chưa có lần so sánh'}
              </>
            ) : (
              'Chưa có lần so sánh'
            )}
          </p>
        </article>
      </section>

      {/* 4. Thanh tab (Segmented Control): Lịch sử | Gợi ý sau sàng lọc | Đánh giá lại */}
      <div className="assessment-tabs-container">
        <div
          ref={tabListRef}
          className="assessment-tablist"
          role="tablist"
          aria-label="Các mục quản lý sàng lọc"
        >
          <button
            type="button"
            id="tab-history"
            role="tab"
            aria-selected={activeTab === 'history'}
            aria-controls="panel-history"
            tabIndex={activeTab === 'history' ? 0 : -1}
            className={`assessment-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
            onKeyDown={(e) => handleTabKeyDown(e, 'history')}
          >
            Lịch sử
          </button>
          <button
            type="button"
            id="tab-support"
            role="tab"
            aria-selected={activeTab === 'support'}
            aria-controls="panel-support"
            tabIndex={activeTab === 'support' ? 0 : -1}
            className={`assessment-tab-btn ${activeTab === 'support' ? 'active' : ''}`}
            onClick={() => setActiveTab('support')}
            onKeyDown={(e) => handleTabKeyDown(e, 'support')}
          >
            Gợi ý sau sàng lọc
          </button>
          <button
            type="button"
            id="tab-reassessment"
            role="tab"
            aria-selected={activeTab === 'reassessment'}
            aria-controls="panel-reassessment"
            tabIndex={activeTab === 'reassessment' ? 0 : -1}
            className={`assessment-tab-btn ${activeTab === 'reassessment' ? 'active' : ''}`}
            onClick={() => setActiveTab('reassessment')}
            onKeyDown={(e) => handleTabKeyDown(e, 'reassessment')}
          >
            Đánh giá lại
          </button>
        </div>

        {/* 5. Tab Panel: Lịch sử */}
        <section
          role="tabpanel"
          id="panel-history"
          aria-labelledby="tab-history"
          tabIndex={0}
          className={`assessment-tabpanel ${activeTab === 'history' ? 'active' : ''}`}
        >
          <div className="history-filter-chips" aria-label="Bộ lọc bộ câu hỏi">
            <button
              type="button"
              className="history-filter-chip"
              aria-pressed={instrumentFilter === 'ALL'}
              onClick={() => setInstrumentFilter('ALL')}
            >
              Tất cả
            </button>
            <button
              type="button"
              className="history-filter-chip"
              aria-pressed={instrumentFilter === 'PHQ9'}
              onClick={() => setInstrumentFilter('PHQ9')}
            >
              PHQ-9
            </button>
            <button
              type="button"
              className="history-filter-chip"
              aria-pressed={instrumentFilter === 'GAD7'}
              onClick={() => setInstrumentFilter('GAD7')}
            >
              GAD-7
            </button>
          </div>

          {error ? (
            <div className="assessment-history-unavailable" role="alert">
              <strong>Không thể tải lịch sử</strong>
              <p>Thông tin của bạn chưa tải được. Vui lòng thử lại.</p>
              <button
                type="button"
                className="select-card-btn"
                onClick={() => void load()}
              >
                Thử lại
              </button>
            </div>
          ) : items.length === 0 && loading ? (
            <div
              className="assessment-history-skeleton"
              role="status"
              aria-live="polite"
            >
              <span className="sr-only">Đang tải lịch sử sàng lọc…</span>
              <Skeleton width="32%" height={16} />
              <Skeleton width="100%" height={48} />
              <Skeleton width="100%" height={48} />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="assessment-history-unavailable">
              <strong>Chưa có lịch sử sàng lọc</strong>
              <p>
                Mỗi lần làm lại sẽ tạo một kết quả mới, không ghi đè kết quả cũ.
              </p>
            </div>
          ) : (
            <div className="history-rows-list">
              {displayedItems.map((item) => {
                const dateObj = new Date(item.submittedAt)
                const dateStr = dateObj.toLocaleDateString('vi-VN')
                const timeStr = dateObj.toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
                const isSingleFilter = instrumentFilter !== 'ALL'

                return (
                  <article key={item.assessmentId} className="history-row-card">
                    <div className="history-row-main">
                      <div className="history-row-date">
                        <strong>{dateStr}</strong>
                        <small>{timeStr}</small>
                      </div>

                      {!isSingleFilter && (
                        <span className="history-row-instrument">
                          {item.instrument}
                        </span>
                      )}

                      <span
                        className={`screening-level-pill ${getLevelClass(item.result.screeningLevel)}`}
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
                        aria-expanded={
                          progressAssessmentId === item.assessmentId
                        }
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

          {/* Nút Xem thêm khi có nhiều hơn 5 mục trong danh sách */}
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

          {/* Nút Tải thêm trang từ API nếu còn */}
          {hasMore && !loading && (
            <div className="history-show-more-wrap">
              <button
                type="button"
                className="btn-show-more"
                onClick={() => void load(cursor)}
              >
                Tải thêm lịch sử
              </button>
            </div>
          )}

          {loading && items.length > 0 && (
            <p className="assessment-history-loading" aria-live="polite">
              Đang tải thêm lịch sử…
            </p>
          )}

          {/* Modal So sánh */}
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

          {/* Modal Xem lại chi tiết */}
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

        {/* 6. Tab Panel: Gợi ý sau sàng lọc */}
        <section
          role="tabpanel"
          id="panel-support"
          aria-labelledby="tab-support"
          tabIndex={0}
          className={`assessment-tabpanel ${activeTab === 'support' ? 'active' : ''}`}
        >
          <SupportEvaluationHistory />
        </section>

        {/* 7. Tab Panel: Đánh giá lại */}
        <section
          role="tabpanel"
          id="panel-reassessment"
          aria-labelledby="tab-reassessment"
          tabIndex={0}
          className={`assessment-tabpanel ${activeTab === 'reassessment' ? 'active' : ''}`}
        >
          <ReassessmentJourney />
        </section>
      </div>

      {/* 8. Cuối trang: Ghi chú nhỏ */}
      <footer className="assessment-bottom-disclaimer">
        <p>
          Sàng lọc chỉ để tham khảo, không phải chẩn đoán. MentalBridge không
          thay thế chuyên gia hay dịch vụ khẩn cấp.
        </p>
      </footer>

      {/* Modal hỗ trợ khẩn cấp mở khi bấm nút Cần hỗ trợ ngay? */}
      <CrisisSupportModal
        isOpen={isCrisisOpen}
        onClose={() => setIsCrisisOpen(false)}
      />
    </div>
  )
}
