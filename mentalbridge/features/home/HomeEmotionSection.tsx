'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { Sun } from 'lucide-react'
import { PlanEmotionCheckIn } from '@/features/emotion-check-in/PlanEmotionCheckIn'
import { MoodFace } from '@/features/emotion-check-in/MoodFace'
import {
  getEmotionCheckInProgress,
  listEmotionCheckIns,
} from '@/features/emotion-check-in/api/browser-emotion-check-in'
import type { EmotionCheckIn } from '@/lib/emotion-check-in/contract'
import { emotionPresentation } from '@/lib/emotion-check-in/presentation'
import { homeEmotionWeek } from './emotion-week'
import styles from './HomeEmotionSection.module.css'

type WeekState =
  | { phase: 'loading' }
  | { phase: 'error' }
  | {
      phase: 'ready'
      localDate: string
      records: readonly EmotionCheckIn[]
      refreshed: boolean
    }

export function HomeEmotionWeek({
  motionOff = false,
}: Readonly<{ motionOff?: boolean }>) {
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    [],
  )
  const [state, setState] = useState<WeekState>({ phase: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    let latestRequest = 0
    async function load(refreshed = false) {
      const request = ++latestRequest
      try {
        const [progress, list] = await Promise.all([
          getEmotionCheckInProgress(timezone),
          listEmotionCheckIns(7),
        ])
        if (active && request === latestRequest)
          setState({
            phase: 'ready',
            localDate: progress.asOfLocalDate,
            records: list.items,
            refreshed,
          })
      } catch {
        if (active && request === latestRequest) setState({ phase: 'error' })
      }
    }
    const refresh = () => {
      void load(true)
    }
    void load()
    window.addEventListener('mb:emotion-check-in-updated', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      active = false
      window.removeEventListener('mb:emotion-check-in-updated', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [attempt, timezone])

  const days =
    state.phase === 'ready'
      ? homeEmotionWeek(state.localDate, state.records)
      : null
  const yesterday = days?.[5]?.emotion

  return (
    <section
      className={styles.week}
      aria-labelledby="home-emotion-week-title"
      aria-busy={state.phase === 'loading'}
      data-testid="home-emotion-week"
      data-motion-off={motionOff}
    >
      <div className={styles.heading}>
        <h2 id="home-emotion-week-title">Tuần này của bạn</h2>
        <Link href="/analytics">Xem tiến độ →</Link>
      </div>
      {state.phase === 'loading' ? (
        <div
          className={styles.weekLoading}
          role="status"
          aria-label="Đang tải cảm xúc 7 ngày gần đây"
        >
          <div className={styles.skeletonDays} aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => (
              <div key={index} className={styles.skeletonDay}>
                <div className={styles.skeletonCircle} />
                <div className={styles.skeletonDayLabel} />
              </div>
            ))}
          </div>
          <div className={styles.skeletonNote} aria-hidden="true" />
        </div>
      ) : state.phase === 'error' ? (
        <div className={styles.error} role="alert">
          <p>Chưa tải được cảm xúc tuần này.</p>
          <button
            type="button"
            onClick={() => {
              setState({ phase: 'loading' })
              setAttempt((value) => value + 1)
            }}
          >
            Thử lại
          </button>
        </div>
      ) : days ? (
        <>
          <ol className={styles.days} aria-label="Cảm xúc 7 ngày gần đây">
            {days.map((day, index) => (
              <li
                key={day.localDate}
                className={day.today ? styles.today : ''}
                aria-label={`${day.localDate}${day.today ? ' · Hôm nay' : ''}: ${day.emotion ? emotionPresentation[day.emotion].label : 'Chưa ghi nhận'}`}
              >
                <div
                  key={`${day.localDate}:${day.emotion ?? 'empty'}`}
                  className={`${styles.circle} ${day.emotion ? '' : styles.empty} ${day.today && state.refreshed && day.emotion ? styles.drop : styles.pop}`}
                  style={{
                    animationDelay: `${day.today && state.refreshed ? 0 : 240 + index * 40}ms`,
                  }}
                >
                  {day.emotion ? (
                    <MoodFace emotion={day.emotion} size={40} />
                  ) : null}
                </div>
                <div className={styles.dayLabel}>{day.label}</div>
              </li>
            ))}
          </ol>
          <div className={styles.note}>
            <Sun size={18} aria-hidden="true" />
            <div>
              {yesterday ? (
                <>
                  Hôm qua bạn chọn <b>{emotionPresentation[yesterday].label}</b>
                  .{' '}
                </>
              ) : (
                'Hôm qua chưa có ghi nhận. '
              )}
              Ngày trống chỉ là ngày chưa ghi.
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}

export function HomeEmotionSection({
  onPersisted,
  motionOff = false,
}: Readonly<{ onPersisted?: () => void; motionOff?: boolean }>) {
  const reducedMotion = useReducedMotion()
  return (
    <motion.section
      className={styles.section}
      aria-label="Cảm xúc"
      layout={!reducedMotion && !motionOff}
      initial={false}
      transition={{ layout: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
    >
      <div className={styles.checkIn}>
        <PlanEmotionCheckIn onPersisted={onPersisted} />
      </div>
      <HomeEmotionWeek motionOff={motionOff} />
    </motion.section>
  )
}
