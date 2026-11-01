'use client'

import { useId } from 'react'
import { motion } from 'framer-motion'
import type {
  ActionOccurrence,
  SupportPlanV3,
} from '../api/support-plan-contract'
import {
  cycleDays,
  shortDate,
  todayCounts,
  todayRows,
  type CycleDay,
} from './workspace-model'

function dayText(day: CycleDay) {
  const state =
    day.status === 'done'
      ? 'xong hết việc'
      : day.status === 'partial'
        ? `xong ${day.done} trên ${day.total} việc`
        : day.status === 'none'
          ? day.total > 0
            ? 'chưa xong việc nào'
            : 'không có việc'
          : day.status === 'unknown'
            ? 'chưa có dữ liệu'
            : 'chưa tới'
  return [
    `Ngày ${day.number}, ${shortDate(day.date)}`,
    day.isToday && 'hôm nay',
    day.isReviewDay && 'ngày xem lại',
    state,
  ]
    .filter(Boolean)
    .join(', ')
}

/**
 * The cycle as a row of days. Status is also written out for screen readers,
 * so colour and fill are never the only meaning. Today fills by its done share.
 */
export default function CycleStrip({
  plan,
  occurrences,
  today,
  known,
  still,
}: Readonly<{
  plan: SupportPlanV3
  occurrences: ActionOccurrence[]
  today: string
  known: boolean
  still: boolean
}>) {
  const summaryId = useId()
  const days = cycleDays(plan, occurrences, today, known)
  if (days.length === 0) return null
  const current = days.find((day) => day.isToday)
  const counts = known
    ? todayCounts(todayRows(plan, occurrences, today))
    : undefined
  const summary = [
    current && `Ngày ${current.number} trên ${days.length}.`,
    counts &&
      counts.total > 0 &&
      `Hôm nay xong ${counts.done} trên ${counts.total} việc.`,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div>
      <p id={summaryId} className="mbw-visually-hidden">
        {summary}
      </p>
      <ol
        className="mbw-strip"
        aria-label="Các ngày của chu kỳ"
        aria-describedby={summaryId}
      >
        {days.map((day) => {
          const share =
            day.status === 'done'
              ? 1
              : day.total > 0 && (day.isToday || day.status === 'partial')
                ? day.done / day.total
                : 0
          return (
            <li
              key={day.date}
              className={[
                'mbw-pip',
                `is-${day.status}`,
                day.isToday && 'is-today',
                day.isReviewDay && 'is-review',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-current={day.isToday ? 'date' : undefined}
            >
              <motion.i
                initial={{ scaleX: 0 }}
                animate={{ scaleX: share }}
                transition={{
                  duration: still ? 0 : 0.48,
                  ease: [0.16, 1, 0.3, 1],
                }}
              />
              <span className="mbw-visually-hidden">{dayText(day)}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
