'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  Video,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  Info,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react'

import { NOTIFICATIONS_UPDATED_EVENT } from '@/components/NotificationBell'
import { Dialog } from '@/components/ui/Dialog'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import type { Appointment } from '@/lib/consultation/consultation-validation'
import { appointmentBrowserClient } from '../api/browser-client'
import { consultationBriefBrowserClient } from '../api/consultation-brief-browser-client'
import {
  appointmentStatusLabel,
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

const CREDIT_LABELS: Record<Appointment['creditState'], string> = {
  AVAILABLE: 'Lượt tư vấn đã được hoàn lại',
  HELD: 'Lượt tư vấn vẫn được giữ cho lịch hẹn',
  CONSUMED: 'Lượt tư vấn đã được sử dụng',
  FORFEITED: 'Lượt tư vấn không còn hiệu lực',
  REVOKED: 'Lượt tư vấn đã bị thu hồi khi chủ gói hủy đăng ký',
}

const RELOAD_CODES = new Set([
  'APPOINTMENT_VERSION_MISMATCH',
  'APPOINTMENT_NOT_DECISION_ELIGIBLE',
  'APPOINTMENT_DECISION_DEADLINE_PASSED',
  'APPOINTMENT_NOT_FOUND',
])

const DECISION_LABELS = {
  SPECIALIST_ACCEPTED: 'Bạn đã xác nhận lịch hẹn',
  SPECIALIST_REJECTED: 'Bạn đã từ chối yêu cầu',
  DECISION_DEADLINE_EXPIRED: 'Yêu cầu hết hạn phản hồi',
} as const

const CANCELLATION_LABELS = {
  USER_CANCELLED: 'Thân chủ đã hủy lịch hẹn',
  USER_RESCHEDULED: 'Thân chủ đã đổi sang lịch khác',
  OWNER_SUBSCRIPTION_CANCELLED: 'Lịch bị hủy vì gói của thân chủ đã kết thúc',
  SPECIALIST_SUSPENDED: 'Lịch bị hủy vì tài khoản chuyên gia tạm ngưng',
} as const

const FALLBACK_CLIENT = 'Thân chủ'

function displayMoment(value: string, timezone: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value))
}

function displayTimeRange(appointment: Appointment) {
  const format = new Intl.DateTimeFormat('vi-VN', {
    timeZone: appointment.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return `${format.format(new Date(appointment.scheduledStartAt))} – ${format.format(new Date(appointment.scheduledEndAt))}`
}

function displayDate(appointment: Appointment) {
  const date = new Intl.DateTimeFormat('vi-VN', {
    timeZone: appointment.timezone,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(appointment.scheduledStartAt))
  return date.charAt(0).toUpperCase() + date.slice(1)
}

function isoWeek(date: Date) {
  const target = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  )
  target.setUTCDate(target.getUTCDate() + 4 - (target.getUTCDay() || 7))
  const firstDay = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  return {
    week: Math.ceil(
      ((target.getTime() - firstDay.getTime()) / 86400000 + 1) / 7,
    ),
    year: target.getUTCFullYear(),
  }
}

function displayDeadline(appointment: Appointment) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: appointment.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(appointment.decisionDeadlineAt))
}

