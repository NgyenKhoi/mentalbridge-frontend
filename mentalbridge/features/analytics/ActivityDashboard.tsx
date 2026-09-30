'use client'

import Link from 'next/link'
import { useId, type CSSProperties, type ReactNode } from 'react'

import type { Analytics, ActivityKind } from '@/lib/analytics'
import { ACTIVITY_KINDS } from '@/lib/analytics'

import styles from './ActivityDashboard.module.css'

type Props = Readonly<{ analytics: Analytics }>

const KINDS: Readonly<
  Record<ActivityKind, Readonly<{ label: string; color: string }>>
> = {
  assessments: { label: 'Bài sàng lọc', color: '#d89a3d' },
  journals: { label: 'Nhật ký', color: '#2f7167' },
  emotions: { label: 'Cảm xúc', color: '#7766a0' },
  support: { label: 'Hỗ trợ', color: '#c87554' },
  appointments: { label: 'Lịch tư vấn', color: '#66a39b' },
}

const EMOTIONS = [
  'Rất không tốt',
  'Không tốt',
  'Bình thường',
  'Tốt',
  'Rất tốt',
] as const

function shortDate(localDate: string) {
  return `${localDate.slice(8, 10)}/${localDate.slice(5, 7)}`
}

function fullDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function localDateLabel(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00.000Z`))
}

function Icon({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  )
}

function Kpis({ analytics }: Props) {
  const latest = analytics.latestAssessment
  const cards = [
    {
      key: 'emotion',
      tone: 'emotion',
      label: 'Chuỗi ghi nhận cảm xúc',
      value: analytics.streak,
      unit: 'ngày',
      detail: `${analytics.emotionActiveDays}/${analytics.range} ngày có ghi nhận`,
      icon: (
        <Icon>
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
          <path d="M8.5 10h.01M15.5 10h.01M8.5 14c1 1 2.2 1.5 3.5 1.5s2.5-.5 3.5-1.5" />
        </Icon>
      ),
    },
    {
      key: 'assessment',
      tone: 'assessment',
      label: 'Bài sàng lọc đã lưu',
      value: analytics.byKind.assessments,
      unit: 'bài',
      detail: latest
        ? `Gần nhất: ${latest.instrument === 'PHQ9' ? 'PHQ-9' : 'GAD-7'} · ${fullDate(latest.submittedAt)}`
        : 'Chưa có bài sàng lọc trong kỳ',
      icon: (
        <Icon>
          <path d="M9 5h10v16H5V5h4M9 3h6v4H9V3Z" />
          <path d="m8 13 2 2 5-5" />
        </Icon>
      ),
    },
    {
      key: 'support',
      tone: 'support',
      label: 'Hoạt động hỗ trợ',
      value: analytics.byKind.support,
      unit: 'lần',
      detail: `${analytics.supportCompleted} hoàn thành · ${analytics.supportSkipped} bỏ qua`,
      icon: (
        <Icon>
          <path d="M4 13.5 9 18l11-12" />
          <path d="M4 6v7.5M9 18h8" />
        </Icon>
      ),
    },
    {
      key: 'appointment',
      tone: 'appointment',
      label: 'Lịch tư vấn đã tạo',
      value: analytics.appointmentCount,
      unit: 'lịch',
      detail:
        analytics.appointmentCount === 0
          ? 'Chưa có lịch trong kỳ'
          : 'Lịch được tạo trong khoảng đã chọn',
      icon: (
        <Icon>
          <path d="M5 4h14v16H5V4ZM8 2v4M16 2v4M5 9h14" />
          <path d="M9 13h2M13 13h2M9 17h2" />
        </Icon>
      ),
      action:
        analytics.appointmentCount === 0 ? (
          <Link href="/specialists">Đặt lịch</Link>
        ) : null,
    },
  ]

  return (
    <section className={styles.kpis} aria-label="Tổng quan hoạt động">
      {cards.map((card) => (
        <article className={styles.kpi} data-tone={card.tone} key={card.key}>
          <span className={styles.kpiIcon}>{card.icon}</span>
          <div className={styles.kpiBody}>
            <p>{card.label}</p>
            <strong>
              {card.value}
              <small>{card.unit}</small>
            </strong>
            <span>{card.detail}</span>
            {card.action}
          </div>
        </article>
      ))}
    </section>
  )
}

function emotionPath(
  points: ReadonlyArray<Readonly<{ x: number; y: number }>>,
) {
  return points
    .map((point, index) =>
      index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`,
    )
    .join(' ')
}

