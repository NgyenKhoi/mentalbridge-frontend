'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import { useEffect, useId, useMemo, useState } from 'react'

import { Skeleton } from '@/components/ui/Skeleton'
import type {
  Emotion,
  EmotionCheckIn,
  EmotionCheckInProgress,
  EmotionProgressWindow,
} from '@/lib/emotion-check-in/contract'

import {
  getEmotionCheckInProgress,
  listEmotionCheckIns,
} from './api/browser-emotion-check-in'

type Props = Readonly<{
  onOpenDetails: () => void
}>

type ReadyState = Readonly<{
  phase: 'ready'
  progress: EmotionCheckInProgress
  history: EmotionCheckIn[]
}>

type State =
  Readonly<{ phase: 'loading' }> | Readonly<{ phase: 'error' }> | ReadyState

type ChartPoint = Readonly<{
  dayIndex: number
  entry: EmotionCheckIn
  x: number
  y: number
}>

const emotions = ['GREAT', 'GOOD', 'OKAY', 'LOW', 'VERY_LOW'] as const
const emotionCopy: Record<
  Emotion,
  Readonly<{ label: string; color: string; background: string }>
> = {
  GREAT: { label: 'Rất tốt', color: '#D99B2B', background: '#FDF3DC' },
  GOOD: { label: 'Tốt', color: '#3D7A6E', background: '#DDF3F0' },
  OKAY: { label: 'Bình thường', color: '#6C9BD2', background: '#E3EDF8' },
  LOW: { label: 'Không tốt', color: '#B96747', background: '#F5DED2' },
  VERY_LOW: { label: 'Rất không tốt', color: '#68639A', background: '#E5E3F1' },
}

const chartLeft = 86
const chartRight = 750
const chartTop = 42
const chartRowHeight = 38
const chartBaseline = chartTop + chartRowHeight * (emotions.length - 1) + 10

const dateValue = (localDate: string) => new Date(`${localDate}T00:00:00.000Z`)
const localDateToOrdinal = (localDate: string) => {
  const [year, month, day] = localDate.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}
const ordinalToLocalDate = (ordinal: number) =>
  new Date(ordinal * 86_400_000).toISOString().slice(0, 10)
const datesInWindow = (window: EmotionProgressWindow) => {
  const start = localDateToOrdinal(window.startLocalDate)
  const end = localDateToOrdinal(window.endLocalDate)
  return Array.from({ length: end - start + 1 }, (_, index) =>
    ordinalToLocalDate(start + index),
  )
}

const weekdayFormatter = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'short',
  timeZone: 'UTC',
})
const accessibleDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

const formatWeekday = (localDate: string) =>
  weekdayFormatter.format(dateValue(localDate)).replace('Th ', 'T')
const formatShortDate = (localDate: string) => {
  const [, month, day] = localDate.split('-')
  return `${day}/${month}`
}
const formatAccessibleDate = (localDate: string) => {
  const value = accessibleDateFormatter.format(dateValue(localDate))
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const smoothPath = (points: ChartPoint[]) => {
  if (points.length < 2) return ''
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index]
    const midpoint = (previous.x + point.x) / 2
    return `${path} C ${midpoint} ${previous.y}, ${midpoint} ${point.y}, ${point.x} ${point.y}`
  }, `M ${points[0].x} ${points[0].y}`)
}

const consecutiveGroups = (points: ChartPoint[]) =>
  points.reduce<ChartPoint[][]>((groups, point) => {
    const current = groups.at(-1)
    const previous = current?.at(-1)
    if (!current || !previous || point.dayIndex !== previous.dayIndex + 1) {
      groups.push([point])
    } else {
      current.push(point)
    }
    return groups
  }, [])

function ChartHeader({ onOpenDetails }: Props) {
  return (
    <div className="analytics-chart-head">
      <div>
        <span>7 ngày gần nhất</span>
        <h2>Cảm xúc bạn đã ghi nhận</h2>
      </div>
      <div className="analytics-chart-actions">
        <div className="analytics-legend" aria-label="Chú giải cảm xúc">
          {emotions.map((emotion) => (
            <span key={emotion} style={{ color: emotionCopy[emotion].color }}>
              {emotionCopy[emotion].label}
            </span>
          ))}
        </div>
        <button type="button" onClick={onOpenDetails}>
          Xem chi tiết <b aria-hidden="true">→</b>
        </button>
      </div>
    </div>
  )
}

function LoadingChart(props: Props) {
  return (
    <section className="analytics-chart-card" aria-busy="true">
      <ChartHeader {...props} />
      <div className="analytics-chart-state">
        <Skeleton width="100%" height={238} />
        <span className="sr-only">Đang tải cảm xúc đã ghi nhận…</span>
      </div>
    </section>
  )
}

function ErrorChart({
  onOpenDetails,
  onRetry,
}: Props & { onRetry: () => void }) {
  return (
    <section className="analytics-chart-card">
      <ChartHeader onOpenDetails={onOpenDetails} />
      <div
        className="analytics-chart-state analytics-chart-message"
        role="alert"
      >
        <strong>Chưa thể tải dữ liệu cảm xúc</strong>
        <p>Hãy thử lại để xem các ghi nhận trong 7 ngày gần nhất.</p>
        <button type="button" onClick={onRetry}>
          Thử lại
        </button>
      </div>
    </section>
  )
}

