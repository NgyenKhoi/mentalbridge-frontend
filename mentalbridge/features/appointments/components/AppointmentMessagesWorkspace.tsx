'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { ApiError } from '@/lib/api/api-error'
import type { Appointment } from '@/lib/consultation/consultation-validation'
import { appointmentBrowserClient } from '../api/browser-client'
import AppointmentChatPanel from './AppointmentChatPanel'
import styles from './AppointmentMessagesWorkspace.module.css'

type ViewerRole = 'USER' | 'SPECIALIST'

type ConversationState = 'active' | 'waiting' | 'ended'

function hasConversation(appointment: Appointment) {
  return (
    appointment.modality === 'IN_APP_CHAT' &&
    (['CONFIRMED', 'IN_PROGRESS', 'SESSION_ENDED', 'COMPLETED'].includes(
      appointment.status,
    ) ||
      appointment.history.some((event) => event.toStatus === 'CONFIRMED'))
  )
}

function conversationState(
  appointment: Appointment,
  now: number,
): ConversationState {
  const start = Date.parse(appointment.scheduledStartAt)
  const end = Date.parse(appointment.scheduledEndAt)
  if (
    appointment.status === 'IN_PROGRESS' ||
    (appointment.status === 'CONFIRMED' && now >= start && now < end)
  ) {
    return 'active'
  }
  if (appointment.status === 'CONFIRMED' && now < end) return 'waiting'
  return 'ended'
}

function formatAppointment(appointment: Appointment) {
  const start = new Date(appointment.scheduledStartAt)
  const end = new Date(appointment.scheduledEndAt)
  const date = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(start)
  const time = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  return `${date} · ${time.format(start)}–${time.format(end)}`
}

function friendlyError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'UNAUTHENTICATED') {
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    }
    if (
      error.code === 'CONSULTATION_ROLE_REQUIRED' ||
      error.code === 'APPOINTMENT_NOT_ASSIGNED'
    ) {
      return 'Bạn không có quyền xem các cuộc trò chuyện này.'
    }
  }
  return 'Chưa thể tải tin nhắn lịch hẹn. Vui lòng thử lại.'
}

const stateCopy: Record<ConversationState, string> = {
  active: 'Đang diễn ra',
  waiting: 'Chưa bắt đầu',
  ended: 'Chỉ đọc',
}

export default function AppointmentMessagesWorkspace({
  viewerRole,
  initialAppointmentId,
}: {
  viewerRole: ViewerRole
  initialAppointmentId?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selectedId, setSelectedId] = useState(initialAppointmentId ?? '')
  const [generatedAt, setGeneratedAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result =
        viewerRole === 'SPECIALIST'
          ? await appointmentBrowserClient.assigned()
          : await appointmentBrowserClient.list()
      setAppointments(result.items.filter(hasConversation))
      setGeneratedAt(result.generatedAt)
    } catch (caught) {
      setError(friendlyError(caught))
    } finally {
      setLoading(false)
    }
  }, [viewerRole])

  useEffect(() => {
    let active = true
    const request =
      viewerRole === 'SPECIALIST'
        ? appointmentBrowserClient.assigned()
        : appointmentBrowserClient.list()
    request
      .then((result) => {
        if (!active) return
        setAppointments(result.items.filter(hasConversation))
        setGeneratedAt(result.generatedAt)
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
  }, [viewerRole])

  const now = generatedAt ? Date.parse(generatedAt) : 0
  const conversations = useMemo(
    () =>
      [...appointments].sort((left, right) => {
        const stateOrder = { active: 0, waiting: 1, ended: 2 }
        const leftState = conversationState(left, now)
        const rightState = conversationState(right, now)
        const stateDifference = stateOrder[leftState] - stateOrder[rightState]
        if (stateDifference !== 0) return stateDifference
        const direction = leftState === 'ended' ? -1 : 1
        return (
          direction *
          (Date.parse(left.scheduledStartAt) -
            Date.parse(right.scheduledStartAt))
        )
      }),
    [appointments, now],
  )

  const effectiveSelectedId = conversations.some(
    (item) => item.id === selectedId,
  )
    ? selectedId
    : (conversations[0]?.id ?? '')

  const selectConversation = (appointmentId: string) => {
    setSelectedId(appointmentId)
    const params = new URLSearchParams({ appointmentId })
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <main className={styles.page}>
      <section className={styles.workspace} aria-label="Tin nhắn lịch hẹn">
        <aside className={styles.inbox} aria-label="Danh sách cuộc trò chuyện">
          <header>
            <div>
              <span>HỘP THƯ</span>
              <h2>Lịch hẹn chat</h2>
            </div>
            <div className={styles.inboxActions}>
              <strong>{conversations.length}</strong>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                aria-label="Tải lại danh sách cuộc trò chuyện"
                title="Tải lại"
              >
                ↻
              </button>
            </div>
          </header>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          {loading && conversations.length === 0 ? (
            <p className={styles.state}>Đang tải cuộc trò chuyện…</p>
          ) : conversations.length === 0 ? (
            <div className={styles.emptyList}>
              <strong>Chưa có cuộc trò chuyện</strong>
              <p>
                Cuộc trò chuyện sẽ xuất hiện sau khi một lịch hẹn chat được xác
                nhận.
              </p>
            </div>
          ) : (
            <ul>
              {conversations.map((appointment) => {
                const state = conversationState(appointment, now)
                const counterpart =
                  viewerRole === 'SPECIALIST'
                    ? 'Khách hàng'
                    : appointment.specialistDisplayName
                return (
                  <li key={appointment.id}>
                    <button
                      type="button"
                      className={
                        effectiveSelectedId === appointment.id
                          ? styles.selected
                          : ''
                      }
                      aria-current={
                        effectiveSelectedId === appointment.id
                          ? 'true'
                          : undefined
                      }
                      onClick={() => selectConversation(appointment.id)}
                    >
                      <span className={styles.avatar} aria-hidden="true">
                        {counterpart.trim().slice(0, 1).toLocaleUpperCase('vi')}
                      </span>
                      <span className={styles.conversationCopy}>
                        <strong>{counterpart}</strong>
                        <small>{formatAppointment(appointment)}</small>
                        <em data-state={state}>
                          <i /> {stateCopy[state]}
                        </em>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        <section className={styles.conversation} aria-live="polite">
          {effectiveSelectedId ? (
            <AppointmentChatPanel
              key={effectiveSelectedId}
              appointmentId={effectiveSelectedId}
              viewerRole={viewerRole}
              embedded
            />
          ) : (
            <div className={styles.emptyConversation}>
              <span aria-hidden="true">◇</span>
              <h2>Chọn một lịch hẹn để xem tin nhắn</h2>
              <p>Lịch sử vẫn có thể xem sau khi phiên chat kết thúc.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  )
}
