'use client'

import { useEffect, useRef, useState } from 'react'
import { ApiError } from '@/lib/api/api-error'
import type {
  Appointment,
  AppointmentDispute,
  OpenAppointmentDisputeInput,
} from '@/lib/consultation/consultation-validation'
import { appointmentBrowserClient } from '../api/browser-client'
import styles from './AppointmentDisputePanel.module.css'

const REASONS: ReadonlyArray<{
  value: OpenAppointmentDisputeInput['reasonCode']
  label: string
}> = [
  { value: 'OUTCOME_INCORRECT', label: 'Kết quả phiên chưa đúng' },
  {
    value: 'PARTICIPATION_EVIDENCE_INCORRECT',
    label: 'Thông tin tham gia chưa đúng',
  },
  {
    value: 'SESSION_DELIVERY_NOT_RECOGNIZED',
    label: 'Không nhận ra phiên tư vấn này',
  },
  { value: 'TECHNICAL_FAILURE', label: 'Có sự cố kỹ thuật' },
]

function format(value: string, timezone: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value))
}

function statusCopy(dispute: AppointmentDispute) {
  if (dispute.status === 'OPEN')
    return {
      title: 'Yêu cầu đang được xem xét',
      description:
        'Kết quả tài chính liên quan được tạm dừng cho đến khi có quyết định.',
    }
  if (dispute.resolutionOutcome === 'RELEASE_USER_CREDIT')
    return {
      title: 'Đã trả lại lượt tư vấn',
      description:
        'Quyết định đã được ghi nhận mà không thay đổi âm thầm kết quả phiên trước đó.',
    }
  return {
    title: 'Đã giữ nguyên kết quả phiên',
    description:
      'Yêu cầu đã được xem xét và kết quả đã ghi nhận được giữ nguyên.',
  }
}

function message(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'APPOINTMENT_DISPUTE_WINDOW_EXPIRED')
      return 'Thời hạn gửi yêu cầu xem xét cho lịch hẹn này đã kết thúc.'
    if (error.code === 'APPOINTMENT_DISPUTE_ALREADY_EXISTS')
      return 'Lịch hẹn này đã có một yêu cầu xem xét.'
    if (error.code === 'APPOINTMENT_DISPUTE_NOT_ELIGIBLE')
      return 'Lịch hẹn này chưa đủ điều kiện để gửi yêu cầu xem xét.'
    if (error.code === 'IDEMPOTENCY_KEY_REUSED')
      return 'Nội dung yêu cầu đã thay đổi. Hãy gửi lại một lần nữa.'
  }
  return 'Chưa thể gửi yêu cầu. Nội dung vẫn được giữ để bạn thử lại.'
}

export function AppointmentDisputePanel({
  appointment,
  role,
  generatedAt,
}: Readonly<{
  appointment: Appointment
  role: 'USER' | 'SPECIALIST'
  generatedAt: string
}>) {
  const [dispute, setDispute] = useState<AppointmentDispute | null>(null)
  const [loading, setLoading] = useState(true)
  const [reasonCode, setReasonCode] =
    useState<OpenAppointmentDisputeInput['reasonCode']>('OUTCOME_INCORRECT')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const command = useRef<{ signature: string; key: string } | null>(null)
  const withinWindow = Boolean(
    appointment.sessionSettledAt &&
    generatedAt &&
    Date.parse(generatedAt) <=
      Date.parse(appointment.sessionSettledAt) + 24 * 60 * 60 * 1000,
  )

  useEffect(() => {
    let active = true
    void appointmentBrowserClient
      .dispute(appointment.id, role)
      .then((value) => {
        if (active) setDispute(value)
      })
      .catch((caught: unknown) => {
        if (active && (!(caught instanceof ApiError) || caught.status !== 404))
          setError('Chưa thể tải trạng thái xem xét. Vui lòng thử lại sau.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [appointment.id, role])

  if (loading)
    return (
      <p className={styles.loading} role="status">
        Đang kiểm tra yêu cầu xem xét…
      </p>
    )
  if (!dispute && !withinWindow && !error) return null

  async function submit() {
    const body: OpenAppointmentDisputeInput = {
      reasonCode,
      evidenceType: null,
      evidenceOccurredAt: null,
    }
    const signature = JSON.stringify(body)
    if (!command.current || command.current.signature !== signature)
      command.current = { signature, key: crypto.randomUUID() }
    setSubmitting(true)
    setError('')
    try {
      const created = await appointmentBrowserClient.openDispute(
        appointment.id,
        role,
        body,
        command.current.key,
      )
      command.current = null
      setDispute(created)
    } catch (caught) {
      setError(message(caught))
      if (
        caught instanceof ApiError &&
        caught.code === 'IDEMPOTENCY_KEY_REUSED'
      )
        command.current = null
    } finally {
      setSubmitting(false)
    }
  }

  if (dispute) {
    const copy = statusCopy(dispute)
    return (
      <section
        className={styles.status}
        aria-label="Trạng thái yêu cầu xem xét"
      >
        <span data-state={dispute.status}>{copy.title}</span>
        <p>{copy.description}</p>
        <small>
          {dispute.status === 'OPEN' ? 'Đã gửi' : 'Đã xử lý'}{' '}
          {format(dispute.resolvedAt ?? dispute.openedAt, appointment.timezone)}
        </small>
      </section>
    )
  }

  return (
    <details className={styles.panel}>
      <summary>Yêu cầu xem xét kết quả phiên</summary>
      <div className={styles.body}>
        <p>
          Chọn lý do phù hợp. Không nhập nội dung sức khỏe, tin nhắn riêng hay
          thông tin nhận dạng vào yêu cầu này.
        </p>
        <label>
          Lý do
          <select
            value={reasonCode}
            disabled={submitting}
            onChange={(event) => {
              setReasonCode(
                event.target.value as OpenAppointmentDisputeInput['reasonCode'],
              )
              setError('')
            }}
          >
            {REASONS.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={submitting}
          onClick={() => void submit()}
        >
          {submitting ? 'Đang gửi…' : 'Gửi yêu cầu xem xét'}
        </button>
      </div>
    </details>
  )
}
