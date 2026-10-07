'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type {
  Emotion,
  EmotionCheckIn,
  EmotionCheckInProgress,
} from '@/lib/emotion-check-in/contract'
import {
  getEmotionCheckInProgress,
  listEmotionCheckIns,
} from './api/browser-emotion-check-in'
import styles from './EmotionProgress.module.css'

const emotionCopy: Record<
  Emotion,
  { emoji: string; label: string; color: string }
> = {
  GREAT: { emoji: '😄', label: 'Rất tốt', color: '#1e4a43' },
  GOOD: { emoji: '😊', label: 'Tốt', color: '#5ca88f' },
  OKAY: { emoji: '😌', label: 'Bình thường', color: '#a0aba5' },
  LOW: { emoji: '🥱', label: 'Không tốt', color: '#e5a842' },
  VERY_LOW: { emoji: '😟', label: 'Rất không tốt', color: '#d9534f' },
}

const weekdayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

type State =
  | { phase: 'loading' }
  | { phase: 'error' }
  | {
      phase: 'ready'
      progress: EmotionCheckInProgress
      history: EmotionCheckIn[]
    }

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})

const displayDate = (localDate: string) =>
  dateFormatter.format(new Date(`${localDate}T00:00:00.000Z`))

interface CalendarCell {
  dateStr: string
  dayNumber: number
  isToday: boolean
  isFuture: boolean
  checkIn?: EmotionCheckIn
}

function computeCalendarCells(
  asOfDateStr: string,
  historyMap: Map<string, EmotionCheckIn>,
): CalendarCell[] {
  const parts = asOfDateStr.split('-').map(Number)
  const y = parts[0] ?? 2026
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  const ref = new Date(Date.UTC(y, m - 1, d))
  const dayOfWeek = ref.getUTCDay()
  const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek

  // Monday of the current week (Row 5)
  const currentMonday = new Date(ref.getTime() - (isoDay - 1) * 86400000)
  // Monday 4 weeks ago (Row 1)
  const startMonday = new Date(currentMonday.getTime() - 28 * 86400000)

  const cells: CalendarCell[] = []
  for (let i = 0; i < 35; i++) {
    const cellDate = new Date(startMonday.getTime() + i * 86400000)
    const dateStr = cellDate.toISOString().slice(0, 10)
    const isToday = dateStr === asOfDateStr
    const isFuture = cellDate > ref
    cells.push({
      dateStr,
      dayNumber: cellDate.getUTCDate(),
      isToday,
      isFuture,
      checkIn: historyMap.get(dateStr),
    })
  }
  return cells
}

