'use client'

import Link from 'next/link'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'

import { CrisisSupportModal } from '@/components/crisis-support/CrisisSupportWidget'
import { Disclosure } from '@/components/ui/Disclosure'
import type { AssessmentSummary } from '@/features/assessment/api/care-contract'
import { getAssessmentHistory } from '@/features/assessment/api/browser-care'
import { IndividualAssessmentHistory } from '@/features/assessment/components/IndividualAssessmentHistory'
import { ScreeningEpisodeHistory } from '@/features/assessment/components/ScreeningEpisodeHistory'
import { SupportEvaluationHistory } from '@/features/assessment/components/SupportEvaluationHistory'
import { ReassessmentJourney } from '@/features/assessment/components/ReassessmentJourney'

import './assessments.css'

type AssessmentTab = 'history' | 'support' | 'reassessment'
const assessmentTabs: AssessmentTab[] = ['history', 'support', 'reassessment']

export default function AssessmentsPage() {
  // useSearchParams needs a Suspense boundary for prerendering.
  return (
    <Suspense fallback={null}>
      <AssessmentsContent />
    </Suspense>
  )
}

function AssessmentsContent() {
  const searchParams = useSearchParams()
  // MB-645: a plan review sends the user here to finish the reassessment and come back.
  const planReview = searchParams?.get('returnTo') === 'plan-review'
  const [items, setItems] = useState<AssessmentSummary[]>([])
  const [cursor, setCursor] = useState<string>()
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [isCrisisOpen, setIsCrisisOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<AssessmentTab>(() =>
    searchParams?.get('tab') === 'reassessment' ? 'reassessment' : 'history',
  )
  const tabListRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async (next?: string) => {
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
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    tab: AssessmentTab,
  ) => {
    const currentIndex = assessmentTabs.indexOf(tab)
    let nextIndex: number

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % assessmentTabs.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex =
        (currentIndex - 1 + assessmentTabs.length) % assessmentTabs.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = assessmentTabs.length - 1
    } else {
      return
    }

    event.preventDefault()
    const nextTab = assessmentTabs[nextIndex]
    setActiveTab(nextTab)
    tabListRef.current
      ?.querySelector<HTMLButtonElement>(`#tab-${nextTab}`)
      ?.focus()
  }

  return (
    <div className="assessment-page">
      <header className="assessment-page-header">
        <div className="assessment-page-title">
          <h1 aria-label="Bài sàng lọc">
            <span className="assessment-desktop-label">Bài sàng lọc</span>
            <span className="assessment-mobile-label">Lịch sử sàng lọc</span>
          </h1>
          <p>
            Làm bài ngắn để hiểu mình đang thế nào và theo dõi biến chuyển cảm
            xúc theo thời gian.
          </p>
        </div>
        <div className="assessment-page-actions">
          <button
            type="button"
            className="crisis-pill-btn"
            onClick={() => setIsCrisisOpen(true)}
          >
            <span className="crisis-dot" aria-hidden="true" />
            Cần hỗ trợ ngay?
          </button>
          <Link
            href="/initial-check"
            className="assessment-start-pair"
            aria-label="Bắt đầu PHQ-9 và GAD-7"
          >
            <RotateCcw aria-hidden="true" />
            Làm bài sàng lọc
          </Link>
        </div>
      </header>

      <div className="assessment-tabs-container" data-page-motion="off">
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
            aria-label="Lịch sử sàng lọc"
            aria-selected={activeTab === 'history'}
            aria-controls="panel-history"
            tabIndex={activeTab === 'history' ? 0 : -1}
            className="assessment-tab-btn"
            onClick={() => setActiveTab('history')}
            onKeyDown={(event) => handleTabKeyDown(event, 'history')}
          >
            <span className="assessment-desktop-label">Lịch sử sàng lọc</span>
            <span className="assessment-mobile-label">Lịch sử</span>
          </button>
          <button
            type="button"
            id="tab-support"
            role="tab"
            aria-label="Gợi ý sau sàng lọc"
            aria-selected={activeTab === 'support'}
            aria-controls="panel-support"
            tabIndex={activeTab === 'support' ? 0 : -1}
            className="assessment-tab-btn"
            onClick={() => setActiveTab('support')}
            onKeyDown={(event) => handleTabKeyDown(event, 'support')}
          >
            <span className="assessment-desktop-label">Gợi ý sau sàng lọc</span>
            <span className="assessment-mobile-label">Gợi ý sau bài</span>
          </button>
          <button
            type="button"
            id="tab-reassessment"
            role="tab"
            aria-selected={activeTab === 'reassessment'}
            aria-controls="panel-reassessment"
            tabIndex={activeTab === 'reassessment' ? 0 : -1}
            className="assessment-tab-btn"
            onClick={() => setActiveTab('reassessment')}
            onKeyDown={(event) => handleTabKeyDown(event, 'reassessment')}
          >
            Đánh giá lại
          </button>
        </div>

        <section
          role="tabpanel"
          id="panel-history"
          aria-labelledby="tab-history"
          tabIndex={0}
          hidden={activeTab !== 'history'}
          className="assessment-tabpanel"
        >
          <div className="assessment-history-sections">
            <ScreeningEpisodeHistory />
            <Disclosure
              className="assessment-standalone-disclosure"
              summary="Bài sàng lọc riêng lẻ và kết quả từng bài"
              contentClassName="assessment-standalone-content"
            >
              <div className="assessment-standalone-starts">
                <p>
                  Làm riêng PHQ-9 hoặc GAD-7, hoặc xem lại kết quả từng bài đã
                  lưu. Các bài riêng lẻ không tự ghép thành một lượt sàng lọc.
                </p>
                <div>
                  <Link href="/assessment/phq9">
                    Làm riêng PHQ-9 <ArrowRight aria-hidden="true" />
                  </Link>
                  <Link href="/assessment/gad7">
                    Làm riêng GAD-7 <ArrowRight aria-hidden="true" />
                  </Link>
                </div>
              </div>
              <IndividualAssessmentHistory
                items={items}
                loading={loading}
                error={error}
                hasMore={hasMore}
                onRetry={() => void load()}
                onLoadMore={() => void load(cursor)}
              />
            </Disclosure>
          </div>
        </section>

        <section
          role="tabpanel"
          id="panel-support"
          aria-labelledby="tab-support"
          tabIndex={0}
          hidden={activeTab !== 'support'}
          className="assessment-tabpanel"
        >
          <SupportEvaluationHistory active={activeTab === 'support'} />
        </section>

        <section
          role="tabpanel"
          id="panel-reassessment"
          aria-labelledby="tab-reassessment"
          tabIndex={0}
          hidden={activeTab !== 'reassessment'}
          className="assessment-tabpanel"
        >
          <ReassessmentJourney planReview={planReview} />
        </section>
      </div>

      <footer className="assessment-bottom-disclaimer">
        <p>
          Sàng lọc chỉ để tham khảo, không phải chẩn đoán. MentalBridge không
          thay thế chuyên gia hay dịch vụ khẩn cấp.
        </p>
      </footer>

      <CrisisSupportModal
        isOpen={isCrisisOpen}
        onClose={() => setIsCrisisOpen(false)}
      />
    </div>
  )
}
