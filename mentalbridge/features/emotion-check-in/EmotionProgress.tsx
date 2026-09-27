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
      <article className={`ref-card ref-trend ${styles.card}`} aria-busy="true">
        <h2>Nhìn lại cảm xúc</h2>
        <p role="status">Đang tải lịch sử cảm xúc…</p>
      </article>
    )

  if (state.phase === 'error')
    return (
      <article className={`ref-card ref-trend ${styles.card}`}>
        <h2>Nhìn lại cảm xúc</h2>
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
      </article>
    )

  const window = state.progress.windows.find((item) => item.days === period)
  if (!window) return null
  const empty = state.history.length === 0

  return (
    <article className={`ref-card ref-trend ${styles.card}`}>
      <header className={styles.heading}>
        <div>
          <h2>Nhìn lại cảm xúc</h2>
          <p>Các con số chỉ phản ánh những ngày bạn đã tự ghi nhận.</p>
        </div>
        <span aria-hidden="true">◷</span>
      </header>

      <dl className={styles.streaks} aria-label="Số ngày ghi nhận liên tiếp">
        <div>
          <dt>Chuỗi hiện tại</dt>
          <dd>{state.progress.currentStreak} ngày</dd>
        </div>
        <div>
          <dt>Chuỗi dài nhất</dt>
          <dd>{state.progress.longestStreak} ngày</dd>
        </div>
      </dl>

      <div className={styles.periods} aria-label="Khoảng thời gian">
        {periods.map((days) => (
          <button
            key={days}
            type="button"
            aria-pressed={period === days}
            onClick={() => setPeriod(days)}
          >
            {days} ngày
          </button>
        ))}
      </div>

      <section
        className={styles.coverage}
        aria-labelledby="emotion-coverage-title"
      >
        <h3 id="emotion-coverage-title">
          Đã ghi nhận {window.checkedInDays}/{window.totalDays} ngày
        </h3>
        {window.checkedInDays === 0 ? (
          <p>Chưa có ghi nhận trong khoảng thời gian này.</p>
        ) : (
          <ul>
            {(Object.keys(emotionCopy) as Emotion[]).map((emotion) => {
              const count = window.distribution[emotion]
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
                    aria-valuemax={window.checkedInDays}
                    aria-valuenow={count}
                  >
                    <i
                      style={{
                        width: `${String((count / window.checkedInDays) * 100)}%`,
                      }}
                    />
                  </div>
                  <b>{count}</b>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section
        className={styles.history}
        aria-labelledby="emotion-history-title"
      >
        <h3 id="emotion-history-title">Lịch sử gần đây</h3>
        {empty ? (
          <p>
            Chưa có ngày nào được ghi nhận. Lịch sử sẽ xuất hiện sau lần lưu đầu
            tiên.
          </p>
        ) : (
          <ol>
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
    </article>
  )
}
