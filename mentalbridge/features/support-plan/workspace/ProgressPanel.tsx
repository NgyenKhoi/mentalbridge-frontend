'use client'

import Link from 'next/link'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { RotateCcw } from 'lucide-react'
import type {
  ActionOccurrence,
  SupportPlanV3,
} from '../api/support-plan-contract'
import { dayLabel, statusLine, titleOf, useNow } from './TodayPanel'
import {
  cycleDays,
  recentDays,
  formatTimeIn,
  occurrenceWindow,
  periodCounts,
  shortDate,
  todayCounts,
  todayRows,
  type CycleDay,
  type ProgressSummary,
  type TodayRow,
} from './workspace-model'
import { hasContentCompletion } from '../resource-plan-origin'

const helpfulLabels = {
  VERY_HELPFUL: 'rất hữu ích',
  HELPFUL: 'hữu ích',
  A_LITTLE_HELPFUL: 'hơi hữu ích',
  NOT_HELPFUL: 'chưa hợp',
} as const

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function helpfulness(occurrences: ActionOccurrence[]) {
  const counts = new Map<string, number>()
  for (const item of occurrences)
    if (item.helpfulness)
      counts.set(item.helpfulness, (counts.get(item.helpfulness) ?? 0) + 1)
  return (Object.keys(helpfulLabels) as Array<keyof typeof helpfulLabels>)
    .filter((key) => counts.has(key))
    .map((key) => `${counts.get(key)} lần ${helpfulLabels[key]}`)
    .join(', ')
}

/** "2 xong, 1 để hôm khác": only the kinds a day actually has. */
function tally(rows: ReadonlyArray<TodayRow>) {
  const count = (status: TodayRow['status']) =>
    rows.filter((row) => row.status === status).length
  return [
    [count('done'), 'xong'],
    [count('skipped'), 'để hôm khác'],
    [count('missed'), 'chưa làm'],
    [count('upcoming'), 'chưa tới giờ'],
  ]
    .filter(([n]) => n)
    .map(([n, label]) => `${n} ${label}`)
    .join(', ')
}

function Row({
  label,
  children,
}: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="mbw-count">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

const chunk = <T,>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  )

