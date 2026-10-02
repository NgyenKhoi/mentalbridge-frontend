'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/lib/api/api-error'
import type { AppointmentChatEligibility } from '@/lib/consultation/consultation-validation'
import {
  createCheckInCommand,
  createHeartbeatCommand,
  createMessageCommand,
  createSocketIoFactory,
  createSubscribeCommand,
  RealtimeTransport,
  type ConnectionState,
  type ServerEventV1,
} from '@/lib/realtime'
import {
  chatEligibility,
  chatHistory,
  socketCredential,
  type ChatMessage,
} from '../api/chat-browser-client'
import styles from './AppointmentChatPanel.module.css'

const phaseText: Record<AppointmentChatEligibility['phase'], string> = {
  NOT_AVAILABLE: 'Lịch hẹn này chưa đủ điều kiện mở chat.',
  TOO_EARLY: 'Phòng chờ sẽ mở trước giờ hẹn 10 phút.',
  WAITING: 'Bạn đang ở phòng chờ. Gửi tin nhắn sẽ mở đúng giờ hẹn.',
  ACTIVE: 'Buổi chat đang diễn ra.',
  ENDED_PROCESSING:
    'Buổi chat đã kết thúc. Hệ thống đang tổng hợp bằng chứng tham gia.',
  COMPLETED: 'Buổi chat đã hoàn thành và credit đã được sử dụng.',
  USER_NO_SHOW: 'Buổi chat kết thúc với kết quả người dùng không tham gia.',
  SPECIALIST_NO_SHOW:
    'Buổi chat kết thúc với kết quả chuyên gia không tham gia.',
  BOTH_NO_SHOW: 'Buổi chat kết thúc vì cả hai bên không tham gia.',
  INSUFFICIENT_EVIDENCE:
    'Chưa đủ bằng chứng để xác nhận buổi chat đã hoàn thành.',
  EVIDENCE_REVIEW:
    'Dữ liệu tham gia đã được chuyển sang trạng thái cần đối soát.',
  CANCELLED: 'Lịch hẹn đã bị hủy. Lịch sử hiện chỉ đọc.',
  RESCHEDULED: 'Lịch hẹn đã được đổi. Lịch sử của lịch cũ hiện chỉ đọc.',
}

const creditText: Record<AppointmentChatEligibility['creditState'], string> = {
  HELD: 'Credit đang được giữ trong lúc buổi hẹn được xử lý.',
  CONSUMED: 'Credit đã được sử dụng cho buổi tư vấn hoàn thành.',
  FORFEITED: 'Credit đã bị trừ theo kết quả người dùng không tham gia.',
  AVAILABLE: 'Credit đã được hoàn lại để bạn có thể đặt lịch khác.',
}

const phaseLabel: Record<AppointmentChatEligibility['phase'], string> = {
  NOT_AVAILABLE: 'Chưa mở',
  TOO_EARLY: 'Sắp diễn ra',
  WAITING: 'Phòng chờ',
  ACTIVE: 'Đang diễn ra',
  ENDED_PROCESSING: 'Đang xử lý',
  COMPLETED: 'Đã hoàn thành',
  USER_NO_SHOW: 'Người dùng vắng mặt',
  SPECIALIST_NO_SHOW: 'Chuyên gia vắng mặt',
  BOTH_NO_SHOW: 'Hai bên vắng mặt',
  INSUFFICIENT_EVIDENCE: 'Chưa đủ dữ liệu',
  EVIDENCE_REVIEW: 'Cần đối soát',
  CANCELLED: 'Đã hủy',
  RESCHEDULED: 'Đã đổi lịch',
}

function sessionPresentation(eligibility: AppointmentChatEligibility) {
  const start = new Date(eligibility.scheduledStartAt)
  const end = new Date(eligibility.scheduledEndAt)
  const server = new Date(eligibility.serverTime)
  const time = (value: Date) =>
    new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(value)
  const date = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(start)
  const totalMinutes = Math.max(1, (end.getTime() - start.getTime()) / 60_000)
  const elapsedMinutes = Math.max(
    0,
    Math.min(totalMinutes, (server.getTime() - start.getTime()) / 60_000),
  )
  const remainingMinutes = Math.max(0, Math.ceil(totalMinutes - elapsedMinutes))

  return {
    range: `${time(start)} – ${time(end)}`,
    date,
    totalMinutes: Math.round(totalMinutes),
    elapsedMinutes: Math.floor(elapsedMinutes),
    remainingMinutes,
    progress: Math.round((elapsedMinutes / totalMinutes) * 100),
    endTime: time(end),
  }
}

