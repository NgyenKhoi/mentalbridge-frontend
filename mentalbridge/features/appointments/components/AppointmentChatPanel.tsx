'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/lib/api/api-error'
import type { AppointmentChatEligibility } from '@/lib/consultation/consultation-validation'
import {
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
  ENDED: 'Buổi chat đã kết thúc. Lịch sử hiện chỉ đọc.',
  CANCELLED: 'Lịch hẹn đã bị hủy. Lịch sử hiện chỉ đọc.',
  RESCHEDULED: 'Lịch hẹn đã được đổi. Lịch sử của lịch cũ hiện chỉ đọc.',
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
                  : current.historyAllowed
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