export default function ProgressPanel({
  plan,
  occurrences,
  today,
  timezone,
  summary,
  loadError,
  still = false,
  onRetry,
}: Readonly<{
  plan: SupportPlanV3
  occurrences: ActionOccurrence[]
  today: string
  timezone: string
  /** Present once the rows were read for this plan and window. */
  summary?: ProgressSummary
  loadError: boolean
  /** Safety help is on screen: no motion. */
  still?: boolean
  onRetry: () => void
}>) {
  const [picked, setPicked] = useState<string>()
  const instant = Boolean(useReducedMotion()) || still
  const now = useNow(60_000)

  if (!summary)
    return (
      <div className="mbw-progress">
        <section className="mbw-tile" aria-labelledby="mbw-progress-title">
          <h2 id="mbw-progress-title">Những gì bạn đã làm</h2>
          <p className="mbw-quiet" role={loadError ? 'alert' : 'status'}>
            {loadError ? 'Chưa tải được phần này.' : 'Đang tải…'}
            {loadError && (
              <>
                {' '}
                <button
                  type="button"
                  className="mbw-link-button"
                  onClick={onRetry}
                >
                  Thử lại
                </button>
              </>
            )}
          </p>
        </section>
      </div>
    )

  const loaded = occurrenceWindow(plan, today)
  const inCycle = cycleDays(plan, occurrences, today)
  // Plans without a usable cycle still get a dated history: the last week.
  const days =
    inCycle.length > 0 ? inCycle : recentDays(plan, occurrences, today)
  const rowsOf = (day: CycleDay) =>
    day.status === 'unknown' || day.date > loaded.through
      ? undefined
      : todayRows(plan, occurrences, day.date, now)
  const active =
    days.find((day) => day.date === picked) ??
    days.find((day) => day.isToday) ??
    [...days].reverse().find((day) => day.status !== 'future')
  const activeRows = active && rowsOf(active)
  const counts = periodCounts(plan, occurrences, summary.from, today, now)
  const rated = helpfulness(occurrences)
  const contentCompletions = occurrences.filter(
    (item) =>
      hasContentCompletion(item) &&
      item.localDate >= summary.from &&
      item.localDate <= summary.through,
  )
  const cycleNumber = plan.cycle?.cycleNumber
  const fade = {
    duration: instant ? 0 : 0.18,
    ease: [0.16, 1, 0.3, 1] as const,
  }

  function dayName(day: CycleDay) {
    const rows = rowsOf(day)
    const state = !rows
      ? 'Chưa có dữ liệu'
      : todayCounts(rows).total === 0
        ? 'Không có việc'
        : tally(rows)
    return [
      dayLabel(day.date),
      day.isToday && 'hôm nay',
      day.isReviewDay && 'ngày xem lại',
    ]
      .filter(Boolean)
      .join(', ')
      .concat(`: ${state}`)
  }

  return (
    <div className="mbw-progress">
      {loadError && (
        <div className="mbw-inline-alert" role="alert">
          <p>Chưa cập nhật được. Số liệu bên dưới có thể chưa mới nhất.</p>
          <button type="button" className="mbw-link-button" onClick={onRetry}>
            <RotateCcw size={16} aria-hidden="true" />
            Thử lại
          </button>
        </div>
      )}

      {days.length > 0 && active && (
        <section
          className="mbw-tile mbw-mapbox"
          aria-labelledby="mbw-map-title"
        >
          <header className="mbw-map-head">
            <h2 id="mbw-map-title">
              {inCycle.length === 0
                ? '7 ngày gần đây'
                : cycleNumber && cycleNumber > 0
                  ? `Chu kỳ ${cycleNumber}`
                  : 'Chu kỳ này'}
            </h2>
            <p className="mbw-quiet">
              {shortDate(days[0].date)} –{' '}
              {shortDate(days[days.length - 1].date)}
            </p>
          </header>
          <div
            className="mbw-map"
            role="group"
            aria-label="Chọn một ngày để xem"
            style={{ '--cols': Math.min(days.length, 14) } as CSSProperties}
          >
            {chunk(days, 7).map((week, index) => (
              <div key={week[0].date} className="mbw-map-week">
                <p className="mbw-map-weeklabel">Tuần {index + 1}</p>
                {week.map((day) => {
                  const selected = day.date === active.date
                  return (
                    <button
                      key={day.date}
                      type="button"
                      className={[
                        'mbw-mapday',
                        `is-${day.status}`,
                        day.isToday && 'is-today',
                        day.isReviewDay && 'is-review',
                        selected && 'is-selected',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      aria-pressed={selected}
                      aria-label={dayName(day)}
                      onClick={() => setPicked(day.date)}
                    >
                      {selected && (
                        <motion.span
                          layoutId="mbw-day-ring"
                          className="mbw-day-ring"
                          transition={{
                            duration: instant ? 0 : 0.22,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                        />
                      )}
                      <span className="mbw-day-wd" aria-hidden="true">
                        {
                          WEEKDAYS[
                            new Date(`${day.date}T00:00:00Z`).getUTCDay()
                          ]
                        }
                      </span>
                      <i className="mbw-day-dot" aria-hidden="true" />
                      <span className="mbw-day-n" aria-hidden="true">
                        {Number(day.date.slice(8, 10))}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active.date}
              className="mbw-hist"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fade}
            >
              <h3>
                {active.isToday ? 'Hôm nay · ' : ''}
                {dayLabel(active.date)}
              </h3>
              {!activeRows ? (
                <p className="mbw-quiet">Chưa có dữ liệu cho ngày này.</p>
              ) : activeRows.length === 0 ? (
                <p className="mbw-quiet">Không có việc nào trong ngày này.</p>
              ) : (
                <ul>
                  {activeRows.map((row) => (
                    <li
                      key={row.occurrence.occurrenceId}
                      className={`is-${row.status}`}
                    >
                      <span className="mbw-hist-time">
                        {formatTimeIn(timezone, row.occurrence.scheduledAt)}
                      </span>
                      <div className="mbw-hist-title">{titleOf(row)}</div>
                      <div className="mbw-hist-state">
                        {statusLine(row, timezone)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      )}

      <section className="mbw-tile" aria-labelledby="mbw-progress-title">
        <h2 id="mbw-progress-title">Những gì bạn đã làm</h2>
        <p className="mbw-quiet">{shortDate(summary.from)} – hôm nay</p>
        <dl className="mbw-counts">
          <Row label="Đã làm">{counts.done} việc</Row>
          <Row label="Để hôm khác">{counts.skipped} việc</Row>
          <Row label="Chưa làm">{counts.missed} việc</Row>
          {contentCompletions.length > 0 && (
            <Row label="Đã ghi nhận từ bài luyện tập">
              {contentCompletions.length} việc
            </Row>
          )}
          <Row label="Ngày ghi cảm xúc">{summary.emotionDays} ngày</Row>
          <Row label="Ngày viết nhật ký">{summary.journalDays} ngày</Row>
          {rated && <Row label="Mức hữu ích bạn chọn">{rated}</Row>}
        </dl>
        <div>
          <Link className="mbw-text-link" href="/assessments">
            So sánh các lần kiểm tra
          </Link>
        </div>
      </section>
    </div>
  )
}
