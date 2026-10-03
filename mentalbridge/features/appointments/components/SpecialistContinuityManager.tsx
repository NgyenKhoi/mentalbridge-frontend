'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ApiError } from '@/lib/api/api-error'
import type { Appointment } from '@/lib/consultation/consultation-validation'
import type {
  AgreedNextStepType,
  SessionSummary,
} from '@/lib/consultation/session-summary-validation'
import { appointmentBrowserClient } from '../api/browser-client'
import { sessionSummaryBrowserClient } from '../api/session-summary-browser-client'
import { PlanChangeRequestCard } from './PlanChangeRequestCard'
import styles from './SpecialistContinuityManager.module.css'

const STEP_LABELS: Record<AgreedNextStepType, string> = {
  CHECKLIST: 'Việc đã thống nhất',
  JOURNAL: 'Viết nhật ký',
  EMOTION_CHECK_IN: 'Ghi nhận cảm xúc',
  REASSESSMENT: 'Làm lại bài sàng lọc',
  FOLLOW_UP_APPOINTMENT: 'Hẹn phiên tiếp theo',
  PLATFORM_RESOURCE: 'Tài nguyên trên MentalBridge',
}

function appointmentError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    if (error.status === 403)
      return 'Tài khoản hiện tại không có quyền xem lịch hẹn chuyên gia.'
  }
  return 'Chưa thể tải các phiên tư vấn đã hoàn thành. Vui lòng thử lại.'
}

function summaryError(error: unknown) {
  if (error instanceof ApiError) {
    if ([403, 404, 410].includes(error.status ?? 0))
      return 'Bản tóm tắt này không còn khả dụng với tài khoản của bạn.'
  }
  return 'Chưa thể tải nội dung sau phiên. Vui lòng thử lại.'
}

