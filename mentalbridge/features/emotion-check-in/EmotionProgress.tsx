'use client'

import { useEffect, useMemo, useState } from 'react'
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

const emotionCopy: Record<Emotion, { emoji: string; label: string }> = {
  GREAT: { emoji: '😄', label: 'Rất tốt' },
  GOOD: { emoji: '😊', label: 'Tốt' },
  OKAY: { emoji: '😌', label: 'Bình thường' },
  LOW: { emoji: '🥱', label: 'Không tốt' },
  VERY_LOW: { emoji: '😟', label: 'Rất không tốt' },
}
const periods = [7, 14, 30] as const
type Period = (typeof periods)[number]
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

export function EmotionProgress({
  refreshKey = 0,
}: Readonly<{ refreshKey?: number }>) {
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    [],
  )
  const [period, setPeriod] = useState<Period>(7)
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
  }, [refreshKey, retry, timezone])

  if (state.phase === 'loading')
    return (
      <div className={styles.card} aria-busy="true">
        <header className={styles.heading}>
          <h2 className={styles.title}>Nhìn lại cảm xúc</h2>
          <p className={styles.subtitle}>Đang tải lịch sử cảm xúc…</p>
        </header>
      </div>
    )

  if (state.phase === 'error')
    return (
      <div className={styles.card}>
        <header className={styles.heading}>
          <h2 className={styles.title}>Nhìn lại cảm xúc</h2>
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

  const win = state.progress.windows.find((item) => item.days === period)
  if (!win) return null
  const empty = state.history.length === 0
  const pct = win.totalDays > 0 ? (win.checkedInDays / win.totalDays) * 100 : 0

  return (
    <div className={styles.card}>
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

      {/* 2 số liệu Chuỗi: rút ngắn khoảng cách giữa label và giá trị, gắn kết như một cụm */}
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

      {/* 3 tab thời gian: pill-segment */}
      <div className={styles.periods} aria-label="Khoảng thời gian">
        {periods.map((days) => (
          <button
            key={days}
            type="button"
            aria-pressed={period === days}
            onClick={() => setPeriod(days)}
          >
            {`${days} ngày`}
          </button>
        ))}
      </div>

      {/* Coverage & progress bar */}
      <section
        className={styles.coverage}
        aria-labelledby="emotion-coverage-title"
      >
        <div className={styles.coverageHeader}>
          <h3 id="emotion-coverage-title">
            Đã ghi nhận {win.checkedInDays}/{win.totalDays} ngày
          </h3>
          <div className={styles.progressBar}>
            <div style={{ width: `${pct}%` }} />
          </div>
        </div>

        {win.checkedInDays === 0 && !empty ? (
          <p className={styles.emptyPeriodText}>
            Chưa có ghi nhận trong khoảng thời gian này.
          </p>
        ) : null}

        {!empty && win.checkedInDays > 0 ? (
          <ul className={styles.distributionList}>
            {(Object.keys(emotionCopy) as Emotion[]).map((emotion) => {
              const count = win.distribution[emotion]
              return (
                <li key={emotion}>
                  <span>
                    <i aria-hidden="true">{emotionCopy[emotion].emoji}</i>
                    {emotionCopy[emotion].label}
                  </span>
                  <div
                    role="meter"
                    aria-label={`${emotionCopy[emotion].label}: ${count} ngày`}
                    aria-valuemin={0}
                    aria-valuemax={win.checkedInDays}
                    aria-valuenow={count}
                  >
                    <i
                      style={{
                        width: `${String((count / Math.max(win.checkedInDays, 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <b>{count}</b>
                </li>
              )
            })}
          </ul>
        ) : null}
      </section>

      {/* History section / Empty state: gộp 2 đoạn text thành 1 câu ngắn gọn */}
      <section
        className={styles.history}
        aria-labelledby="emotion-history-title"
      >
        <h3
          id="emotion-history-title"
          className={empty ? styles.srOnly : styles.historyTitle}
        >
          Lịch sử gần đây
        </h3>
        {empty ? (
          <p className={styles.emptyCombinedNote}>
            <span>Chưa có ghi nhận trong khoảng thời gian này.</span>{' '}
            <span>Lịch sử sẽ xuất hiện sau lần lưu đầu tiên.</span>
          </p>
        ) : (
          <ol className={styles.historyList}>
            {state.history.map((item) => (
              <li key={item.id}>
                <time dateTime={item.localDate}>
                  {displayDate(item.localDate)}
                </time>
                <span>
                  <i aria-hidden="true">{emotionCopy[item.emotion].emoji}</i>
                  {emotionCopy[item.emotion].label}
                </span>
                <small>Mức cảm nhận {item.intensity}/5</small>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className={styles.disclaimer}>
        Đây không phải chẩn đoán, đánh giá tiến bộ hay mức độ hồi phục.
      </p>
    </div>
  )
}
