'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import type {
  AssessmentSummary,
  ScreeningLevel,
} from '@/features/assessment/api/care-contract'
import { getAssessmentHistory } from '@/features/assessment/api/browser-care'

const levelLabels: Record<ScreeningLevel, string> = {
  MINIMAL: 'Tối thiểu',
  MILD: 'Nhẹ',
  MODERATE: 'Trung bình',
  MODERATELY_SEVERE: 'Khá nặng',
  SEVERE: 'Nặng',
}

type ResultState =
  | { status: 'loading' }
  | { status: 'ready'; assessment?: AssessmentSummary }
  | { status: 'error' }

export default function LatestPhq9Result() {
  const [state, setState] = useState<ResultState>({ status: 'loading' })

  useEffect(() => {
    let active = true

    void getAssessmentHistory()
      .then((page) => {
        if (!active) return
        setState({
          status: 'ready',
          assessment: page.items.find((item) => item.instrument === 'PHQ9'),
        })
      })
      .catch(() => {
        if (active) setState({ status: 'error' })
      })

    return () => {
      active = false
    }
  }, [])

  if (state.status === 'loading') {
    return (
      <div className="ref-result-content" aria-live="polite" aria-busy="true">
        <p className="ref-result-desc">Đang tải kết quả sàng lọc…</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="ref-result-content" role="status">
        <p className="ref-result-desc">
          Chưa thể tải kết quả lúc này. Kết quả bạn đã lưu vẫn được giữ nguyên.
        </p>
        <Link href="/assessments" className="ref-result-cta-btn">
          <span>Mở Bài sàng lọc</span>
          <span className="ref-btn-arrow" aria-hidden="true">
            →
          </span>
        </Link>
      </div>
    )
  }

  if (!state.assessment) {
    return (
      <div className="ref-result-content">
        <div className="ref-result-msg-row">
          <span className="ref-result-inline-icon" aria-hidden="true">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
          <p className="ref-result-desc">
            Chưa có kết quả PHQ-9 nào được hiển thị.
          </p>
        </div>
        <Link href="/assessment/phq9" className="ref-result-cta-btn">
          <span>Làm PHQ-9 để nhận kết quả</span>
          <span className="ref-btn-arrow" aria-hidden="true">
            →
          </span>
        </Link>
      </div>
    )
  }

  const submittedAt = new Date(state.assessment.submittedAt)

  return (
    <div className="ref-result-content" aria-live="polite">
      <div className="ref-result-summary">
        <span className="ref-result-label">PHQ-9 gần nhất</span>
        <div className="ref-result-score">
          <strong>{state.assessment.result.totalScore}</strong>
          <span>điểm</span>
        </div>
        <p>
          Mức sàng lọc:{' '}
          <strong>{levelLabels[state.assessment.result.screeningLevel]}</strong>
        </p>
        <time dateTime={state.assessment.submittedAt}>
          {submittedAt.toLocaleDateString('vi-VN')}
        </time>
      </div>
      <Link href="/assessments" className="ref-result-cta-btn">
        <span>Xem các lần sàng lọc</span>
        <span className="ref-btn-arrow" aria-hidden="true">
          →
        </span>
      </Link>
    </div>
  )
}
