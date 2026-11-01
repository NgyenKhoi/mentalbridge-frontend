'use client'

import Link from 'next/link'
import { useEffect, useState, type CSSProperties } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { useMamTarget } from '@/features/mam/use-mam-target'
import { appointmentBrowserClient } from '@/features/appointments/api/browser-client'
import { nextAppointment } from '@/features/appointments/model/appointment-view'
import type { Appointment } from '@/lib/consultation/consultation-validation'
import { homeAppointmentView } from './home-appointment'
import styles from './HomeSecondarySections.module.css'

export function HomeUpcomingAppointment({
  summonable = true,
}: Readonly<{
  /** False inside a no-interrupt zone such as the plan emotion check-in. */
  summonable?: boolean
}> = {}) {
  const mamTarget = useMamTarget(
    summonable ? { kind: 'home.appointment' } : null,
  )
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; appointment: Appointment | null; readAt: Date }
    | { status: 'error' }
  >({ status: 'loading' })

  useEffect(() => {
    let active = true
    appointmentBrowserClient.list().then(
      (list) => {
        if (!active) return
        const readAt = new Date()
        setState({
          status: 'ready',
          appointment: nextAppointment(list.items, readAt.getTime()) ?? null,
          readAt,
        })
      },
      () => {
        if (active) setState({ status: 'error' })
      },
    )
    return () => {
      active = false
    }
  }, [attempt])

  const view =
    state.status === 'ready' && state.appointment
      ? homeAppointmentView(state.appointment, state.readAt)
      : null

  return (
    <section
      ref={mamTarget}
      className={styles.section}
      aria-labelledby="home-appointment-heading"
      data-testid="home-upcoming-appointment"
    >
      <div className={styles.headingRow}>
        <h2 id="home-appointment-heading">Buổi hẹn sắp tới</h2>
        <Link href="/appointments">Tất cả →</Link>
      </div>
      {state.status === 'loading' ? (
        <div role="status" aria-label="Đang tải lịch hẹn" aria-busy="true">
          <Skeleton className={styles.skeleton} height={236} />
        </div>
      ) : state.status === 'error' ? (
        <div className={styles.localState}>
          <div role="status">Chưa tải được lịch hẹn.</div>
          <button
            className={styles.quietAction}
            onClick={() => {
              setState({ status: 'loading' })
              setAttempt((value) => value + 1)
            }}
          >
            Thử lại
          </button>
        </div>
      ) : view ? (
        <div
          className={`${styles.appointment} ${styles.reveal}`}
          style={{ '--home-section-delay': '300ms' } as CSSProperties}
        >
          <div className={styles.appointmentWhen}>
            <div className={styles.dateTile} aria-label={view.dateLabel}>
              <div className={styles.weekday}>{view.weekday}</div>
              <div className={styles.day}>{view.day}</div>
              <div className={styles.month}>{view.month}</div>
            </div>
            <div className={styles.timeBlock}>
              <div className={styles.timeRange}>{view.timeRange}</div>
              <div className={styles.appointmentMeta}>
                {view.modality} · {view.countdown}
              </div>
            </div>
          </div>
          <div className={styles.specialist}>
            <div className={styles.avatar} aria-hidden="true">
              {view.specialistInitials}
            </div>
            <div className={styles.specialistName}>{view.specialistName}</div>
          </div>
          <Link href={view.href} className={styles.detailLink}>
            Xem chi tiết buổi hẹn →
          </Link>
        </div>
      ) : (
        <div className={`${styles.localState} ${styles.emptyAppointment}`}>
          <svg
            className={styles.calendarArt}
            width="64"
            height="64"
            viewBox="0 0 64 64"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <rect x="12" y="15" width="40" height="38" rx="6" />
            <path d="M22 10v10M42 10v10M12 26h40M22 35h5M37 35h5M22 44h5M37 44h5" />
          </svg>
          <div>Chưa có buổi hẹn nào sắp tới.</div>
          <Link href="/specialists" className={styles.quietAction}>
            Tìm chuyên gia →
          </Link>
        </div>
      )}
    </section>
  )
}
