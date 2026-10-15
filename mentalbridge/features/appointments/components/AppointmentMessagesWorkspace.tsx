'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Clock3, RefreshCw, ShieldCheck } from 'lucide-react'

import { ApiError } from '@/lib/api/api-error'
import type { Appointment } from '@/lib/consultation/consultation-validation'
import { appointmentBrowserClient } from '../api/browser-client'
import { getMessagesPreview, type MessagesPreviewConversation } from '../mocks/messages-preview'
import AppointmentChatPanel from './AppointmentChatPanel'
import chatStyles from './AppointmentChatPanel.module.css'
import styles from './AppointmentMessagesWorkspace.module.css'

type ViewerRole = 'USER' | 'SPECIALIST'

type ConversationState = 'active' | 'waiting' | 'ended'
type InboxFilter = 'today' | 'upcoming' | 'completed'

function localDay(value: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

function matchesInboxFilter(appointment: Appointment, filter: InboxFilter, today: string, now: number) {
  if (filter === 'today') return localDay(appointment.scheduledStartAt) === today
  if (filter === 'upcoming') return localDay(appointment.scheduledStartAt) !== today && conversationState(appointment, now) !== 'ended'
  return conversationState(appointment, now) === 'ended'
}

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
  const [filter, setFilter] = useState<InboxFilter>('today')
  const [previewEnabled, setPreviewEnabled] = useState(false)
  const [previewData, setPreviewData] = useState<ReturnType<typeof getMessagesPreview> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (previewEnabled && viewerRole === 'SPECIALIST') {
        const sample = getMessagesPreview()
        setPreviewData(sample)
        setAppointments(sample.conversations.map((item) => item.appointment))
        setGeneratedAt(sample.generatedAt)
        return
      }
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
  }, [previewEnabled, viewerRole])

  useEffect(() => {
    let active = true
    if (previewEnabled && viewerRole === 'SPECIALIST') {
      const sample = getMessagesPreview()
      setPreviewData(sample)
      setAppointments(sample.conversations.map((item) => item.appointment))
      setGeneratedAt(sample.generatedAt)
      const initialConversation = sample.conversations.find((item) => item.appointment.id === initialAppointmentId)
      setSelectedId(initialConversation?.appointment.id ?? sample.conversations[0]?.appointment.id ?? '')
      setFilter(initialConversation
        ? matchesInboxFilter(initialConversation.appointment, 'today', localDay(sample.generatedAt), Date.parse(sample.generatedAt)) ? 'today'
          : matchesInboxFilter(initialConversation.appointment, 'upcoming', localDay(sample.generatedAt), Date.parse(sample.generatedAt)) ? 'upcoming' : 'completed'
        : 'today')
      setError('')
      setLoading(false)
      return () => { active = false }
    }
    setPreviewData(null)
    setLoading(true)
    setError('')
    setSelectedId(initialAppointmentId ?? '')
    const request =
      viewerRole === 'SPECIALIST'
        ? appointmentBrowserClient.assigned()
        : appointmentBrowserClient.list()
    request
      .then((result) => {
        if (!active) return
        const available = result.items.filter(hasConversation)
        setAppointments(available)
        setGeneratedAt(result.generatedAt)
        if (viewerRole === 'SPECIALIST') {
          const currentDay = localDay(result.generatedAt)
          const serverNow = Date.parse(result.generatedAt)
          const selected = available.find((item) => item.id === initialAppointmentId)
          setFilter(selected
            ? localDay(selected.scheduledStartAt) === currentDay ? 'today' : conversationState(selected, serverNow) === 'ended' ? 'completed' : 'upcoming'
            : available.some((item) => matchesInboxFilter(item, 'today', currentDay, serverNow)) ? 'today' : available.some((item) => matchesInboxFilter(item, 'upcoming', currentDay, serverNow)) ? 'upcoming' : 'completed')
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
  }, [initialAppointmentId, previewEnabled, viewerRole])

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
  const today = localDay(generatedAt || new Date().toISOString())
  const inboxCounts = {
    today: conversations.filter((item) => matchesInboxFilter(item, 'today', today, now)).length,
    upcoming: conversations.filter((item) => matchesInboxFilter(item, 'upcoming', today, now)).length,
    completed: conversations.filter((item) => matchesInboxFilter(item, 'completed', today, now)).length,
  }
  const visibleConversations = viewerRole === 'SPECIALIST' ? conversations.filter((item) => matchesInboxFilter(item, filter, today, now)) : conversations

  const effectiveSelectedId = visibleConversations.some(
    (item) => item.id === selectedId,
  )
    ? selectedId
    : (visibleConversations[0]?.id ?? '')
  const appointmentsHref = viewerRole === 'SPECIALIST' ? '/specialist/appointments' : '/appointments'
  const selectedPreview: MessagesPreviewConversation | undefined = previewEnabled
    ? previewData?.conversations.find((item) => item.appointment.id === effectiveSelectedId)
    : undefined

  const selectConversation = (appointmentId: string) => {
    setSelectedId(appointmentId)
    if (previewEnabled) return
    const params = new URLSearchParams({ appointmentId })
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const togglePreview = () => {
    setAppointments([])
    setPreviewData(null)
    setSelectedId('')
    setLoading(true)
    setPreviewEnabled((value) => !value)
  }

  return (
    <main className={styles.page} data-messages-workspace>
      <section className={styles.workspace} aria-label="Tin nhắn lịch hẹn">
        <aside className={styles.inbox} aria-label="Danh sách cuộc trò chuyện">
          <header>
            <div>
              <h2>Lịch hẹn chat</h2>
            </div>
            <div className={styles.inboxActions}>
              <strong>{conversations.length}</strong>
              <button
                data-messages-ui
                type="button"
                onClick={() => void load()}
                disabled={loading}
                aria-label="Tải lại danh sách cuộc trò chuyện"
                title="Tải lại"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </header>

          {viewerRole === 'SPECIALIST' && <div className={styles.filters} aria-label="Lọc lịch hẹn chat">
            {([['today', 'Hôm nay'], ['upcoming', 'Sắp tới'], ['completed', 'Đã hoàn thành']] as const).map(([key, label]) => (
              <button data-messages-ui type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<span>{inboxCounts[key]}</span></button>
            ))}
          </div>}

          {viewerRole === 'SPECIALIST' && process.env.NODE_ENV === 'development' && (
            <div className={styles.previewBar} data-active={previewEnabled}>
              <span><i /> {previewEnabled ? 'Đang xem dữ liệu mẫu để duyệt giao diện' : 'Đang xem dữ liệu thật'}</span>
              <button data-messages-ui type="button" onClick={togglePreview}>{previewEnabled ? 'Xem dữ liệu thật' : 'Xem dữ liệu mẫu'}</button>
            </div>
          )}

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          {loading && conversations.length === 0 ? (
            <p className={styles.state}>Đang tải cuộc trò chuyện…</p>
          ) : error && conversations.length === 0 ? null : conversations.length === 0 ? (
            <div className={styles.emptyList}>
              <strong>Chưa có cuộc trò chuyện</strong>
              <p>
                Cuộc trò chuyện sẽ xuất hiện sau khi một lịch hẹn chat được xác nhận.
              </p>
            </div>
          ) : (
            <ul>
              {visibleConversations.length === 0 && <li className={styles.emptyFilter}>Chưa có lịch hẹn trong mục này.</li>}
              {visibleConversations.map((appointment) => {
                const state = conversationState(appointment, now)
                const sample = previewData?.conversations.find((item) => item.appointment.id === appointment.id)
                const counterpart = viewerRole === 'SPECIALIST'
                  ? sample?.clientName ?? 'Khách hàng'
                  : appointment.specialistDisplayName
                return (
                  <li key={appointment.id}>
                    <button
                      data-messages-ui
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
                        {counterpart.trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toLocaleUpperCase('vi')}
                      </span>
                      <span className={styles.conversationCopy}>
                        <span className={styles.listTop}><strong>{counterpart}</strong><em data-state={state}><i /> {stateCopy[state]}</em></span>
                        <small>Phiên #{sample?.reference ?? appointment.id.slice(-6).toUpperCase()}</small>
                        <span className={styles.listTime}><Clock3 size={14} /> {formatAppointment(appointment)}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {viewerRole === 'SPECIALIST' && <footer className={styles.inboxFooter}><ShieldCheck size={15} /> Tin nhắn chỉ mở theo lịch hẹn được cấp quyền.</footer>}
        </aside>

        <section className={styles.conversation} aria-live="polite">
          {effectiveSelectedId ? (
            <AppointmentChatPanel
              key={`${previewEnabled ? 'preview' : 'live'}-${effectiveSelectedId}`}
              appointmentId={effectiveSelectedId}
              viewerRole={viewerRole}
              embedded
              preview={selectedPreview}
            />
          ) : (
            <div className={`${chatStyles.page} ${chatStyles.embedded}`}>
              <div className={chatStyles.layout}>
                <section className={chatStyles.chat} aria-label="Khung nhắn tin">
                  <header className={chatStyles.chatHeader}>
                    <span className={chatStyles.avatar} aria-hidden="true">◇</span>
                    <div className={chatStyles.chatIdentity}>
                      <div className={chatStyles.chatTitleRow}>
                        <strong>Tin nhắn tư vấn</strong>
                        <span className={`${chatStyles.phaseBadge} ${styles.emptyPhase}`}>
                          <i /> {loading ? 'Đang tải' : error ? 'Chưa kết nối' : 'Chưa có lịch hẹn'}
                        </span>
                      </div>
                      <div className={chatStyles.chatMeta}>
                        <h1>Phòng chat lịch hẹn</h1>
                        <span aria-hidden="true">·</span>
                        <span>Chat trong ứng dụng</span>
                      </div>
                    </div>
                  </header>

                  <section className={chatStyles.messages} aria-label="Tin nhắn tư vấn" role="log">
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
                      {!loading && (error ? (
                        <button data-messages-ui type="button" className={styles.emptyAction} onClick={() => void load()}>
                          Thử tải lại
                        </button>
                      ) : (
                        <Link className={styles.emptyAction} href={appointmentsHref}>Xem lịch hẹn</Link>
                      ))}
                    </div>
                  </section>

                  <div className={chatStyles.composer}>
                    <label htmlFor="empty-appointment-chat-message">Tin nhắn</label>
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
