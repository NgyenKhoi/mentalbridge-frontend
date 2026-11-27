'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { ApiError } from '@/lib/api/api-error'
import type { ReusableSessionSummary } from '@/lib/consultation/session-summary-validation'
import { sessionSummaryBrowserClient } from '../api/session-summary-browser-client'
import { STEP_LABELS, SummaryContent } from './SessionSummaryPanel'
import styles from './PriorSessionSummaries.module.css'

const VN_ZONE = 'Asia/Ho_Chi_Minh'
const sessionDate = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeZone: VN_ZONE,
})

type Load =
  | { state: 'loading' }
  | { state: 'ready'; items: ReusableSessionSummary[] }
  | { state: 'closed' }
  | { state: 'error' }

/** Earlier session summaries the user approved for reuse, shown to the specialist of a later active appointment. */
export function PriorSessionSummaries({
  appointmentId,
}: {
  appointmentId: string
}) {
  const headingId = useId()
  const [load, setLoad] = useState<Load>({ state: 'loading' })

  const fetchItems = useCallback(async () => {
    setLoad({ state: 'loading' })
    try {
      const list = await sessionSummaryBrowserClient.reusable(appointmentId)
      setLoad({ state: 'ready', items: list.items })
    } catch (error) {
      setLoad(
        error instanceof ApiError && error.status === 403
          ? { state: 'closed' }
          : { state: 'error' },
      )
    }
  }, [appointmentId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    void fetchItems()
  }, [fetchItems])

  return (
    <section
      className={styles.section}
      aria-labelledby={headingId}
      aria-busy={load.state === 'loading'}
    >
      <header className={styles.heading}>
        <h3 id={headingId}>Tổng kết từ các phiên trước</h3>
        <p>Người dùng đã cho phép bạn đọc những bản tổng kết này.</p>
      </header>

      {load.state === 'loading' && (
        <div className={styles.skeletons}>
          <span className="sr-only" role="status">
            Đang tải các bản tổng kết trước
          </span>
          <Skeleton height="3.4rem" />
          <Skeleton height="3.4rem" />
        </div>
      )}

      {load.state === 'error' && (
        <div className={styles.notice} role="alert">
          <p>Chưa tải được các bản tổng kết trước.</p>
          <button type="button" onClick={() => void fetchItems()}>
            Thử lại
          </button>
        </div>
      )}

      {load.state === 'closed' && (
        <p className={styles.empty}>
          Phần này mở khi lịch hẹn đã được xác nhận, trong vòng 24 giờ quanh giờ
          hẹn.
        </p>
      )}

      {load.state === 'ready' && load.items.length === 0 && (
        <p className={styles.empty}>
          Người dùng chưa chia sẻ bản tổng kết nào từ các phiên trước.
        </p>
      )}

      {load.state === 'ready' && load.items.length > 0 && (
        <ol className={styles.list}>
          {load.items.map((item, index) => (
            <li
              key={item.summary.id}
              className={styles.item}
              style={{ '--prior-i': index } as React.CSSProperties}
            >
              <details className={styles.entry} open={index === 0}>
                <summary className={styles.entryHead}>
                  <span className={styles.entryTitle}>
                    <strong>
                      Phiên ngày{' '}
                      <time dateTime={item.sessionStartedAt}>
                        {sessionDate.format(new Date(item.sessionStartedAt))}
                      </time>
                    </strong>
                    <span className={styles.byline}>
                      {item.sameSpecialist
                        ? 'Bạn đã ghi'
                        : `Ghi bởi ${item.specialistDisplayName}`}
                    </span>
                  </span>
                  <span className={styles.topics} aria-hidden="true">
                    {item.summary.topicsDiscussed.slice(0, 2).join(' · ')}
                  </span>
                  <ChevronDown className={styles.chevron} aria-hidden="true" />
                </summary>
                <div className={styles.entryBody}>
                  <SummaryContent summary={item.summary} hideMeta />
                  {item.summary.agreedNextSteps.length > 0 && (
                    <div className={styles.steps}>
                      <h4>Đã thống nhất sau phiên</h4>
                      <ul>
                        {item.summary.agreedNextSteps.map((step) => (
                          <li key={step.id}>
                            <span>{STEP_LABELS[step.type]}</span>
                            {step.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
