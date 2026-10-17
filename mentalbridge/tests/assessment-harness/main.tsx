import { StrictMode, useState, useRef } from 'react'
import { createRoot } from 'react-dom/client'

import '../../app/globals.css'
import '../../app/(dashboard)/dashboard.css'
import '../../app/(dashboard)/dashboard-shell.css'
import '../../app/(dashboard)/assessments/assessments.css'

import type {
  AssessmentSummary,
  AssessmentProgress,
} from '@/features/assessment/api/care-contract'
import AssessmentProgressPanel from '@/features/assessment/components/AssessmentProgressPanel'
import AssessmentDetailModal from '@/features/assessment/components/AssessmentDetailModal'
import {
  getLevelClass,
  levelLabels,
} from '@/features/assessment/components/assessment-meanings'

const mockItems: AssessmentSummary[] = [
  {
    assessmentId: '10000000-0000-4000-8000-000000000001',
    questionnaireDefinitionId: 'def-phq9',
    instrument: 'PHQ9',
    questionnaireVersion: 'phq9-vi-vn-v1',
    privacyPolicyVersion: 'privacy-v1',
    submittedAt: '2026-09-28T14:20:00Z',
    result: {
      totalScore: 13,
      screeningLevel: 'MODERATE',
      scoringVersion: 'phq9-standard-bands-v1',
      safetyStatus: 'NEGATIVE_SAFETY_SCREEN',
      safetyPolicyVersion: 'MB-SAFETY-PHQ9-001/1.0',
      disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
    },
  },
  {
    assessmentId: '10000000-0000-4000-8000-000000000002',
    questionnaireDefinitionId: 'def-phq9',
    instrument: 'PHQ9',
    questionnaireVersion: 'phq9-vi-vn-v1',
    privacyPolicyVersion: 'privacy-v1',
    submittedAt: '2026-09-28T13:58:00Z',
    result: {
      totalScore: 17,
      screeningLevel: 'MODERATELY_SEVERE',
      scoringVersion: 'phq9-standard-bands-v1',
      safetyStatus: 'POSITIVE_SAFETY_SCREEN',
      safetyPolicyVersion: 'MB-SAFETY-PHQ9-001/1.0',
      disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
    },
  },
  {
    assessmentId: '10000000-0000-4000-8000-000000000003',
    questionnaireDefinitionId: 'def-gad7',
    instrument: 'GAD7',
    questionnaireVersion: 'gad7-vi-vn-v1',
    privacyPolicyVersion: 'privacy-v1',
    submittedAt: '2026-09-20T10:15:00Z',
    result: {
      totalScore: 8,
      screeningLevel: 'MILD',
      scoringVersion: 'gad7-standard-bands-v1',
      safetyStatus: 'NEGATIVE_SAFETY_SCREEN',
      safetyPolicyVersion: 'MB-SAFETY-GAD7-001/1.0',
      disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
    },
  },
]

const mockProgressData: AssessmentProgress = {
  instrument: 'PHQ9',
  scoringVersion: 'phq9-standard-bands-v1',
  previous: {
    assessmentId: '10000000-0000-4000-8000-000000000002',
    questionnaireVersion: 'phq9-vi-vn-v1',
    submittedAt: '2026-09-28T13:58:00Z',
    totalScore: 17,
    screeningLevel: 'MODERATELY_SEVERE',
  },
  current: {
    assessmentId: '10000000-0000-4000-8000-000000000001',
    questionnaireVersion: 'phq9-vi-vn-v1',
    submittedAt: '2026-09-28T14:20:00Z',
    totalScore: 13,
    screeningLevel: 'MODERATE',
  },
  rawDelta: -4,
  scoreDirection: 'DECREASED',
  bandTransition: { previous: 'MODERATELY_SEVERE', current: 'MODERATE' },
  elapsedDuration: 'PT22M',
}

