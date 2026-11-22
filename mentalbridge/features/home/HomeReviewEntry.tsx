'use client'

import { History } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useId, useState } from 'react'

import { listReassessmentSummaries } from '@/features/assessment/api/browser-care'

import styles from './HomeReviewEntry.module.css'

/**
 * Entry to the latest review. It appears only when the owner has a saved review, not when the newest
 * screening happened to be a reassessment. HomeHub does not render it on the safety Home (a deliberate
 * decision: the safety presentation comes first).
 */
export function HomeReviewEntry({
  onResolved,
}: Readonly<{ onResolved?: (exists: boolean) => void }> = {}) {
  const id = useId()
  const [exists, setExists] = useState(false)

  useEffect(() => {
    let active = true
    listReassessmentSummaries(1)
      .then((page) => {
        if (!active) return
        setExists(page.items.length > 0)
        onResolved?.(page.items.length > 0)
      })
      .catch(() => active && onResolved?.(false))
    return () => {
      active = false
    }
  }, [onResolved])

  if (!exists) return null
  return (
    <Link
      className={styles.entry}
      href="/assessments?tab=reassessment"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-line`}
    >
      <div className={styles.icon}>
        <History aria-hidden="true" size={22} />
      </div>
      <div className={styles.copy}>
        <div className={styles.title} id={`${id}-title`}>
          Nhìn lại 14 ngày vừa qua
        </div>
        <div className={styles.line} id={`${id}-line`}>
          Điều bạn đã chia sẻ và đã làm trong hai kỳ gần nhất, đặt cạnh nhau.
        </div>
      </div>
      <div className={styles.go}>
        Xem nhìn lại <span aria-hidden="true">→</span>
      </div>
    </Link>
  )
}