function displayRemaining(deadlineAt: string, referenceTime: number) {
  if (!referenceTime) return 'đang cập nhật…'
  const minutes = Math.ceil((Date.parse(deadlineAt) - referenceTime) / 60000)
  if (minutes <= 0) return 'đã hết hạn'
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0')
  const remainingMinutes = String(minutes % 60).padStart(2, '0')
  return `còn ${hours}h ${remainingMinutes}m`
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

const chatHref = (appointment: Appointment) =>
  `/specialist/messages?appointmentId=${encodeURIComponent(appointment.id)}`
const chatLinkable = (appointment: Appointment) =>
  appointment.modality === 'IN_APP_CHAT' &&
  (appointment.status === 'CONFIRMED' ||
    appointment.status === 'IN_PROGRESS' ||
    appointment.history.some((event) => event.toStatus === 'CONFIRMED'))
const videoHref = (appointment: Appointment) =>
  `/specialist/appointments/${encodeURIComponent(appointment.id)}/video`
const videoLinkable = (appointment: Appointment) =>
  appointment.modality === 'IN_APP_VIDEO' &&
  ['CONFIRMED', 'IN_PROGRESS', 'SESSION_ENDED', 'COMPLETED'].includes(
    appointment.status,
  )

function SessionDetailDrawer({
  appointment,
  clientName,
  open,
  onClose,
}: Readonly<{
  appointment: Appointment | undefined
  clientName: string
  open: boolean
  onClose: () => void
}>) {
  const titleId = 'session-detail-title'
  const decision = appointment?.decisionReason
    ? DECISION_LABELS[appointment.decisionReason]
    : null
  const cancellation = appointment?.cancellationReason
    ? CANCELLATION_LABELS[appointment.cancellationReason]
    : null
  const briefLinkable =
    !!appointment &&
    ['CONFIRMED', 'IN_PROGRESS', 'SESSION_ENDED'].includes(appointment.status)
  const hasLinks =
    !!appointment &&
    (briefLinkable ||
      appointment.status === 'COMPLETED' ||
      chatLinkable(appointment) ||
      videoLinkable(appointment))
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      labelledBy={titleId}
      className={styles.drawer}
    >
      {appointment && (
        <div className={styles.drawerBody}>
          <header className={styles.drawerHead}>
            <h2 id={titleId}>Chi tiết phiên</h2>
            <button
              type="button"
              className={styles.drawerClose}
              onClick={onClose}
              aria-label="Đóng chi tiết phiên"
            >
              <X size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </header>
          <dl className={styles.drawerFacts}>
            <div>
              <dt>Thân chủ</dt>
              <dd>{clientName}</dd>
            </div>
            <div>
              <dt>Thời gian</dt>
              <dd>
                {displayTimeRange(appointment)}, {displayDate(appointment)}
              </dd>
            </div>
            <div>
              <dt>Hình thức</dt>
              <dd>
                {appointment.modality === 'IN_APP_VIDEO'
                  ? 'Video trong ứng dụng'
                  : 'Chat trong ứng dụng'}
              </dd>
            </div>
            <div>
              <dt>Trạng thái</dt>
              <dd>{appointmentStatusLabel(appointment, 'SPECIALIST')}</dd>
            </div>
            {appointment.status === 'REQUESTED' && (
              <div>
                <dt>Hạn phản hồi</dt>
                <dd>
                  {displayMoment(
                    appointment.decisionDeadlineAt,
                    appointment.timezone,
                  )}
                </dd>
              </div>
            )}
            {decision && (
              <div>
                <dt>Phản hồi</dt>
                <dd>
                  {decision}
                  {appointment.decidedAt
                    ? `, ${displayMoment(appointment.decidedAt, appointment.timezone)}`
                    : ''}
                </dd>
              </div>
            )}
            {cancellation && (
              <div>
                <dt>Hủy lịch</dt>
                <dd>
                  {cancellation}
                  {appointment.cancelledAt
                    ? `, ${displayMoment(appointment.cancelledAt, appointment.timezone)}`
                    : ''}
                </dd>
              </div>
            )}
            <div>
              <dt>Lượt tư vấn</dt>
              <dd>{CREDIT_LABELS[appointment.creditState]}</dd>
            </div>
          </dl>
          {hasLinks && (
            <nav className={styles.drawerLinks} aria-label="Đi tới">
              {briefLinkable && (
                <Link
                  href={`/specialist/clients?appointmentId=${encodeURIComponent(appointment.id)}`}
                >
                  Mở hồ sơ chuẩn bị phiên
                </Link>
              )}
              {appointment.status === 'COMPLETED' && (
                <Link
                  href={`/specialist/clients?appointmentId=${encodeURIComponent(appointment.id)}`}
                >
                  Xem tổng kết phiên
                </Link>
              )}
              {chatLinkable(appointment) && (
                <Link href={chatHref(appointment)}>Mở cuộc trò chuyện</Link>
              )}
              {videoLinkable(appointment) && (
                <Link href={videoHref(appointment)}>
                  {['CONFIRMED', 'IN_PROGRESS'].includes(appointment.status)
                    ? 'Mở phòng tư vấn video'
                    : 'Xem phiên tư vấn video'}
                </Link>
              )}
            </nav>
          )}
        </div>
      )}
    </Dialog>
  )
}