// Mock window.fetch for browser care API
const originalFetch = window.fetch
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  if (
    url.includes('/api/care/assessments/by-id/') &&
    url.includes('/progress')
  ) {
    return new Response(JSON.stringify(mockProgressData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return originalFetch(input, init)
}

function HarnessApp() {
  const [items] = useState<AssessmentSummary[]>(mockItems)
  const [activeTab, setActiveTab] = useState<
    'history' | 'support' | 'reassessment'
  >('history')
  const [instrumentFilter, setInstrumentFilter] = useState<
    'ALL' | 'PHQ9' | 'GAD7'
  >('ALL')
  const [progressAssessmentId, setProgressAssessmentId] = useState<string>()
  const [reviewItem, setReviewItem] = useState<AssessmentSummary | null>(null)

  const progressTriggerRef = useRef<HTMLButtonElement | null>(null)
  const reviewTriggerRef = useRef<HTMLElement | null>(null)

  const filteredItems = items.filter((item) =>
    instrumentFilter === 'ALL' ? true : item.instrument === instrumentFilter,
  )

  return (
    <div
      style={{
        background: 'var(--bg-canvas, #f7f9f6)',
        minHeight: '100vh',
        padding: '32px 16px',
      }}
    >
      <div className="assessment-page">
        {/* Header */}
        <header className="assessment-page-header">
          <div className="assessment-page-title">
            <h1>Bài sàng lọc</h1>
            <p>Làm bài ngắn để hiểu mình đang thế nào.</p>
          </div>
          <button
            type="button"
            className="crisis-pill-btn"
            aria-label="Cần hỗ trợ ngay?"
          >
            <span className="crisis-dot" aria-hidden="true" />
            <span>Cần hỗ trợ ngay?</span>
          </button>
        </header>

        {/* 3 cards selector */}
        <section
          className="assessment-selector-section"
          aria-label="Chọn bài sàng lọc"
        >
          <div className="assessment-selector-grid">
            <article className="assessment-select-card">
              <div>
                <h2 className="select-card-name">PHQ-9</h2>
                <p className="select-card-meta">Tâm trạng · 9 câu · 3–5 phút</p>
              </div>
              <div className="select-card-footer">
                <span className="select-card-score">Gần nhất: 13 điểm</span>
                <span className="select-card-btn">Bắt đầu →</span>
              </div>
            </article>

            <article className="assessment-select-card">
              <div>
                <h2 className="select-card-name">GAD-7</h2>
                <p className="select-card-meta">Lo âu · 7 câu · 3–5 phút</p>
              </div>
              <div className="select-card-footer">
                <span className="select-card-score">Gần nhất: 8 điểm</span>
                <span className="select-card-btn">Bắt đầu →</span>
              </div>
            </article>

            <article className="assessment-select-card select-card-disabled">
              <div>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <h2 className="select-card-name">PSQI</h2>
                  <span className="select-card-badge-soon">Sắp có</span>
                </div>
                <p className="select-card-meta">Giấc ngủ · 19 câu</p>
              </div>
              <div className="select-card-footer">
                <span className="select-card-score">Chưa mở</span>
                <span className="select-card-btn select-btn-disabled">
                  Sắp mở
                </span>
              </div>
            </article>
          </div>
        </section>

        {/* Tabs container */}
        <div className="assessment-tabs-container">
          <div className="assessment-tablist" role="tablist">
            <button
              type="button"
              id="tab-history"
              role="tab"
              aria-selected={activeTab === 'history'}
              className={`assessment-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              Lịch sử
            </button>
            <button
              type="button"
              id="tab-support"
              role="tab"
              aria-selected={activeTab === 'support'}
              className={`assessment-tab-btn ${activeTab === 'support' ? 'active' : ''}`}
              onClick={() => setActiveTab('support')}
            >
              Gợi ý sau sàng lọc
            </button>
            <button
              type="button"
              id="tab-reassessment"
              role="tab"
              aria-selected={activeTab === 'reassessment'}
              className={`assessment-tab-btn ${activeTab === 'reassessment' ? 'active' : ''}`}
              onClick={() => setActiveTab('reassessment')}
            >
              Đánh giá lại
            </button>
          </div>

          {/* Panel Lịch sử */}
          <section role="tabpanel" className="assessment-tabpanel active">
            <div className="history-filter-chips">
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

            <div className="history-rows-list">
              {filteredItems.map((item) => {
                const dateObj = new Date(item.submittedAt)
                const dateStr = dateObj.toLocaleDateString('vi-VN')
                const timeStr = dateObj.toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })

                return (
                  <article key={item.assessmentId} className="history-row-card">
                    <div className="history-row-main">
                      <div className="history-row-date">
                        <strong>{dateStr}</strong>
                        <small>{timeStr}</small>
                      </div>

                      <span className="history-row-instrument">
                        {item.instrument}
                      </span>

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
                      <button
                        type="button"
                        className="btn-row-action"
                        onClick={(event) => {
                          reviewTriggerRef.current = event.currentTarget
                          setReviewItem(item)
                        }}
                      >
                        Xem lại
                      </button>
                      <button
                        type="button"
                        className="btn-row-action"
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
        </div>
      </div>
    </div>
  )
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <HarnessApp />
    </StrictMode>,
  )
}
