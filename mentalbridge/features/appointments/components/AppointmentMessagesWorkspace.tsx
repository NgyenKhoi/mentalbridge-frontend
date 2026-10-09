'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { ApiError } from '@/lib/api/api-error'
import type { Appointment } from '@/lib/consultation/consultation-validation'
import { appointmentBrowserClient } from '../api/browser-client'
import AppointmentChatPanel from './AppointmentChatPanel'
import chatStyles from './AppointmentChatPanel.module.css'
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
  const appointmentsHref =
    viewerRole === 'SPECIALIST' ? '/specialist/appointments' : '/appointments'

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
          ) : error &&
            conversations.length === 0 ? null : conversations.length === 0 ? (
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
            <div className={`${chatStyles.page} ${chatStyles.embedded}`}>
              <div className={chatStyles.layout}>
                <section
                  className={chatStyles.chat}
                  aria-label="Khung nhắn tin"
                >
                  <header className={chatStyles.chatHeader}>
                    <span className={chatStyles.avatar} aria-hidden="true">
                      ◇
                    </span>
                    <div className={chatStyles.chatIdentity}>
                      <div className={chatStyles.chatTitleRow}>
                        <strong>Tin nhắn tư vấn</strong>
                        <span
                          className={`${chatStyles.phaseBadge} ${styles.emptyPhase}`}
                        >
                          <i />{' '}
                          {loading
                            ? 'Đang tải'
                            : error
                              ? 'Chưa kết nối'
                              : 'Chưa có lịch hẹn'}
                        </span>
                      </div>
                      <div className={chatStyles.chatMeta}>
                        <h1>Phòng chat lịch hẹn</h1>
                        <span aria-hidden="true">·</span>
                        <span>Chat trong ứng dụng</span>
                      </div>
                    </div>
                  </header>

                  <section
                    className={chatStyles.messages}
                    aria-label="Tin nhắn tư vấn"
                    role="log"
                  >
                    <div className={chatStyles.empty}>
                      <svg viewBox="0 0 120 84" aria-hidden="true">
                        <path d="M4 84V50a56 56 0 0 1 112 0v34" />
                        <path d="M20 84V50a40 40 0 0 1 80 0v34" />
                        <path d="M36 84V50a24 24 0 0 1 48 0v34" />
                      </svg>
                      <h2>
                        {loading
                          ? 'Đang tải tin nhắn…'
                          : error
                            ? 'Không thể tải cuộc trò chuyện'
                            : 'Chưa có tin nhắn để hiển thị'}
                      </h2>
                      <p>
                        {loading
                          ? 'Vui lòng chờ trong giây lát.'
                          : error
                            ? error
                            : 'Tin nhắn sẽ hiển thị khi lịch hẹn chat được xác nhận. Bạn có thể xem lại lịch sử sau khi phiên chat kết thúc.'}
                      </p>
                      {!loading &&
                        (error ? (
                          <button
                            type="button"
                            className={styles.emptyAction}
                            onClick={() => void load()}
                          >
                            Thử tải lại
                          </button>
                        ) : (
                          <Link
                            className={styles.emptyAction}
                            href={appointmentsHref}
                          >
                            Xem lịch hẹn
                          </Link>
                        ))}
                    </div>
                  </section>

                  <div className={chatStyles.composer}>
                    <label htmlFor="empty-appointment-chat-message">
                      Tin nhắn
                    </label>
                    <div className={chatStyles.composerBox}>
                      <textarea
                        id="empty-appointment-chat-message"
                        rows={1}
                        disabled
                        placeholder={
                          loading
                            ? 'Đang tải tin nhắn…'
                            : error
                              ? 'Không thể tải cuộc trò chuyện'
                              : 'Chọn lịch hẹn chat để nhắn tin'
                        }
                      />
                      <button type="button" disabled aria-label="Gửi tin nhắn">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                        </svg>
                      </button>
                    </div>
                    <p>
                      {error
                        ? 'Tải lại danh sách cuộc trò chuyện để tiếp tục.'
                        : 'Chọn một lịch hẹn chat đã xác nhận để gửi tin nhắn.'}
                    </p>
                  </div>
                </section>
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  )
}
