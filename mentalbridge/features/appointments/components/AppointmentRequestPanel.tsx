'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Disclosure } from '@/components/ui/Disclosure'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import type {
  Appointment,
  BookableSlot,
} from '@/lib/consultation/consultation-validation'
import { appointmentBrowserClient } from '../api/browser-client'
import {
  appointmentTimingCopy,
  matchesAppointmentFilter,
  nextAppointment,
  orderAppointmentsForDisplay,
  type AppointmentFilter,
} from '../model/appointment-view'
import { ConsultationBriefEditor } from './ConsultationBriefEditor'
import { AppointmentRatingDialog } from './AppointmentRatingDialog'
import { AppointmentDisputePanel } from './AppointmentDisputePanel'
import { SessionSummaryPanel } from './SessionSummaryPanel'
import styles from './AppointmentRequestPanel.module.css'

function format(value: string, timezone: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value))
}

function formatTimeRange(start: string, end: string, timezone: string) {
  const formatter = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  })
  return `${formatter.format(new Date(start))} – ${formatter.format(new Date(end))}`
}

function formatSlotRange(start: string, end: string, timezone: string) {
  const date = new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeZone: timezone,
  }).format(new Date(start))
  return `${date} · ${formatTimeRange(start, end, timezone)}`
}

function slotDateKey(slot: BookableSlot) {
  const day = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: slot.timezone,
  }).format(new Date(slot.startAt))
  return `${slot.timezone}:${day}`
}

function slotDateLabel(slot: BookableSlot, short = false) {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: short ? 'short' : 'long',
    day: '2-digit',
    month: '2-digit',
    timeZone: slot.timezone,
  }).format(new Date(slot.startAt))
}

function dateTile(value: string, timezone: string) {
  const date = new Date(value)
  return {
    weekday: new Intl.DateTimeFormat('vi-VN', {
      weekday: 'short',
      timeZone: timezone,
    }).format(date),
    day: new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      timeZone: timezone,
    }).format(date),
    month: new Intl.DateTimeFormat('vi-VN', {
      month: '2-digit',
      timeZone: timezone,
    }).format(date),
  }
}

function Icon({
  name,
}: {
  name: 'arrow' | 'calendar' | 'clock' | 'message' | 'refresh'
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === 'calendar' && (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </>
      )}
      {name === 'clock' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      )}
      {name === 'message' && (
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
      )}
      {name === 'refresh' && (
        <>
          <path d="M20 7v5h-5" />
          <path d="M4 17v-5h5" />
          <path d="M6.1 8a7 7 0 0 1 11.4-2.1L20 8M4 16l2.5 2.1A7 7 0 0 0 17.9 16" />
        </>
      )}
      {name === 'arrow' && <path d="M5 12h14m-5-5 5 5-5 5" />}
    </svg>
  )
}

function statusTone(status: Appointment['status']) {
  if (status === 'REQUESTED') return 'waiting'
  if (status === 'CONFIRMED' || status === 'IN_PROGRESS') return 'active'
  if (status === 'SESSION_ENDED' || status === 'COMPLETED') return 'complete'
  return 'muted'
}

function isLateConfirmed(appointment: Appointment, generatedAt: string) {
  return (
    appointment.status === 'CONFIRMED' &&
    generatedAt.length > 0 &&
    Date.parse(appointment.scheduledStartAt) - Date.parse(generatedAt) <
      24 * 60 * 60 * 1000
  )
}

function isChangeable(appointment: Appointment | undefined) {
  return (
    appointment?.status === 'REQUESTED' || appointment?.status === 'CONFIRMED'
  )
}

function cancellationOutcomeMessage(
  outcome: Appointment['cancellationCreditOutcome'],
) {
  if (outcome === 'FORFEITED') {
    return 'Lượt tư vấn không được hoàn lại theo mốc 24 giờ.'
  }
  if (outcome === 'RELEASED') {
    return 'Khung giờ và lượt tư vấn đã được hoàn lại.'
  }
  return 'Lịch hẹn và lượt tư vấn đã được cập nhật.'
}

function rescheduleOutcomeMessage(
  outcome: Appointment['cancellationCreditOutcome'],
) {
  if (outcome === 'FORFEITED') {
    return 'Lượt tư vấn cũ không được hoàn lại theo mốc 24 giờ; lịch mới đã dùng một lượt tư vấn đủ điều kiện khác.'
  }
  if (outcome === 'TRANSFERRED_TO_REPLACEMENT') {
    return 'Lượt tư vấn đã được chuyển sang lịch mới. Lịch cũ vẫn được lưu trong lịch sử.'
  }
  return 'Lịch cũ được lưu trong lịch sử. Yêu cầu mới đang chờ xác nhận.'
}

const appointmentStatus: Record<Appointment['status'], string> = {
  REQUESTED: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  IN_PROGRESS: 'Đang diễn ra',
  SESSION_ENDED: 'Đang tổng hợp kết quả',
  COMPLETED: 'Đã hoàn thành',
  REJECTED: 'Chuyên gia chưa thể nhận lịch',
  EXPIRED: 'Hết thời gian xác nhận',
  CANCELLED: 'Đã hủy',
}

const creditOutcome: Record<Appointment['creditState'], string> = {
  HELD: 'Lượt tư vấn đang được giữ',
  AVAILABLE: 'Lượt tư vấn đã được hoàn lại',
  CONSUMED: 'Lượt tư vấn đã được sử dụng',
  FORFEITED: 'Lượt tư vấn không được hoàn lại',
}