export default function AppointmentChatPanel({
  appointmentId,
  viewerRole = 'USER',
  embedded = false,
}: {
  appointmentId: string
  viewerRole?: 'USER' | 'SPECIALIST'
  embedded?: boolean
}) {
  const [eligibility, setEligibility] = useState<AppointmentChatEligibility>()
  const [connection, setConnection] = useState<ConnectionState>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [errorDismissed, setErrorDismissed] = useState(false)
  const [showSessionDetails, setShowSessionDetails] = useState(true)
  const transportRef = useRef<RealtimeTransport | undefined>(undefined)
  const messagesRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const timer = window.setTimeout(
      () =>
        setShowSessionDetails(window.matchMedia('(min-width: 1280px)').matches),
      0,
    )
    return () => window.clearTimeout(timer)
  }, [])

  const mergeMessages = useCallback((incoming: readonly ChatMessage[]) => {
    setMessages((current) => {
      const byId = new Map(
        current.map((message) => [message.messageId, message]),
      )
      for (const message of incoming) byId.set(message.messageId, message)
      return [...byId.values()].sort(
        (left, right) => Date.parse(left.sentAt) - Date.parse(right.sentAt),
      )
    })
  }, [])

  const refresh = useCallback(async () => {
    let decision: AppointmentChatEligibility
    try {
      decision = await chatEligibility(appointmentId, 'history')
      setEligibility(decision)
      setError('')
    } catch (caught) {
      setEligibility(undefined)
      setError(
        caught instanceof ApiError && caught.status === 404
          ? 'Bạn không có quyền truy cập phòng chat này.'
          : 'Không thể cập nhật phòng chat. Vui lòng thử lại.',
      )
      return undefined
    }
    if (decision.historyAllowed) {
      try {
        const page = await chatHistory(decision.conversationId)
        mergeMessages(page.items)
      } catch {
        setError(
          'Không thể đồng bộ lịch sử chat. Bạn vẫn có thể thử kết nối lại.',
        )
      }
    }
    return decision
  }, [appointmentId, mergeMessages])

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0)
    const timer = window.setInterval(() => void refresh(), 15_000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(timer)
    }
  }, [refresh])

  useEffect(() => {
    if (!eligibility?.subscribeAllowed || transportRef.current) return
    const conversationId = eligibility.conversationId
    let socketEndpoint = window.location.origin
    const transport = new RealtimeTransport({
      socketFactory: (handshake) =>
        createSocketIoFactory(socketEndpoint)(handshake),
      credentialProvider: async () => {
        try {
          const credential = await socketCredential()
          socketEndpoint = credential.endpoint
          return {
            status: 'available' as const,
            credential: {
              accessToken: credential.accessToken,
              expiresAtEpochMs: Date.parse(credential.expiresAt),
            },
          }
        } catch {
          return {
            status: 'unavailable' as const,
            reason: 'Không thể cấp quyền kết nối chat.',
          }
        }
      },
      eligibility: {
        check: async (conversationId, operation) => {
          try {
            const current = await chatEligibility(conversationId, operation)
            setEligibility(current)
            const allowed =
              operation === 'subscribe'
                ? current.subscribeAllowed
                : operation === 'send'
                  ? current.sendAllowed
                  : operation === 'history'
                    ? current.historyAllowed
                    : current.checkInAllowed
            return allowed ? 'eligible' : 'denied'
          } catch {
            return 'unavailable'
          }
        },
      },
      history: {
        recover: async (conversationId) => {
          try {
            const page = await chatHistory(conversationId)
            mergeMessages(page.items)
            return {
              status: 'recovered' as const,
              boundary: {},
              count: page.items.length,
            }
          } catch {
            return {
              status: 'unavailable' as const,
              reason: 'Không thể đồng bộ lịch sử.',
            }
          }
        },
      },
      onState: setConnection,
      onEvent: (event: ServerEventV1) => {
        if (event.eventType === 'message.created')
          mergeMessages([event.payload])
      },
      onError: (issue) => {
        if (!issue.retryable)
          setError('Phiên chat không thể tiếp tục ở trạng thái hiện tại.')
      },
    })
    transportRef.current = transport
    transport.connect()
    void transport.subscribe(
      conversationId,
      createSubscribeCommand(conversationId),
    )
    const resume = () => transport.resume()
    window.addEventListener('online', resume)
    return () => {
      window.removeEventListener('online', resume)
      transport.stop()
      if (transportRef.current === transport) transportRef.current = undefined
    }
  }, [
    eligibility?.conversationId,
    eligibility?.subscribeAllowed,
    mergeMessages,
  ])

  useEffect(() => {
    if (eligibility && !eligibility.subscribeAllowed && transportRef.current) {
      transportRef.current.stop()
      transportRef.current = undefined
      setConnection(undefined)
    }
  }, [eligibility])

  async function send() {
    const text = content.trim()
    if (!text || !eligibility?.sendAllowed || !transportRef.current) return
    setContent('')
    const result = await transportRef.current.sendMessage(
      eligibility.conversationId,
      createMessageCommand(eligibility.conversationId, text),
    )
    if (result !== 'sent') {
      setContent(text)
      await refresh()
    }
  }

  async function checkIn() {
    if (
      !eligibility?.checkInAllowed ||
      eligibility.participantCheckedIn ||
      !transportRef.current
    )
      return
    const result = await transportRef.current.checkIn(
      eligibility.conversationId,
      createCheckInCommand(eligibility.conversationId),
    )
    if (result === 'sent') await refresh()
    else setError('Không thể ghi nhận điểm danh. Vui lòng thử lại.')
  }

  useEffect(() => {
    if (
      !eligibility?.subscribeAllowed ||
      (connection?.phase !== 'ready' && connection?.phase !== 'degraded')
    )
      return
    const timer = window.setInterval(() => {
      const transport = transportRef.current
      if (transport) void transport.heartbeat(createHeartbeatCommand())
    }, 15_000)
    return () => window.clearInterval(timer)
  }, [connection?.phase, eligibility?.subscribeAllowed])

  useEffect(() => {
    const container = messagesRef.current
    if (container) container.scrollTop = container.scrollHeight
  }, [messages])

  useEffect(() => {
    const timer = window.setTimeout(() => setErrorDismissed(false), 0)
    return () => window.clearTimeout(timer)
  }, [error, connection?.issue])

  const reconnecting =
    eligibility?.subscribeAllowed === true &&
    (connection?.phase === 'reconnecting' ||
      connection?.phase === 'resubscribing')
  const connectionFailure =
    eligibility?.subscribeAllowed === true &&
    connection?.issue &&
    (connection.phase === 'disconnected' ||
      connection.phase === 'authentication-expired')
      ? 'Không thể duy trì kết nối chat. Vui lòng tải lại để thử lại.'
      : ''
  const displayedError = errorDismissed ? '' : error || connectionFailure
  const session = eligibility ? sessionPresentation(eligibility) : null
  const viewerAccountId = eligibility
    ? viewerRole === 'SPECIALIST'
      ? eligibility.specialistAccountId
      : eligibility.userAccountId
    : null
  const counterpartLabel =
    viewerRole === 'SPECIALIST' ? 'Người dùng' : 'Chuyên gia'
  const quickReplies =
    viewerRole === 'SPECIALIST'
      ? [
          'Chào bạn, hôm nay bạn muốn chia sẻ điều gì?',
          'Chào bạn, bạn đã sẵn sàng bắt đầu buổi chat chưa?',
        ]
      : [
          'Chào chuyên gia, mình đã sẵn sàng bắt đầu.',
          'Chào chuyên gia, cảm ơn bạn đã đồng hành cùng mình hôm nay.',
        ]

  return (
    <main className={`${styles.page} ${embedded ? styles.embedded : ''}`}>
      {!embedded && (
        <Link
          className={styles.backLink}
          href={
            viewerRole === 'SPECIALIST'
              ? '/specialist/appointments'
              : '/appointments'
          }
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Lịch hẹn
        </Link>
      )}
      <div
        className={`${styles.layout} ${showSessionDetails && eligibility && session ? styles.withSessionDetails : ''}`}
      >
        <section className={styles.chat} aria-label="Cuộc trò chuyện">
          <header className={styles.chatHeader}>
            <span className={styles.avatar} aria-hidden="true">
              {counterpartLabel.slice(0, 1)}
            </span>
            <div className={styles.chatIdentity}>
              <div className={styles.chatTitleRow}>
                <strong>{counterpartLabel}</strong>
                {eligibility && (
                  <span
                    className={styles.phaseBadge}
                    data-phase={eligibility.phase}
                  >
                    <i /> {phaseLabel[eligibility.phase]}
                  </span>
                )}
              </div>
              <div className={styles.chatMeta}>
                <h1>Phòng chat lịch hẹn</h1>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.2-4.4A8 8 0 1 1 21 12z" />
                </svg>
                <span>Chat trong ứng dụng</span>
                <span aria-hidden="true">·</span>
                <p>
                  {eligibility
                    ? phaseText[eligibility.phase]
                    : 'Đang kiểm tra lịch hẹn…'}
                </p>
              </div>
            </div>
            <div className={styles.chatActions}>
              {eligibility?.phase === 'ACTIVE' && session && (
                <div className={styles.timeRemaining}>
                  <strong>Còn {session.remainingMinutes} phút</strong>
                  <span>Kết thúc lúc {session.endTime}</span>
                </div>
              )}
              <button
                className={styles.refreshButton}
                type="button"
                onClick={() => void refresh()}
                aria-label="Tải lại phòng chat"
                title="Tải lại"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
                </svg>
              </button>
              <button
                className={styles.refreshButton}
                type="button"
                onClick={() => setShowSessionDetails((visible) => !visible)}
                aria-controls="appointment-session-details"
                aria-expanded={showSessionDetails}
                aria-label={
                  showSessionDetails
                    ? 'Ẩn thông tin buổi hẹn'
                    : 'Hiện thông tin buổi hẹn'
                }
                title="Thông tin buổi hẹn"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 8h.01M11 12h1v4h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
                </svg>
              </button>
            </div>
          </header>

          {reconnecting && (
            <div className={styles.notice}>
              Đang kết nối lại và đồng bộ tin nhắn…
            </div>
          )}
          {displayedError && (
            <div className={styles.error} role="alert">
              <span>{displayedError}</span>
              <div>
                <button type="button" onClick={() => void refresh()}>
                  Thử lại
                </button>
                <button
                  type="button"
                  onClick={() => setErrorDismissed(true)}
                  aria-label="Đóng thông báo lỗi"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {eligibility?.checkInAllowed && (
            <section
              className={styles.attendance}
              aria-label="Điểm danh buổi tư vấn"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {eligibility.participantCheckedIn ? (
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                ) : (
                  <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3zM9 12l2 2 4-4" />
                )}
              </svg>
              <div>
                <strong>
                  {eligibility.participantCheckedIn
                    ? 'Đã ghi nhận điểm danh'
                    : 'Xác nhận bạn đã tham gia'}
                </strong>
                <p>
                  Hệ thống chỉ ghi nhận metadata tham gia, không dùng nội dung
                  chat để đánh giá mức tham gia.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void checkIn()}
                disabled={eligibility.participantCheckedIn}
              >
                {eligibility.participantCheckedIn
                  ? 'Đã điểm danh'
                  : 'Xác nhận tham gia'}
              </button>
            </section>
          )}

          <section
            ref={messagesRef}
            className={styles.messages}
            aria-live="polite"
            aria-label="Tin nhắn tư vấn"
            role="log"
          >
            {messages.length === 0 ? (
              <div className={styles.empty}>
                <svg viewBox="0 0 120 84" aria-hidden="true">
                  <path d="M4 84V50a56 56 0 0 1 112 0v34" />
                  <path d="M20 84V50a40 40 0 0 1 80 0v34" />
                  <path d="M36 84V50a24 24 0 0 1 48 0v34" />
                </svg>
                <h2>Chưa có tin nhắn trong lịch hẹn này</h2>
                <p>
                  {eligibility?.sendAllowed
                    ? 'Gửi lời chào để mở đầu buổi tư vấn.'
                    : 'Tin nhắn sẽ được mở khi buổi tư vấn bắt đầu.'}
                </p>
                {eligibility?.sendAllowed && (
                  <div className={styles.quickReplies}>
                    {quickReplies.map((reply, index) => (
                      <button
                        key={reply}
                        type="button"
                        onClick={() => setContent(reply)}
                      >
                        {index === 0 ? 'Gửi lời chào' : 'Xác nhận sẵn sàng'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              messages.map((message) => {
                const own = message.senderId === viewerAccountId
                return (
                  <article
                    key={message.messageId}
                    className={`${styles.messageRow} ${own ? styles.own : ''}`}
                    aria-label={
                      own
                        ? 'Tin nhắn của bạn'
                        : `Tin nhắn từ ${counterpartLabel}`
                    }
                  >
                    <p>{message.content}</p>
                    <time dateTime={message.sentAt}>
                      {new Intl.DateTimeFormat('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                        timeZone: 'Asia/Ho_Chi_Minh',
                      }).format(new Date(message.sentAt))}
                    </time>
                  </article>
                )
              })
            )}
          </section>

          <form
            className={styles.composer}
            onSubmit={(event) => {
              event.preventDefault()
              void send()
            }}
          >
            <label htmlFor="appointment-chat-message">Tin nhắn</label>
            <div className={styles.composerBox}>
              <textarea
                id="appointment-chat-message"
                value={content}
                rows={1}
                maxLength={4000}
                onChange={(event) => setContent(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault()
                    void send()
                  }
                }}
                disabled={!eligibility?.sendAllowed}
                placeholder={
                  eligibility?.sendAllowed
                    ? 'Nhập tin nhắn…'
                    : 'Chat hiện ở chế độ chỉ đọc'
                }
              />
              <button
                type="submit"
                disabled={!eligibility?.sendAllowed || !content.trim()}
                aria-label="Gửi tin nhắn"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </button>
            </div>
            <p>Enter để gửi, Shift + Enter để xuống dòng.</p>
          </form>
        </section>

        {eligibility && session && showSessionDetails && (
          <aside
            id="appointment-session-details"
            className={styles.sessionCard}
            aria-label="Thông tin buổi hẹn"
          >
            <h2>Thông tin buổi hẹn</h2>
            <strong className={styles.sessionTime}>{session.range}</strong>
            <p className={styles.sessionDate}>{session.date}</p>
            <div
              className={styles.progress}
              role="progressbar"
              aria-valuenow={session.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Thời gian buổi hẹn đã trôi qua"
            >
              <i style={{ width: `${session.progress}%` }} />
            </div>
            <div className={styles.progressLabels}>
              <span>Đã qua {session.elapsedMinutes} phút</span>
              <span>Tổng {session.totalMinutes} phút</span>
            </div>
            <dl className={styles.sessionFacts}>
              <div>
                <dt>Hình thức</dt>
                <dd>Chat trong ứng dụng</dd>
              </div>
              <div>
                <dt>Trạng thái</dt>
                <dd>{phaseLabel[eligibility.phase]}</dd>
              </div>
              <div>
                <dt>Điểm danh</dt>
                <dd>
                  {eligibility.participantCheckedIn
                    ? 'Đã xác nhận'
                    : 'Chưa xác nhận'}
                </dd>
              </div>
            </dl>
            <div className={styles.creditState}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
              </svg>
              <div>
                <strong>Quyền lợi buổi hẹn</strong>
                <p>{creditText[eligibility.creditState]}</p>
              </div>
            </div>
          </aside>
        )}
      </div>
    </main>
  )
}
