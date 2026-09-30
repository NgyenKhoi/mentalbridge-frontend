'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

import ActivityDashboard from '@/features/analytics/ActivityDashboard'
import type { AnalyticsRange } from '@/features/analytics/api/activity-dashboard-contract'
import { getAnalyticsEvents } from '@/features/analytics/api/browser-analytics'
import { buildAnalytics, type Analytics } from '@/lib/analytics'

import './analytics.css'

const RANGES: readonly AnalyticsRange[] = [7, 30, 90]

type State =
  | Readonly<{ phase: 'loading'; range: AnalyticsRange }>
  | Readonly<{ phase: 'ready'; range: AnalyticsRange; analytics: Analytics }>
  | Readonly<{ phase: 'error'; range: AnalyticsRange }>

function Header() {
  return (
    <header className="analytics-hero">
      <div>
        <span>Hành trình của bạn</span>
        <h1>Thống kê &amp; Phân tích</h1>
        <p>
          Xem lại các hoạt động bạn đã ghi nhận trên MentalBridge theo thời
          gian.
        </p>
      </div>
    </header>
  )
}

function LoadingState() {
  return (
    <section
      className="analytics-loading"
      aria-label="Đang tải dữ liệu phân tích"
      aria-busy="true"
    >
      <div className="analytics-loading-kpis">
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <div className="analytics-loading-charts">
        <span />
        <span />
      </div>
      <span className="analytics-loading-rhythm" />
    </section>
  )
}

function AnalyticsContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const requestedRange = Number(searchParams.get('range'))
  const range = RANGES.includes(requestedRange as AnalyticsRange)
    ? (requestedRange as AnalyticsRange)
    : 30
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<State>({ phase: 'loading', range })

  useEffect(() => {
    if (searchParams.get('range') !== String(range)) {
      const next = new URLSearchParams(searchParams)
      next.set('range', String(range))
      router.replace(`${pathname}?${next}`, { scroll: false })
    }
  }, [pathname, range, router, searchParams])

  useEffect(() => {
    let active = true
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    getAnalyticsEvents(range, timezone)
      .then((events) => {
        if (!active) return
        if (events.partial) throw new Error('Analytics source unavailable.')
        setState({
          phase: 'ready',
          range,
          analytics: buildAnalytics(events, range),
        })
      })
      .catch(() => {
        if (active) setState({ phase: 'error', range })
      })
    return () => {
      active = false
    }
  }, [attempt, range])

  function selectRange(nextRange: AnalyticsRange) {
    if (nextRange === range) return
    const next = new URLSearchParams(searchParams)
    next.set('range', String(nextRange))
    router.replace(`${pathname}?${next}`, { scroll: false })
  }

  return (
    <>
      <div className="analytics-toolbar">
        <div>
          <strong>Khoảng thời gian</strong>
          <span>Mọi số liệu và biểu đồ dùng cùng một khoảng.</span>
        </div>
        <div className="analytics-range" aria-label="Chọn khoảng thời gian">
          {RANGES.map((item) => (
            <button
              type="button"
              key={item}
              aria-pressed={range === item}
              onClick={() => selectRange(item)}
            >
              {item} ngày
            </button>
          ))}
        </div>
      </div>

      {state.phase === 'loading' || state.range !== range ? (
        <LoadingState />
      ) : state.phase === 'error' ? (
        <section className="analytics-error" role="alert">
          <div>
            <strong>Chưa thể tải dữ liệu phân tích</strong>
            <p>Vui lòng thử lại để tải đầy đủ số liệu trong cùng một lần.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setState({ phase: 'loading', range })
              setAttempt((value) => value + 1)
            }}
          >
            Thử lại
          </button>
        </section>
      ) : (
        <ActivityDashboard analytics={state.analytics} />
      )}
    </>
  )
}

export default function AnalyticsPage() {
  return (
    <div className="analytics-page">
      <Header />
      <Suspense fallback={<LoadingState />}>
        <AnalyticsContent />
      </Suspense>
    </div>
  )
}