const historyReason: Record<Appointment['history'][number]['reason'], string> =
  {
    APPOINTMENT_REQUESTED: 'Bạn đã gửi yêu cầu đặt lịch',
    USER_CANCELLED: 'Bạn đã hủy lịch hẹn',
    USER_RESCHEDULED: 'Bạn đã đổi sang lịch hẹn mới',
    SPECIALIST_ACCEPTED: 'Chuyên gia đã xác nhận lịch hẹn',
    SPECIALIST_REJECTED: 'Chuyên gia chưa thể nhận lịch hẹn',
    DECISION_DEADLINE_EXPIRED: 'Yêu cầu đã hết thời gian xác nhận',
    SPECIALIST_SUSPENDED: 'Lịch hẹn đã hủy vì chuyên gia tạm ngưng nhận lịch',
    SESSION_ACTIVITY_OBSERVED: 'Phiên tư vấn đã bắt đầu',
    SCHEDULED_WINDOW_ENDED: 'Thời gian tư vấn đã kết thúc',
    EVIDENCE_REQUIREMENTS_MET: 'Phiên tư vấn đã được hoàn tất',
  }

function appointmentGuidance(appointment: Appointment) {
  switch (appointment.status) {
    case 'REQUESTED':
      return `Chuyên gia sẽ phản hồi trước ${format(
        appointment.decisionDeadlineAt,
        appointment.timezone,
      )}.`
    case 'CONFIRMED':
      return appointment.modality === 'IN_APP_CHAT'
        ? 'Lịch đã được xác nhận. Bạn có thể chuẩn bị nội dung trước và mở Tin nhắn khi đến giờ.'
        : 'Lịch đã được xác nhận. Bạn có thể chuẩn bị nội dung trước phiên tư vấn.'
    case 'IN_PROGRESS':
      return 'Phiên tư vấn đang diễn ra. Mở Tin nhắn để tiếp tục cuộc trò chuyện.'
    case 'SESSION_ENDED':
      return 'Phiên đã kết thúc và nội dung sau buổi tư vấn đang được tổng hợp.'
    case 'COMPLETED':
      return 'Phiên đã hoàn tất. Bạn có thể xem nội dung đã chốt và đánh giá chuyên gia.'
    case 'REJECTED':
      return 'Chuyên gia chưa thể nhận lịch này. Bạn có thể chọn một khung giờ khác.'
    case 'EXPIRED':
      return 'Yêu cầu đã hết thời gian xác nhận. Bạn có thể chọn một khung giờ khác.'
    case 'CANCELLED':
      return appointment.replacedByAppointmentId
        ? 'Lịch này đã được thay bằng một lịch mới.'
        : 'Lịch này đã hủy và được lưu trong lịch sử của bạn.'
  }
}

function canOpenChat(appointment: Appointment) {
  return (
    appointment.modality === 'IN_APP_CHAT' &&
    (appointment.status === 'CONFIRMED' ||
      appointment.status === 'IN_PROGRESS' ||
      appointment.history.some((event) => event.toStatus === 'CONFIRMED'))
  )
}

function errorMessage(
  error: unknown,
  fallback = 'Không thể gửi yêu cầu. Vui lòng thử lại.',
) {
  if (!(error instanceof ApiError)) return fallback
  const messages: Record<string, string> = {
    PAID_PLAN_REQUIRED: 'Bạn cần gói Plus hoặc Premium để đặt lịch.',
    APPOINTMENT_CREDIT_UNAVAILABLE:
      'Không còn lượt tư vấn phù hợp cho khung giờ này.',
    APPOINTMENT_RESERVATION_LIMIT_REACHED:
      'Bạn đã đạt giới hạn lịch đang chờ, đã xác nhận hoặc đang diễn ra. Hãy hoàn tất, hủy hoặc đổi một lịch hiện có trước khi đặt thêm.',
    APPOINTMENT_SLOT_UNAVAILABLE:
      'Khung giờ vừa được người khác giữ. Hãy chọn khung giờ khác.',
    APPOINTMENT_SLOT_STALE: 'Khung giờ này không còn khả dụng.',
    APPOINTMENT_VIDEO_DISABLED:
      'Tư vấn video hiện chưa được bật. Hãy chọn chat trong ứng dụng.',
    APPOINTMENT_MODALITY_MISMATCH:
      'Hình thức tư vấn không khớp với khung giờ đã chọn.',
    APPOINTMENT_LEAD_TIME_INVALID: 'Lịch hẹn cần được đặt trước ít nhất 4 giờ.',
    APPOINTMENT_VERSION_MISMATCH:
      'Lịch hẹn vừa được cập nhật. Hãy tải lại trước khi tiếp tục.',
    APPOINTMENT_NOT_CANCELLATION_ELIGIBLE: 'Lịch hẹn này không còn có thể hủy.',
    APPOINTMENT_REPLACEMENT_NOT_ACTIVE: 'Lịch hẹn này không còn có thể đổi.',
    APPOINTMENT_CHANGE_WINDOW_CLOSED:
      'Không thể hủy hoặc đổi lịch sau khi buổi tư vấn đã bắt đầu.',
  }
  return messages[error.code] ?? fallback
}

