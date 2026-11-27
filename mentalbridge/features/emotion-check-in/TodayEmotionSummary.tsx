'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError } from '@/lib/api/api-error'
import type { EmotionCheckIn } from '@/lib/emotion-check-in/contract'
import {
  emotionPresentation,
  formatEmotionLocalDate,
  localDateInTimeZone,
} from '@/lib/emotion-check-in/presentation'
import { getEmotionCheckIn } from './api/browser-emotion-check-in'
import styles from './TodayEmotionSummary.module.css'

type State =
  | { phase: 'loading' }
  | { phase: 'empty' }
  | { phase: 'error' }
  | { phase: 'ready'; checkIn: EmotionCheckIn }

export function TodayEmotionSummary() {
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    [],
  )
  const [reload, setReload] = useState(0)
  const [state, setState] = useState<State>({ phase: 'loading' })

  const refresh = useCallback(() => {
    setState({ phase: 'loading' })
    setReload((value) => value + 1)
  }, [])

  useEffect(() => {
    let active = true
    const date = localDateInTimeZone(new Date(), timezone)
    void getEmotionCheckIn(date)
      .then((checkIn) => {
        if (active) setState({ phase: 'ready', checkIn })
      })
      .catch((error: unknown) => {
        if (!active) return
        setState(
          error instanceof ApiError && error.status === 404
            ? { phase: 'empty' }
            : { phase: 'error' },
        )
      })
    return () => {
      active = false
    }
  }, [reload, timezone])

  useEffect(() => {
    window.addEventListener('mb:emotion-check-in-updated', refresh)
    return () =>
      window.removeEventListener('mb:emotion-check-in-updated', refresh)
  }, [refresh])

  return (
    <section className={styles.card} aria-labelledby="today-emotion-title">
      <div className={styles.heading}>
        <h2 id="today-emotion-title">Cảm xúc đã ghi hôm nay</h2>
        <Link href="/dashboard#emotion-check-in">
          {state.phase === 'ready' ? 'Cập nhật' : 'Ghi lại'}
        </Link>
      </div>

      {state.phase === 'loading' ? (
        <p className={styles.state} role="status" aria-busy="true">
          Đang xác nhận ghi nhận hôm nay…
        </p>
      ) : state.phase === 'error' ? (
        <div className={styles.state} role="alert">
          <p>Chưa thể xác nhận ghi nhận hôm nay.</p>
          <button type="button" onClick={refresh}>
            Thử lại
          </button>
        </div>
      ) : state.phase === 'empty' ? (
        <p className={styles.state} role="status">
          Hôm nay chưa có ghi nhận cảm xúc.
        </p>
      ) : (
        <div className={styles.record}>
          <span className={styles.emoji} aria-hidden="true">
            {emotionPresentation[state.checkIn.emotion].emoji}
          </span>
          <div>
            <strong>{emotionPresentation[state.checkIn.emotion].label}</strong>
            <span>Mức cảm nhận {state.checkIn.intensity}/5</span>
            <small>
              {formatEmotionLocalDate(state.checkIn.localDate)} · Múi giờ{' '}
              {state.checkIn.timezone}
            </small>
          </div>
        </div>
      )}
      <p className={styles.note}>Dữ liệu từ ghi nhận cảm xúc trong Nhật ký.</p>
    </section>
  )
}
