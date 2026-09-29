'use client'

import { useCallback, useEffect, useState } from 'react'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import type {
  Appointment,
  BookableSlot,
} from '@/lib/consultation/consultation-validation'
import { appointmentBrowserClient } from '../api/browser-client'
import { ConsultationBriefEditor } from './ConsultationBriefEditor'
import styles from './AppointmentRequestPanel.module.css'

function format(value: string, timezone: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value))
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
  REQUESTED: 'Đang chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  IN_PROGRESS: 'Đang diễn ra',
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

function errorMessage(error: unknown) {
  if (!(error instanceof ApiError))
    return 'Không thể gửi yêu cầu. Vui lòng thử lại.'
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
  return messages[error.code] ?? 'Lịch hẹn tạm thời chưa thể cập nhật.'
}

export default function AppointmentRequestPanel() {
  const { confirm, showActionToast } = useFeedback()
  const [slots, setSlots] = useState<BookableSlot[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [generatedAt, setGeneratedAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [available, existing] = await Promise.all([
        appointmentBrowserClient.slots(),
        appointmentBrowserClient.list(),
      ])
      setSlots(available.items)
      setAppointments(existing.items)
      setGeneratedAt(existing.generatedAt)
      return existing
    } catch (caught) {
      setError(errorMessage(caught))
      return null
    } finally {
      setLoading(false)
    }
  }, [])

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
    Promise.all([
      appointmentBrowserClient.slots(),
      appointmentBrowserClient.list(),
    ])
      .then(([available, existing]) => {
        setSlots(available.items)
        setAppointments(existing.items)
        setGeneratedAt(existing.generatedAt)
      })
      .catch((caught: unknown) => setError(errorMessage(caught)))
      .finally(() => setLoading(false))
  }, [])

  async function request(slot: BookableSlot) {
    setSubmitting(slot.id)
    setError('')
    try {
      const replacement = rescheduling
      let authoritativeReplacement = replacement
      if (replacement) {
        const reconciled = await refreshAppointment(replacement.id)
        if (!isChangeable(reconciled.appointment)) {
          setRescheduling(null)
          setError(
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
          setError(
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
      setError(errorMessage(caught))
    } finally {
      setSubmitting(null)
    }
  }

  async function cancelAppointment(appointment: Appointment) {
    setSubmitting(appointment.id)
    setError('')
    try {
      const reconciled = await refreshAppointment(appointment.id)
      if (!isChangeable(reconciled.appointment)) {
        if (rescheduling?.id === appointment.id) setRescheduling(null)
        setError(
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
        setError(
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
      setError(errorMessage(caught))
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

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span>ĐẶT LỊCH TRỰC TUYẾN</span>
          <h1>Lịch hẹn của bạn</h1>
          <p>
            Chọn một khung giờ 60 phút. Một lượt tư vấn sẽ được giữ trong khi
            chờ chuyên gia quyết định.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>
          Tải lại
        </button>
      </header>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <section aria-labelledby="requested-title">
        <h2 id="requested-title">Yêu cầu hiện tại</h2>
        {appointments.length === 0 ? (
          <p className={styles.empty}>Bạn chưa có yêu cầu đặt lịch.</p>
        ) : (
          <div className={styles.grid}>
            {appointments.map((item) => (
              <article className={styles.card} key={item.id}>
                <div className={styles.status}>
                  {appointmentStatus[item.status]}
                </div>
                <h3>{item.specialistDisplayName}</h3>
                <p>
                  {item.modality === 'IN_APP_CHAT'
                    ? 'Chat trong ứng dụng'
                    : 'Video trong ứng dụng'}
                </p>
                <dl>
                  <div>
                    <dt>Thời gian</dt>
                    <dd>{format(item.scheduledStartAt, item.timezone)}</dd>
                  </div>
                  <div>
                    <dt>Hạn quyết định</dt>
                    <dd>{format(item.decisionDeadlineAt, item.timezone)}</dd>
                  </div>
                  <div>
                    <dt>Lượt tư vấn</dt>
                    <dd>
                      {item.cancellationCreditOutcome ===
                      'TRANSFERRED_TO_REPLACEMENT'
                        ? 'Đã chuyển sang lịch mới'
                        : item.cancellationCreditOutcome === 'FORFEITED'
                          ? 'Không được hoàn lại'
                          : item.cancellationCreditOutcome === 'RELEASED'
                            ? 'Đã được hoàn lại'
                            : creditOutcome[item.creditState]}
                    </dd>
                  </div>
                </dl>
                {replacementText(item) && (
                  <p className={styles.relationship}>{replacementText(item)}</p>
                )}
                {item.status === 'CANCELLED' && (
                  <div className={styles.audit}>
                    <strong>Thông tin hủy lịch</strong>
                    <span>
                      {item.cancellationActor === 'USER'
                        ? 'Bạn'
                        : 'Quản trị viên'}{' '}
                      đã hủy vào{' '}
                      {item.cancelledAt
                        ? format(item.cancelledAt, item.timezone)
                        : ''}
                    </span>
                    <span>
                      {item.cancellationReason === 'USER_RESCHEDULED'
                        ? 'Lý do: đổi sang lịch mới'
                        : item.cancellationReason === 'SPECIALIST_SUSPENDED'
                          ? 'Lý do: chuyên gia tạm ngưng nhận lịch'
                          : 'Lý do: bạn yêu cầu hủy'}
                    </span>
                  </div>
                )}
                {item.history.length > 0 && (
                  <details className={styles.history}>
                    <summary>Lịch sử thay đổi</summary>
                    <ol>
                      {item.history.map((event) => (
                        <li key={event.eventId}>
                          <span>{appointmentStatus[event.toStatus]}</span>
                          <time>{format(event.occurredAt, item.timezone)}</time>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
                {(item.status === 'REQUESTED' ||
                  item.status === 'CONFIRMED') && (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={() => setRescheduling(item)}
                      disabled={submitting !== null}
                    >
                      Đổi lịch
                    </button>
                    <button
                      type="button"
                      className={styles.danger}
                      onClick={() => void cancelAppointment(item)}
                      disabled={submitting !== null}
                    >
                      {submitting === item.id ? 'Đang hủy…' : 'Hủy lịch'}
                    </button>
                  </div>
                )}
                {item.status === 'CONFIRMED' && (
                  <ConsultationBriefEditor appointmentId={item.id} />
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      <section aria-labelledby="slots-title">
        <h2 id="slots-title">Khung giờ có thể chọn</h2>
        {rescheduling && (
          <div className={styles.rescheduleNotice} role="status">
            <div>
              <strong>
                Chọn giờ mới cho lịch với {rescheduling.specialistDisplayName}
              </strong>
              <span>
                Lịch cũ lúc{' '}
                {format(rescheduling.scheduledStartAt, rescheduling.timezone)}{' '}
                chỉ được hủy khi yêu cầu mới được tạo thành công.
                {isLateConfirmed(rescheduling, generatedAt) &&
                  ' Vì còn dưới 24 giờ, lượt tư vấn cũ sẽ không được hoàn lại và lịch mới cần một lượt tư vấn khác.'}
              </span>
            </div>
            <button type="button" onClick={() => setRescheduling(null)}>
              Thôi đổi lịch
            </button>
          </div>
        )}
        {loading ? (
          <p className={styles.empty}>Đang tải khung giờ…</p>
        ) : slots.length === 0 ? (
          <p className={styles.empty}>Hiện chưa có khung giờ phù hợp.</p>
        ) : (
          <div className={styles.grid}>
            {slots.map((slot) => (
              <article className={styles.card} key={slot.id}>
                <div className={styles.mode}>
                  {slot.modality === 'IN_APP_CHAT' ? 'Chat' : 'Video'}
                </div>
                <h3>{slot.specialistDisplayName}</h3>
                <p>
                  {format(slot.startAt, slot.timezone)} –{' '}
                  {format(slot.endAt, slot.timezone)}
                </p>
                <button
                  type="button"
                  onClick={() => void request(slot)}
                  disabled={submitting !== null}
                >
                  {submitting === slot.id
                    ? 'Đang gửi…'
                    : rescheduling
                      ? 'Đổi sang giờ này'
                      : 'Yêu cầu lịch hẹn'}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