function EmotionTrend({ analytics }: Props) {
  const gradientId = useId().replaceAll(':', '')
  const recorded = analytics.emotionSeries.flatMap((entry, index) => {
    const level = entry.level
    if (level === null) return []
    return [
      {
        localDate: entry.localDate,
        level,
        x: 52 + (index / Math.max(analytics.range - 1, 1)) * 700,
        y: 26 + ((5 - level) / 4) * 176,
      },
    ]
  })

  return (
    <article className={`${styles.panel} ${styles.emotionPanel}`}>
      <header className={styles.panelHeader}>
        <div>
          <span>Cảm xúc tự ghi nhận</span>
          <h2>Xu hướng cảm xúc</h2>
        </div>
        <p>{analytics.emotionActiveDays} ngày có ghi nhận</p>
      </header>
      {recorded.length < 3 ? (
        <div className={styles.sparseState}>
          <span aria-hidden="true">◌</span>
          <strong>Cần thêm vài ngày để tạo đường xu hướng</strong>
          <p>Ghi nhận ít nhất 3 ngày trong khoảng đã chọn.</p>
          <Link href="/dashboard#emotion-check-in">Ghi nhận cảm xúc</Link>
        </div>
      ) : (
        <svg
          className={styles.emotionChart}
          viewBox="0 0 800 250"
          role="img"
          aria-labelledby="emotion-trend-title emotion-trend-desc"
        >
          <title id="emotion-trend-title">
            Xu hướng cảm xúc trong {analytics.range} ngày
          </title>
          <desc id="emotion-trend-desc">
            {analytics.emotionActiveDays} ngày có ghi nhận từ{' '}
            {shortDate(analytics.startLocalDate)} đến{' '}
            {shortDate(analytics.asOfLocalDate)}.
          </desc>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7766a0" stopOpacity=".24" />
              <stop offset="100%" stopColor="#7766a0" stopOpacity="0" />
            </linearGradient>
          </defs>
          {EMOTIONS.map((label, index) => {
            const y = 26 + ((4 - index) / 4) * 176
            return (
              <g key={label}>
                <line
                  className={styles.gridLine}
                  x1="52"
                  x2="752"
                  y1={y}
                  y2={y}
                />
                <text
                  className={styles.axisLabel}
                  x="45"
                  y={y + 4}
                  textAnchor="end"
                >
                  {label}
                </text>
              </g>
            )
          })}
          <path
            className={styles.emotionArea}
            fill={`url(#${gradientId})`}
            d={`${emotionPath(recorded)} L ${recorded.at(-1)?.x} 204 L ${recorded[0].x} 204 Z`}
          />
          <path className={styles.emotionLine} d={emotionPath(recorded)} />
          {recorded.map((point) => (
            <g key={point.localDate}>
              <circle
                className={styles.emotionPoint}
                cx={point.x}
                cy={point.y}
                r="5"
              />
              <title>{`${localDateLabel(point.localDate)}: ${EMOTIONS[point.level - 1]}`}</title>
            </g>
          ))}
          {analytics.emotionSeries.map((entry, index) => {
            const interval = Math.max(1, Math.ceil(analytics.range / 6))
            if (index % interval !== 0 && index !== analytics.range - 1)
              return null
            const x = 52 + (index / Math.max(analytics.range - 1, 1)) * 700
            return (
              <text
                className={styles.dateLabel}
                key={entry.localDate}
                x={x}
                y="232"
                textAnchor={
                  index === 0
                    ? 'start'
                    : index === analytics.range - 1
                      ? 'end'
                      : 'middle'
                }
              >
                {shortDate(entry.localDate)}
              </text>
            )
          })}
        </svg>
      )}
    </article>
  )
}