export function EmotionProgress({
  refreshKey = 0,
}: Readonly<{ refreshKey?: number }>) {
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    [],
  )
  const [retry, setRetry] = useState(0)
  const [state, setState] = useState<State>({ phase: 'loading' })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([getEmotionCheckInProgress(timezone), listEmotionCheckIns(30)])
      .then(([progress, history]) => {
        if (active) {
          setState({ phase: 'ready', progress, history: history.items })
        }
      })
      .catch(() => {
        if (active) setState({ phase: 'error' })
      })
    return () => {
      active = false
    }
  }, [refreshKey, retry, timezone])

  const historyMap = useMemo(() => {
    const map = new Map<string, EmotionCheckIn>()
    if (state.phase === 'ready') {
      for (const item of state.history) {
        map.set(item.localDate, item)
      }
    }
    return map
  }, [state])

  const asOfDateStr = useMemo(() => {
    if (state.phase === 'ready' && state.progress.asOfLocalDate) {
      return state.progress.asOfLocalDate
    }
    return new Date().toISOString().slice(0, 10)
  }, [state])

  const calendarCells = useMemo(() => {
    return computeCalendarCells(asOfDateStr, historyMap)
  }, [asOfDateStr, historyMap])

  // Select today or the latest available checkin by default
  const activeDate = selectedDate ?? asOfDateStr
  const activeCell = calendarCells.find((c) => c.dateStr === activeDate)
  const activeCheckIn = historyMap.get(activeDate)

  if (state.phase === 'loading') {
    return (
      <div className={styles.card} aria-busy="true">
        <header className={styles.heading}>
          <div>
            <h2 className={styles.title}>Nhìn lại cảm xúc</h2>
            <p className={styles.subtitle}>Đang tải lịch sử cảm xúc…</p>
          </div>
          <span className={styles.clockBadge} aria-hidden="true">
            ◷
          </span>
        </header>
        <div className={styles.skeletonContainer}>
          <div className={styles.skeletonTop} />
          <div className={styles.skeletonGrid} />
          <div className={styles.skeletonDetail} />
        </div>
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className={styles.card}>
        <header className={styles.heading}>
          <div>
            <h2 className={styles.title}>Nhìn lại cảm xúc</h2>
          </div>
          <span className={styles.clockBadge} aria-hidden="true">
            ◷
          </span>
        </header>
        <div className={styles.error} role="alert">
          <p>Lịch sử cảm xúc tạm thời chưa tải được.</p>
          <button
            type="button"
            onClick={() => {
              setState({ phase: 'loading' })
              setRetry((value) => value + 1)
            }}
          >
            Thử lại
          </button>
        </div>
      </div>
    )
  }

  const empty = state.history.length === 0
  const win7 = state.progress.windows?.find((item) => item.days === 7) ?? {
    checkedInDays: 0,
    totalDays: 7,
  }

  // SVG Progress Ring calculations (radius = 28, circumference ~ 175.93)
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const progressRatio =
    win7.totalDays > 0
      ? Math.min(1, Math.max(0, win7.checkedInDays / win7.totalDays))
      : 0
  const strokeDashoffset = circumference * (1 - progressRatio)

  return (
    <div className={styles.card}>
      {/* Header */}
      <header className={styles.heading}>
        <div>
          <h2 className={styles.title}>Nhìn lại cảm xúc</h2>
          <p className={styles.subtitle}>
            Các con số chỉ phản ánh những ngày bạn đã tự ghi nhận.
          </p>
        </div>
        <span className={styles.clockBadge} aria-hidden="true">
          ◷
        </span>
      </header>

      {/* Top block: Progress ring on left + Vertical Streaks on right */}
      <div className={styles.topSection}>
        <div className={styles.progressRingWrapper}>
          <svg
            className={styles.progressSvg}
            viewBox="0 0 68 68"
            width="68"
            height="68"
            aria-hidden="true"
          >
            <circle
              className={styles.progressTrack}
              cx="34"
              cy="34"
              r={radius}
            />
            <circle
              className={styles.progressBar}
              cx="34"
              cy="34"
              r={radius}
              style={{
                strokeDasharray: circumference,
                strokeDashoffset,
              }}
            />
          </svg>
          <div className={styles.progressCenter}>
            <span className={styles.progressFraction}>
              {win7.checkedInDays}/{win7.totalDays}
            </span>
            <span className={styles.progressUnit}>ngày</span>
          </div>
        </div>

        <dl className={styles.streaks} aria-label="Số ngày ghi nhận liên tiếp">
          <div className={styles.streakItem}>
            <dt className={styles.streakLabel}>Chuỗi hiện tại</dt>
            <dd className={styles.streakValue}>
              {state.progress.currentStreak === 0 && empty ? (
                <span className={styles.streakEmpty}>Chưa bắt đầu</span>
              ) : (
                `${state.progress.currentStreak} ngày`
              )}
            </dd>
          </div>
          <div className={styles.streakItem}>
            <dt className={styles.streakLabel}>Chuỗi dài nhất</dt>
            <dd className={styles.streakValue}>
              {state.progress.longestStreak === 0 && empty ? (
                <span className={styles.streakEmpty}>Chưa bắt đầu</span>
              ) : (
                `${state.progress.longestStreak} ngày`
              )}
            </dd>
          </div>
        </dl>
      </div>

      {/* Middle block: 5-week x 7-column calendar heat grid */}
      <section
        className={styles.calendarSection}
        aria-labelledby="calendar-heatmap-title"
      >
        <h3 id="calendar-heatmap-title" className={styles.srOnly}>
          Lịch ghi nhận cảm xúc 5 tuần gần nhất
        </h3>

        <div className={styles.weekdayHeader}>
          {weekdayLabels.map((label) => (
            <span key={label} className={styles.weekdayLabel}>
              {label}
            </span>
          ))}
        </div>

        <div className={styles.calendarGrid} role="grid">
          {calendarCells.map((cell, index) => {
            const hasCheckIn = Boolean(cell.checkIn)
            const isSelected = cell.dateStr === activeDate
            const emotionDetails = cell.checkIn
              ? emotionCopy[cell.checkIn.emotion]
              : null

            let cellTitle = `${displayDate(cell.dateStr)}`
            if (cell.isToday) cellTitle += ' (Hôm nay)'
            if (emotionDetails && cell.checkIn) {
              cellTitle += `: ${emotionDetails.label}, Cường độ ${cell.checkIn.intensity}/5`
            } else if (cell.isFuture) {
              cellTitle += ' (Chưa đến)'
            } else {
              cellTitle += ' (Chưa ghi nhận)'
            }

            return (
              <button
                key={cell.dateStr}
                type="button"
                className={`${styles.calendarCell} ${
                  cell.isToday ? styles.cellToday : ''
                } ${cell.isFuture ? styles.cellFuture : ''} ${
                  hasCheckIn ? styles.cellRecorded : styles.cellEmpty
                } ${isSelected ? styles.cellSelected : ''}`}
                style={
                  {
                    '--cell-delay': `${index * 20}ms`,
                    '--emotion-color': emotionDetails?.color,
                  } as React.CSSProperties
                }
                disabled={cell.isFuture}
                title={cellTitle}
                aria-label={cellTitle}
                aria-pressed={isSelected}
                onClick={() => setSelectedDate(cell.dateStr)}
              >
                <span className={styles.cellDayNumber}>{cell.dayNumber}</span>
                {emotionDetails ? (
                  <span className={styles.cellEmoji} aria-hidden="true">
                    {emotionDetails.emoji}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        {/* 5-color legend */}
        <div className={styles.legendRow} aria-label="Chú giải các mức cảm xúc">
          {(Object.keys(emotionCopy) as Emotion[]).map((emotionKey) => (
            <div key={emotionKey} className={styles.legendItem}>
              <span
                className={styles.legendDot}
                style={{ backgroundColor: emotionCopy[emotionKey].color }}
                aria-hidden="true"
              />
              <span className={styles.legendLabel}>
                {emotionCopy[emotionKey].label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom block: Selected Day Detail Box */}
      <div
        key={activeDate}
        className={styles.detailBox}
        role="region"
        aria-label="Chi tiết ngày được chọn"
      >
        <div className={styles.detailHeader}>
          <span className={styles.detailDate}>
            {displayDate(activeDate)}
            {activeCell?.isToday ? ' • Hôm nay' : ''}
          </span>
          <Link href="/journal" className={styles.journalLink}>
            Xem nhật ký →
          </Link>
        </div>

        {activeCheckIn ? (
          <div className={styles.detailContent}>
            <span className={styles.detailEmoji} aria-hidden="true">
              {emotionCopy[activeCheckIn.emotion].emoji}
            </span>
            <div className={styles.detailInfo}>
              <strong className={styles.detailEmotionName}>
                {emotionCopy[activeCheckIn.emotion].label}
              </strong>
              <span className={styles.detailIntensity}>
                Cường độ {activeCheckIn.intensity}/5
              </span>
            </div>
          </div>
        ) : (
          <div className={styles.detailContentEmpty}>
            <span className={styles.detailEmptyText}>
              {activeCell?.isFuture
                ? 'Ngày này chưa diễn ra.'
                : 'Chưa có ghi nhận cho ngày này.'}
            </span>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className={styles.disclaimer}>
        Đây không phải chẩn đoán, đánh giá tiến bộ hay mức độ hồi phục.
      </p>
    </div>
  )
}

export default EmotionProgress