export default function SpecialistAppointmentDecisionPanel({
  initialAppointmentId,
}: {
  initialAppointmentId?: string
} = {}) {
  const { confirm, showActionToast } = useFeedback()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [generatedAt, setGeneratedAt] = useState('')
  const [filter, setFilter] = useState<AppointmentFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingCommand, setPendingCommand] = useState<string | null>(null)
  const [clientNames, setClientNames] = useState<Record<string, string>>({})
  // Snapshot, not an id: a refresh that drops the appointment must not empty
  // the open drawer.
  const [detailSnapshot, setDetailSnapshot] = useState<Appointment | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const commandKeys = useRef(new Map<string, string>())
  const commandBusy = useRef(false)
  const focusedAppointment = useRef('')

  // Consultation has no client name; Care's continuity list carries it for
  // appointments the specialist may see. Failure keeps the generic label.
  const refreshNames = useCallback(() => {
    consultationBriefBrowserClient
      .specialistContinuity()
      .then((list) =>
        setClientNames(
          Object.fromEntries(
            list.items.map((item) => [
              item.appointmentId,
              item.userDisplayName,
            ]),
          ),
        ),
      )
      .catch(() => undefined)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    refreshNames()
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
  }, [refreshNames])

  useEffect(() => {
    let active = true
    refreshNames()
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
  }, [refreshNames])

  // A new booking notification (bell event) or a 30 s tick refreshes the list quietly.
  useEffect(() => {
    let active = true
    const refresh = () => {
      if (document.visibilityState !== 'visible' || commandBusy.current) return
      refreshNames()
      appointmentBrowserClient
        .assigned()
        .then((data) => {
          if (!active || commandBusy.current) return
          setAppointments(data.items)
          setGeneratedAt(data.generatedAt)
        })
        .catch(() => undefined)
    }
    const timer = window.setInterval(refresh, 30_000)
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh)
    }
  }, [refreshNames])

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
      heading.closest('li')?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      })
    })
    return () => cancelAnimationFrame(timer)
  }, [initialAppointmentId, visibleAppointments])

  // visibleAppointments is already in specialist order, so each group keeps it.
  const groups: [string, string, Appointment['status'][]][] = [
    ['in-progress', 'ĐANG DIỄN RA', ['IN_PROGRESS']],
    ['confirmed', 'ĐÃ XÁC NHẬN, SẮP TỚI', ['CONFIRMED']],
    ['requested', 'CHỜ BẠN PHẢN HỒI', ['REQUESTED']],
    ['ended', 'ĐÃ KẾT THÚC, CHỜ KẾT QUẢ', ['SESSION_ENDED']],
    [
      'history',
      'LỊCH SỬ & ĐÃ HỦY',
      ['COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED'],
    ],
  ]
  const detail =
    appointments.find((item) => item.id === detailSnapshot?.id) ??
    detailSnapshot ??
    undefined
  const clientName = (appointment: Appointment) =>
    clientNames[appointment.id] ?? FALLBACK_CLIENT
  const openDetail = (appointment: Appointment) => {
    setDetailSnapshot(appointment)
    setDetailOpen(true)
  }
  const weekAnchor = generatedAt ? new Date(generatedAt) : new Date()
  const weekStart = new Date(weekAnchor)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    return {
      date,
      booked: appointments.some(
        (item) =>
          ['CONFIRMED', 'IN_PROGRESS'].includes(item.status) &&
          new Date(item.scheduledStartAt).toDateString() ===
            date.toDateString(),
      ),
      urgent: appointments.some(
        (item) =>
          item.status === 'REQUESTED' &&
          new Date(item.scheduledStartAt).toDateString() ===
            date.toDateString(),
      ),
      current: date.toDateString() === weekAnchor.toDateString(),
    }
  })
  const weekLabel = isoWeek(weekAnchor)

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

  const renderAppointment = (appointment: Appointment) => {
    const accepting = pendingCommand === `${appointment.id}:accept`
    const rejecting = pendingCommand === `${appointment.id}:reject`
    const requested = appointment.status === 'REQUESTED'

    return (
      <li
        key={appointment.id}
        id={`appointment-card-${appointment.id}`}
        className={requested ? styles.requestCard : styles.compactCard}
        data-status={appointment.status}
        data-modality={appointment.modality}
      >
        {requested ? (
          <>
            <div className={styles.requestTop}>
              <div className={styles.requestBadges}>
                <span className={styles.waitingStatus}>
                  <span aria-hidden="true" />
                  CHỜ BÁC SĨ PHẢN HỒI
                  <span className={styles.srOnly}>Chờ phản hồi</span>
                </span>
                <span className={styles.modality}>
                  {appointment.modality === 'IN_APP_VIDEO'
                    ? 'Video trong ứng dụng'
                    : 'Chat trong ứng dụng'}
                </span>
              </div>
              <span className={styles.deadline}>
                <Clock3 size={15} strokeWidth={1.75} aria-hidden="true" />
                Hạn chót:{' '}
                {displayRemaining(appointment.decisionDeadlineAt, now)} (Phản
                hồi trước {displayDeadline(appointment)})
              </span>
            </div>
            <div className={styles.requestDetails}>
              <div className={styles.requestSchedule}>
                <div className={styles.timeLine}>
                  <h3 id={`appointment-${appointment.id}`} tabIndex={-1}>
                    {displayTimeRange(appointment)}
                  </h3>
                  <span>{displayDate(appointment)}</span>
                </div>
                <p>
                  <strong>{clientName(appointment)}</strong>
                  <span className={styles.metaDivider} aria-hidden="true">
                    ·
                  </span>
                  <span>{CREDIT_LABELS[appointment.creditState]}</span>
                </p>
              </div>
              <div className={styles.method}>
                <span>HÌNH THỨC</span>
                <strong>
                  {appointment.modality === 'IN_APP_VIDEO'
                    ? 'Phiên tư vấn Video'
                    : 'Phiên tư vấn Chat'}
                </strong>
              </div>
            </div>
            <div className={styles.briefPreview}>
              <div>
                <FileText size={17} strokeWidth={1.75} aria-hidden="true" />
                <strong>Tóm tắt tiền sử &amp; Đánh giá sơ bộ</strong>
                <span>
                  Thông tin có điều kiện{' '}
                  <ChevronRight
                    size={15}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </span>
              </div>
              <p>
                Tóm tắt do thân chủ phê duyệt chỉ hiển thị khi đủ điều kiện truy
                cập trước buổi tư vấn.
              </p>
            </div>
            <button
              data-appointment-ui
              type="button"
              className={styles.detailLink}
              onClick={() => openDetail(appointment)}
              aria-label={`Xem chi tiết phiên, ${clientName(appointment)}, ${displayDate(appointment)} ${displayTimeRange(appointment)}`}
            >
              Xem chi tiết phiên
              <ChevronRight size={15} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <div className={styles.actions}>
              <button
                data-appointment-ui
                type="button"
                className={styles.propose}
                disabled
                title="Chưa hỗ trợ đề xuất đổi giờ từ yêu cầu này"
              >
                Đề xuất đổi giờ khác
              </button>
              <button
                data-appointment-ui
                type="button"
                className={styles.reject}
                disabled={Boolean(pendingCommand) || loading}
                onClick={() => void decide(appointment, 'reject')}
                aria-label="Từ chối"
              >
                <X size={17} strokeWidth={1.75} aria-hidden="true" />
                {rejecting ? 'Đang xử lý…' : 'Từ chối ca'}
              </button>
              <button
                data-appointment-ui
                type="button"
                className={styles.accept}
                disabled={Boolean(pendingCommand) || loading}
                onClick={() => void decide(appointment, 'accept')}
                aria-label="Xác nhận"
              >
                <Check size={17} strokeWidth={1.75} aria-hidden="true" />
                {accepting ? 'Đang xử lý…' : 'Chấp nhận lịch hẹn'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.compactTop}>
              <div>
                <span
                  className={styles.status}
                  data-status={appointment.status}
                >
                  {appointmentStatusLabel(appointment, 'SPECIALIST')}
                </span>
                <span className={styles.compactModality}>
                  {appointment.modality === 'IN_APP_VIDEO'
                    ? 'Video trong ứng dụng'
                    : 'Chat trong ứng dụng'}
                </span>
              </div>
              <div className={styles.compactActions}>
                <button
                  data-appointment-ui
                  type="button"
                  className={styles.compactAction}
                  onClick={() => openDetail(appointment)}
                  aria-label={`Xem chi tiết phiên, ${clientName(appointment)}, ${displayDate(appointment)} ${displayTimeRange(appointment)}`}
                >
                  Xem chi tiết phiên
                </button>
                {chatLinkable(appointment) && (
                  <Link
                    className={styles.compactAction}
                    href={chatHref(appointment)}
                  >
                    Mở tin nhắn
                  </Link>
                )}
              </div>
            </div>
            <h3 id={`appointment-${appointment.id}`} tabIndex={-1}>
              {displayTimeRange(appointment)}{' '}
              <span>{displayDate(appointment)}</span>
            </h3>
            <p>
              {clientName(appointment)} <span aria-hidden="true">·</span>{' '}
              <span>{CREDIT_LABELS[appointment.creditState]}</span>
            </p>
            {appointment.modality === 'IN_APP_VIDEO' &&
              [
                'CONFIRMED',
                'IN_PROGRESS',
                'SESSION_ENDED',
                'COMPLETED',
              ].includes(appointment.status) && (
                <Link
                  className={styles.compactAction}
                  href={`/specialist/appointments/${encodeURIComponent(appointment.id)}/video`}
                  aria-label={`${['CONFIRMED', 'IN_PROGRESS'].includes(appointment.status) ? 'Mở phòng tư vấn' : 'Xem phiên tư vấn video'}, buổi ${displayDate(appointment)} ${displayTimeRange(appointment)}`}
                >
                  {['CONFIRMED', 'IN_PROGRESS'].includes(appointment.status)
                    ? 'Mở phòng tư vấn'
                    : 'Xem phiên tư vấn video'}
                </Link>
              )}
            {['CONFIRMED', 'IN_PROGRESS'].includes(appointment.status) && (
              <SpecialistConsultationBrief
                appointmentId={appointment.id}
                compact
              />
            )}
            {appointment.status === 'COMPLETED' && (
              <SessionSummaryPanel
                appointmentId={appointment.id}
                viewer="SPECIALIST"
              />
            )}
            {appointment.sessionSettledAt &&
              ['SESSION_ENDED', 'COMPLETED'].includes(appointment.status) && (
                <AppointmentDisputePanel
                  appointment={appointment}
                  role="SPECIALIST"
                  generatedAt={generatedAt}
                />
              )}
          </>
        )}
      </li>
    )
  }

  return (
    <section
      className={styles.panel}
      data-specialist-journey="appointments"
      aria-labelledby="appointment-title"
    >
      <header className={styles.heading}>
        <div className={styles.headingCopy}>
          <span className={styles.eyebrow}>
            <ShieldCheck size={17} strokeWidth={1.75} aria-hidden="true" />
            TRUNG TÂM LÂM SÀNG TRỰC TUYẾN
          </span>
          <h1 id="appointment-title">Phản hồi yêu cầu lịch hẹn</h1>
          <p>
            Phản hồi kịp thời giúp thân chủ chuẩn bị tâm lý tốt nhất. Lịch hẹn
            chưa phản hồi sẽ tự động hoàn trả sau khi hết hạn.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            data-appointment-ui
            className={styles.refresh}
            type="button"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Tải lại"
          >
            <RefreshCw size={17} strokeWidth={1.75} aria-hidden="true" />
            {loading ? 'Đang tải…' : 'Làm mới danh sách'}
          </button>
          <button
            data-appointment-ui
            className={styles.calendarSync}
            type="button"
            disabled
            title="Chưa hỗ trợ đồng bộ Google Calendar"
          >
            <CalendarDays size={17} strokeWidth={1.75} aria-hidden="true" />
            Đồng bộ Google Calendar
          </button>
        </div>
      </header>

      <div className={styles.filterBar}>
        <div className={styles.filters} role="group" aria-label="Lọc lịch hẹn">
          {(
            [
              ['all', 'Tất cả (' + appointments.length + ')'],
              ['requested', 'Cần phản hồi ngay'],
              ['upcoming', 'Đã xác nhận (' + counts.confirmed + ')'],
              ['history', 'Lịch sử & Đã hủy'],
            ] as const
          ).map(([value, label]) => (
            <button
              data-appointment-ui
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
              {value === 'requested' && (
                <>
                  <span className={styles.tabAlert} aria-hidden="true" />
                  <span className={styles.tabCount}>{counts.waiting}</span>
                </>
              )}
            </button>
          ))}
        </div>
        <div className={styles.priority}>
          <span>Ưu tiên:</span>
          <strong>
            {filter === 'requested'
              ? 'Sắp hết hạn trước'
              : 'Đang diễn ra và sắp tới trước'}
          </strong>
        </div>
      </div>

      <div className={styles.workspace}>
        <div className={styles.workColumn}>
          <div className={styles.toolbar}>
            <div>
              <h2 id="appointment-list-title" tabIndex={-1}>
                Yêu cầu giao cho bạn
              </h2>
              <span className={styles.waitingCount}>
                {counts.waiting} Cần duyệt
              </span>
            </div>
            <span className={styles.refreshNote}>
              Cập nhật khi làm mới danh sách
            </span>
          </div>

          <div aria-live="polite" aria-atomic="true">
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
          </div>

          {loading && !generatedAt ? (
            <p className={styles.state} role="status">
              Đang tải lịch hẹn…
            </p>
          ) : !generatedAt && error ? null : appointments.length === 0 ? (
            <div className={styles.empty}>
              <h2>Chưa có yêu cầu lịch hẹn</h2>
              <p>
                Khi có yêu cầu mới, bạn sẽ thấy thời hạn và lựa chọn phản hồi
                tại đây.
              </p>
            </div>
          ) : visibleAppointments.length === 0 ? (
            <div className={styles.empty}>
              <h2>Không có lịch hẹn trong nhóm này</h2>
              <p>Chọn một bộ lọc khác để xem các lịch hẹn còn lại.</p>
              <button
                type="button"
                data-appointment-ui
                onClick={() => setFilter('all')}
              >
                Xem tất cả lịch hẹn
              </button>
            </div>
          ) : (
            <>
              {groups.map(([id, title, statuses]) => {
                const items = visibleAppointments.filter((item) =>
                  statuses.includes(item.status),
                )
                return items.length === 0 ? null : (
                  <section
                    key={id}
                    className={styles.group}
                    aria-labelledby={`group-${id}-title`}
                  >
                    <h3 id={`group-${id}-title`}>{title}</h3>
                    <ul className={styles.list}>
                      {items.map(renderAppointment)}
                    </ul>
                  </section>
                )
              })}
            </>
          )}
        </div>

        <aside className={styles.sideColumn} aria-label="Lịch trình lâm sàng">
          <div className={styles.sideHeading}>
            <h2>Lịch Trình Lâm Sàng</h2>
            <span>
              Tuần {weekLabel.week} / {weekLabel.year}
            </span>
          </div>
          {next ? (
            <section
              className={styles.nextAppointment}
              aria-label="Phiên tư vấn tiếp theo"
            >
              <div className={styles.nextTop}>
                <span>
                  <i aria-hidden="true" /> PHIÊN TƯ VẤN TIẾP THEO
                </span>
                <strong>
                  {new Date(next.scheduledStartAt).toDateString() ===
                  weekAnchor.toDateString()
                    ? 'Hôm nay'
                    : 'Sắp tới'}
                </strong>
              </div>
              <div className={styles.nextTime}>
                <h3>{displayTimeRange(next)}</h3>
                <p>
                  {displayDate(next)} ·{' '}
                  {next.modality === 'IN_APP_CHAT'
                    ? 'Chat trực tiếp chuyên sâu'
                    : 'Video trong ứng dụng'}
                </p>
              </div>
              <div className={styles.nextClient}>
                <div>
                  <span>Thân chủ:</span>
                  <strong>{clientName(next)}</strong>
                </div>
                <div>
                  <span>Trạng thái</span>
                  <strong>{appointmentStatusLabel(next, 'SPECIALIST')}</strong>
                </div>
              </div>
              {next.modality === 'IN_APP_CHAT' ? (
                <Link
                  className={styles.nextAction}
                  href={`/specialist/messages?appointmentId=${encodeURIComponent(next.id)}`}
                >
                  <MessageCircle
                    size={17}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  Mở cửa sổ tin nhắn tư vấn
                </Link>
              ) : (
                <Link
                  className={styles.nextAction}
                  href={`/specialist/appointments/${encodeURIComponent(next.id)}/video`}
                >
                  <Video size={17} aria-hidden="true" />
                  Mở phòng tư vấn video
                </Link>
              )}
            </section>
          ) : (
            <section
              className={styles.nextAppointment}
              aria-label="Phiên tư vấn tiếp theo"
            >
              <div className={styles.nextTop}>
                <span>
                  <i aria-hidden="true" /> PHIÊN TƯ VẤN TIẾP THEO
                </span>
              </div>
              <p className={styles.noNext}>Chưa có phiên tư vấn sắp tới.</p>
            </section>
          )}

          <section
            className={styles.weekCard}
            aria-label="Mật độ lịch tuần này"
          >
            <div className={styles.weekTop}>
              <h3>Mật độ lịch tuần này</h3>
              <div className={styles.legend}>
                <span>
                  <i className={styles.bookedLegend} aria-hidden="true" /> Có
                  hẹn
                </span>
                <span>
                  <i className={styles.emptyLegend} aria-hidden="true" /> Chưa
                  có hẹn
                </span>
              </div>
            </div>
            <div className={styles.weekGrid}>
              {weekDays.map(({ date, booked, urgent, current }, index) => (
                <div
                  key={date.toISOString()}
                  className={styles.day}
                  data-booked={booked}
                  data-urgent={urgent}
                  data-current={current}
                >
                  <small>{index === 6 ? 'CN' : 'T' + (index + 2)}</small>
                  <strong>{date.getDate()}</strong>
                  <i aria-hidden="true" />
                </div>
              ))}
            </div>
            <div className={styles.weekFooter}>
              <span>
                {weekDays.filter((day) => day.booked).length} ngày có lịch hẹn
              </span>
              <Link href="/specialist/availability">Chỉnh sửa lịch rảnh</Link>
            </div>
          </section>

          <section className={styles.rulesCard} aria-label="Quy tắc phản hồi">
            <h3>
              <Info size={17} strokeWidth={1.75} aria-hidden="true" /> QUY TẮC
              CHUẨN MỰC PHẢN HỒI
            </h3>
            <ul>
              <li>
                <strong>Phản hồi đúng hạn:</strong> Xử lý mỗi yêu cầu trước thời
                điểm ghi trên thẻ lịch hẹn.
              </li>
              <li>
                <strong>Bảo mật thông tin:</strong> Chỉ xem tóm tắt do thân chủ
                phê duyệt khi đủ điều kiện truy cập.
              </li>
              <li>
                <strong>Từ chối ca:</strong> Khung giờ được mở lại và lượt tư
                vấn được hoàn theo quy tắc hiện hành.
              </li>
            </ul>
          </section>
        </aside>
      </div>
      <SessionDetailDrawer
        appointment={detail}
        clientName={detail ? clientName(detail) : FALLBACK_CLIENT}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </section>
  )
}