function ActivityMix({ analytics }: Props) {
  const entries = ACTIVITY_KINDS.reduce<
    Array<
      Readonly<{
        kind: ActivityKind
        percent: number
        start: number
        end: number
      }>
    >
  >((result, kind) => {
    const percent = analytics.total
      ? (analytics.byKind[kind] / analytics.total) * 100
      : 0
    const start = result.at(-1)?.end ?? 0
    return [...result, { kind, percent, start, end: start + percent }]
  }, [])
  const ring = entries
    .filter((entry) => entry.percent > 0)
    .map((entry) => `${KINDS[entry.kind].color} ${entry.start}% ${entry.end}%`)
    .join(', ')

  return (
    <article className={`${styles.panel} ${styles.mixPanel}`}>
      <header className={styles.panelHeader}>
        <div>
          <span>Phân bổ</span>
          <h2>Cơ cấu hoạt động</h2>
        </div>
      </header>
      <div className={styles.mixBody}>
        <div
          className={styles.donut}
          style={{ '--activity-ring': ring } as CSSProperties}
          role="img"
          aria-label={`Cơ cấu ${analytics.total} hoạt động trong ${analytics.range} ngày`}
        >
          <div>
            <span>Cơ cấu</span>
            <strong>{analytics.range} ngày</strong>
          </div>
        </div>
        <ul className={styles.mixLegend}>
          {entries.map((entry) => (
            <li key={entry.kind}>
              <span
                style={{ background: KINDS[entry.kind].color }}
                aria-hidden="true"
              />
              <p>{KINDS[entry.kind].label}</p>
              <strong>{Math.round(entry.percent)}%</strong>
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

function dayDescription(day: Analytics['byDay'][number]) {
  const details = ACTIVITY_KINDS.flatMap((kind) =>
    day.byKind[kind] ? [`${KINDS[kind].label}: ${day.byKind[kind]}`] : [],
  )
  return `${localDateLabel(day.localDate)} · ${day.total} hoạt động${details.length ? ` · ${details.join(', ')}` : ''}`
}

function ActivityRhythm({ analytics }: Props) {
  const maximum = Math.max(1, ...analytics.byDay.map((day) => day.total))
  const heatmap = analytics.range >= 30
  return (
    <article className={`${styles.panel} ${styles.rhythmPanel}`}>
      <header className={styles.panelHeader}>
        <div>
          <span>Nhịp hoạt động</span>
          <h2>Hoạt động theo ngày</h2>
        </div>
        <p>
          {analytics.activeDays}/{analytics.range} ngày có hoạt động
        </p>
      </header>
      <div className={styles.kindLegend} aria-label="Chú giải loại hoạt động">
        {ACTIVITY_KINDS.map((kind) => (
          <span
            key={kind}
            style={{ '--kind-color': KINDS[kind].color } as CSSProperties}
          >
            {KINDS[kind].label}
          </span>
        ))}
      </div>
      {heatmap ? (
        <div
          className={styles.heatmap}
          data-range={analytics.range}
          role="img"
          aria-label={`Bản đồ nhiệt hoạt động từng ngày trong ${analytics.range} ngày`}
        >
          {analytics.byDay.map((day, index) => {
            const strength = day.total / maximum
            return (
              <span
                className={styles.heatCell}
                data-tooltip={dayDescription(day)}
                key={day.localDate}
                tabIndex={0}
                aria-label={dayDescription(day)}
                title={dayDescription(day)}
                style={{ '--strength': strength } as CSSProperties}
              >
                {day.total || ''}
                {(index % (analytics.range === 30 ? 5 : 7) === 0 ||
                  index === analytics.range - 1) && (
                  <small>{shortDate(day.localDate)}</small>
                )}
              </span>
            )
          })}
        </div>
      ) : (
        <div
          className={styles.stackedChart}
          role="img"
          aria-label="Biểu đồ cột chồng hoạt động trong 7 ngày"
        >
          {analytics.byDay.map((day) => (
            <div className={styles.dayColumn} key={day.localDate}>
              <strong>{day.total || ''}</strong>
              <div className={styles.barTrack}>
                <div
                  className={styles.bar}
                  style={{ height: `${(day.total / maximum) * 100}%` }}
                  aria-label={dayDescription(day)}
                >
                  {ACTIVITY_KINDS.map((kind) =>
                    day.byKind[kind] ? (
                      <span
                        key={kind}
                        style={{
                          background: KINDS[kind].color,
                          flexGrow: day.byKind[kind],
                        }}
                      />
                    ) : null,
                  )}
                </div>
              </div>
              <span>{shortDate(day.localDate)}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}

export function AnalyticsEmptyState({ range }: Readonly<{ range: number }>) {
  return (
    <section className={styles.empty}>
      <span aria-hidden="true">✦</span>
      <h2>Chưa có hoạt động trong {range} ngày gần nhất</h2>
      <p>
        Bắt đầu bằng một ghi nhận cảm xúc hoặc bài nhật ký; thống kê sẽ xuất
        hiện tại đây.
      </p>
      <div>
        <Link href="/dashboard#emotion-check-in">Ghi nhận cảm xúc</Link>
        <Link href="/journal">Viết nhật ký</Link>
      </div>
    </section>
  )
}

export default function ActivityDashboard({ analytics }: Props) {
  if (analytics.total === 0)
    return <AnalyticsEmptyState range={analytics.range} />

  return (
    <div className={styles.dashboard}>
      <Kpis analytics={analytics} />
      <section className={styles.chartGrid} aria-label="Biểu đồ phân tích">
        <EmotionTrend analytics={analytics} />
        <ActivityMix analytics={analytics} />
      </section>
      <ActivityRhythm analytics={analytics} />
    </div>
  )
}
