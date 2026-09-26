'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useFeedback } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import type { Appointment } from '@/lib/consultation/consultation-validation'
import { appointmentBrowserClient } from '../api/browser-client'
import styles from './SpecialistAppointmentDecisionPanel.module.css'

type Decision = 'accept' | 'reject'

const STATUS_LABELS: Record<Appointment['status'], string> = {
  REQUESTED: 'Chờ phản hồi',
  CONFIRMED: 'Đã xác nhận',
  IN_PROGRESS: 'Đang diễn ra',
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

export default function SpecialistAppointmentDecisionPanel() {
  const { confirm, showActionToast } = useFeedback()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingCommand, setPendingCommand] = useState<string | null>(null)
  const commandKeys = useRef(new Map<string, string>())

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await appointmentBrowserClient.assigned()
      setAppointments(data.items)
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
        if (active) setAppointments(data.items)
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

  const decide = async (appointment: Appointment, decision: Decision) => {
    if (decision === 'reject') {
      const confirmed = await confirm({
        title: 'Từ chối yêu cầu lịch hẹn?',
        description:
          'Khung giờ sẽ được mở lại và lượt tư vấn của người dùng được hoàn lại. Quyết định này không thể thay đổi.',
        confirmLabel: 'Từ chối yêu cầu',
        tone: 'warning',
      })
      if (!confirmed) return
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
      setPendingCommand(null)
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="appointment-title">
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
          <span>
            <strong>{counts.waiting}</strong> chờ phản hồi
          </span>
          <span>
            <strong>{counts.confirmed}</strong> đã xác nhận
          </span>
        </div>
      </header>

      <div className={styles.toolbar}>
        <div>
          <h2>Yêu cầu được giao cho bạn</h2>
          <p>Yêu cầu sắp hết hạn được ưu tiên hiển thị trước.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>
          {loading ? 'Đang tải…' : 'Tải lại'}
        </button>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>

      {loading ? (
        <p className={styles.state}>Đang tải lịch hẹn…</p>
      ) : appointments.length === 0 ? (
        <div className={styles.empty}>
          <h2>Chưa có yêu cầu lịch hẹn</h2>
          <p>
            Khi có yêu cầu mới, bạn sẽ thấy thời hạn và lựa chọn phản hồi tại
            đây.
          </p>
        </div>
      ) : (
        <ul className={styles.list}>
          {appointments.map((appointment) => {
            const deciding = pendingCommand?.startsWith(`${appointment.id}:`)
            return (
              <li key={appointment.id} className={styles.card}>
                <div className={styles.cardMain}>
                  <div className={styles.cardHeading}>
                    <div>
                      <span className={styles.modality}>
                        {appointment.modality === 'IN_APP_VIDEO'
                          ? 'Video trong ứng dụng'
                          : 'Chat trong ứng dụng'}
                      </span>
                      <h3>{displayRange(appointment)}</h3>
                    </div>
                    <span
                      className={styles.status}
                      data-status={appointment.status}
                    >
                      {STATUS_LABELS[appointment.status]}
                    </span>
                  </div>
                  <p className={styles.credit}>
                    {CREDIT_LABELS[appointment.creditState]}
                  </p>
                  {appointment.status === 'REQUESTED' && (
                    <p className={styles.deadline}>
                      Phản hồi trước {displayDeadline(appointment)}
                    </p>
                  )}
                </div>
                {appointment.status === 'REQUESTED' && (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.accept}
                      disabled={Boolean(pendingCommand)}
                      onClick={() => void decide(appointment, 'accept')}
                    >
                      {deciding ? 'Đang xử lý…' : 'Xác nhận'}
                    </button>
                    <button
                      type="button"
                      className={styles.reject}
                      disabled={Boolean(pendingCommand)}
                      onClick={() => void decide(appointment, 'reject')}
                    >
                      Từ chối
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