function formatAppointment(appointment: Appointment) {
  const start = new Date(appointment.scheduledStartAt)
  const end = new Date(appointment.scheduledEndAt)
  const date = new Intl.DateTimeFormat('vi-VN', {
    timeZone: appointment.timezone,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(start)
  const time = new Intl.DateTimeFormat('vi-VN', {
    timeZone: appointment.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return { date, time: `${time.format(start)}–${time.format(end)}` }
}

function formatPublishedAt(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function SummarySnapshot({ summary }: { summary: SessionSummary }) {
  return (
    <div className={styles.snapshot}>
      <div className={styles.snapshotMeta}>
        <span>
          {summary.amendsSummaryId ? 'Bản đính chính' : 'Bản đầu tiên'}
        </span>
        <time dateTime={summary.publishedAt}>
          Xuất bản {formatPublishedAt(summary.publishedAt)}
        </time>
      </div>

      <section className={styles.summarySection}>
        <span className={styles.sectionLabel}>Nội dung đã trao đổi</span>
        <div className={styles.topics}>
          {summary.topicsDiscussed.map((topic) => (
            <span key={topic}>{topic}</span>
          ))}
        </div>
      </section>

      {summary.progressSummary && (
        <section className={styles.summarySection}>
          <h3>Điều đã ghi nhận trong phiên</h3>
          <p>{summary.progressSummary}</p>
        </section>
      )}

      {summary.specialistNoteForUser && (
        <section className={styles.note}>
          <span aria-hidden="true">“</span>
          <div>
            <h3>Lời nhắn đã gửi người dùng</h3>
            <p>{summary.specialistNoteForUser}</p>
          </div>
        </section>
      )}

      <section
        className={styles.steps}
        aria-labelledby="continuity-steps-title"
      >
        <div className={styles.stepsHeading}>
          <div>
            <span className={styles.sectionLabel}>Tiếp nối sau phiên</span>
            <h3 id="continuity-steps-title">Các bước đã thống nhất</h3>
          </div>
          <span className={styles.stepCount}>
            {summary.agreedNextSteps.length} bước
          </span>
        </div>

        {summary.agreedNextSteps.length === 0 ? (
          <p className={styles.inlineEmpty}>
            Phiên này không ghi nhận bước tiếp theo.
          </p>
        ) : (
          <ol>
            {summary.agreedNextSteps.map((step, index) => (
              <li key={step.id}>
                <span className={styles.stepIndex}>{index + 1}</span>
                <div className={styles.stepCopy}>
                  <span>{STEP_LABELS[step.type]}</span>
                  <strong>{step.title}</strong>
                  {step.details && <p>{step.details}</p>}
                  {step.type === 'PLATFORM_RESOURCE' && (
                    <PlanChangeRequestCard
                      proposalId={step.id}
                      viewer="SPECIALIST"
                    />
                  )}
                </div>
                <span className={styles.agreed}>Đã thống nhất</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {summary.followUpSuggested && (
        <aside className={styles.followUpNote}>
          <span aria-hidden="true">↗</span>
          <div>
            <strong>Đã đề xuất một phiên trao đổi tiếp theo</strong>
            <p>Kiểm tra lịch hẹn để tiếp tục khi người dùng gửi yêu cầu mới.</p>
          </div>
        </aside>
      )}
    </div>
  )
}

export default function SpecialistContinuityManager() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('')
  const [summaries, setSummaries] = useState<SessionSummary[]>([])
  const [selectedSummaryId, setSelectedSummaryId] = useState('')
  const [loadingAppointments, setLoadingAppointments] = useState(true)
  const [loadingSummaries, setLoadingSummaries] = useState(false)
  const [appointmentsError, setAppointmentsError] = useState('')
  const [summariesError, setSummariesError] = useState('')
  const summaryRequest = useRef(0)

  const completedAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) => appointment.status === 'COMPLETED')
        .sort(
          (left, right) =>
            Date.parse(right.scheduledEndAt) - Date.parse(left.scheduledEndAt),
        ),
    [appointments],
  )

  const selectedAppointment = useMemo(
    () =>
      completedAppointments.find(
        (appointment) => appointment.id === selectedAppointmentId,
      ) ?? null,
    [completedAppointments, selectedAppointmentId],
  )

  const selectedSummary = useMemo(
    () =>
      summaries.find((summary) => summary.id === selectedSummaryId) ??
      summaries[0] ??
      null,
    [selectedSummaryId, summaries],
  )

  const loadAppointments = useCallback(async () => {
    setLoadingAppointments(true)
    setAppointmentsError('')
    try {
      const data = await appointmentBrowserClient.assigned()
      setAppointments(data.items)
      const completed = data.items
        .filter((appointment) => appointment.status === 'COMPLETED')
        .sort(
          (left, right) =>
            Date.parse(right.scheduledEndAt) - Date.parse(left.scheduledEndAt),
        )
      const next = completed[0]?.id ?? ''
      setSelectedAppointmentId(next)
      setSummaries([])
      setSelectedSummaryId('')
      setSummariesError('')
      setLoadingSummaries(Boolean(next))
    } catch (error) {
      setAppointments([])
      setSelectedAppointmentId('')
      setAppointmentsError(appointmentError(error))
    } finally {
      setLoadingAppointments(false)
    }
  }, [])

  const loadSummaries = useCallback(async (appointmentId: string) => {
    const request = ++summaryRequest.current
    setLoadingSummaries(true)
    setSummariesError('')
    setSummaries([])
    setSelectedSummaryId('')
    try {
      const data = await sessionSummaryBrowserClient.list(
        appointmentId,
        'SPECIALIST',
      )
      if (request !== summaryRequest.current) return
      setSummaries(data.items)
      setSelectedSummaryId(data.items[0]?.id ?? '')
    } catch (error) {
      if (request !== summaryRequest.current) return
      setSummariesError(summaryError(error))
    } finally {
      if (request === summaryRequest.current) setLoadingSummaries(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    void appointmentBrowserClient
      .assigned()
      .then((data) => {
        if (!active) return
        setAppointments(data.items)
        const completed = data.items
          .filter((appointment) => appointment.status === 'COMPLETED')
          .sort(
            (left, right) =>
              Date.parse(right.scheduledEndAt) -
              Date.parse(left.scheduledEndAt),
          )
        const first = completed[0]?.id ?? ''
        setSelectedAppointmentId(first)
        setLoadingSummaries(Boolean(first))
      })
      .catch((error: unknown) => {
        if (!active) return
        setAppointments([])
        setSelectedAppointmentId('')
        setAppointmentsError(appointmentError(error))
      })
      .finally(() => {
        if (active) setLoadingAppointments(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedAppointmentId) return
    let active = true
    void sessionSummaryBrowserClient
      .list(selectedAppointmentId, 'SPECIALIST')
      .then((data) => {
        if (!active) return
        setSummaries(data.items)
        setSelectedSummaryId(data.items[0]?.id ?? '')
      })
      .catch((error: unknown) => {
        if (!active) return
        setSummariesError(summaryError(error))
      })
      .finally(() => {
        if (active) setLoadingSummaries(false)
      })
    return () => {
      active = false
    }
  }, [selectedAppointmentId])

  const selectAppointment = (appointmentId: string) => {
    summaryRequest.current += 1
    setSelectedAppointmentId(appointmentId)
    setSummaries([])
    setSelectedSummaryId('')
    setSummariesError('')
    setLoadingSummaries(true)
  }

  return (
    <section className={styles.page} aria-labelledby="continuity-title">
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>Tiếp nối sau tư vấn</span>
          <h1 id="continuity-title">Nội dung đã thống nhất sau phiên</h1>
          <p>
            Xem lại bản tóm tắt và các bước đã trao đổi theo từng lịch hẹn đã
            hoàn thành.
          </p>
        </div>
        <Link className={styles.primaryLink} href="/specialist/appointments">
          Mở lịch hẹn
        </Link>
      </header>

      <aside className={styles.boundaryNote}>
        <span aria-hidden="true">✓</span>
        <p>
          <strong>Thông tin theo đúng phiên tư vấn</strong>
          Mỗi lần xuất bản được giữ nguyên để bạn có thể xem lại nội dung đã
          thống nhất tại thời điểm đó.
        </p>
      </aside>

      {appointmentsError && (
        <div className={styles.pageError} role="alert">
          <p>{appointmentsError}</p>
          <button type="button" onClick={() => void loadAppointments()}>
            Thử lại
          </button>
        </div>
      )}

      {loadingAppointments ? (
        <div className={styles.loadingState} role="status">
          <span />
          <span />
          <span />
          <p>Đang tải các phiên đã hoàn thành…</p>
        </div>
      ) : !appointmentsError && completedAppointments.length === 0 ? (
        <div className={styles.emptyState}>
          <span aria-hidden="true">◷</span>
          <h2>Chưa có phiên tư vấn đã hoàn thành</h2>
          <p>
            Bản tóm tắt và các bước tiếp theo sẽ xuất hiện ở đây sau khi một
            phiên được hoàn tất.
          </p>
          <Link href="/specialist/appointments">Xem lịch hẹn</Link>
        </div>
      ) : !appointmentsError ? (
        <div className={styles.workspace}>
          <aside
            className={styles.directory}
            aria-label="Các phiên đã hoàn thành"
          >
            <header>
              <div>
                <span>Phiên tư vấn</span>
                <h2>Đã hoàn thành</h2>
              </div>
              <strong>{completedAppointments.length}</strong>
            </header>
            <div className={styles.appointmentList}>
              {completedAppointments.map((appointment) => {
                const display = formatAppointment(appointment)
                const selected = appointment.id === selectedAppointmentId
                return (
                  <button
                    type="button"
                    key={appointment.id}
                    className={selected ? styles.selectedAppointment : ''}
                    aria-pressed={selected}
                    onClick={() => selectAppointment(appointment.id)}
                  >
                    <span className={styles.dateMark} aria-hidden="true">
                      {new Intl.DateTimeFormat('vi-VN', {
                        timeZone: appointment.timezone,
                        day: '2-digit',
                      }).format(new Date(appointment.scheduledStartAt))}
                    </span>
                    <span className={styles.appointmentCopy}>
                      <strong>{display.date}</strong>
                      <small>
                        {display.time} ·{' '}
                        {appointment.modality === 'IN_APP_CHAT'
                          ? 'Chat trong ứng dụng'
                          : 'Video trong ứng dụng'}
                      </small>
                    </span>
                    <span aria-hidden="true">›</span>
                  </button>
                )
              })}
            </div>
          </aside>

          <section className={styles.detail} aria-live="polite">
            {selectedAppointment && (
              <header className={styles.detailHeader}>
                <div>
                  <span className={styles.sectionLabel}>
                    Phiên đã hoàn thành
                  </span>
                  <h2>{formatAppointment(selectedAppointment).date}</h2>
                  <p>
                    {formatAppointment(selectedAppointment).time} ·{' '}
                    {selectedAppointment.modality === 'IN_APP_CHAT'
                      ? 'Chat trong ứng dụng'
                      : 'Video trong ứng dụng'}
                  </p>
                </div>
                <div className={styles.detailActions}>
                  {selectedAppointment.modality === 'IN_APP_CHAT' && (
                    <Link
                      href={`/specialist/messages?appointmentId=${encodeURIComponent(selectedAppointment.id)}`}
                    >
                      Xem lại hội thoại
                    </Link>
                  )}
                  <Link href="/specialist/appointments">
                    Quản lý trong lịch hẹn
                  </Link>
                </div>
              </header>
            )}

            {loadingSummaries ? (
              <div className={styles.detailState} role="status">
                <span className={styles.spinner} />
                <p>Đang tải nội dung sau phiên…</p>
              </div>
            ) : summariesError ? (
              <div className={styles.detailError} role="alert">
                <span aria-hidden="true">!</span>
                <div>
                  <h3>Không thể mở nội dung sau phiên</h3>
                  <p>{summariesError}</p>
                  {selectedAppointment && (
                    <button
                      type="button"
                      onClick={() => void loadSummaries(selectedAppointment.id)}
                    >
                      Thử lại
                    </button>
                  )}
                </div>
              </div>
            ) : summaries.length === 0 ? (
              <div className={styles.detailState}>
                <span className={styles.documentMark} aria-hidden="true">
                  ≡
                </span>
                <h3>Chưa có bản tóm tắt sau phiên</h3>
                <p>
                  Mở lịch hẹn này để xuất bản nội dung đã thống nhất với người
                  dùng.
                </p>
                <Link href="/specialist/appointments">Mở lịch hẹn</Link>
              </div>
            ) : (
              <>
                <div className={styles.versionBar}>
                  <div>
                    <span className={styles.sectionLabel}>
                      Lịch sử xuất bản
                    </span>
                    <p>{summaries.length} bản được lưu cho phiên này</p>
                  </div>
                  <div
                    className={styles.versionChoices}
                    aria-label="Chọn bản tóm tắt"
                  >
                    {summaries.map((summary, index) => (
                      <button
                        type="button"
                        key={summary.id}
                        aria-pressed={summary.id === selectedSummary?.id}
                        onClick={() => setSelectedSummaryId(summary.id)}
                      >
                        <span>
                          {index === 0 ? 'Mới nhất' : `Bản ${summary.version}`}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                {selectedSummary && (
                  <SummarySnapshot summary={selectedSummary} />
                )}
              </>
            )}
          </section>
        </div>
      ) : null}
    </section>
  )
}
