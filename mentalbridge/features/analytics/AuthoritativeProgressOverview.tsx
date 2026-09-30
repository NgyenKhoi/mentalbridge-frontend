'use client'

import { useEffect, useState, type CSSProperties } from 'react'

import type {
  AnalyticsOverview,
  OverviewSource,
} from './api/analytics-overview-contract'
import { getAnalyticsOverview } from './api/browser-analytics-overview'

type Tone = 'amber' | 'teal' | 'lavender' | 'terra'

type Card = Readonly<{
  key: string
  label: string
  icon: string
  tone: Tone
  value: string
  unit?: string
  detail: string
  unavailable?: boolean
}>

function unavailableCard(
  key: string,
  label: string,
  icon: string,
  tone: Tone,
): Card {
  return {
    key,
    label,
    icon,
    tone,
    value: '—',
    detail: 'Tạm thời chưa tải được dữ liệu này.',
    unavailable: true,
  }
}

function sourceCard<T>(
  source: OverviewSource<T>,
  fallback: Card,
  render: (data: T) => Card,
  empty?: Card,
) {
  if (source.state === 'available') return render(source.data)
  if (source.state === 'empty' && empty) return empty
  return fallback
}

function formatLatestAssessment(instrument: 'PHQ9' | 'GAD7', date: string) {
  const label = instrument === 'PHQ9' ? 'PHQ-9' : 'GAD-7'
  return `Gần nhất: ${label} · ${new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))}`
}

function cardsFrom(overview: AnalyticsOverview): Card[] {
  const emotionFallback = unavailableCard(
    'emotion',
    'Chuỗi ghi nhận cảm xúc',
    '↗',
    'amber',
  )
  const assessmentFallback = unavailableCard(
    'assessments',
    'Bài sàng lọc đã lưu',
    '✓',
    'teal',
  )
  const supportFallback = unavailableCard(
    'support',
    'Hoạt động hỗ trợ',
    '◇',
    'terra',
  )
  const appointmentFallback = unavailableCard(
    'appointments',
    'Lịch tư vấn đã tạo',
    '♡',
    'lavender',
  )

  return [
    sourceCard(overview.emotion, emotionFallback, (data) => ({
      ...emotionFallback,
      value: String(data.currentStreak),
      unit: 'ngày',
      detail:
        data.checkedInDays === 0
          ? `Chưa có ghi nhận trong ${data.windowDays} ngày gần nhất.`
          : `${data.checkedInDays}/${data.windowDays} ngày gần nhất có ghi nhận.`,
      unavailable: false,
    })),
    sourceCard(overview.assessments, assessmentFallback, (data) => ({
      ...assessmentFallback,
      value: `${data.count}${data.countIsLowerBound ? '+' : ''}`,
      unit: 'bài',
      detail:
        data.latestSubmittedAt && data.latestInstrument
          ? formatLatestAssessment(
              data.latestInstrument,
              data.latestSubmittedAt,
            )
          : 'Chưa có bài sàng lọc nào được lưu.',
      unavailable: false,
    })),
    sourceCard(
      overview.supportActivities,
      supportFallback,
      (data) => ({
        ...supportFallback,
        value: String(data.completedCount),
        unit: 'hoạt động',
        detail:
          data.completedCount === 0 &&
          data.skippedCount === 0 &&
          data.scheduledOrMissedCount === 0
            ? `Chưa có hoạt động trong ${data.windowDays} ngày gần nhất.`
            : `${data.skippedCount} đã bỏ qua · ${data.scheduledOrMissedCount} chưa hoàn tất.`,
        unavailable: false,
      }),
      {
        ...supportFallback,
        value: '—',
        detail: 'Chưa có kế hoạch hỗ trợ hiện tại.',
        unavailable: false,
      },
    ),
    sourceCard(overview.appointments, appointmentFallback, (data) => ({
      ...appointmentFallback,
      value: String(data.totalCount),
      unit: 'lịch',
      detail:
        data.totalCount === 0
          ? 'Chưa có lịch tư vấn nào.'
          : `${data.activeCount} lịch đang hoạt động.`,
      unavailable: false,
    })),
  ]
}

function LoadingCards() {
  return (
    <section
      className="analytics-stats"
      aria-label="Đang tải tổng quan hoạt động"
      aria-busy="true"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <article
          className="analytics-stat analytics-stat-loading"
          key={index}
          style={{ '--delay': `${index * 65}ms` } as CSSProperties}
        >
          <span className="analytics-stat-skeleton analytics-stat-skeleton-icon" />
          <span className="analytics-stat-skeleton analytics-stat-skeleton-value" />
          <span className="analytics-stat-skeleton analytics-stat-skeleton-label" />
        </article>
      ))}
    </section>
  )
}

export default function AuthoritativeProgressOverview() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    async function fetchOverview() {
      try {
        const timezone =
          Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        const nextOverview = await getAnalyticsOverview(timezone)
        if (active) setOverview(nextOverview)
      } catch {
        if (active) setFailed(true)
      }
    }
    void fetchOverview()
    return () => {
      active = false
    }
  }, [attempt])

  if (!overview) {
    if (!failed) return <LoadingCards />
    return (
      <section className="analytics-overview-error" role="alert">
        <div>
          <strong>Chưa thể tải tổng quan hoạt động</strong>
          <p>
            Các số liệu chưa được hiển thị để tránh đưa ra thông tin không chính
            xác.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFailed(false)
            setAttempt((value) => value + 1)
          }}
        >
          Thử lại
        </button>
      </section>
    )
  }

  const cards = cardsFrom(overview)
  return (
    <section className="analytics-stats" aria-label="Tổng quan hoạt động">
      {cards.map((card, index) => (
        <article
          className={`analytics-stat${card.unavailable ? ' is-unavailable' : ''}`}
          key={card.key}
          style={{ '--delay': `${index * 65}ms` } as CSSProperties}
        >
          <span
            className={`analytics-stat-icon ${card.tone}`}
            aria-hidden="true"
          >
            {card.icon}
          </span>
          <div>
            <strong>
              {card.value}
              {card.unit ? <small>{card.unit}</small> : null}
            </strong>
            <p className="analytics-stat-label">{card.label}</p>
            <p className="analytics-stat-detail">{card.detail}</p>
          </div>
        </article>
      ))}
    </section>
  )
}
