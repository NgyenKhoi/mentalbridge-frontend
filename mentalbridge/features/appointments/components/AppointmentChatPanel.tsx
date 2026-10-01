'use client'

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

export default function AppointmentChatPanel({
  appointmentId,
}: {
  appointmentId: string
}) {
  const [eligibility, setEligibility] = useState<AppointmentChatEligibility>()
  const [connection, setConnection] = useState<ConnectionState>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const transportRef = useRef<RealtimeTransport | undefined>(undefined)

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
  const displayedError = error || connectionFailure

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span>TƯ VẤN TRỰC TUYẾN</span>
          <h1>Phòng chat lịch hẹn</h1>
          <p>
            {eligibility
              ? phaseText[eligibility.phase]
              : 'Đang kiểm tra lịch hẹn…'}
          </p>
        </div>
        <button type="button" onClick={() => void refresh()}>
          Tải lại
        </button>
      </header>
      {reconnecting && (
        <p className={styles.notice}>Đang kết nối lại và đồng bộ tin nhắn…</p>
      )}
      {displayedError && (
        <p className={styles.error} role="alert">
          {displayedError}
        </p>
      )}
      {eligibility?.checkInAllowed && (
        <section
          className={styles.attendance}
          aria-label="Điểm danh buổi tư vấn"
        >
          <div>
            <strong>
              {eligibility.participantCheckedIn
                ? 'Đã ghi nhận điểm danh'
                : 'Xác nhận bạn đã tham gia'}
            </strong>
            <p>
              Thời gian hiện diện và tin nhắn được ghi nhận bằng metadata máy
              chủ; nội dung chat không được dùng để chấm mức tham gia.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void checkIn()}
            disabled={eligibility.participantCheckedIn}
          >
            {eligibility.participantCheckedIn ? 'Đã điểm danh' : 'Điểm danh'}
          </button>
        </section>
      )}
      {eligibility &&
        [
          'ENDED_PROCESSING',
          'COMPLETED',
          'USER_NO_SHOW',
          'SPECIALIST_NO_SHOW',
          'BOTH_NO_SHOW',
          'INSUFFICIENT_EVIDENCE',
          'EVIDENCE_REVIEW',
        ].includes(eligibility.phase) && (
          <p className={styles.creditState}>
            {creditText[eligibility.creditState]}
          </p>
        )}
      <section
        className={styles.messages}
        aria-live="polite"
        aria-label="Tin nhắn tư vấn"
      >
        {messages.length === 0 ? (
          <p className={styles.empty}>Chưa có tin nhắn trong lịch hẹn này.</p>
        ) : (
          messages.map((message) => (
            <article key={message.messageId} className={styles.message}>
              <p>{message.content}</p>
              <time dateTime={message.sentAt}>
                {new Intl.DateTimeFormat('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(message.sentAt))}
              </time>
            </article>
          ))
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
        <textarea
          id="appointment-chat-message"
          value={content}
          maxLength={4000}
          onChange={(event) => setContent(event.target.value)}
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
        >
          Gửi tin nhắn
        </button>
      </form>
    </main>
  )
}
