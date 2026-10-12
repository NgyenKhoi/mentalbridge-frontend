'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  CalendarCheck,
  Check,
  Clock3,
  MessageSquare,
  RefreshCw,
  X,
} from 'lucide-react'

import { useFeedback } from '@/components/ui/FeedbackProvider'
import { Skeleton } from '@/components/ui/Skeleton'
import { ApiError } from '@/lib/api/api-error'
import type { Appointment } from '@/lib/consultation/consultation-validation'
import { appointmentBrowserClient } from '../api/browser-client'
import {
  appointmentTimingCopy,
  matchesAppointmentFilter,
  nextAppointment,
  orderSpecialistAppointments,
  type AppointmentFilter,
} from '../model/appointment-view'
import styles from './SpecialistAppointmentDecisionPanel.module.css'
import { SpecialistConsultationBrief } from './SpecialistConsultationBrief'
import { SessionSummaryPanel } from './SessionSummaryPanel'
import { AppointmentDisputePanel } from './AppointmentDisputePanel'

type Decision = 'accept' | 'reject'

const STATUS_LABELS: Record<Appointment['status'], string> = {
  REQUESTED: 'Chờ phản hồi',
  CONFIRMED: 'Đã xác nhận',
  IN_PROGRESS: 'Đang diễn ra',
  SESSION_ENDED: 'Đang tổng hợp kết quả',
  COMPLETED: 'Đã hoàn thành',
  REJECTED: 'Đã từ chối',
  EXPIRED: 'Đã hết hạn',
  CANCELLED: 'Đã hủy',
}

const CREDIT_LABELS: Record<Appointment['creditState'], string> = {
  AVAILABLE: 'Lượt tư vấn đã được hoàn lại',
  HELD: 'Lượt tư vấn vẫn được giữ cho lịch hẹn',
  CONSUMED: 'Lượt tư vấn đã được sử dụng',
  FORFEITED: 'Lượt tư vấn không còn hiệu lực',
}

const RELOAD_CODES = new Set([
  'APPOINTMENT_VERSION_MISMATCH',
  'APPOINTMENT_NOT_DECISION_ELIGIBLE',
  'APPOINTMENT_DECISION_DEADLINE_PASSED',
  'APPOINTMENT_NOT_FOUND',
])

function displayRange(appointment: Appointment) {
  const date = new Intl.DateTimeFormat('vi-VN', {
    timeZone: appointment.timezone,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const end = new Intl.DateTimeFormat('vi-VN', {
    timeZone: appointment.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return `${date.format(new Date(appointment.scheduledStartAt))}–${end.format(new Date(appointment.scheduledEndAt))}`
}

function durationCopy(appointment: Appointment) {
  const minutes = Math.round(
    (Date.parse(appointment.scheduledEndAt) -
      Date.parse(appointment.scheduledStartAt)) /
      60000,
  )
  return `${minutes} phút · ${appointment.modality === 'IN_APP_CHAT' ? 'Chat trong ứng dụng' : 'Video trong ứng dụng'}`
}

function displayDeadline(appointment: Appointment) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: appointment.timezone,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(appointment.decisionDeadlineAt))
}

function friendlyError(error: unknown, reloaded = false) {
  const suffix = reloaded ? ' Danh sách mới nhất đã được tải lại.' : ''
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'APPOINTMENT_VERSION_MISMATCH':
        return `Yêu cầu này vừa được cập nhật ở nơi khác.${suffix || ' Hãy tải lại rồi thử lại.'}`
      case 'APPOINTMENT_NOT_DECISION_ELIGIBLE':
        return `Yêu cầu này không còn chờ phản hồi.${suffix}`
      case 'APPOINTMENT_DECISION_DEADLINE_PASSED':
        return `Thời hạn phản hồi đã kết thúc.${suffix}`
      case 'APPOINTMENT_NOT_ASSIGNED':
        return 'Bạn chỉ có thể xử lý lịch hẹn được giao cho mình.'
      case 'APPOINTMENT_CREDIT_CONFLICT':
        return 'Lượt tư vấn của yêu cầu này đang có thay đổi. Vui lòng tải lại trước khi tiếp tục.'
      case 'IDEMPOTENCY_KEY_REUSED':
        return 'Lần gửi trước không khớp với thao tác này. Hãy thử lại.'
      case 'UNAUTHENTICATED':
        return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
      case 'CONSULTATION_ROLE_REQUIRED':
        return 'Tài khoản hiện tại không có quyền xử lý lịch hẹn chuyên gia.'
    }
  }
  return 'Chưa thể xử lý lịch hẹn. Vui lòng thử lại.'
}

