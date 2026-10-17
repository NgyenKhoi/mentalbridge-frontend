'use client'

import { useCallback, useEffect, useState } from 'react'
import { getSupportPlanActionOccurrences } from '../api/browser-support-plan-actions'
import type { ActionOccurrence } from '../api/support-plan-contract'
import styles from './SupportPlanFortnight.module.css'

function dateAfter(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function dayLabel(date: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

export default function SupportPlanFortnight({
  startDate,
  supportPlanId,
  onSelectDay,
}: Readonly<{
  startDate: string
  supportPlanId: string
  onSelectDay: (date: string) => void
}>) {
  const [occurrences, setOccurrences] = useState<ActionOccurrence[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const dates = Array.from({ length: 14 }, (_, index) =>
    dateAfter(startDate, index),
  )
  const through = dates[13]

  const reload = useCallback(() => setReloadKey((value) => value + 1), [])

  useEffect(() => {
    let active = true
    getSupportPlanActionOccurrences(startDate, through)
      .then((result) => {
        if (!active) return
        if (
          result.supportPlanId !== supportPlanId ||
          result.representationMode !== 'NATIVE_V3'
        ) {
          setState('error')
          return
        }
        setOccurrences(result.occurrences)
        setState('ready')
      })
      .catch(() => {
        if (active) setState('error')
      })
    return () => {
      active = false
    }
  }, [reloadKey, startDate, supportPlanId, through])

  return (
    <section
      className={styles.panel}
      aria-labelledby="support-plan-fortnight-title"
    >
      <header className={styles.header}>
        <div>
          <span>Hành trình theo kế hoạch hiện tại</span>
          <h3 id="support-plan-fortnight-title">14 ngày từ hôm nay</h3>
          <p>
            Các ô thể hiện hoạt động đã xếp lịch và ghi nhận của chính bạn,
            không phải điểm đánh giá sức khỏe.
          </p>
        </div>
        {state === 'error' && (
          <button type="button" onClick={reload}>
            Tải lại
          </button>
        )}
      </header>
      {state === 'loading' && <p role="status">Đang tải hành trình…</p>}
      {state === 'error' && (
        <p role="alert">Chưa tải được hoạt động của 14 ngày này.</p>
      )}
      {state === 'ready' && (
        <div className={styles.days}>
          {dates.map((date, index) => {
            const activities = occurrences.filter(
              (item) => item.localDate === date && item.state !== 'CANCELLED',
            )
            const completed = activities.filter(
              (item) => item.state === 'COMPLETED',
            ).length
            return (
              <button
                type="button"
                key={date}
                className={styles.day}
                onClick={() => onSelectDay(date)}
                aria-label={`Ngày ${index + 1}, ${dayLabel(date)}: ${completed} trên ${activities.length} hoạt động đã ghi nhận. Xem hoạt động ngày này`}
              >
                <small>Ngày {index + 1}</small>
                <strong>{dayLabel(date)}</strong>
                <span>
                  {activities.length === 0
                    ? 'Chưa xếp lịch'
                    : `${completed}/${activities.length} đã ghi nhận`}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
