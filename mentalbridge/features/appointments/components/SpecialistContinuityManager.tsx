'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  History,
  Info,
  MessageSquare,
  RefreshCw,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'

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
    if (error.status === 401)
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
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

function formatPublishedAt(value: string, timezone?: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value))
}

function SummarySnapshot({
  summary,
  timezone,
}: {
  summary: SessionSummary
  timezone?: string
}) {
  return (
    <div className={styles.snapshot}>
      <div className={styles.snapshotMeta}>
        <span>
          {summary.amendsSummaryId ? 'Bản đính chính' : 'Bản đầu tiên'} · Bản{' '}
          {summary.version}
        </span>
        <time dateTime={summary.publishedAt}>
          Xuất bản {formatPublishedAt(summary.publishedAt, timezone)}
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
                    <>
                      {step.resourceId && (
                        <Link
                          className={styles.resourceLink}
                          href={`/resources/${encodeURIComponent(step.resourceId)}${step.resourceVersion ? `?contentVersion=${encodeURIComponent(step.resourceVersion)}` : ''}`}
                        >
                          Xem tài nguyên đính kèm
                        </Link>
                      )}
                      <PlanChangeRequestCard
                        proposalId={step.id}
                        viewer="SPECIALIST"
                      />
                    </>
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

export default function SpecialistContinuityManager({
  initialAppointmentId,
}: {
  initialAppointmentId?: string
}) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('')
  const [summaries, setSummaries] = useState<SessionSummary[]>([])
  const [selectedSummaryId, setSelectedSummaryId] = useState('')
  const [loadingAppointments, setLoadingAppointments] = useState(true)
  const [loadingSummaries, setLoadingSummaries] = useState(false)
  const [appointmentsError, setAppointmentsError] = useState('')
  const [summariesError, setSummariesError] = useState('')
  const summaryRequest = useRef(0)
  const appointmentRequest = useRef(0)
  const selectedAppointmentRef = useRef(initialAppointmentId ?? '')
  const selectedSummaryRef = useRef('')
  const [detailOpen, setDetailOpen] = useState(Boolean(initialAppointmentId))
  const [summaryCounts, setSummaryCounts] = useState<Record<string, number>>({})
  const directoryRef = useRef<HTMLElement>(null)

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
    const request = ++appointmentRequest.current
    setLoadingAppointments(true)
    setAppointmentsError('')
    try {
      const data = await appointmentBrowserClient.assigned()
      if (request !== appointmentRequest.current) return
      setAppointments(data.items)
      const completed = data.items
        .filter((appointment) => appointment.status === 'COMPLETED')
        .sort(
          (left, right) =>
            Date.parse(right.scheduledEndAt) - Date.parse(left.scheduledEndAt),
        )
      const previous = selectedAppointmentRef.current
      const next = previous
        ? (completed.find((item) => item.id === previous)?.id ?? '')
        : (completed[0]?.id ?? '')
      selectedAppointmentRef.current = next || previous
      setSelectedAppointmentId(next)
      if (next !== previous) {
        summaryRequest.current += 1
        selectedSummaryRef.current = ''
        setSummaries([])
        setSelectedSummaryId('')
        setSummariesError('')
        setLoadingSummaries(Boolean(next))
      }
      return next
    } catch (error) {
      if (request !== appointmentRequest.current) return
      if (error instanceof ApiError && [401, 403].includes(error.status ?? 0)) {
        summaryRequest.current += 1
        selectedAppointmentRef.current = ''
        selectedSummaryRef.current = ''
        setAppointments([])
        setSelectedAppointmentId('')
        setSummaries([])
        setSelectedSummaryId('')
        setSummaryCounts({})
        setLoadingSummaries(false)
      }
      setAppointmentsError(appointmentError(error))
      return ''
    } finally {
      if (request === appointmentRequest.current) setLoadingAppointments(false)
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
      const ordered = [...data.items].sort(
        (left, right) => right.version - left.version,
      )
      const next =
        ordered.find((item) => item.id === selectedSummaryRef.current)?.id ??
        ordered[0]?.id ??
        ''
      selectedSummaryRef.current = next
      setSummaries(ordered)
      setSelectedSummaryId(next)
      setSummaryCounts((counts) => ({ ...counts, [appointmentId]: data.count }))
    } catch (error) {
      if (request !== summaryRequest.current) return
      setSummariesError(summaryError(error))
    } finally {
      if (request === summaryRequest.current) setLoadingSummaries(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAppointments(), 0)
    return () => {
      window.clearTimeout(timer)
      appointmentRequest.current += 1
    }
  }, [loadAppointments])

  useEffect(() => {
    if (!selectedAppointmentId) return
    const timer = window.setTimeout(
      () => void loadSummaries(selectedAppointmentId),
      0,
    )
    return () => {
      window.clearTimeout(timer)
      summaryRequest.current += 1
    }
  }, [selectedAppointmentId, loadSummaries])

  const selectAppointment = (appointmentId: string) => {
    if (appointmentId === selectedAppointmentId) {
      setDetailOpen(true)
      requestAnimationFrame(() =>
        document.getElementById('continuity-session-title')?.focus(),
      )
      return
    }
    summaryRequest.current += 1
    selectedAppointmentRef.current = appointmentId
    selectedSummaryRef.current = ''
    setSelectedAppointmentId(appointmentId)
    setDetailOpen(true)
    setSummaries([])
    setSelectedSummaryId('')
    setSummariesError('')
    setLoadingSummaries(true)
    requestAnimationFrame(() =>
      document.getElementById('continuity-session-title')?.focus(),
    )
  }
  const selectVersion = (summaryId: string) => {
    selectedSummaryRef.current = summaryId
    setSelectedSummaryId(summaryId)
  }
  const backToList = () => {
    setDetailOpen(false)
    requestAnimationFrame(() =>
      directoryRef.current
        ?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
        ?.focus(),
    )
  }
  const reload = async () => {
    const availableSelection = await loadAppointments()
    if (availableSelection) await loadSummaries(availableSelection)
  }

  return (
    <section
      className={styles.page}
      data-specialist-journey="follow-up"
      aria-labelledby="continuity-title"
    >
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>Tiếp nối sau tư vấn</span>
          <h1 id="continuity-title">Nội dung đã thống nhất sau phiên</h1>
          <p>
            Xem lại bản tóm tắt và các bước đã trao đổi theo từng lịch hẹn đã
            hoàn thành.
          </p>
        </div>
        <div className={styles.headingActions}>
          <button
            type="button"
            className={styles.secondaryAction}
            disabled={loadingAppointments || loadingSummaries}
            onClick={() => void reload()}
          >
            <RefreshCw size={18} aria-hidden="true" />
            Tải lại
          </button>
          <Link className={styles.primaryLink} href="/specialist/appointments">
            <CalendarDays size={18} aria-hidden="true" />
            Mở lịch hẹn
          </Link>
        </div>
      </header>

      <aside className={styles.boundaryNote}>
        <Info size={20} aria-hidden="true" />
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

      {loadingAppointments && appointments.length === 0 ? (
        <div className={styles.loadingState} role="status">
          <Skeleton width="100%" height={92} />
          <Skeleton width="100%" height={92} />
          <Skeleton width="100%" height={92} />
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
      ) : completedAppointments.length > 0 ? (
        <div className={styles.workspace} data-detail-open={detailOpen}>
          <aside
            className={styles.directory}
            aria-label="Các phiên đã hoàn thành"
            ref={directoryRef}
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
                      {summaryCounts[appointment.id] !== undefined && (
                        <em className={styles.summaryBadge}>
                          {summaryCounts[appointment.id] > 0
                            ? 'Đã có bản tóm tắt'
                            : 'Chưa có bản tóm tắt'}
                        </em>
                      )}
                    </span>
                    <span aria-hidden="true">›</span>
                  </button>
                )
              })}
            </div>
          </aside>

          <section
            className={styles.detail}
            aria-label="Nội dung phiên đã chọn"
            aria-busy={loadingSummaries}
          >
            <button
              className={styles.backButton}
              type="button"
              onClick={backToList}
            >
              <ArrowLeft size={18} aria-hidden="true" />
              Quay lại danh sách phiên
            </button>
            {selectedAppointment && (
              <header className={styles.detailHeader}>
                <div>
                  <span className={styles.sectionLabel}>
                    Phiên đã hoàn thành
                  </span>
                  <h2 id="continuity-session-title" tabIndex={-1}>
                    {formatAppointment(selectedAppointment).date}
                  </h2>
                  <p>
                    {formatAppointment(selectedAppointment).time} ·{' '}
                    {selectedAppointment.modality === 'IN_APP_CHAT'
                      ? 'Chat trong ứng dụng'
                      : 'Video trong ứng dụng'}
                  </p>
                  <small>Múi giờ: {selectedAppointment.timezone}</small>
                </div>
                <div className={styles.detailActions}>
                  {selectedAppointment.modality === 'IN_APP_CHAT' && (
                    <Link
                      href={`/specialist/messages?appointmentId=${encodeURIComponent(selectedAppointment.id)}`}
                    >
                      <MessageSquare size={17} aria-hidden="true" />
                      Xem lại hội thoại
                    </Link>
                  )}
                  <Link
                    href={`/specialist/appointments?appointmentId=${encodeURIComponent(selectedAppointment.id)}`}
                  >
                    Quản lý trong lịch hẹn
                  </Link>
                </div>
              </header>
            )}

            {!selectedAppointment ? (
              <div className={styles.detailState}>
                <CalendarDays size={32} aria-hidden="true" />
                <h3>Chọn một phiên đã hoàn thành</h3>
                <p>
                  Phiên được yêu cầu không có trong danh sách hiện tại. Hãy chọn
                  một phiên được cấp quyền.
                </p>
              </div>
            ) : loadingSummaries ? (
              <div className={styles.detailState} role="status">
                <Skeleton width="100%" height={40} />
                <Skeleton width="100%" height={96} />
                <Skeleton width="100%" height={96} />
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
                  <FileText size={28} aria-hidden="true" />
                </span>
                <h3>Chưa có bản tóm tắt sau phiên</h3>
                <p>
                  Mở lịch hẹn này để xuất bản nội dung đã thống nhất với người
                  dùng.
                </p>
                <Link
                  href={`/specialist/appointments?appointmentId=${encodeURIComponent(selectedAppointment.id)}`}
                >
                  Mở lịch hẹn
                </Link>
              </div>
            ) : (
              <>
                <div className={styles.versionBar}>
                  <div>
                    <span className={styles.sectionLabel}>
                      <History size={18} aria-hidden="true" />
                      Lịch sử xuất bản
                    </span>
                    <p>{summaries.length} bản được lưu cho phiên này</p>
                  </div>
                  <div
                    className={styles.versionChoices}
                    aria-label="Chọn bản tóm tắt"
                    role="tablist"
                  >
                    {summaries.map((summary, index) => (
                      <button
                        type="button"
                        key={summary.id}
                        role="tab"
                        id={`summary-tab-${summary.version}`}
                        aria-selected={summary.id === selectedSummary?.id}
                        tabIndex={summary.id === selectedSummary?.id ? 0 : -1}
                        aria-controls="continuity-snapshot"
                        onClick={() => selectVersion(summary.id)}
                        onKeyDown={(event) => {
                          let next = index
                          if (event.key === 'ArrowRight')
                            next = (index + 1) % summaries.length
                          else if (event.key === 'ArrowLeft')
                            next =
                              (index - 1 + summaries.length) % summaries.length
                          else if (event.key === 'Home') next = 0
                          else if (event.key === 'End')
                            next = summaries.length - 1
                          else return
                          event.preventDefault()
                          selectVersion(summaries[next].id)
                          document
                            .getElementById(
                              `summary-tab-${summaries[next].version}`,
                            )
                            ?.focus()
                        }}
                      >
                        <span>
                          {index === 0
                            ? `Mới nhất · Bản ${summary.version}`
                            : `Bản ${summary.version}`}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                {selectedSummary && (
                  <div
                    id="continuity-snapshot"
                    role="tabpanel"
                    aria-labelledby={`summary-tab-${selectedSummary.version}`}
                  >
                    <SummarySnapshot
                      key={selectedSummary.id}
                      summary={selectedSummary}
                      timezone={selectedAppointment.timezone}
                    />
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      ) : null}
    </section>
  )
}