export default function SpecialistAppointmentDecisionPanel({
  initialAppointmentId,
}: {
  initialAppointmentId?: string
}) {
  const { confirm, showActionToast } = useFeedback()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [generatedAt, setGeneratedAt] = useState('')
  const [filter, setFilter] = useState<AppointmentFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingCommand, setPendingCommand] = useState<string | null>(null)
  const commandKeys = useRef(new Map<string, string>())
  const commandBusy = useRef(false)
  const focusedAppointment = useRef('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await appointmentBrowserClient.assigned()
      setAppointments(data.items)
      setGeneratedAt(data.generatedAt)
      return true
    } catch (caught) {
      setError(friendlyError(caught))
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    appointmentBrowserClient
      .assigned()
      .then((data) => {
        if (active) {
          setAppointments(data.items)
          setGeneratedAt(data.generatedAt)
        }
      })
      .catch((caught: unknown) => {
        if (active) setError(friendlyError(caught))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const counts = useMemo(
    () => ({
      waiting: appointments.filter((item) => item.status === 'REQUESTED')
        .length,
      confirmed: appointments.filter((item) =>
        ['CONFIRMED', 'IN_PROGRESS'].includes(item.status),
      ).length,
    }),
    [appointments],
  )
  const now = generatedAt ? Date.parse(generatedAt) : 0
  const next = useMemo(
    () => nextAppointment(appointments, now),
    [appointments, now],
  )
  const visibleAppointments = useMemo(
    () =>
      orderSpecialistAppointments(appointments).filter((appointment) =>
        matchesAppointmentFilter(appointment, filter, now),
      ),
    [appointments, filter, now],
  )
  useEffect(() => {
    if (
      !initialAppointmentId ||
      focusedAppointment.current === initialAppointmentId ||
      !visibleAppointments.some((item) => item.id === initialAppointmentId)
    )
      return
    const timer = requestAnimationFrame(() => {
      const heading = document.getElementById(
        `appointment-${initialAppointmentId}`,
      )
      if (!heading) return
      focusedAppointment.current = initialAppointmentId
      heading.focus({ preventScroll: true })
      heading.closest('article')?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      })
    })
    return () => cancelAnimationFrame(timer)
  }, [initialAppointmentId, visibleAppointments])

  const decide = async (appointment: Appointment, decision: Decision) => {
    if (commandBusy.current || loading) return
    commandBusy.current = true
    if (decision === 'reject') {
      const confirmed = await confirm({
        title: 'Từ chối yêu cầu lịch hẹn?',
        description:
          'Khung giờ sẽ được mở lại và lượt tư vấn của người dùng được hoàn lại. Quyết định này không thể thay đổi.',
        confirmLabel: 'Từ chối yêu cầu',
        tone: 'warning',
      })
      if (!confirmed) {
        commandBusy.current = false
        return
      }
    }

    const commandId = `${appointment.id}:${decision}`
    const idempotencyKey =
      commandKeys.current.get(commandId) ?? crypto.randomUUID()
    commandKeys.current.set(commandId, idempotencyKey)
    setPendingCommand(commandId)
    setError('')
    try {
      const updated = await appointmentBrowserClient.decide(
        appointment.id,
        decision,
        appointment.version,
        idempotencyKey,
      )
      commandKeys.current.delete(commandId)
      setAppointments((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
      showActionToast({
        title:
          decision === 'accept' ? 'Đã xác nhận lịch hẹn' : 'Đã từ chối yêu cầu',
        description:
          decision === 'accept'
            ? 'Lịch hẹn đã được giữ trong lịch làm việc của bạn.'
            : 'Khung giờ đã được mở lại và lượt tư vấn được hoàn lại.',
        tone: 'success',
      })
      requestAnimationFrame(() => {
        const target =
          document.getElementById(`appointment-${updated.id}`) ??
          document.getElementById('appointment-list-title')
        target?.focus({ preventScroll: true })
      })
    } catch (caught) {
      const shouldReload =
        caught instanceof ApiError && RELOAD_CODES.has(caught.code)
      const reloaded = shouldReload ? await load() : false
      setError(friendlyError(caught, reloaded))
      if (
        caught instanceof ApiError &&
        caught.code === 'IDEMPOTENCY_KEY_REUSED'
      )
        commandKeys.current.delete(commandId)
    } finally {
      commandBusy.current = false
      setPendingCommand(null)
    }
  }

  return (
    <section
      className={styles.panel}
      data-specialist-journey="appointments"
      aria-labelledby="appointment-title"
    >
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>Không gian chuyên gia</span>
          <h1 id="appointment-title">Phản hồi yêu cầu lịch hẹn</h1>
          <p>
            Xác nhận khi bạn có thể tham gia, hoặc từ chối trước thời hạn để
            khung giờ và lượt tư vấn được trả lại kịp thời.
          </p>
        </div>
        <div className={styles.summary} aria-label="Tổng quan lịch hẹn">
          <button
            type="button"
            onClick={() => setFilter('requested')}
            aria-label={`${counts.waiting} yêu cầu chờ phản hồi`}
          >
            <span>Chờ xác nhận</span>
            <strong>{loading && !generatedAt ? '—' : counts.waiting}</strong>
          </button>
          <button
            type="button"
            onClick={() => setFilter('upcoming')}
            aria-label={`${counts.confirmed} lịch hẹn đã xác nhận`}
          >
            <span>Đã xác nhận</span>
            <strong>{loading && !generatedAt ? '—' : counts.confirmed}</strong>
          </button>
        </div>
      </header>

      {next && (
        <section
          className={styles.nextAppointment}
          aria-label="Cuộc hẹn tiếp theo"
        >
          <div className={styles.nextHeading}>
            <span className={styles.calendarIcon}>
              <CalendarDays size={24} aria-hidden="true" />
            </span>
            <div>
              <div className={styles.nextMeta}>
                <span>CUỘC HẸN TIẾP THEO</span>
                <strong className={styles.status} data-status={next.status}>
                  {STATUS_LABELS[next.status]}
                </strong>
              </div>
              <h2>{displayRange(next)}</h2>
              <p>
                {next.modality === 'IN_APP_CHAT'
                  ? appointmentTimingCopy(next)
                  : 'Phiên video đã được xác nhận'}
              </p>
              <small>
                {durationCopy(next)} · {next.timezone}
              </small>
            </div>
          </div>
          <div className={styles.nextActions}>
            {next.modality === 'IN_APP_CHAT' && (
              <Link
                href={`/specialist/messages?appointmentId=${encodeURIComponent(next.id)}`}
              >
                <MessageSquare size={18} aria-hidden="true" /> Mở tin nhắn
              </Link>
            )}
          </div>
          <SpecialistConsultationBrief appointmentId={next.id} compact />
        </section>
      )}

      <div className={styles.filterBar}>
        <div className={styles.filters} role="group" aria-label="Lọc lịch hẹn">
          {(
            [
              ['all', 'Tất cả'],
              ['requested', 'Chờ xác nhận'],
              ['upcoming', 'Sắp tới'],
              ['history', 'Lịch sử'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className={styles.reload}
          type="button"
          onClick={() => void load()}
          disabled={loading || Boolean(pendingCommand)}
        >
          <RefreshCw
            size={18}
            aria-hidden="true"
            className={loading ? styles.spinning : undefined}
          />
          {loading ? 'Đang tải…' : 'Tải lại'}
        </button>
      </div>

      <div className={styles.toolbar}>
        <div>
          <h2 id="appointment-list-title" tabIndex={-1}>
            Yêu cầu được giao cho bạn
          </h2>
          <p>Yêu cầu sắp hết hạn được ưu tiên hiển thị trước.</p>
        </div>
        {generatedAt && (
          <span className={styles.resultCount}>
            {visibleAppointments.length} lịch hẹn
          </span>
        )}
      </div>

      {error && (
        <div className={styles.error} role="alert">
          <div>
            <strong>
              {generatedAt
                ? 'Chưa thể cập nhật lịch hẹn'
                : 'Chưa thể tải lịch hẹn'}
            </strong>
            <p>{error}</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || Boolean(pendingCommand)}
          >
            Thử lại
          </button>
        </div>
      )}

      {loading && !generatedAt ? (
        <div
          className={styles.loading}
          role="status"
          aria-label="Đang tải lịch hẹn"
        >
          {[0, 1, 2].map((item) => (
            <div className={styles.loadingCard} key={item}>
              <Skeleton width="48px" height="48px" />
              <div>
                <Skeleton width="40%" height="18px" />
                <Skeleton width="80%" height="24px" />
                <Skeleton width="60%" height="18px" />
              </div>
            </div>
          ))}
        </div>
      ) : !generatedAt && error ? null : appointments.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.calendarIcon}>
            <CalendarDays size={28} aria-hidden="true" />
          </span>
          <h2>Chưa có yêu cầu lịch hẹn</h2>
          <p>
            Khi có yêu cầu mới, bạn sẽ thấy thời hạn và lựa chọn phản hồi tại
            đây.
          </p>
          <Link href="/specialist/availability">Quản lý lịch khả dụng</Link>
        </div>
      ) : visibleAppointments.length === 0 ? (
        <div className={styles.empty}>
          <h2>Không có lịch hẹn trong nhóm này</h2>
          <p>Chọn một bộ lọc khác để xem các lịch hẹn còn lại.</p>
          <button type="button" onClick={() => setFilter('all')}>
            Xem tất cả lịch hẹn
          </button>
        </div>
      ) : (
        <ul className={styles.list} aria-busy={loading}>
          {visibleAppointments.map((appointment) => {
            const deciding = pendingCommand?.startsWith(`${appointment.id}:`)
            return (
              <li
                key={appointment.id}
                className={styles.card}
                data-status={appointment.status}
              >
                <span className={styles.cardIcon} aria-hidden="true">
                  {appointment.status === 'REQUESTED' ? (
                    <Clock3 size={22} />
                  ) : (
                    <CalendarCheck size={22} />
                  )}
                </span>
                <div className={styles.cardMain}>
                  <div className={styles.cardHeading}>
                    <span
                      className={styles.status}
                      data-status={appointment.status}
                    >
                      {STATUS_LABELS[appointment.status]}
                    </span>
                    <span className={styles.modality}>
                      {durationCopy(appointment)}
                    </span>
                  </div>
                  <h3 id={`appointment-${appointment.id}`} tabIndex={-1}>
                    {displayRange(appointment)}
                  </h3>
                  <small className={styles.timezone}>
                    {appointment.timezone}
                  </small>
                  <p className={styles.credit}>
                    {CREDIT_LABELS[appointment.creditState]}
                  </p>
                  {appointment.status === 'REQUESTED' && (
                    <p className={styles.deadline}>
                      <Clock3 size={16} aria-hidden="true" /> Phản hồi trước{' '}
                      {displayDeadline(appointment)}
                    </p>
                  )}
                </div>
                {appointment.modality === 'IN_APP_CHAT' &&
                  (appointment.status === 'CONFIRMED' ||
                    appointment.status === 'IN_PROGRESS' ||
                    appointment.history.some(
                      (event) => event.toStatus === 'CONFIRMED',
                    )) && (
                    <Link
                      className={styles.chatLink}
                      href={`/specialist/messages?appointmentId=${encodeURIComponent(appointment.id)}`}
                    >
                      <MessageSquare size={18} aria-hidden="true" /> Mở tin nhắn
                    </Link>
                  )}
                {appointment.status === 'REQUESTED' && (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.reject}
                      disabled={Boolean(pendingCommand) || loading}
                      onClick={() => void decide(appointment, 'reject')}
                    >
                      <X size={18} aria-hidden="true" /> Từ chối
                    </button>
                    <button
                      type="button"
                      className={styles.accept}
                      disabled={Boolean(pendingCommand) || loading}
                      onClick={() => void decide(appointment, 'accept')}
                    >
                      <Check size={18} aria-hidden="true" />{' '}
                      {deciding ? 'Đang xử lý…' : 'Xác nhận'}
                    </button>
                  </div>
                )}
                {['CONFIRMED', 'IN_PROGRESS'].includes(appointment.status) && (
                  <SpecialistConsultationBrief appointmentId={appointment.id} />
                )}
                {appointment.status === 'COMPLETED' && (
                  <SessionSummaryPanel
                    appointmentId={appointment.id}
                    viewer="SPECIALIST"
                  />
                )}
                {appointment.sessionSettledAt &&
                  ['SESSION_ENDED', 'COMPLETED'].includes(
                    appointment.status,
                  ) && (
                    <AppointmentDisputePanel
                      appointment={appointment}
                      role="SPECIALIST"
                      generatedAt={generatedAt}
                    />
                  )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
