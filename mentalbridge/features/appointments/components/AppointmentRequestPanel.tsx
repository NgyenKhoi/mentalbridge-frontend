'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  MoreVertical,
  Video,
} from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import type {
  Appointment,
  BookableSlot,
} from '@/lib/consultation/consultation-validation'
import { appointmentBrowserClient } from '../api/browser-client'
import {
  appointmentTimingCopy,
  nextAppointment,
  orderAppointmentsForDisplay,
} from '../model/appointment-view'
import { ConsultationBriefEditor } from './ConsultationBriefEditor'
import { AppointmentDisputePanel } from './AppointmentDisputePanel'
import { AppointmentRatingDialog } from './AppointmentRatingDialog'
import { SessionSummaryPanel } from './SessionSummaryPanel'
import { VideoConsultationPanel } from './VideoConsultationPanel'
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

function getRowDateInfo(dateStr: string, timezone = 'Asia/Ho_Chi_Minh') {
  const date = new Date(dateStr)
  const weekday = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'short',
    timeZone: timezone,
  })
    .format(date)
    .toUpperCase()
  const day = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    timeZone: timezone,
  }).format(date)
  const month =
    'Thg ' +
    new Intl.DateTimeFormat('vi-VN', {
      month: '2-digit',
      timeZone: timezone,
    }).format(date)
  return { weekday, day, month }
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

type DisplayAppointment = Pick<
  Appointment,
  | 'id'
  | 'specialistDisplayName'
  | 'status'
  | 'modality'
  | 'scheduledStartAt'
  | 'scheduledEndAt'
  | 'timezone'
> & { guidance: string; appointment?: Appointment }

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
        : 'Lịch đã được hệ thống xác nhận. Bạn có thể chuẩn bị câu hỏi trước phiên.'
    case 'IN_PROGRESS':
      return appointment.modality === 'IN_APP_CHAT'
        ? 'Phiên tư vấn đang diễn ra. Mở Tin nhắn để tiếp tục cuộc trò chuyện.'
        : 'Phiên tư vấn đang diễn ra.'
    case 'SESSION_ENDED':
      return 'Phiên đã kết thúc. Nội dung tóm tắt sẽ hiển thị khi có sẵn.'
    case 'COMPLETED':
      return appointment.modality === 'IN_APP_CHAT'
        ? 'Phiên đã hoàn tất. Bạn có thể xem lại cuộc trò chuyện theo quyền truy cập hiện tại.'
        : 'Phiên đã hoàn tất. Bạn có thể xem nội dung tóm tắt khi có sẵn.'
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
      appointment.status === 'COMPLETED' ||
      appointment.history.some((event) => event.toStatus === 'CONFIRMED'))
  )
}

