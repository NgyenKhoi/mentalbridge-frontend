'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { MessageCircle, RefreshCw, Search, X } from 'lucide-react'

import { Skeleton } from '@/components/ui/Skeleton'
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

function conversationState(appointment: Appointment): ConversationState {
  if (appointment.status === 'IN_PROGRESS') return 'active'
  if (appointment.status === 'CONFIRMED') return 'waiting'
  return 'ended'
}

function formatAppointment(appointment: Appointment) {
  const start = new Date(appointment.scheduledStartAt)
  const end = new Date(appointment.scheduledEndAt)
  const date = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    timeZone: appointment.timezone,
  }).format(start)
  const time = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: appointment.timezone,
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
  waiting: 'Đã xác nhận',
  ended: 'Đã kết thúc',
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ConversationState | 'all'>('all')
  const [detailOpen, setDetailOpen] = useState(Boolean(initialAppointmentId))
  const requestSequence = useRef(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const inboxRef = useRef<HTMLElement>(null)
  const isSpecialist = viewerRole === 'SPECIALIST'

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current
    setLoading(true)
    setError('')
    try {
      const result =
        viewerRole === 'SPECIALIST'
          ? await appointmentBrowserClient.assigned()
          : await appointmentBrowserClient.list()
      if (sequence !== requestSequence.current) return
      setAppointments(result.items.filter(hasConversation))
    } catch (caught) {
      if (sequence !== requestSequence.current) return
      if (
        caught instanceof ApiError &&
        [401, 403].includes(caught.status ?? 0)
      ) {
        setAppointments([])
      }
      setError(friendlyError(caught))
    } finally {
      if (sequence === requestSequence.current) setLoading(false)
    }
  }, [viewerRole])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => {
      window.clearTimeout(timer)
      requestSequence.current += 1
    }
  }, [load])

  const conversations = useMemo(
    () =>
      [...appointments].sort((left, right) => {
        const stateOrder = { active: 0, waiting: 1, ended: 2 }
        const leftState = conversationState(left)
        const rightState = conversationState(right)
        const stateDifference = stateOrder[leftState] - stateOrder[rightState]
        if (stateDifference !== 0) return stateDifference
        const direction = leftState === 'ended' ? -1 : 1
        return (
          direction *
          (Date.parse(left.scheduledStartAt) -
            Date.parse(right.scheduledStartAt))
        )
      }),
    [appointments],
  )

  const selectedAppointment = selectedId
    ? conversations.find((item) => item.id === selectedId)
    : conversations[0]
  const effectiveSelectedId = selectedAppointment?.id ?? ''
  const matchingConversations = conversations.filter((appointment) => {
    const state = conversationState(appointment)
    const searchText = `${formatAppointment(appointment)} ${appointment.timezone} ${stateCopy[state]} ${viewerRole === 'USER' ? appointment.specialistDisplayName : 'Khách hàng'}`
    return (
      (filter === 'all' || state === filter) &&
      searchText
        .toLocaleLowerCase('vi')
        .includes(query.trim().toLocaleLowerCase('vi'))
    )
  })

  const selectConversation = (appointmentId: string) => {
    setSelectedId(appointmentId)
    setDetailOpen(true)
    requestAnimationFrame(() =>
      document.getElementById('appointment-chat-title')?.focus(),
    )
    const params = new URLSearchParams({ appointmentId })
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }
  const backToInbox = () => {
    setDetailOpen(false)
    requestAnimationFrame(() => {
      inboxRef.current
        ?.querySelector<HTMLButtonElement>('button[aria-current="true"]')
        ?.focus()
    })
  }
  const clearSearch = () => {
    setQuery('')
    setFilter('all')
    searchRef.current?.focus()
  }

  return (
    <main
      className={`${styles.page} ${isSpecialist ? styles.specialist : ''}`}
      data-specialist-journey={isSpecialist ? 'messages' : undefined}
    >
      <section
        className={styles.workspace}
        data-detail-open={detailOpen}
        aria-label="Tin nhắn lịch hẹn"
      >
        <aside
          ref={inboxRef}
          className={styles.inbox}
          aria-label="Danh sách cuộc trò chuyện"
          aria-busy={loading}
        >
          <header>
            <div>
              {!isSpecialist && <span>HỘP THƯ</span>}
              <h1>{isSpecialist ? 'Hộp thư' : 'Lịch hẹn chat'}</h1>
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
                <RefreshCw size={18} aria-hidden="true" />
              </button>
            </div>
          </header>
          {isSpecialist && (
            <div className={styles.inboxTools}>
              <label className={styles.search}>
                <Search size={18} aria-hidden="true" />
                <input
                  ref={searchRef}
                  type="search"
                  aria-label="Tìm cuộc trò chuyện"
                  placeholder="Tìm theo ngày, giờ hoặc trạng thái…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Xóa tìm kiếm"
                    onClick={clearSearch}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </label>
              <div
                className={styles.filters}
                role="group"
                aria-label="Lọc cuộc trò chuyện"
              >
                {(
                  [
                    ['all', 'Tất cả'],
                    ['active', 'Đang diễn ra'],
                    ['waiting', 'Chờ & sắp tới'],
                    ['ended', 'Đã kết thúc'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={filter === key}
                    onClick={() => setFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          {loading && conversations.length === 0 ? (
            <div className={styles.state} role="status">
              <p>Đang tải cuộc trò chuyện…</p>
              <Skeleton height={84} />
              <Skeleton height={84} />
              <Skeleton height={84} />
            </div>
          ) : error && conversations.length === 0 ? (
            <div className={styles.emptyList}>
              <button type="button" onClick={() => void load()}>
                Thử lại
              </button>
            </div>
          ) : conversations.length === 0 ? (
            <div className={styles.emptyList}>
              <strong>Chưa có cuộc trò chuyện</strong>
              <p>
                Cuộc trò chuyện sẽ xuất hiện sau khi một lịch hẹn chat được xác
                nhận.
              </p>
              {isSpecialist && (
                <Link href="/specialist/appointments">Xem lịch hẹn</Link>
              )}
            </div>
          ) : matchingConversations.length === 0 ? (
            <div className={styles.emptyList}>
              <Search aria-hidden="true" size={28} />
              <strong>Không tìm thấy cuộc trò chuyện phù hợp</strong>
              <p>Thử ngày khác hoặc xem lại tất cả lịch hẹn.</p>
              <button type="button" onClick={clearSearch}>
                Xóa bộ lọc
              </button>
            </div>
          ) : (
            <ul>
              {matchingConversations.map((appointment) => {
                const state = conversationState(appointment)
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
          {isSpecialist && (
            <footer className={styles.inboxFooter}>
              Nhắn tin trong phạm vi lịch hẹn đã xác nhận.
            </footer>
          )}
        </aside>

        <section
          className={styles.conversation}
          aria-label="Lịch hẹn đang chọn"
        >
          {effectiveSelectedId ? (
            <AppointmentChatPanel
              key={effectiveSelectedId}
              appointmentId={effectiveSelectedId}
              viewerRole={viewerRole}
              timezone={selectedAppointment?.timezone}
              onBackToInbox={isSpecialist ? backToInbox : undefined}
              embedded
            />
          ) : (
            <div className={styles.emptyConversation}>
              <MessageCircle size={40} aria-hidden="true" />
              <h2>
                {selectedId && !loading
                  ? 'Lịch hẹn này không có trong hộp thư'
                  : 'Chọn một lịch hẹn để xem tin nhắn'}
              </h2>
              <p>
                {selectedId && !loading
                  ? 'Chọn một cuộc trò chuyện được cấp quyền trong danh sách.'
                  : 'Lịch sử được hiển thị theo quyền truy cập của từng phiên.'}
              </p>
              {isSpecialist && (
                <button
                  className={styles.backToInbox}
                  type="button"
                  onClick={backToInbox}
                >
                  Quay lại hộp thư
                </button>
              )}
            </div>
          )}
        </section>
      </section>
    </main>
  )
}
