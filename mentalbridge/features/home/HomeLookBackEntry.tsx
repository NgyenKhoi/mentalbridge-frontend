'use client'

import { CalendarRange } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useId, useState } from 'react'

import { getAnalyticsEvents } from '@/features/analytics/api/browser-analytics'
import { narrativeOfDashboard } from '@/features/look-back/look-back-model'

import styles from './HomeReviewEntry.module.css'

/** Quiet entry to the 14-day journey; it appears only when the page has something to say (not SPARSE, mood readable). */
export function HomeLookBackEntry() {
  const id = useId()
  const [enough, setEnough] = useState(false)

  useEffect(() => {
    let active = true
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    getAnalyticsEvents(30, timezone)
      .then((dashboard) => {
        if (active)
          setEnough(
            ['IMPROVING', 'STEADY', 'HARDER'].includes(
              narrativeOfDashboard(dashboard),
            ),
          )
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  if (!enough) return null
  return (
    <Link
      className={styles.entry}
      href="/nhin-lai"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-line`}
    >
      <div className={styles.icon}>
        <CalendarRange aria-hidden="true" size={22} />
      </div>
      <div className={styles.copy}>
        <div className={styles.title} id={`${id}-title`}>
          Hành trình 14 ngày
        </div>
        <div className={styles.line} id={`${id}-line`}>
          Cảm xúc và những việc bạn đã làm, đặt cạnh nhau.
        </div>
      </div>
      <div className={styles.go}>
        Xem <span aria-hidden="true">→</span>
      </div>
    </Link>
  )
}