export default function EmotionProgressChart({ onOpenDetails }: Props) {
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    [],
  )
  const gradientId = useId().replaceAll(':', '')
  const [retry, setRetry] = useState(0)
  const [state, setState] = useState<State>({ phase: 'loading' })

  useEffect(() => {
    let active = true
    Promise.all([getEmotionCheckInProgress(timezone), listEmotionCheckIns(30)])
      .then(([progress, history]) => {
        if (active)
          setState({ phase: 'ready', progress, history: history.items })
      })
      .catch(() => {
        if (active) setState({ phase: 'error' })
      })
    return () => {
      active = false
    }
  }, [retry, timezone])

  if (state.phase === 'loading')
    return <LoadingChart onOpenDetails={onOpenDetails} />

  if (state.phase === 'error')
    return (
      <ErrorChart
        onOpenDetails={onOpenDetails}
        onRetry={() => {
          setState({ phase: 'loading' })
          setRetry((value) => value + 1)
        }}
      />
    )

  const window = state.progress.windows.find((item) => item.days === 7)
  if (!window)
    return (
      <ErrorChart
        onOpenDetails={onOpenDetails}
        onRetry={() => {
          setState({ phase: 'loading' })
          setRetry((value) => value + 1)
        }}
      />
    )

  const dates = datesInWindow(window)
  const historyByDate = new Map(
    state.history.map((entry) => [entry.localDate, entry]),
  )
  const xStep = (chartRight - chartLeft) / Math.max(dates.length - 1, 1)
  const points = dates.flatMap((localDate, dayIndex) => {
    const entry = historyByDate.get(localDate)
    if (!entry) return []
    return [
      {
        dayIndex,
        entry,
        x: chartLeft + xStep * dayIndex,
        y: chartTop + emotions.indexOf(entry.emotion) * chartRowHeight,
      },
    ]
  })
  const groups = consecutiveGroups(points)

  return (
    <section className="analytics-chart-card">
      <ChartHeader onOpenDetails={onOpenDetails} />
      {points.length === 0 ? (
        <div className="analytics-chart-state analytics-chart-message">
          <strong>Chưa có ghi nhận trong 7 ngày gần nhất</strong>
          <p>Ghi lại cảm xúc hôm nay để bắt đầu nhìn lại theo thời gian.</p>
          <Link href="/dashboard#emotion-check-in">Ghi lại cảm xúc</Link>
        </div>
      ) : (
        <div className="analytics-chart-scroll">
          <svg
            className="analytics-chart"
            viewBox="0 0 800 264"
            role="img"
            aria-labelledby="emotion-chart-title emotion-chart-description"
          >
            <title id="emotion-chart-title">
              Cảm xúc đã ghi nhận trong 7 ngày gần nhất
            </title>
            <desc id="emotion-chart-description">
              {`Từ ${formatShortDate(window.startLocalDate)} đến ${formatShortDate(window.endLocalDate)}, bạn đã ghi nhận ${window.checkedInDays} trên ${window.totalDays} ngày. Những ngày không có điểm là ngày chưa ghi nhận.`}
            </desc>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--teal-deep)"
                  stopOpacity=".14"
                />
                <stop
                  offset="100%"
                  stopColor="var(--teal-deep)"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>
            {emotions.map((emotion, index) => {
              const y = chartTop + index * chartRowHeight
              return (
                <g key={emotion}>
                  <line
                    x1={chartLeft}
                    y1={y}
                    x2={chartRight}
                    y2={y}
                    className="analytics-grid-line"
                  />
                  <text x="0" y={y + 4} className="analytics-axis">
                    {emotionCopy[emotion].label}
                  </text>
                </g>
              )
            })}
            {groups.map((group) => {
              const line = smoothPath(group)
              if (!line) return null
              const first = group[0]
              const last = group[group.length - 1]
              return (
                <g key={`${first.entry.localDate}-${last.entry.localDate}`}>
                  <path
                    className="analytics-area"
                    fill={`url(#${gradientId})`}
                    d={`${line} L ${last.x} ${chartBaseline} L ${first.x} ${chartBaseline} Z`}
                  />
                  <path className="analytics-line" d={line} />
                </g>
              )
            })}
            {points.map((point, index) => {
              const copy = emotionCopy[point.entry.emotion]
              const labelWidth = Math.max(56, copy.label.length * 7 + 18)
              return (
                <g
                  key={point.entry.id}
                  className="analytics-point"
                  aria-label={`${formatAccessibleDate(point.entry.localDate)}, cảm xúc ${copy.label}, mức cảm nhận ${point.entry.intensity} trên 5`}
                  style={
                    {
                      '--delay': `${250 + index * 70}ms`,
                      '--emotion-color': copy.color,
                      '--emotion-background': copy.background,
                    } as CSSProperties
                  }
                >
                  <rect
                    x={point.x - labelWidth / 2}
                    y={point.y - 29}
                    width={labelWidth}
                    height="20"
                    rx="10"
                  />
                  <text x={point.x} y={point.y - 15} textAnchor="middle">
                    {copy.label}
                  </text>
                  <circle cx={point.x} cy={point.y} r="5" />
                </g>
              )
            })}
            {dates.map((localDate, index) => (
              <g
                key={localDate}
                className="analytics-day-label"
                data-recorded={
                  historyByDate.has(localDate) ? 'true' : undefined
                }
              >
                <text x={chartLeft + xStep * index} y="230" textAnchor="middle">
                  {formatWeekday(localDate)}
                </text>
                <text x={chartLeft + xStep * index} y="247" textAnchor="middle">
                  {formatShortDate(localDate)}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}
    </section>
  )
}
