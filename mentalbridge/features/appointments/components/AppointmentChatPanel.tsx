'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/lib/api/api-error'
import { Dialog } from '@/components/ui/Dialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { ArrowLeft, CalendarDays, LockKeyhole, X } from 'lucide-react'
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

function sessionPresentation(
  eligibility: AppointmentChatEligibility,
  timezone: string,
) {
  const start = new Date(eligibility.scheduledStartAt)
  const end = new Date(eligibility.scheduledEndAt)
  const server = new Date(eligibility.serverTime)
  const time = (value: Date) =>
    new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    }).format(value)
  const date = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: timezone,
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
  timezone = 'Asia/Ho_Chi_Minh',
  onBackToInbox,
}: {
  appointmentId: string
  viewerRole?: 'USER' | 'SPECIALIST'
  embedded?: boolean
  timezone?: string
  onBackToInbox?: () => void
}) {
  const [eligibility, setEligibility] = useState<AppointmentChatEligibility>()
  const [connection, setConnection] = useState<ConnectionState>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [errorDismissed, setErrorDismissed] = useState(false)
  const [showSessionDetails, setShowSessionDetails] = useState(
    viewerRole !== 'SPECIALIST',
  )
  const [wideSessionDetails, setWideSessionDetails] = useState(false)
  const [refreshing, setRefreshing] = useState(true)
  const [sending, setSending] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [followingLive, setFollowingLive] = useState(true)
  const transportRef = useRef<RealtimeTransport | undefined>(undefined)
  const messagesRef = useRef<HTMLElement | null>(null)
  const detailsButtonRef = useRef<HTMLButtonElement>(null)
  const refreshSequence = useRef(0)
  const decisionRef = useRef<AppointmentChatEligibility | undefined>(undefined)
  const commandBusy = useRef({ send: false, checkIn: false })
  const followMessages = useRef(true)
  const composingRef = useRef(false)
  const checkInCommandId = useRef<string | undefined>(undefined)
  const pendingSend = useRef<
    | {
        command: ReturnType<typeof createMessageCommand>
        draft: string
        timer: number
      }
    | undefined
  >(undefined)
  const retrySend = useRef<
    | { command: ReturnType<typeof createMessageCommand>; draft: string }
    | undefined
  >(undefined)
  const isSpecialist = viewerRole === 'SPECIALIST'
  const restoreDetailsFocus = useCallback(() => detailsButtonRef.current, [])
  const finishPendingSend = useCallback(
    (acknowledged: boolean, failure?: string) => {
      const pending = pendingSend.current
      if (!pending) return
      window.clearTimeout(pending.timer)
      pendingSend.current = undefined
      commandBusy.current.send = false
      setSending(false)
      if (acknowledged) {
        retrySend.current = undefined
        setContent((current) => (current === pending.draft ? '' : current))
        followMessages.current = true
        setFollowingLive(true)
      } else {
        setError(
          failure ??
            'Chưa gửi được tin nhắn. Bản nháp vẫn được giữ; vui lòng thử lại.',
        )
      }
    },
    [],
  )

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(
      isSpecialist ? '(min-width: 1440px)' : '(min-width: 1280px)',
    )
    const update = () => {
      setWideSessionDetails(media.matches)
      if (!media.matches) setShowSessionDetails(false)
    }
    const timer = window.setTimeout(() => {
      update()
      setShowSessionDetails(media.matches)
    }, 0)
    media.addEventListener?.('change', update)
    return () => {
      window.clearTimeout(timer)
      media.removeEventListener?.('change', update)
    }
  }, [isSpecialist])

  const applyDecision = useCallback((decision: AppointmentChatEligibility) => {
    decisionRef.current = decision
    setEligibility(decision)
    if (!decision.historyAllowed) setMessages([])
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
    const sequence = ++refreshSequence.current
    setRefreshing(true)
    let decision: AppointmentChatEligibility
    try {
      decision = await chatEligibility(appointmentId, 'history')
      if (sequence !== refreshSequence.current) return undefined
      applyDecision(decision)
      setError('')
    } catch (caught) {
      if (sequence !== refreshSequence.current) return undefined
      decisionRef.current = undefined
      finishPendingSend(false)
      setEligibility(undefined)
      setMessages([])
      setRefreshing(false)
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
        if (
          sequence !== refreshSequence.current ||
          !decisionRef.current?.historyAllowed
        )
          return undefined
        mergeMessages(page.items)
      } catch {
        if (sequence !== refreshSequence.current) return undefined
        setError(
          'Không thể đồng bộ lịch sử chat. Bạn vẫn có thể thử kết nối lại.',
        )
      }
    }
    if (sequence === refreshSequence.current) setRefreshing(false)
    return decision
  }, [appointmentId, applyDecision, mergeMessages, finishPendingSend])

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0)
    const timer = window.setInterval(() => void refresh(), 15_000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(timer)
      refreshSequence.current += 1
      decisionRef.current = undefined
      if (pendingSend.current) window.clearTimeout(pendingSend.current.timer)
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
            applyDecision(current)
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
            if (decisionRef.current?.historyAllowed) mergeMessages(page.items)
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
        if (
          event.eventType === 'message.created' &&
          decisionRef.current?.historyAllowed
        ) {
          mergeMessages([event.payload])
          const pending = pendingSend.current?.command
          if (
            pending?.commandType === 'message.send' &&
            pending.payload.clientMessageId === event.payload.clientMessageId
          )
            finishPendingSend(true)
        }
      },
      onAcknowledgement: (acknowledgement) => {
        if (acknowledgement.commandId === checkInCommandId.current) {
          checkInCommandId.current = undefined
          void refresh()
        }
        if (
          acknowledgement.commandId === pendingSend.current?.command.commandId
        )
          finishPendingSend(true)
      },
      onError: (issue) => {
        if (pendingSend.current) finishPendingSend(false)
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
    applyDecision,
    finishPendingSend,
    refresh,
  ])

  useEffect(() => {
    if (eligibility && !eligibility.subscribeAllowed && transportRef.current) {
      transportRef.current.stop()
      transportRef.current = undefined
      setConnection(undefined)
    }
  }, [eligibility])

  async function send() {
    const draft = content
    const text = content.trim()
    if (
      !text ||
      !eligibility?.sendAllowed ||
      !transportRef.current ||
      commandBusy.current.send
    )
      return
    commandBusy.current.send = true
    setSending(true)
    const command =
      retrySend.current?.draft === draft
        ? retrySend.current.command
        : createMessageCommand(eligibility.conversationId, text)
    retrySend.current = { command, draft }
    pendingSend.current = {
      command,
      draft,
      timer: window.setTimeout(
        () =>
          finishPendingSend(
            false,
            'Chưa nhận được xác nhận gửi tin. Bản nháp vẫn được giữ; kiểm tra lịch sử trước khi thử lại.',
          ),
        10_000,
      ),
    }
    try {
      const result = await transportRef.current.sendMessage(
        eligibility.conversationId,
        command,
      )
      // "sent" means dispatched, not acknowledged. Keep the draft until an ACK/event.
      if (result !== 'sent') {
        finishPendingSend(false)
        await refresh()
        setError(
          'Chưa gửi được tin nhắn. Bản nháp vẫn được giữ; hãy kiểm tra kết nối rồi thử lại.',
        )
      }
    } catch {
      finishPendingSend(false)
    }
  }

  async function checkIn() {
    if (
      !eligibility?.checkInAllowed ||
      eligibility.participantCheckedIn ||
      commandBusy.current.checkIn ||
      !transportRef.current
    )
      return
    commandBusy.current.checkIn = true
    setCheckingIn(true)
    const command = createCheckInCommand(eligibility.conversationId)
    checkInCommandId.current = command.commandId
    try {
      const result = await transportRef.current.checkIn(
        eligibility.conversationId,
        command,
      )
      if (result === 'sent') await refresh()
      else setError('Không thể ghi nhận điểm danh. Vui lòng thử lại.')
    } catch {
      setError('Không thể ghi nhận điểm danh. Vui lòng thử lại.')
    } finally {
      commandBusy.current.checkIn = false
      setCheckingIn(false)
    }
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
    if (container && followMessages.current)
      container.scrollTop = container.scrollHeight
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
  const session = eligibility
    ? sessionPresentation(eligibility, timezone)
    : null
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

  const sessionDetails =
    eligibility && session ? (
      <>
        <header className={styles.detailsHeader}>
          <h2 id="appointment-details-title">
            <CalendarDays size={20} aria-hidden="true" />
            Thông tin buổi hẹn
          </h2>
          {isSpecialist && (
            <button
              type="button"
              className={styles.refreshButton}
              aria-label="Đóng thông tin buổi hẹn"
              onClick={() => setShowSessionDetails(false)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </header>
        <div className={styles.sessionSchedule}>
          <span className={styles.detailsEyebrow}>Thời gian tư vấn</span>
          <strong className={styles.sessionTime}>{session.range}</strong>
          <p className={styles.sessionDate}>{session.date}</p>
          {isSpecialist && (
            <p className={styles.timezone}>Múi giờ: {timezone}</p>
          )}
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
            <dt>{isSpecialist ? 'Điểm danh của bạn' : 'Điểm danh'}</dt>
            <dd>
              {eligibility.participantCheckedIn
                ? 'Đã xác nhận'
                : 'Chưa xác nhận'}
            </dd>
          </div>
        </dl>
        <div className={styles.creditState}>
          <LockKeyhole size={20} aria-hidden="true" />
          <div>
            <strong>Quyền lợi buổi hẹn</strong>
            <p>
              {isSpecialist
                ? creditText[eligibility.creditState].replaceAll(
                    'Credit',
                    'Lượt tư vấn',
                  )
                : creditText[eligibility.creditState]}
            </p>
          </div>
        </div>
        {isSpecialist && (
          <div className={styles.detailsLinks}>
            <Link
              href={`/specialist/clients?appointmentId=${encodeURIComponent(appointmentId)}`}
            >
              Xem chuẩn bị khách hàng
            </Link>
            {eligibility.phase === 'COMPLETED' && (
              <Link
                href={`/specialist/follow-up?appointmentId=${encodeURIComponent(appointmentId)}`}
              >
                Mở Sau tư vấn
              </Link>
            )}
          </div>
        )}
      </>
    ) : null

  return (
    <div
      className={`${styles.page} ${embedded ? styles.embedded : ''} ${isSpecialist ? styles.specialist : ''}`}
      data-specialist-journey={isSpecialist ? 'chat' : undefined}
    >
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
        className={`${styles.layout} ${showSessionDetails && eligibility && session && (!isSpecialist || wideSessionDetails) ? styles.withSessionDetails : ''}`}
      >
        <section className={styles.chat} aria-label="Cuộc trò chuyện">
          <header className={styles.chatHeader}>
            {onBackToInbox && (
              <button
                type="button"
                className={`${styles.refreshButton} ${styles.backToInbox}`}
                onClick={onBackToInbox}
                aria-label="Quay lại hộp thư"
              >
                <ArrowLeft size={20} aria-hidden="true" />
              </button>
            )}
            <span className={styles.avatar} aria-hidden="true">
              {counterpartLabel.slice(0, 1)}
            </span>
            <div className={styles.chatIdentity}>
              <div className={styles.chatTitleRow}>
                <strong tabIndex={-1} id="appointment-chat-title">
                  {counterpartLabel}
                </strong>
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
                {!isSpecialist && <h1>Phòng chat lịch hẹn</h1>}
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.2-4.4A8 8 0 1 1 21 12z" />
                </svg>
                <span>Chat trong ứng dụng</span>
                <span aria-hidden="true">·</span>
                {!isSpecialist && (
                  <p>
                    {eligibility
                      ? phaseText[eligibility.phase]
                      : 'Đang kiểm tra lịch hẹn…'}
                  </p>
                )}
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
                disabled={refreshing}
                aria-label="Tải lại phòng chat"
                title="Tải lại"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
                </svg>
              </button>
              <button
                ref={detailsButtonRef}
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
                disabled={!eligibility}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 8h.01M11 12h1v4h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
                </svg>
              </button>
            </div>
          </header>
          {isSpecialist && eligibility && (
            <div className={styles.phaseNotice} data-phase={eligibility.phase}>
              <span
                className={styles.phaseBadge}
                data-phase={eligibility.phase}
              >
                {phaseLabel[eligibility.phase]}
              </span>
              <p>
                {phaseText[eligibility.phase].replaceAll(
                  'credit',
                  'lượt tư vấn',
                )}
              </p>
            </div>
          )}

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
                  Hệ thống chỉ ghi nhận thông tin tham gia, không dùng nội dung
                  chat để đánh giá mức tham gia.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void checkIn()}
                disabled={eligibility.participantCheckedIn || checkingIn}
              >
                {eligibility.participantCheckedIn
                  ? 'Đã điểm danh'
                  : checkingIn
                    ? 'Đang ghi nhận…'
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
            aria-busy={refreshing}
            onScroll={(event) => {
              const node = event.currentTarget
              const following =
                node.scrollHeight - node.scrollTop - node.clientHeight < 80
              followMessages.current = following
              setFollowingLive(following)
            }}
          >
            {isSpecialist && refreshing && !eligibility ? (
              <div className={styles.historySkeleton} role="status">
                <span>Đang kiểm tra phòng chat…</span>
                <Skeleton height={64} />
                <Skeleton height={90} />
                <Skeleton height={64} />
              </div>
            ) : messages.length === 0 ? (
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
                    : eligibility?.phase === 'WAITING' ||
                        eligibility?.phase === 'TOO_EARLY'
                      ? 'Tin nhắn sẽ được mở khi buổi tư vấn bắt đầu.'
                      : 'Chưa có lịch sử tin nhắn được cấp quyền trong phiên này.'}
                </p>
                {eligibility?.sendAllowed && !isSpecialist && (
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
                        timeZone: timezone,
                      }).format(new Date(message.sentAt))}
                    </time>
                  </article>
                )
              })
            )}
          </section>
          {!followingLive && messages.length > 0 && (
            <button
              className={styles.jumpToLatest}
              type="button"
              onClick={() => {
                followMessages.current = true
                setFollowingLive(true)
                if (messagesRef.current)
                  messagesRef.current.scrollTop =
                    messagesRef.current.scrollHeight
              }}
            >
              Xuống tin nhắn mới nhất
            </button>
          )}

          {isSpecialist && !eligibility?.sendAllowed ? (
            <footer className={styles.readOnly}>
              <LockKeyhole size={18} aria-hidden="true" />
              <p>
                {refreshing && !eligibility
                  ? 'Đang kiểm tra quyền gửi tin…'
                  : eligibility
                    ? 'Cuộc trò chuyện hiện ở chế độ chỉ đọc.'
                    : 'Chưa xác định được quyền gửi tin. Hãy thử tải lại phòng chat.'}
              </p>
              {eligibility?.phase === 'COMPLETED' && (
                <Link
                  href={`/specialist/follow-up?appointmentId=${encodeURIComponent(appointmentId)}`}
                >
                  Mở Sau tư vấn
                </Link>
              )}
            </footer>
          ) : (
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
                  onCompositionStart={() => {
                    composingRef.current = true
                  }}
                  onCompositionEnd={() => {
                    composingRef.current = false
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing &&
                      !composingRef.current &&
                      event.keyCode !== 229
                    ) {
                      event.preventDefault()
                      void send()
                    }
                  }}
                  disabled={!eligibility?.sendAllowed || sending}
                  placeholder={
                    eligibility?.sendAllowed
                      ? 'Nhập tin nhắn…'
                      : 'Chat hiện ở chế độ chỉ đọc'
                  }
                />
                <button
                  type="submit"
                  disabled={
                    !eligibility?.sendAllowed || !content.trim() || sending
                  }
                  aria-label="Gửi tin nhắn"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </div>
              <p role={sending ? 'status' : undefined}>
                {sending
                  ? 'Đang gửi tin nhắn…'
                  : 'Enter để gửi, Shift + Enter để xuống dòng.'}
              </p>
            </form>
          )}
        </section>

        {eligibility &&
          session &&
          showSessionDetails &&
          (!isSpecialist || wideSessionDetails) && (
            <aside
              id="appointment-session-details"
              className={styles.sessionCard}
              aria-label="Thông tin buổi hẹn"
            >
              {sessionDetails}
            </aside>
          )}
      </div>
      {isSpecialist && (
        <Dialog
          open={Boolean(
            showSessionDetails && !wideSessionDetails && sessionDetails,
          )}
          onOpenChange={setShowSessionDetails}
          labelledBy="appointment-details-title"
          className={styles.infoDialog}
          restoreFocusTo={restoreDetailsFocus}
        >
          <section
            id="appointment-session-details"
            className={styles.sessionCard}
            aria-label="Thông tin buổi hẹn"
          >
            {!wideSessionDetails && sessionDetails}
          </section>
        </Dialog>
      )}
    </div>
  )
}