function AppointmentCancellationInfo({
  appointment,
}: {
  appointment: Appointment
}) {
  if (appointment.status !== 'CANCELLED') return null

  const creditLabel =
    appointment.cancellationCreditOutcome === 'RELEASED'
      ? 'Đã được hoàn lại'
      : appointment.cancellationCreditOutcome === 'FORFEITED'
        ? 'Không được hoàn lại'
        : 'Lượt tư vấn đã được cập nhật'
  const reasonLabel =
    appointment.cancellationReason === 'USER_CANCELLED'
      ? 'Lý do: bạn yêu cầu hủy'
      : appointment.cancellationReason === 'USER_RESCHEDULED'
        ? 'Lý do: bạn đã đổi lịch'
        : 'Lịch hẹn đã hủy'

  return (
    <section
      className={styles.cancellationInfo}
      aria-label="Thông tin hủy lịch"
    >
      <h3>Thông tin hủy lịch</h3>
      <p>{creditLabel}</p>
      <p>{reasonLabel}</p>
      {appointment.history.length > 0 && (
        <details>
          <summary>Lịch sử thay đổi</summary>
          <ol>
            {appointment.history.map((event) => (
              <li key={event.eventId}>{appointmentStatus[event.toStatus]}</li>
            ))}
          </ol>
        </details>
      )}
    </section>
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
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('all')
  const [monthOffset, setMonthOffset] = useState(0)
  const [selectedDayKey, setSelectedDayKey] = useState('')
  const [appointmentLoading, setAppointmentLoading] = useState(true)
  const [slotLoading, setSlotLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null)
  const [appointmentError, setAppointmentError] = useState('')
  const [slotError, setSlotError] = useState('')
  const [actionError, setActionError] = useState('')
  const [detailAppointmentId, setDetailAppointmentId] = useState<string | null>(
    null,
  )
  const [detailView, setDetailView] = useState<
    'details' | 'notes' | 'record' | 'rating'
  >('details')
  const [bookingOpen, setBookingOpen] = useState(false)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)

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
      setSlots([])
      setSlotError(
        errorMessage(caught, 'Không thể tải khung giờ. Vui lòng thử lại.'),
      )
      return null
    } finally {
      setSlotLoading(false)
    }
  }, [])

  useEffect(() => {
    const openFromHeader = () => {
      setDetailAppointmentId(null)
      setRescheduling(null)
      setSelectedSlotId(null)
      setActionError('')
      setBookingOpen(true)
      void loadSlots()
    }
    window.addEventListener(
      'mentalbridge:open-appointment-booking',
      openFromHeader,
    )
    return () =>
      window.removeEventListener(
        'mentalbridge:open-appointment-booking',
        openFromHeader,
      )
  }, [loadSlots])

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
      const requestKey = `appointment-${crypto.randomUUID()}`
      const created = authoritativeReplacement?.originatingPlanActionId
        ? await appointmentBrowserClient.request(
            slot.id,
            slot.modality,
            requestKey,
            authoritativeReplacement.id,
            authoritativeReplacement.version,
            authoritativeReplacement.originatingPlanActionId,
          )
        : await appointmentBrowserClient.request(
            slot.id,
            slot.modality,
            requestKey,
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
      setBookingOpen(false)
      setSelectedSlotId(null)
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
        cancelLabel: 'Giữ lịch hẹn',
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
          cancelLabel: 'Giữ lịch hẹn',
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
      setDetailAppointmentId(null)
    } catch (caught) {
      setActionError(errorMessage(caught))
    } finally {
      setSubmitting(null)
    }
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

  const spotlightDateInfo = useMemo(() => {
    if (!spotlightAppointment) return null
    const info = getRowDateInfo(
      spotlightAppointment.scheduledStartAt,
      spotlightAppointment.timezone,
    )
    const time = formatTimeRange(
      spotlightAppointment.scheduledStartAt,
      spotlightAppointment.scheduledEndAt,
      spotlightAppointment.timezone,
    )
    return {
      weekday: info.weekday.toUpperCase(),
      day: `${info.day} ${info.month}`,
      time,
    }
  }, [spotlightAppointment])

  const spotlightInitials = useMemo(() => {
    const name = spotlightAppointment?.specialistDisplayName || ''
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (
        parts[parts.length - 2][0] + parts[parts.length - 1][0]
      ).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }, [spotlightAppointment?.specialistDisplayName])

  const displayItems = useMemo<DisplayAppointment[]>(
    () =>
      orderAppointmentsForDisplay(appointments).map((appointment) => ({
        ...appointment,
        appointment,
        guidance: appointmentGuidance(appointment),
      })),
    [appointments],
  )
  const filteredItems = useMemo(
    () =>
      displayItems.filter((item) =>
        filter === 'all'
          ? true
          : filter === 'upcoming'
            ? ['REQUESTED', 'CONFIRMED', 'IN_PROGRESS'].includes(item.status)
            : ['SESSION_ENDED', 'COMPLETED'].includes(item.status),
      ),
    [displayItems, filter],
  )
  const detailAppointment = detailAppointmentId
    ? appointments.find((item) => item.id === detailAppointmentId)
    : undefined
  const detailItem = detailAppointmentId
    ? displayItems.find((item) => item.id === detailAppointmentId)
    : undefined
  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId)
  const calendarAnchor = generatedAt ? new Date(generatedAt) : new Date()
  const calendarStart = new Date(
    calendarAnchor.getFullYear(),
    calendarAnchor.getMonth() + monthOffset,
    1,
  )
  const calendarYear = calendarStart.getFullYear()
  const calendarMonth = calendarStart.getMonth()
  const dayKey = (day: number) =>
    `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const slotsByDay = useMemo(() => {
    const grouped = new Map<string, BookableSlot[]>()
    for (const slot of [...slots].sort(
      (left, right) => Date.parse(left.startAt) - Date.parse(right.startAt),
    )) {
      const key = new Intl.DateTimeFormat('en-CA', {
        timeZone: slot.timezone,
      }).format(new Date(slot.startAt))
      grouped.set(key, [...(grouped.get(key) ?? []), slot])
    }
    return grouped
  }, [slots])
  const activeDayKey =
    selectedDayKey ||
    slotsByDay.keys().next().value ||
    dayKey(calendarAnchor.getDate())
  const daySlots = slotsByDay.get(activeDayKey) ?? []

  function openDetail(
    appointmentId: string,
    view: 'details' | 'notes' | 'record' | 'rating',
  ) {
    setDetailAppointmentId(appointmentId)
    setDetailView(view)
  }

  function openBooking(
    appointment?: Appointment,
    slotId: string | null = null,
  ) {
    setDetailAppointmentId(null)
    setRescheduling(appointment ?? null)
    setSelectedSlotId(slotId)
    setActionError('')
    setBookingOpen(true)
    void loadSlots()
  }

  const focusedAppointment = focusAppointmentId
    ? appointments.find((item) => item.id === focusAppointmentId)
    : undefined

  // If focusAppointmentId is present, render the appointment detail subpage
  const bookingDialog = (
    <Dialog
      open={bookingOpen}
      onOpenChange={(open) => {
        if (!open && !submitting) {
          setBookingOpen(false)
          setRescheduling(null)
          setSelectedSlotId(null)
        }
      }}
      labelledBy="appointment-booking-title"
      className={styles.appointmentDialog}
    >
      <div className={styles.dialogContent}>
        <div className={styles.dialogHeading}>
          <div>
            <span className={styles.eyebrow}>
              {rescheduling ? 'ĐỔI LỊCH HẸN' : 'ĐẶT HẸN NHANH'}
            </span>
            <h2 id="appointment-booking-title">
              {rescheduling ? 'Chọn thời gian mới' : 'Chọn khung giờ tư vấn'}
            </h2>
            <p>
              {rescheduling
                ? `Lịch hiện tại với ${rescheduling.specialistDisplayName}: ${format(rescheduling.scheduledStartAt, rescheduling.timezone)}.`
                : 'Chọn một khung giờ còn trống để gửi yêu cầu.'}
            </p>
          </div>
          <button
            type="button"
            className={styles.dialogClose}
            onClick={() => setBookingOpen(false)}
            disabled={Boolean(submitting)}
            aria-label="Đóng chọn khung giờ"
          >
            ×
          </button>
        </div>
        {rescheduling && (
          <p className={styles.bookingNote}>
            Lịch cũ chỉ được hủy khi yêu cầu mới được gửi thành công.
          </p>
        )}
        {rescheduling && isLateConfirmed(rescheduling, generatedAt) && (
          <p className={styles.bookingWarning}>
            Lịch đã xác nhận còn dưới 24 giờ. Lượt tư vấn cũ sẽ không được hoàn
            lại và lịch mới cần một lượt tư vấn đủ điều kiện khác.
          </p>
        )}
        {slotLoading && <p role="status">Đang tải khung giờ…</p>}
        {slotError && (
          <div role="alert">
            <p>Chưa thể tải khung giờ.</p>
            <button type="button" onClick={() => void loadSlots()}>
              Thử lại
            </button>
          </div>
        )}
        {!slotLoading && !slotError && slots.length === 0 && (
          <p>Hiện chưa có khung giờ trống. Bạn có thể xem lại sau.</p>
        )}
        <div
          className={styles.dialogSlotList}
          role="group"
          aria-label="Khung giờ còn trống"
        >
          {!slotLoading &&
            !slotError &&
            slots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                className={
                  selectedSlotId === slot.id
                    ? styles.dialogSlotSelected
                    : styles.dialogSlot
                }
                aria-pressed={selectedSlotId === slot.id}
                onClick={() => setSelectedSlotId(slot.id)}
                disabled={Boolean(submitting)}
              >
                <strong>
                  {formatSlotRange(slot.startAt, slot.endAt, slot.timezone)}
                </strong>
                <span>
                  {slot.specialistDisplayName} ·{' '}
                  {slot.modality === 'IN_APP_CHAT' ? 'Chat' : 'Video'}
                </span>
              </button>
            ))}
        </div>
        {actionError && (
          <p className={styles.dialogError} role="alert">
            {actionError}
          </p>
        )}
        <div className={styles.dialogActions}>
          <button
            type="button"
            className={styles.outlineBtn}
            onClick={() => setBookingOpen(false)}
            disabled={Boolean(submitting)}
          >
            Để sau
          </button>
          <button
            type="button"
            className={styles.primaryAction}
            onClick={() => {
              if (selectedSlot) void request(selectedSlot)
            }}
            disabled={!selectedSlot || Boolean(submitting)}
          >
            {submitting
              ? 'Đang gửi…'
              : rescheduling
                ? 'Gửi yêu cầu đổi lịch'
                : 'Gửi yêu cầu đặt lịch'}
          </button>
        </div>
      </div>
    </Dialog>
  )

  if (focusAppointmentId) {
    return (
      <>
        <main className={styles.page} data-appointments-ui="">
          <header className={styles.header}>
            <span className={styles.eyebrow}>TƯ VẤN SỨC KHỎE TÂM LÝ</span>
            <h1 className={styles.title}>Chi tiết lịch hẹn</h1>
            <p className={styles.subtitle}>
              Xem trạng thái, chuẩn bị cho buổi tư vấn và quản lý lịch hẹn này.
            </p>
            <div style={{ marginTop: '12px' }}>
              <Link className={styles.outlineBtn} href="/appointments">
                ← Tất cả lịch hẹn
              </Link>
            </div>
          </header>

          {actionError && (
            <div className={styles.pageError} role="alert">
              <p>{actionError}</p>
              <button type="button" onClick={() => setActionError('')}>
                Đóng
              </button>
            </div>
          )}

          {focusedAppointment ? (
            <div className={styles.detailPanel} id="appointment-from-reminder">
              <div className={styles.detailSummary}>
                <div className={styles.heroAvatar}>
                  {focusedAppointment.specialistDisplayName
                    .split(' ')
                    .pop()?.[0] || 'BS'}
                </div>
                <div className={styles.detailLead}>
                  <h2>{focusedAppointment.specialistDisplayName}</h2>
                  <span
                    className={
                      focusedAppointment.status === 'CONFIRMED'
                        ? styles.badgeGreen
                        : styles.badgeAmber
                    }
                  >
                    {appointmentStatus[focusedAppointment.status]}
                  </span>
                  <p
                    style={{
                      marginTop: '6px',
                      color: '#6b7280',
                      fontSize: '13px',
                    }}
                  >
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
                  <dt>Trạng thái</dt>
                  <dd>{appointmentStatus[focusedAppointment.status]}</dd>
                </div>
              </dl>

              <AppointmentCancellationInfo appointment={focusedAppointment} />

              <div className={styles.detailActions}>
                {canOpenChat(focusedAppointment) && (
                  <Link
                    className={styles.mintBtn}
                    href={`/messages?appointmentId=${encodeURIComponent(focusedAppointment.id)}`}
                  >
                    <MessageSquare size={16} /> Mở tin nhắn
                  </Link>
                )}
                {(focusedAppointment.status === 'REQUESTED' ||
                  focusedAppointment.status === 'CONFIRMED') && (
                  <>
                    <button
                      type="button"
                      className={styles.secondaryAction}
                      onClick={() => openBooking(focusedAppointment)}
                    >
                      Đổi lịch
                    </button>
                    <button
                      type="button"
                      className={styles.dangerAction}
                      onClick={() => void cancelAppointment(focusedAppointment)}
                    >
                      Hủy lịch
                    </button>
                  </>
                )}
                {focusedAppointment.status === 'COMPLETED' && (
                  <AppointmentRatingDialog appointment={focusedAppointment} />
                )}
              </div>

              {focusedAppointment.status === 'CONFIRMED' && (
                <div style={{ marginTop: '20px' }}>
                  <ConsultationBriefEditor
                    appointmentId={focusedAppointment.id}
                  />
                </div>
              )}

              {focusedAppointment.modality === 'IN_APP_VIDEO' && (
                <VideoConsultationPanel
                  appointmentId={focusedAppointment.id}
                  role="USER"
                  onVerified={() => void loadAppointments()}
                />
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
            </div>
          ) : (
            <div className={styles.detailPanel}>
              {appointmentLoading ? (
                <p role="status">Đang tải chi tiết cuộc hẹn…</p>
              ) : appointmentError ? (
                <div role="alert">
                  <p>Chưa thể tải lịch hẹn. Vui lòng thử lại.</p>
                  <button type="button" onClick={() => void loadAppointments()}>
                    Thử lại
                  </button>
                </div>
              ) : (
                <section role="status">
                  <h2>Không tìm thấy lịch hẹn này</h2>
                  <p>
                    Lịch hẹn không còn trong tài khoản hoặc đường dẫn đã cũ. Hãy
                    mở danh sách mới nhất để tiếp tục.
                  </p>
                  <Link className={styles.outlineBtn} href="/appointments">
                    Xem tất cả lịch hẹn
                  </Link>
                </section>
              )}
            </div>
          )}
        </main>
        {bookingDialog}
      </>
    )
  }

  return (
    <main className={styles.page} data-appointments-ui="">
      {/* Top Header */}
      <header className={styles.header}>
        <span className={styles.eyebrow}>TƯ VẤN SỨC KHỎE TÂM LÝ</span>
        <h1 className={styles.title}>Lịch hẹn của bạn</h1>
        <p className={styles.subtitle}>
          Quản lý hành trình chăm sóc bản thân. Mọi thông tin trao đổi giữa bạn
          và chuyên gia đều được mã hóa bảo mật tuyệt đối.
        </p>
      </header>

      {actionError && (
        <div className={styles.pageError} role="alert">
          <p>{actionError}</p>
          <button type="button" onClick={() => setActionError('')}>
            Đóng
          </button>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className={styles.mainGrid}>
        {/* Left Column: Hero Spotlight + Appointments List */}
        <div className={styles.leftCol}>
          {spotlightAppointment && spotlightDateInfo && (
            <section className={styles.heroCard} aria-label="Cuộc hẹn kế tiếp">
              <div className={styles.heroTop}>
                <span className={styles.heroPill}>
                  <span className={styles.greenDot} />{' '}
                  {appointmentTimingCopy(spotlightAppointment)}
                </span>
                <span className={styles.heroDuration}>
                  Thời lượng:{' '}
                  {Math.round(
                    (Date.parse(spotlightAppointment.scheduledEndAt) -
                      Date.parse(spotlightAppointment.scheduledStartAt)) /
                      60000,
                  )}{' '}
                  phút
                </span>
              </div>

              <div className={styles.heroBody}>
                <div className={styles.heroDateBox}>
                  <span className={styles.heroDateWeekday}>
                    {spotlightDateInfo.weekday}
                  </span>
                  <span className={styles.heroDateDay}>
                    {spotlightDateInfo.day}
                  </span>
                  <span className={styles.heroDateTime}>
                    {spotlightDateInfo.time}
                  </span>
                </div>

                <div className={styles.heroInfo}>
                  <div className={styles.heroSpecialistHeader}>
                    <div className={styles.heroAvatar}>{spotlightInitials}</div>
                    <div className={styles.heroSpecialistMeta}>
                      <h2 className={styles.heroSpecialistName}>
                        {spotlightAppointment.specialistDisplayName}
                      </h2>
                    </div>
                  </div>

                  <p className={styles.heroTopic}>
                    {appointmentGuidance(spotlightAppointment)}
                  </p>
                </div>
              </div>

              <div className={styles.heroFooter}>
                <div className={styles.heroSecureNotice}>
                  {spotlightAppointment?.modality === 'IN_APP_CHAT' ? (
                    <MessageSquare size={16} aria-hidden="true" />
                  ) : (
                    <Video size={16} aria-hidden="true" />
                  )}
                  <span>
                    {spotlightAppointment?.modality === 'IN_APP_CHAT'
                      ? 'Trao đổi trong Tin nhắn'
                      : 'Video trong ứng dụng'}
                  </span>
                </div>

                <div className={styles.heroActions}>
                  {isChangeable(spotlightAppointment) && (
                    <button
                      type="button"
                      className={styles.heroRescheduleBtn}
                      onClick={() => openBooking(spotlightAppointment)}
                    >
                      Đổi lịch
                    </button>
                  )}
                  <Link
                    href={
                      spotlightAppointment.modality === 'IN_APP_CHAT'
                        ? `/messages?appointmentId=${encodeURIComponent(spotlightAppointment.id)}`
                        : `/appointments/${encodeURIComponent(spotlightAppointment.id)}`
                    }
                    className={styles.heroEnterBtn}
                  >
                    <span>
                      {spotlightAppointment?.modality === 'IN_APP_CHAT'
                        ? 'Mở tin nhắn'
                        : 'Vào phòng tư vấn'}
                    </span>
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* Appointment List Card */}
          <section
            className={styles.listCard}
            aria-label="Danh sách các cuộc hẹn"
          >
            <div className={styles.listHeader}>
              <div className={styles.listHeaderLeft}>
                <h2 className={styles.listTitle}>Danh sách các cuộc hẹn</h2>
                <p className={styles.listSubtitle}>
                  Theo dõi phiên đang đợi duyệt, sắp tới và lịch sử ghi chú
                </p>
              </div>

              <div
                className={styles.filterTabs}
                role="tablist"
                aria-label="Lọc lịch hẹn"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === 'all'}
                  className={`${styles.filterTab} ${filter === 'all' ? styles.filterTabActive : ''}`}
                  onClick={() => setFilter('all')}
                >
                  Tất cả ({displayItems.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === 'upcoming'}
                  className={`${styles.filterTab} ${filter === 'upcoming' ? styles.filterTabActive : ''}`}
                  onClick={() => setFilter('upcoming')}
                >
                  Sắp tới (
                  {
                    displayItems.filter((item) =>
                      ['REQUESTED', 'CONFIRMED', 'IN_PROGRESS'].includes(
                        item.status,
                      ),
                    ).length
                  }
                  )
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === 'completed'}
                  className={`${styles.filterTab} ${filter === 'completed' ? styles.filterTabActive : ''}`}
                  onClick={() => setFilter('completed')}
                >
                  Đã hoàn tất (
                  {
                    displayItems.filter((item) =>
                      ['SESSION_ENDED', 'COMPLETED'].includes(item.status),
                    ).length
                  }
                  )
                </button>
              </div>
            </div>

            <div className={styles.rowsList}>
              {filteredItems.map((item) => {
                const dateInfo = getRowDateInfo(
                  item.scheduledStartAt,
                  item.timezone,
                )
                const isConfirmed = item.status === 'CONFIRMED'
                const isEnding =
                  item.status === 'SESSION_ENDED' ||
                  item.status === 'IN_PROGRESS'
                const isCompleted = item.status === 'COMPLETED'

                const dateBlockClass = isConfirmed
                  ? styles.dateBlockGreen
                  : isEnding
                    ? styles.dateBlockAmber
                    : styles.dateBlockGray

                const weekdayClass = isConfirmed
                  ? styles.dateWeekdayGreen
                  : isEnding
                    ? styles.dateWeekdayAmber
                    : styles.dateWeekdayGray

                const dayClass = isConfirmed
                  ? styles.dateDayGreen
                  : isEnding
                    ? styles.dateDayAmber
                    : styles.dateDayGray

                const monthClass = isConfirmed
                  ? styles.dateMonthGreen
                  : isEnding
                    ? styles.dateMonthAmber
                    : styles.dateMonthGray

                const badgeClass = isConfirmed
                  ? styles.badgeGreen
                  : isEnding
                    ? styles.badgeAmber
                    : styles.badgeGray

                const badgeLabel =
                  item.status === 'CONFIRMED'
                    ? 'Đã xác nhận'
                    : item.status === 'SESSION_ENDED'
                      ? 'Đang tổng hợp kết quả'
                      : item.status === 'COMPLETED'
                        ? 'Đã hoàn thành'
                        : appointmentStatus[item.status]

                const timeLabel = formatTimeRange(
                  item.scheduledStartAt,
                  item.scheduledEndAt,
                  item.timezone,
                )

                return (
                  <article className={styles.appointmentRow} key={item.id}>
                    <div className={dateBlockClass}>
                      <span className={weekdayClass}>{dateInfo.weekday}</span>
                      <strong className={dayClass}>{dateInfo.day}</strong>
                      <span className={monthClass}>{dateInfo.month}</span>
                    </div>

                    <div className={styles.rowContent}>
                      <div className={styles.rowTop}>
                        <h3 className={styles.specialistName}>
                          {item.specialistDisplayName}
                        </h3>
                        <span className={badgeClass}>{badgeLabel}</span>
                      </div>

                      <p className={styles.rowTime}>
                        <span>{timeLabel}</span>
                        <span>•</span>
                        {item.modality === 'IN_APP_VIDEO' ? (
                          <Video size={14} aria-hidden="true" />
                        ) : (
                          <MessageSquare size={14} aria-hidden="true" />
                        )}
                        <span>
                          {item.modality === 'IN_APP_CHAT'
                            ? 'Chat trực tuyến'
                            : 'Video Call'}
                        </span>
                      </p>

                      <p className={styles.rowNote}>{item.guidance}</p>
                    </div>

                    <div className={styles.rowActions}>
                      {(isConfirmed ||
                        (isCompleted && item.modality === 'IN_APP_CHAT') ||
                        (!isEnding && !isCompleted)) && (
                        <button
                          type="button"
                          className={styles.detailLink}
                          onClick={() => openDetail(item.id, 'details')}
                          aria-label={`Xem chi tiết lịch hẹn với ${item.specialistDisplayName}`}
                        >
                          Xem chi tiết
                        </button>
                      )}

                      {isConfirmed && (
                        <button
                          type="button"
                          className={styles.textActionBtn}
                          onClick={() => openDetail(item.id, 'details')}
                          aria-label={`Thêm thao tác với ${item.specialistDisplayName}`}
                        >
                          <MoreVertical size={16} aria-hidden="true" />
                        </button>
                      )}

                      {isEnding && (
                        <button
                          type="button"
                          className={styles.outlineBtn}
                          onClick={() => openDetail(item.id, 'notes')}
                        >
                          Xem ghi chú sơ bộ
                        </button>
                      )}

                      {isCompleted && item.modality === 'IN_APP_CHAT' && (
                        <Link
                          href={
                            item.appointment
                              ? `/messages?appointmentId=${encodeURIComponent(item.id)}`
                              : '/messages'
                          }
                          className={styles.mintBtn}
                        >
                          <MessageSquare size={14} /> Mở tin nhắn
                        </Link>
                      )}

                      {isCompleted && item.modality !== 'IN_APP_CHAT' && (
                        <>
                          <button
                            type="button"
                            className={styles.outlineBtn}
                            onClick={() => openDetail(item.id, 'record')}
                          >
                            Hồ sơ phiên
                          </button>
                          {item.appointment ? (
                            <AppointmentRatingDialog
                              appointment={item.appointment}
                              triggerLabel="Đánh giá"
                              triggerClassName={styles.textActionBtn}
                            />
                          ) : (
                            <button
                              type="button"
                              className={styles.textActionBtn}
                              onClick={() => openDetail(item.id, 'rating')}
                            >
                              Đánh giá
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </article>
                )
              })}
              {!appointmentLoading &&
                !appointmentError &&
                filteredItems.length === 0 && (
                  <p className={styles.emptyState}>
                    {appointments.length === 0
                      ? 'Bạn chưa có lịch hẹn nào. Chọn một khung giờ trống để bắt đầu.'
                      : 'Không có lịch hẹn trong nhóm này.'}
                  </p>
                )}
              {appointmentError && (
                <div className={styles.emptyState} role="alert">
                  <p>Chưa thể tải lịch hẹn. Vui lòng thử lại.</p>
                  <button type="button" onClick={() => void loadAppointments()}>
                    Thử lại
                  </button>
                </div>
              )}
            </div>

            <div className={styles.listFooter}>
              <span className={styles.listFooterCount}>
                Hiển thị {filteredItems.length} trên tổng số{' '}
                {displayItems.length} cuộc hẹn
              </span>
              <div className={styles.paginationBtns}>
                <button type="button" className={styles.pageBtn} disabled>
                  Trước
                </button>
                <button type="button" className={styles.pageBtn} disabled>
                  Sau
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Widgets */}
        <div className={styles.rightCol}>
          <section
            className={styles.quickBookingCard}
            aria-label="Đặt hẹn nhanh"
          >
            <div className={styles.quickBookingHeader}>
              <div>
                <span className={styles.quickBookingTag}>ĐẶT HẸN NHANH</span>
                <h3 className={styles.quickBookingTitle}>
                  Chọn thời gian phù hợp
                </h3>
              </div>
            </div>

            <div className={styles.calendarBox}>
              <div className={styles.calendarMonth}>
                <span>
                  Tháng {calendarMonth + 1}, {calendarYear}
                </span>
                <div>
                  <button
                    type="button"
                    className={styles.calendarNavBtn}
                    onClick={() => {
                      setMonthOffset((offset) => offset - 1)
                      setSelectedDayKey('')
                    }}
                    aria-label="Tháng trước"
                  >
                    <ChevronLeft size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.calendarNavBtn}
                    onClick={() => {
                      setMonthOffset((offset) => offset + 1)
                      setSelectedDayKey('')
                    }}
                    aria-label="Tháng sau"
                  >
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className={styles.calendarGrid}>
                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => (
                  <span className={styles.calWeekday} key={day}>
                    {day}
                  </span>
                ))}
                {Array.from(
                  { length: (calendarStart.getDay() + 6) % 7 },
                  (_, index) => (
                    <span
                      className={`${styles.calDay} ${styles.calDayMuted}`}
                      key={`previous-${index}`}
                      aria-hidden="true"
                    />
                  ),
                )}
                {Array.from(
                  {
                    length: new Date(
                      calendarYear,
                      calendarMonth + 1,
                      0,
                    ).getDate(),
                  },
                  (_, index) => {
                    const day = index + 1
                    const key = dayKey(day)
                    const available = slotsByDay.has(key)
                    return (
                      <button
                        type="button"
                        key={key}
                        className={`${styles.calDay} ${key === activeDayKey ? styles.calDaySelected : ''} ${available ? styles.calDayDotGreen : ''}`}
                        onClick={() => {
                          setSelectedDayKey(key)
                          setSelectedSlotId(null)
                        }}
                        aria-pressed={key === activeDayKey}
                        aria-label={`Ngày ${day}${available ? ', có khung giờ trống' : ''}`}
                      >
                        {day}
                      </button>
                    )
                  },
                )}
              </div>
            </div>
            <div className={styles.slotSelectSection}>
              <div className={styles.slotSelectHeading}>
                <span>Khung giờ trống</span>
                {!slotLoading && !slotError && (
                  <small>{daySlots.length} lựa chọn</small>
                )}
              </div>
              {slotLoading ? (
                <p role="status">Đang tải khung giờ…</p>
              ) : slotError ? (
                <div role="alert">
                  <p>Chưa thể tải khung giờ.</p>
                  <button type="button" onClick={() => void loadSlots()}>
                    Thử lại
                  </button>
                </div>
              ) : daySlots.length === 0 ? (
                <p>Ngày này chưa có khung giờ trống.</p>
              ) : (
                daySlots.map((slot) => {
                  const selected = selectedSlotId === slot.id
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      className={`${styles.slotOption} ${selected ? styles.slotOptionSelected : ''}`}
                      onClick={() => setSelectedSlotId(slot.id)}
                      aria-pressed={selected}
                    >
                      <span
                        className={`${styles.radioCircle} ${selected ? styles.radioCircleSelected : ''}`}
                        aria-hidden="true"
                      >
                        {selected && <span className={styles.radioDot} />}
                      </span>
                      <span className={styles.slotOptionInfo}>
                        <strong className={styles.slotOptionTime}>
                          {formatTimeRange(
                            slot.startAt,
                            slot.endAt,
                            slot.timezone,
                          )}
                        </strong>
                        <span className={styles.slotOptionDoctor}>
                          {slot.specialistDisplayName}
                        </span>
                      </span>
                      <span className={styles.slotBadgeMorning}>
                        {slot.modality === 'IN_APP_CHAT' ? 'Chat' : 'Video'}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
            <button
              type="button"
              className={styles.confirmSlotBtn}
              onClick={() => openBooking(undefined, selectedSlotId)}
            >
              <span>Xác nhận đặt khung giờ này</span>
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </section>
        </div>
      </div>

      <Dialog
        open={Boolean(detailItem)}
        onOpenChange={(open) => {
          if (!open) setDetailAppointmentId(null)
        }}
        labelledBy="appointment-detail-title"
        className={styles.appointmentDialog}
      >
        {detailItem && (
          <div className={styles.dialogContent}>
            <div className={styles.dialogHeading}>
              <div>
                <span className={styles.eyebrow}>CUỘC HẸN CỦA BẠN</span>
                <h2 id="appointment-detail-title">
                  {detailView === 'rating'
                    ? 'Đánh giá'
                    : detailView === 'record'
                      ? 'Hồ sơ phiên'
                      : detailView === 'notes'
                        ? 'Ghi chú phiên'
                        : 'Chi tiết lịch hẹn'}
                </h2>
                <p>
                  {detailItem.specialistDisplayName} ·{' '}
                  {appointmentStatus[detailItem.status]}
                </p>
              </div>
              <button
                type="button"
                className={styles.dialogClose}
                onClick={() => setDetailAppointmentId(null)}
                aria-label="Đóng chi tiết lịch hẹn"
              >
                ×
              </button>
            </div>
            <dl className={styles.detailFacts}>
              <div>
                <dt>Thời gian</dt>
                <dd>
                  {formatSlotRange(
                    detailItem.scheduledStartAt,
                    detailItem.scheduledEndAt,
                    detailItem.timezone,
                  )}
                </dd>
              </div>
              <div>
                <dt>Hình thức</dt>
                <dd>
                  {detailItem.modality === 'IN_APP_CHAT'
                    ? 'Chat trong ứng dụng'
                    : 'Video trong ứng dụng'}
                </dd>
              </div>
              <div>
                <dt>Trạng thái</dt>
                <dd>{appointmentStatus[detailItem.status]}</dd>
              </div>
            </dl>
            {detailAppointment && (
              <AppointmentCancellationInfo appointment={detailAppointment} />
            )}
            {detailView === 'details' && <p>{detailItem.guidance}</p>}
            {detailView === 'notes' &&
              (detailAppointment ? (
                detailAppointment.status === 'CONFIRMED' ? (
                  <ConsultationBriefEditor
                    appointmentId={detailAppointment.id}
                  />
                ) : (
                  <SessionSummaryPanel
                    appointmentId={detailAppointment.id}
                    viewer="USER"
                  />
                )
              ) : (
                <p>{detailItem.guidance}</p>
              ))}
            {detailView === 'record' && detailAppointment && (
              <SessionSummaryPanel
                appointmentId={detailAppointment.id}
                viewer="USER"
              />
            )}
            {detailView === 'record' && !detailAppointment && (
              <p>{detailItem.guidance}</p>
            )}
            {actionError && (
              <p className={styles.dialogError} role="alert">
                {actionError}
              </p>
            )}
            <div className={styles.dialogActions}>
              {detailAppointment && canOpenChat(detailAppointment) && (
                <Link
                  className={styles.mintBtn}
                  href={`/messages?appointmentId=${encodeURIComponent(detailAppointment.id)}`}
                >
                  Mở tin nhắn
                </Link>
              )}
              {detailAppointment?.modality === 'IN_APP_VIDEO' &&
                detailAppointment.status === 'CONFIRMED' && (
                  <Link
                    className={styles.outlineBtn}
                    href={`/appointments/${encodeURIComponent(detailAppointment.id)}`}
                  >
                    Vào phòng tư vấn
                  </Link>
                )}
              {detailAppointment?.modality !== 'IN_APP_VIDEO' &&
                detailAppointment?.status === 'CONFIRMED' && (
                  // The consultation brief editor lives on the detail route.
                  <Link
                    className={styles.outlineBtn}
                    href={`/appointments/${encodeURIComponent(detailAppointment.id)}`}
                  >
                    Chuẩn bị cho buổi tư vấn
                  </Link>
                )}
              {detailAppointment && isChangeable(detailAppointment) && (
                <>
                  <button
                    type="button"
                    className={styles.outlineBtn}
                    onClick={() => openBooking(detailAppointment)}
                  >
                    Đổi lịch
                  </button>
                  <button
                    type="button"
                    className={styles.dangerAction}
                    onClick={() => void cancelAppointment(detailAppointment)}
                    disabled={Boolean(submitting)}
                  >
                    Hủy lịch
                  </button>
                </>
              )}
              {detailAppointment?.status === 'COMPLETED' && (
                <AppointmentRatingDialog
                  appointment={detailAppointment}
                  triggerLabel="Đánh giá"
                />
              )}
              {detailAppointment?.sessionSettledAt &&
                ['SESSION_ENDED', 'COMPLETED'].includes(
                  detailAppointment.status,
                ) && (
                  // Disputes live on the detail route (AppointmentDisputePanel).
                  <Link
                    className={styles.outlineBtn}
                    href={`/appointments/${encodeURIComponent(detailAppointment.id)}`}
                  >
                    Xem chi tiết và phản hồi kết quả
                  </Link>
                )}
            </div>
          </div>
        )}
      </Dialog>

      {bookingDialog}

      <Link
        href="/messages"
        className={styles.floatingChatBtn}
        aria-label="Mở tin nhắn trực tuyến"
      >
        <MessageSquare size={22} aria-hidden="true" />
      </Link>
    </main>
  )
}