export default function AppointmentRequestPanel({
  focusAppointmentId,
}: {
  focusAppointmentId?: string
}) {
  const { confirm, showActionToast } = useFeedback()
  const [slots, setSlots] = useState<BookableSlot[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [generatedAt, setGeneratedAt] = useState('')
  const [filter, setFilter] = useState<AppointmentFilter>('all')
  const [selectedSlotDate, setSelectedSlotDate] = useState('')
  const [appointmentLoading, setAppointmentLoading] = useState(true)
  const [slotLoading, setSlotLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null)
  const [appointmentError, setAppointmentError] = useState('')
  const [slotError, setSlotError] = useState('')
  const [actionError, setActionError] = useState('')

  const loadAppointments = useCallback(async () => {
    setAppointmentLoading(true)
    setAppointmentError('')
    try {
      const existing = await appointmentBrowserClient.list()
      setAppointments(existing.items)
      setGeneratedAt(existing.generatedAt)
      return existing
    } catch (caught) {
      setAppointmentError(
        errorMessage(caught, 'Không thể tải lịch hẹn. Vui lòng thử lại.'),
      )
      return null
    } finally {
      setAppointmentLoading(false)
    }
  }, [])

  const loadSlots = useCallback(async () => {
    setSlotLoading(true)
    setSlotError('')
    try {
      const available = await appointmentBrowserClient.slots()
      setSlots(available.items)
      return available
    } catch (caught) {
      setSlotError(
        errorMessage(caught, 'Không thể tải khung giờ. Vui lòng thử lại.'),
      )
      return null
    } finally {
      setSlotLoading(false)
    }
  }, [])

  const load = useCallback(async () => {
    const [, existing] = await Promise.all([loadSlots(), loadAppointments()])
    return existing
  }, [loadAppointments, loadSlots])

  const refreshAppointment = useCallback(async (appointmentId: string) => {
    const existing = await appointmentBrowserClient.list()
    setAppointments(existing.items)
    setGeneratedAt(existing.generatedAt)
    return {
      appointment: existing.items.find((item) => item.id === appointmentId),
      generatedAt: existing.generatedAt,
    }
  }, [])

  useEffect(() => {
    const initialLoad = async () => {
      await Promise.resolve()
      await load()
    }

    void initialLoad()
  }, [load])

  async function request(slot: BookableSlot) {
    setSubmitting(slot.id)
    setActionError('')
    try {
      const replacement = rescheduling
      let authoritativeReplacement = replacement
      if (replacement) {
        const reconciled = await refreshAppointment(replacement.id)
        if (!isChangeable(reconciled.appointment)) {
          setRescheduling(null)
          setActionError(
            'Lịch hẹn vừa được cập nhật và không còn có thể đổi. Hãy chọn lại từ trạng thái mới nhất.',
          )
          return
        }
        authoritativeReplacement = reconciled.appointment ?? null
        if (
          authoritativeReplacement &&
          isLateConfirmed(authoritativeReplacement, reconciled.generatedAt)
        ) {
          const accepted = await confirm({
            title: 'Đổi lịch trong vòng 24 giờ?',
            description:
              'Lịch đã được xác nhận và còn dưới 24 giờ. Lượt tư vấn cũ sẽ không được hoàn lại, và lịch mới cần một lượt tư vấn đủ điều kiện khác.',
            confirmLabel: 'Tiếp tục đổi lịch',
            cancelLabel: 'Giữ lịch cũ',
            tone: 'warning',
          })
          if (!accepted) return
        }
        const precommand = await refreshAppointment(replacement.id)
        if (!isChangeable(precommand.appointment)) {
          setRescheduling(null)
          setActionError(
            'Lịch hẹn vừa được cập nhật và không còn có thể đổi. Hãy chọn lại từ trạng thái mới nhất.',
          )
          return
        }
        if (
          authoritativeReplacement &&
          !isLateConfirmed(authoritativeReplacement, reconciled.generatedAt) &&
          isLateConfirmed(
            precommand.appointment as Appointment,
            precommand.generatedAt,
          )
        ) {
          const accepted = await confirm({
            title: 'Đổi lịch trong vòng 24 giờ?',
            description:
              'Lịch vừa đi vào mốc dưới 24 giờ. Lượt tư vấn cũ sẽ không được hoàn lại, và lịch mới cần một lượt tư vấn đủ điều kiện khác.',
            confirmLabel: 'Tiếp tục đổi lịch',
            cancelLabel: 'Giữ lịch cũ',
            tone: 'warning',
          })
          if (!accepted) return
        }
        authoritativeReplacement = precommand.appointment ?? null
      }
      const created = await appointmentBrowserClient.request(
        slot.id,
        slot.modality,
        `appointment-${crypto.randomUUID()}`,
        authoritativeReplacement?.id,
        authoritativeReplacement?.version,
      )
      let replacedAppointment: Appointment | undefined
      if (authoritativeReplacement) {
        setRescheduling(null)
        const latest = await load()
        replacedAppointment = latest?.items.find(
          (item) => item.id === authoritativeReplacement?.id,
        )
      } else {
        setAppointments((items) => [created, ...items])
        setSlots((items) => items.filter((item) => item.id !== slot.id))
      }
      showActionToast({
        title: authoritativeReplacement
          ? 'Đã gửi yêu cầu đổi lịch'
          : 'Đã gửi yêu cầu đặt lịch',
        description: authoritativeReplacement
          ? rescheduleOutcomeMessage(
              replacedAppointment?.cancellationCreditOutcome ?? null,
            )
          : 'Yêu cầu đang chờ chuyên gia xác nhận.',
      })
    } catch (caught) {
      setActionError(errorMessage(caught))
    } finally {
      setSubmitting(null)
    }
  }

  async function cancelAppointment(appointment: Appointment) {
    setSubmitting(appointment.id)
    setActionError('')
    try {
      const reconciled = await refreshAppointment(appointment.id)
      if (!isChangeable(reconciled.appointment)) {
        if (rescheduling?.id === appointment.id) setRescheduling(null)
        setActionError(
          'Lịch hẹn vừa được cập nhật và không còn có thể hủy. Hãy kiểm tra trạng thái mới nhất.',
        )
        return
      }
      const authoritativeAppointment = reconciled.appointment as Appointment
      const accepted = await confirm({
        title: 'Hủy lịch hẹn này?',
        description: isLateConfirmed(
          authoritativeAppointment,
          reconciled.generatedAt,
        )
          ? 'Lịch đã được xác nhận và còn dưới 24 giờ. Lượt tư vấn sẽ không được hoàn lại.'
          : 'Lịch sẽ được hủy và lịch sử thay đổi vẫn được lưu lại.',
        confirmLabel: 'Hủy lịch hẹn',
        cancelLabel: 'Giữ lịch',
        tone: 'danger',
      })
      if (!accepted) return
      const precommand = await refreshAppointment(appointment.id)
      if (!isChangeable(precommand.appointment)) {
        if (rescheduling?.id === appointment.id) setRescheduling(null)
        setActionError(
          'Lịch hẹn vừa được cập nhật và không còn có thể hủy. Hãy kiểm tra trạng thái mới nhất.',
        )
        return
      }
      if (
        !isLateConfirmed(authoritativeAppointment, reconciled.generatedAt) &&
        isLateConfirmed(
          precommand.appointment as Appointment,
          precommand.generatedAt,
        )
      ) {
        const acceptedLateWarning = await confirm({
          title: 'Lịch vừa đi vào mốc dưới 24 giờ',
          description: 'Nếu tiếp tục hủy, lượt tư vấn sẽ không được hoàn lại.',
          confirmLabel: 'Vẫn hủy lịch',
          cancelLabel: 'Giữ lịch',
          tone: 'danger',
        })
        if (!acceptedLateWarning) return
      }
      const appointmentToCancel = precommand.appointment as Appointment
      const cancelled = await appointmentBrowserClient.cancel(
        appointmentToCancel.id,
        appointmentToCancel.version,
        `appointment-cancel-${crypto.randomUUID()}`,
      )
      if (rescheduling?.id === appointment.id) setRescheduling(null)
      await load()
      showActionToast({
        title: 'Đã hủy lịch hẹn',
        description: cancellationOutcomeMessage(
          cancelled.cancellationCreditOutcome,
        ),
      })
    } catch (caught) {
      setActionError(errorMessage(caught))
    } finally {
      setSubmitting(null)
    }
  }

  function replacementText(item: Appointment) {
    if (item.replacesAppointmentId) {
      const previous = appointments.find(
        (candidate) => candidate.id === item.replacesAppointmentId,
      )
      return previous
        ? `Lịch thay thế cho ${format(previous.scheduledStartAt, previous.timezone)}`
        : 'Lịch thay thế'
    }
    if (item.replacedByAppointmentId) {
      const replacement = appointments.find(
        (candidate) => candidate.id === item.replacedByAppointmentId,
      )
      return replacement
        ? `Đã đổi sang ${format(replacement.scheduledStartAt, replacement.timezone)}`
        : 'Đã được đổi sang lịch mới'
    }
    return null
  }

  const now = generatedAt ? Date.parse(generatedAt) : 0
  const next = useMemo(
    () => nextAppointment(appointments, now),
    [appointments, now],
  )
  const pending = useMemo(
    () =>
      appointments
        .filter((appointment) => appointment.status === 'REQUESTED')
        .sort(
          (left, right) =>
            Date.parse(left.scheduledStartAt) -
            Date.parse(right.scheduledStartAt),
        )[0],
    [appointments],
  )
  const spotlightAppointment = next ?? pending
  const visibleAppointments = useMemo(
    () =>
      orderAppointmentsForDisplay(
        appointments.filter((appointment) =>
          matchesAppointmentFilter(appointment, filter, now),
        ),
      ),
    [appointments, filter, now],
  )
  const focusedAppointment = focusAppointmentId
    ? appointments.find((item) => item.id === focusAppointmentId)
    : undefined
  const slotGroups = useMemo(() => {
    const grouped = new Map<
      string,
      { key: string; label: string; shortLabel: string; slots: BookableSlot[] }
    >()
    for (const slot of [...slots].sort(
      (left, right) => Date.parse(left.startAt) - Date.parse(right.startAt),
    )) {
      const key = slotDateKey(slot)
      const group = grouped.get(key)
      if (group) group.slots.push(slot)
      else
        grouped.set(key, {
          key,
          label: slotDateLabel(slot),
          shortLabel: slotDateLabel(slot, true),
          slots: [slot],
        })
    }
    return [...grouped.values()]
  }, [slots])
  const activeSlotGroup =
    slotGroups.find((group) => group.key === selectedSlotDate) ?? slotGroups[0]
  const spotlightDate = spotlightAppointment
    ? dateTile(
        spotlightAppointment.scheduledStartAt,
        spotlightAppointment.timezone,
      )
    : null
  const isRefreshing = appointmentLoading || slotLoading

  const bookingSection = (
    <section
      className={styles.bookingPanel}
      id="available-slots"
      aria-labelledby="slots-title"
    >
      <header className={styles.bookingHeading}>
        <div>
          <span>{rescheduling ? 'Đang đổi lịch' : 'Đặt lịch trực tuyến'}</span>
          <h2 id="slots-title">
            {rescheduling ? 'Chọn thời gian mới' : 'Chọn thời gian phù hợp'}
          </h2>
          <p>
            Mỗi buổi kéo dài 60 phút. Lượt tư vấn chỉ được giữ sau khi bạn gửi
            yêu cầu.
          </p>
        </div>
        {!slotLoading && !slotError && (
          <b aria-label={`${slots.length} khung giờ`}>{slots.length}</b>
        )}
      </header>

      {rescheduling && (
        <div className={styles.rescheduleNotice} role="status">
          <div>
            <strong>
              Đang đổi lịch với {rescheduling.specialistDisplayName}
            </strong>
            <span>
              Lịch cũ lúc{' '}
              {format(rescheduling.scheduledStartAt, rescheduling.timezone)} chỉ
              được hủy khi yêu cầu mới được tạo thành công.
              {isLateConfirmed(rescheduling, generatedAt) &&
                ' Vì còn dưới 24 giờ, lượt tư vấn cũ sẽ không được hoàn lại và lịch mới cần một lượt tư vấn khác.'}
            </span>
          </div>
          <button type="button" onClick={() => setRescheduling(null)}>
            Giữ lịch hiện tại
          </button>
        </div>
      )}

      {slotError && (
        <div className={styles.sectionError} role="alert">
          <div>
            <strong>Chưa thể tải khung giờ</strong>
            <span>{slotError}</span>
          </div>
          <button type="button" onClick={() => void loadSlots()}>
            Thử lại
          </button>
        </div>
      )}

      {slotLoading && slots.length === 0 ? (
        <div className={styles.slotSkeleton} aria-busy="true">
          {[0, 1, 2].map((item) => (
            <i key={item} />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <div className={styles.slotEmpty}>
          <Icon name="calendar" />
          <strong>Chưa có khung giờ phù hợp</strong>
          <p>Hãy tải lại sau để xem lịch trống mới nhất.</p>
        </div>
      ) : (
        <div className={styles.slotBrowser}>
          <div
            className={styles.dateChoices}
            role="group"
            aria-label="Chọn ngày tư vấn"
          >
            {slotGroups.map((group) => (
              <button
                key={group.key}
                type="button"
                aria-pressed={activeSlotGroup?.key === group.key}
                onClick={() => setSelectedSlotDate(group.key)}
              >
                <span>{group.shortLabel}</span>
                <small>{group.slots.length} giờ trống</small>
              </button>
            ))}
          </div>

          {activeSlotGroup && (
            <div className={styles.slotResults}>
              <div className={styles.slotResultsHeading}>
                <strong>{activeSlotGroup.label}</strong>
                <span>{activeSlotGroup.slots.length} lựa chọn</span>
              </div>
              <div className={styles.slotList}>
                {activeSlotGroup.slots.map((slot) => (
                  <article className={styles.slotRow} key={slot.id}>
                    <div className={styles.slotIcon} aria-hidden="true">
                      <Icon name="clock" />
                    </div>
                    <div className={styles.slotCopy}>
                      <strong>
                        {formatTimeRange(
                          slot.startAt,
                          slot.endAt,
                          slot.timezone,
                        )}
                      </strong>
                      <p>{slot.specialistDisplayName}</p>
                      <span>
                        {slot.modality === 'IN_APP_CHAT'
                          ? 'Chat trong ứng dụng'
                          : 'Video trong ứng dụng'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={
                        rescheduling || !spotlightAppointment
                          ? styles.slotAction
                          : styles.slotActionSecondary
                      }
                      onClick={() => void request(slot)}
                      disabled={submitting !== null}
                      aria-label={
                        rescheduling
                          ? `Đổi lịch sang ${formatSlotRange(slot.startAt, slot.endAt, slot.timezone)} với ${slot.specialistDisplayName}`
                          : `Yêu cầu lịch hẹn với ${slot.specialistDisplayName}, ${formatSlotRange(slot.startAt, slot.endAt, slot.timezone)}`
                      }
                    >
                      {submitting === slot.id
                        ? 'Đang gửi…'
                        : rescheduling
                          ? 'Chọn giờ này'
                          : 'Chọn giờ này'}
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Tư vấn trực tuyến</span>
          <h1>
            {focusAppointmentId ? 'Chi tiết lịch hẹn' : 'Lịch hẹn của bạn'}
          </h1>
          <p>
            {focusAppointmentId
              ? 'Xem trạng thái, chuẩn bị cho buổi tư vấn và quản lý lịch hẹn này.'
              : 'Biết rõ cuộc hẹn nào cần chú ý, điều gì sẽ diễn ra tiếp theo và khi nào bạn có thể trao đổi.'}
          </p>
        </div>
        <div className={styles.headerActions}>
          {focusAppointmentId ? (
            <Link className={styles.mobileBookingLink} href="/appointments">
              ← Tất cả lịch hẹn
            </Link>
          ) : (
            <a className={styles.mobileBookingLink} href="#available-slots">
              Đặt lịch mới
            </a>
          )}
        </div>
      </header>

      {actionError && (
        <div className={styles.pageError} role="alert">
          <span aria-hidden="true">!</span>
          <p>{actionError}</p>
          <button type="button" onClick={() => setActionError('')}>
            Đóng
          </button>
        </div>
      )}
      {focusAppointmentId && appointmentError && (
        <div className={styles.pageError} role="alert">
          <div>
            <strong>Chưa thể tải lịch hẹn</strong>
            <p>{appointmentError}</p>
          </div>
          <button
            type="button"
            onClick={() => void loadAppointments()}
            disabled={appointmentLoading}
          >
            Thử lại
          </button>
        </div>
      )}
      {focusAppointmentId ? (
        appointmentLoading && appointments.length === 0 ? (
          <section
            className={`${styles.detailPanel} ${styles.nextSkeleton}`}
            aria-label="Đang tải chi tiết lịch hẹn"
            aria-busy="true"
          >
            <i />
            <div>
              <i />
              <i />
              <i />
            </div>
          </section>
        ) : focusedAppointment ? (
          <>
            <article
              className={styles.detailPanel}
              id="appointment-from-reminder"
              aria-labelledby="appointment-detail-title"
            >
              <div className={styles.detailSummary}>
                <time
                  className={styles.nextDate}
                  dateTime={focusedAppointment.scheduledStartAt}
                >
                  <span>
                    {
                      dateTile(
                        focusedAppointment.scheduledStartAt,
                        focusedAppointment.timezone,
                      ).weekday
                    }
                  </span>
                  <strong>
                    {
                      dateTile(
                        focusedAppointment.scheduledStartAt,
                        focusedAppointment.timezone,
                      ).day
                    }
                  </strong>
                  <small>
                    Tháng{' '}
                    {
                      dateTile(
                        focusedAppointment.scheduledStartAt,
                        focusedAppointment.timezone,
                      ).month
                    }
                  </small>
                </time>
                <div className={styles.detailLead}>
                  <div className={styles.nextLabelRow}>
                    <span>Buổi tư vấn với</span>
                    <span
                      className={styles.status}
                      data-tone={statusTone(focusedAppointment.status)}
                    >
                      {appointmentStatus[focusedAppointment.status]}
                    </span>
                  </div>
                  <h2 id="appointment-detail-title">
                    {focusedAppointment.specialistDisplayName}
                  </h2>
                  <p className={styles.guidance}>
                    {appointmentGuidance(focusedAppointment)}
                  </p>
                </div>
              </div>

              <dl className={styles.detailFacts}>
                <div>
                  <dt>Thời gian</dt>
                  <dd>
                    {format(
                      focusedAppointment.scheduledStartAt,
                      focusedAppointment.timezone,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Hình thức</dt>
                  <dd>
                    {focusedAppointment.modality === 'IN_APP_CHAT'
                      ? 'Chat trong ứng dụng'
                      : 'Video trong ứng dụng'}
                  </dd>
                </div>
                <div>
                  <dt>Lượt tư vấn</dt>
                  <dd>
                    {focusedAppointment.cancellationCreditOutcome ===
                    'TRANSFERRED_TO_REPLACEMENT'
                      ? 'Đã chuyển sang lịch mới'
                      : focusedAppointment.cancellationCreditOutcome ===
                          'FORFEITED'
                        ? 'Không được hoàn lại'
                        : focusedAppointment.cancellationCreditOutcome ===
                            'RELEASED'
                          ? 'Đã được hoàn lại'
                          : creditOutcome[focusedAppointment.creditState]}
                  </dd>
                </div>
                {focusedAppointment.status === 'REQUESTED' && (
                  <div>
                    <dt>Phản hồi trước</dt>
                    <dd>
                      {format(
                        focusedAppointment.decisionDeadlineAt,
                        focusedAppointment.timezone,
                      )}
                    </dd>
                  </div>
                )}
              </dl>

              <div className={styles.detailActions}>
                {canOpenChat(focusedAppointment) && (
                  <Link
                    className={styles.primaryAction}
                    href={`/messages?appointmentId=${encodeURIComponent(focusedAppointment.id)}`}
                    aria-label={`Mở tin nhắn với ${focusedAppointment.specialistDisplayName}, buổi ${format(focusedAppointment.scheduledStartAt, focusedAppointment.timezone)}`}
                  >
                    <Icon name="message" />
                    Mở tin nhắn
                  </Link>
                )}
                {(focusedAppointment.status === 'REQUESTED' ||
                  focusedAppointment.status === 'CONFIRMED') && (
                  <>
                    <button
                      type="button"
                      className={styles.secondaryAction}
                      onClick={() => {
                        setRescheduling(focusedAppointment)
                        window.requestAnimationFrame(() => {
                          const booking =
                            document.getElementById('available-slots')
                          if (typeof booking?.scrollIntoView === 'function') {
                            booking.scrollIntoView({
                              behavior: window.matchMedia(
                                '(prefers-reduced-motion: reduce)',
                              ).matches
                                ? 'auto'
                                : 'smooth',
                            })
                          }
                        })
                      }}
                      disabled={submitting !== null}
                    >
                      Đổi lịch
                    </button>
                    <button
                      type="button"
                      className={styles.dangerAction}
                      onClick={() => void cancelAppointment(focusedAppointment)}
                      disabled={submitting !== null}
                    >
                      {submitting === focusedAppointment.id
                        ? 'Đang hủy…'
                        : 'Hủy lịch'}
                    </button>
                  </>
                )}
                {focusedAppointment.status === 'COMPLETED' && (
                  <AppointmentRatingDialog appointment={focusedAppointment} />
                )}
                {['REJECTED', 'EXPIRED', 'CANCELLED'].includes(
                  focusedAppointment.status,
                ) && (
                  <a className={styles.primaryAction} href="#available-slots">
                    Chọn lịch mới
                  </a>
                )}
              </div>

              {replacementText(focusedAppointment) && (
                <p className={styles.relationship}>
                  {replacementText(focusedAppointment)}
                </p>
              )}

              {focusedAppointment.status === 'CANCELLED' && (
                <div className={styles.audit}>
                  <strong>Thông tin hủy lịch</strong>
                  <span>
                    {focusedAppointment.cancellationActor === 'USER'
                      ? 'Bạn'
                      : 'Quản trị viên'}{' '}
                    đã hủy vào{' '}
                    {focusedAppointment.cancelledAt
                      ? format(
                          focusedAppointment.cancelledAt,
                          focusedAppointment.timezone,
                        )
                      : ''}
                  </span>
                  <span>
                    {focusedAppointment.cancellationReason ===
                    'USER_RESCHEDULED'
                      ? 'Lý do: đổi sang lịch mới'
                      : focusedAppointment.cancellationReason ===
                          'SPECIALIST_SUSPENDED'
                        ? 'Lý do: chuyên gia tạm ngưng nhận lịch'
                        : 'Lý do: bạn yêu cầu hủy'}
                  </span>
                </div>
              )}
            </article>

            {focusedAppointment.status === 'CONFIRMED' && (
              <section
                className={styles.detailSection}
                aria-labelledby="preparation-title"
              >
                <div className={styles.detailSectionHeading}>
                  <span>Trước buổi tư vấn</span>
                  <h2 id="preparation-title">
                    Chuẩn bị điều bạn muốn trao đổi
                  </h2>
                  <p>
                    Ghi lại những điều quan trọng để buổi tư vấn đi đúng trọng
                    tâm của bạn.
                  </p>
                </div>
                <ConsultationBriefEditor
                  appointmentId={focusedAppointment.id}
                />
              </section>
            )}

            {focusedAppointment.status === 'COMPLETED' && (
              <SessionSummaryPanel
                appointmentId={focusedAppointment.id}
                viewer="USER"
              />
            )}

            {focusedAppointment.sessionSettledAt &&
              ['SESSION_ENDED', 'COMPLETED'].includes(
                focusedAppointment.status,
              ) && (
                <AppointmentDisputePanel
                  appointment={focusedAppointment}
                  role="USER"
                  generatedAt={generatedAt}
                />
              )}

            {focusedAppointment.history.length > 0 && (
              <Disclosure
                className={styles.historyPanel}
                summary="Lịch sử thay đổi"
              >
                <ol>
                  {focusedAppointment.history.map((event) => (
                    <li key={event.eventId}>
                      <span>{historyReason[event.reason]}</span>
                      <time>
                        {format(event.occurredAt, focusedAppointment.timezone)}
                      </time>
                    </li>
                  ))}
                </ol>
              </Disclosure>
            )}

            {(rescheduling ||
              ['REJECTED', 'EXPIRED', 'CANCELLED'].includes(
                focusedAppointment.status,
              )) &&
              bookingSection}
          </>
        ) : !appointmentError ? (
          <section className={styles.notFound} role="status">
            <Icon name="calendar" />
            <h2>Không tìm thấy lịch hẹn này</h2>
            <p>
              Lịch hẹn không còn trong tài khoản hoặc đường dẫn đã cũ. Hãy mở
              danh sách mới nhất để tiếp tục.
            </p>
            <Link href="/appointments">Xem tất cả lịch hẹn</Link>
          </section>
        ) : null
      ) : (
        <>
          {appointmentLoading && appointments.length === 0 ? (
            <section
              className={`${styles.nextAppointment} ${styles.nextSkeleton}`}
              aria-label="Đang tải cuộc hẹn tiếp theo"
              aria-busy="true"
            >
              <i />
              <div>
                <i />
                <i />
                <i />
              </div>
            </section>
          ) : spotlightAppointment && spotlightDate ? (
            <section
              className={styles.nextAppointment}
              aria-labelledby="next-appointment-title"
            >
              <time
                className={styles.nextDate}
                dateTime={spotlightAppointment.scheduledStartAt}
              >
                <span>{spotlightDate.weekday}</span>
                <strong>{spotlightDate.day}</strong>
                <small>Tháng {spotlightDate.month}</small>
              </time>
              <div className={styles.nextCopy}>
                <div className={styles.nextLabelRow}>
                  <span id="next-appointment-title">
                    {spotlightAppointment.status === 'REQUESTED'
                      ? 'Yêu cầu đang chờ'
                      : 'Cuộc hẹn tiếp theo'}
                  </span>
                  <span
                    className={styles.status}
                    data-tone={statusTone(spotlightAppointment.status)}
                  >
                    {appointmentStatus[spotlightAppointment.status]}
                  </span>
                </div>
                <h2>{spotlightAppointment.specialistDisplayName}</h2>
                <p>
                  <Icon name="clock" />
                  <span>
                    {format(
                      spotlightAppointment.scheduledStartAt,
                      spotlightAppointment.timezone,
                    )}
                  </span>
                  <b aria-hidden="true">·</b>
                  <span>
                    {spotlightAppointment.modality === 'IN_APP_CHAT'
                      ? 'Chat trong ứng dụng'
                      : 'Video trong ứng dụng'}
                  </span>
                </p>
                <strong>
                  {spotlightAppointment.status === 'REQUESTED'
                    ? appointmentGuidance(spotlightAppointment)
                    : spotlightAppointment.modality === 'IN_APP_CHAT'
                      ? appointmentTimingCopy(spotlightAppointment)
                      : 'Phiên video đã được xác nhận'}
                </strong>
              </div>
              <div className={styles.nextActions}>
                <Link
                  className={
                    spotlightAppointment.status === 'REQUESTED'
                      ? styles.primaryAction
                      : undefined
                  }
                  href={`/appointments/${encodeURIComponent(spotlightAppointment.id)}`}
                >
                  Xem chi tiết
                </Link>
                {spotlightAppointment.modality === 'IN_APP_CHAT' &&
                  spotlightAppointment.status !== 'REQUESTED' && (
                    <Link
                      className={styles.primaryAction}
                      href={`/messages?appointmentId=${encodeURIComponent(spotlightAppointment.id)}`}
                      aria-label={`Mở tin nhắn với ${spotlightAppointment.specialistDisplayName}, buổi ${format(spotlightAppointment.scheduledStartAt, spotlightAppointment.timezone)}`}
                    >
                      <Icon name="message" />
                      Mở tin nhắn
                      <Icon name="arrow" />
                    </Link>
                  )}
              </div>
            </section>
          ) : (
            <section
              className={styles.nextEmpty}
              aria-label="Cuộc hẹn tiếp theo"
            >
              <div className={styles.nextEmptyIcon} aria-hidden="true">
                <Icon name="calendar" />
              </div>
              <div>
                <span>Cuộc hẹn tiếp theo</span>
                <h2>Chưa có lịch tư vấn sắp tới</h2>
                <p>Chọn một khung giờ phù hợp để gửi yêu cầu tới chuyên gia.</p>
              </div>
              <a className={styles.primaryAction} href="#available-slots">
                Xem khung giờ
                <Icon name="arrow" />
              </a>
            </section>
          )}

          <div className={styles.workspace}>
            <section
              className={styles.appointmentPanel}
              aria-labelledby="requested-title"
            >
              <header className={styles.appointmentHeading}>
                <div className={styles.appointmentTitleRow}>
                  <div>
                    <span>Lịch tư vấn</span>
                    <h2 id="requested-title">Tất cả cuộc hẹn</h2>
                  </div>
                  <div className={styles.appointmentTools}>
                    <p className={styles.resultStatus} aria-live="polite">
                      {appointmentLoading && appointments.length > 0
                        ? 'Đang cập nhật lịch hẹn…'
                        : `Hiển thị ${visibleAppointments.length} lịch hẹn`}
                    </p>
                    <button
                      className={styles.refreshButton}
                      type="button"
                      onClick={() => void load()}
                      disabled={isRefreshing}
                    >
                      <Icon name="refresh" />
                      <span>{isRefreshing ? 'Đang cập nhật…' : 'Tải lại'}</span>
                    </button>
                  </div>
                </div>
                <div
                  className={styles.filters}
                  role="group"
                  aria-label="Lọc lịch hẹn"
                >
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
              </header>

              {appointmentError && (
                <div className={styles.sectionError} role="alert">
                  <div>
                    <strong>Chưa thể tải lịch hẹn</strong>
                    <span>{appointmentError}</span>
                  </div>
                  <button type="button" onClick={() => void loadAppointments()}>
                    Thử lại
                  </button>
                </div>
              )}

              {appointmentLoading && appointments.length === 0 ? (
                <div className={styles.listSkeleton} aria-busy="true">
                  {[0, 1, 2].map((item) => (
                    <i key={item} />
                  ))}
                </div>
              ) : appointments.length === 0 ? (
                <div className={styles.emptyState}>
                  <div aria-hidden="true">
                    <Icon name="calendar" />
                  </div>
                  <h3>Bạn chưa có lịch hẹn</h3>
                  <p>
                    Khung giờ bạn chọn sẽ xuất hiện tại đây để tiện theo dõi.
                  </p>
                  <a href="#available-slots">Chọn khung giờ đầu tiên</a>
                </div>
              ) : visibleAppointments.length === 0 ? (
                <div className={styles.emptyState}>
                  <div aria-hidden="true">
                    <Icon name="calendar" />
                  </div>
                  <h3>Không có lịch trong nhóm này</h3>
                  <p>Chọn nhóm khác để xem các cuộc hẹn còn lại.</p>
                  <button type="button" onClick={() => setFilter('all')}>
                    Xem tất cả lịch hẹn
                  </button>
                </div>
              ) : (
                <div className={styles.appointmentList}>
                  {visibleAppointments.map((item) => {
                    const itemDate = dateTile(
                      item.scheduledStartAt,
                      item.timezone,
                    )
                    const relation = replacementText(item)
                    return (
                      <article
                        className={styles.appointmentRow}
                        key={item.id}
                        id={`appointment-${item.id}`}
                      >
                        <time
                          className={styles.dateTile}
                          dateTime={item.scheduledStartAt}
                        >
                          <span>{itemDate.weekday}</span>
                          <strong>{itemDate.day}</strong>
                          <small>Tháng {itemDate.month}</small>
                        </time>

                        <div className={styles.appointmentBody}>
                          <div className={styles.rowHeading}>
                            <div>
                              <h3>{item.specialistDisplayName}</h3>
                              <p>
                                {formatTimeRange(
                                  item.scheduledStartAt,
                                  item.scheduledEndAt,
                                  item.timezone,
                                )}{' '}
                                ·{' '}
                                {item.modality === 'IN_APP_CHAT'
                                  ? 'Chat trong ứng dụng'
                                  : 'Video trong ứng dụng'}
                              </p>
                            </div>
                            <span
                              className={styles.status}
                              data-tone={statusTone(item.status)}
                            >
                              {appointmentStatus[item.status]}
                            </span>
                          </div>

                          <p className={styles.rowGuidance}>
                            {appointmentGuidance(item)}
                          </p>
                          {relation && (
                            <p className={styles.relationship}>{relation}</p>
                          )}

                          <div className={styles.rowFooter}>
                            <div className={styles.rowActions}>
                              {canOpenChat(item) && (
                                <Link
                                  className={styles.chatLink}
                                  href={`/messages?appointmentId=${encodeURIComponent(item.id)}`}
                                  aria-label={`Mở trò chuyện với ${item.specialistDisplayName}, buổi ${format(item.scheduledStartAt, item.timezone)}`}
                                >
                                  <Icon name="message" />
                                  Mở tin nhắn
                                </Link>
                              )}
                              <Link
                                className={styles.secondaryAction}
                                href={`/appointments/${encodeURIComponent(item.id)}`}
                                aria-label={`Xem chi tiết lịch hẹn với ${item.specialistDisplayName}, buổi ${format(item.scheduledStartAt, item.timezone)}`}
                              >
                                Xem chi tiết
                              </Link>
                            </div>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
          {bookingSection}
        </>
      )}
    </main>
  )
}
