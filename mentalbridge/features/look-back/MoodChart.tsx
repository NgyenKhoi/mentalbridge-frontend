import type { CSSProperties } from 'react'

import { emotionPresentation } from '@/lib/emotion-check-in/presentation'

import { dayMonth, moodLabel } from './look-back-copy'
import type { LookBack } from './look-back-model'
import styles from './LookBack.module.css'

type Day = LookBack['days'][number]

const left = (index: number, count: number) => ((index + 0.5) / count) * 100
// Level 5 (very good) sits at the top; the 8% margin keeps dots inside the plot.
const top = (level: number) => 8 + ((5 - level) / 4) * 84

/** Runs of consecutive check-in days: a day without one breaks the line instead of dipping to zero. */
function runs(days: readonly Day[]) {
  const result: Array<Array<{ x: number; y: number }>> = []
  let run: Array<{ x: number; y: number }> = []
  days.forEach((day, index) => {
    if (day.emotionLevel === null) {
      if (run.length) result.push(run)
      run = []
      return
    }
    run.push({ x: left(index, days.length), y: top(day.emotionLevel) })
  })
  if (run.length) result.push(run)
  return result
}

export function MoodChart({ days }: Readonly<{ days: readonly Day[] }>) {
  const half = days.length / 2
  const first = days[0].localDate
  const middle = days[half - 1].localDate
  const second = days[half].localDate
  const last = days[days.length - 1].localDate

  return (
    <div className={styles.chart}>
      <div className={styles.axis} aria-hidden="true">
        <div style={{ top: `${top(5)}%` }}>
          {emotionPresentation.GREAT.label}
        </div>
        <div style={{ top: `${top(1)}%` }}>
          {emotionPresentation.VERY_LOW.label}
        </div>
      </div>
      <div
        className={styles.plot}
        role="img"
        aria-label="Biểu đồ cảm xúc ghi nhận trong 14 ngày, chia làm hai tuần. Danh sách từng ngày nằm ngay bên dưới."
      >
        <div className={styles.tint} />
        <svg
          className={styles.line}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {[1, 2, 3, 4, 5].map((level) => (
            <line
              key={level}
              className={styles.grid}
              x1="0"
              x2="100"
              y1={top(level)}
              y2={top(level)}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {runs(days)
            .filter((run) => run.length > 1)
            .map((run) => (
              <polyline
                key={run[0].x}
                points={run.map(({ x, y }) => `${x},${y}`).join(' ')}
                vectorEffect="non-scaling-stroke"
              />
            ))}
        </svg>
        {days.map((day, index) =>
          day.emotionLevel === null ? null : (
            <div
              key={day.localDate}
              className={styles.dot}
              style={
                {
                  left: `${left(index, days.length)}%`,
                  top: `${top(day.emotionLevel)}%`,
                  '--i': index,
                  '--c':
                    emotionPresentation[moodLabel(day.emotionLevel).key].color,
                } as CSSProperties
              }
            />
          ),
        )}
      </div>
      <div className={styles.weeks}>
        <div>
          Tuần 1 · {dayMonth(first)}–{dayMonth(middle)}
        </div>
        <div>
          Tuần 2 · {dayMonth(second)}–{dayMonth(last)}
        </div>
      </div>
      <div className={styles.scale}>
        {emotionPresentation.VERY_LOW.label} → {emotionPresentation.GREAT.label}
      </div>
      <ul className="sr-only">
        {days.map((day) =>
          day.emotionLevel === null ? null : (
            <li key={day.localDate}>
              {dayMonth(day.localDate)}: {moodLabel(day.emotionLevel).label}
            </li>
          ),
        )}
      </ul>
    </div>
  )
}
