'use client'

import { useCallback, useEffect, useState } from 'react'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import type {
  Appointment,
  BookableSlot,
} from '@/lib/consultation/consultation-validation'
import { appointmentBrowserClient } from '../api/browser-client'
import styles from './AppointmentRequestPanel.module.css'

function format(value: string, timezone: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value))
}

function errorMessage(error: unknown) {
  if (!(error instanceof ApiError))
    return 'Không thể gửi yêu cầu. Vui lòng thử lại.'
  const messages: Record<string, string> = {
    PAID_PLAN_REQUIRED: 'Bạn cần gói Plus hoặc Premium để đặt lịch.',
    APPOINTMENT_CREDIT_UNAVAILABLE:
      'Không còn credit phù hợp cho khung giờ này.',
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
  }
  return (
    messages[error.code] ?? 'Dịch vụ đặt lịch đang tạm thời không khả dụng.'
  )
}

export default function AppointmentRequestPanel() {
  const { showActionToast } = useFeedback()
  const [slots, setSlots] = useState<BookableSlot[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
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
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setLoading(false)
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
      })
      .catch((caught: unknown) => setError(errorMessage(caught)))
      .finally(() => setLoading(false))
  }, [])

  async function request(slot: BookableSlot) {
    setSubmitting(slot.id)
    setError('')
    try {
      const created = await appointmentBrowserClient.request(
        slot.id,
        slot.modality,
        `appointment-${crypto.randomUUID()}`,
      )
      setAppointments((items) => [created, ...items])
      setSlots((items) => items.filter((item) => item.id !== slot.id))
      showActionToast({
        title: 'Đã gửi yêu cầu đặt lịch',
        description: 'Yêu cầu đang chờ chuyên gia xác nhận.',
      })
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span>ĐẶT LỊCH TRỰC TUYẾN</span>
          <h1>Lịch hẹn của bạn</h1>
          <p>
            Chọn một khung giờ 60 phút. Một credit sẽ được giữ trong khi chờ
            chuyên gia quyết định.
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
                  {item.status === 'REQUESTED'
                    ? 'Đang chờ xác nhận'
                    : item.status === 'IN_PROGRESS'
                      ? 'Đang diễn ra'
                      : item.status}
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
                    <dt>Credit</dt>
                    <dd>Đang được giữ</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
      <section aria-labelledby="slots-title">
        <h2 id="slots-title">Khung giờ có thể chọn</h2>
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
                  {submitting === slot.id ? 'Đang gửi…' : 'Yêu cầu lịch hẹn'}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
