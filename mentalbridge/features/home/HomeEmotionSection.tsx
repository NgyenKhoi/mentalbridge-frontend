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
import type { Emotion, EmotionCheckIn } from '@/lib/emotion-check-in/contract'
import { emotionPresentation } from '@/lib/emotion-check-in/presentation'
import { homeEmotionWeek } from './emotion-week'
import styles from './HomeEmotionSection.module.css'

const dailyMessages: Record<Emotion, { title: string; body: string }> = {
  GREAT: {
    title: 'Một khoảnh khắc đáng trân trọng',
    body: 'Điều gì đã làm ngày hôm nay của bạn thật vui? Bạn có thể giữ lại khoảnh khắc ấy bằng vài dòng để đọc lại khi muốn.',
  },
  GOOD: {
    title: 'Dành chỗ cho những điều đang tốt',
    body: 'Một niềm vui nhỏ cũng đáng được ghi nhớ. Nếu muốn, hãy viết lại điều đã khiến hôm nay dễ chịu hơn với bạn.',
  },
  OKAY: {
    title: 'Cứ đi theo nhịp của bạn',
    body: 'Những ngày bình thường cũng có câu chuyện riêng. Bạn có thể dành một chút thời gian để nhìn lại điều đang ở trong tâm trí mình.',
  },
  LOW: {
    title: 'Hôm nay, hãy nhẹ nhàng với mình',
    body: 'Bạn không cần làm mọi thứ cùng lúc. Nếu muốn, hãy cho mình một khoảng nghỉ, viết vài dòng hoặc trò chuyện với người bạn tin tưởng.',
  },
  VERY_LOW: {
    title: 'Bạn không cần gồng mình một mình',
    body: 'Cảm ơn bạn đã dành thời gian lắng nghe cảm xúc của mình. Bạn có thể viết ra điều đang nặng lòng hoặc tìm một người tin tưởng để chia sẻ, khi sẵn sàng.',
  },
}

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
  const today = days?.[6]?.emotion
  const message = today ? dailyMessages[today] : null
  const recordedDays = days?.filter((day) => day.emotion).length ?? 0

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
          <div
            className={styles.encouragement}
            aria-live="polite"
            aria-atomic="true"
          >
            <div className={styles.messageLabel}>
              <span>Một lời nhắn cho bạn</span>
              {today && (
                <span className={styles.emotionLabel}>
                  Hôm nay: {emotionPresentation[today].label}
                </span>
              )}
            </div>
            <h3>{message?.title ?? 'Dành một phút để lắng nghe mình'}</h3>
            <p>
              {message?.body ??
                'Bạn đang cảm thấy thế nào? Khi bạn lưu cảm xúc hôm nay, một lời nhắn dành cho cảm xúc ấy sẽ xuất hiện ở đây.'}
            </p>
            {today && (
              <Link href="/journal" className={styles.journalLink}>
                Viết vài dòng cho mình <span aria-hidden="true">→</span>
              </Link>
            )}
            <p className={styles.recordedDays}>
              {recordedDays > 0
                ? `Bạn đã dành thời gian ghi nhận cảm xúc ${recordedDays}/7 ngày gần đây.`
                : 'Bạn có thể bắt đầu từ hôm nay, theo nhịp của mình.'}
            </p>
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
