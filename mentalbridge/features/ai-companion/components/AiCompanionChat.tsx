'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import type {
  CompanionConversation,
  CompanionConversationSummary,
  CompanionContextSources,
  CompanionQuota,
} from '@/lib/companion/companion-contract'
import {
  getResourceCatalogue,
  type PublicResourceSummary,
} from '@/features/resources/api/browser-resources'
import { getResourceProgress } from '@/features/resources/api/browser-resource-progress'
import {
  localDate,
  shiftDate,
} from '@/features/resources/model/resource-experience'
import {
  CompanionBrowserError,
  companionBrowserClient,
} from '../api/browser-client'
import styles from './AiCompanionChat.module.css'
import CompanionContextDialog from './CompanionContextDialog'
import StreamingText from './StreamingText'

const starters = [
  'Mình đang thấy lo âu',
  'Mình muốn nói về giấc ngủ',
  'Mình cần ai đó lắng nghe',
  'Giúp mình bắt đầu bằng một bước nhỏ',
]

const errorCopy: Record<string, string> = {
  AI_CONSENT_REQUIRED:
    'Bạn đã tắt hoặc chưa cấp đồng ý xử lý AI. Hãy cập nhật quyền riêng tư trước khi gửi tiếp.',
  CHAT_QUOTA_EXHAUSTED:
    'Bạn đã dùng hết lượt trả lời hôm nay. Hạn mức sẽ tự đặt lại vào thời điểm hiển thị bên dưới.',
  CHAT_RATE_LIMITED: 'Bạn đang gửi hơi nhanh. Hãy chờ một chút rồi thử lại.',
  CHAT_TOKEN_BUDGET_EXHAUSTED:
    'Giới hạn sử dụng an toàn hôm nay đã đạt mức tối đa.',
  CHAT_PROVIDER_UNAVAILABLE:
    'AI Companion đang gián đoạn. Nhật ký, kế hoạch và mục “Cần trợ giúp ngay” vẫn hoạt động độc lập.',
  CHAT_CONTEXT_UNAVAILABLE:
    'Không thể xác minh bối cảnh đã cho phép nên yêu cầu đã dừng an toàn.',
  COMPANION_OUTCOME_UNKNOWN:
    'Chưa thể xác nhận lần gửi trước. Hãy thử gửi lại; nội dung sẽ không bị lặp.',
  COMPANION_UNAVAILABLE: 'AI Companion tạm thời không khả dụng.',
}

const friendlyError = (error: unknown) =>
  error instanceof CompanionBrowserError
    ? (errorCopy[error.code] ?? error.message)
    : 'AI Companion tạm thời không khả dụng.'

const quotaCopy = (quota: CompanionQuota | null) => {
  if (!quota) return 'Lượt dùng còn lại sẽ hiện sau câu trả lời đầu tiên.'
  if (quota.plan === 'PREMIUM')
    return 'Premium không hiển thị giới hạn trả lời hằng ngày; giới hạn token, tốc độ và sử dụng hợp lý vẫn áp dụng.'
  return `Còn ${String(quota.remaining)} lượt · đặt lại ${new Intl.DateTimeFormat(
    'vi-VN',
    { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' },
  ).format(new Date(quota.resetAt))}`
}

const contextLabels: Record<string, string> = {
  JOURNAL: 'Nhật ký gần đây',
  SUPPORT_PLAN: 'Kế hoạch hỗ trợ hiện tại',
  REASSESSMENT: 'Bài sàng lọc gần đây',
  RESOURCE: 'Tài nguyên đã chọn',
}

const formatConversationTime = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

function Icon({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  )
}

function InfoIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.7v5.1M12 7.7h.01" />
    </Icon>
  )
}

function SparkIcon() {
  return (
    <Icon>
      <path d="M12 3.5c.6 4.1 2.4 5.9 6.5 6.5-4.1.6-5.9 2.4-6.5 6.5-.6-4.1-2.4-5.9-6.5-6.5 4.1-.6 5.9-2.4 6.5-6.5Z" />
      <path d="M18.2 15.5c.2 1.7 1.1 2.6 2.8 2.8-1.7.3-2.6 1.1-2.8 2.8-.3-1.7-1.1-2.5-2.8-2.8 1.7-.2 2.5-1.1 2.8-2.8Z" />
    </Icon>
  )
}

export default function AiCompanionChat() {
  const { confirm, showActionToast } = useFeedback()
  const [conversations, setConversations] = useState<
    CompanionConversationSummary[]
  >([])
  const [active, setActive] = useState<CompanionConversation | null>(null)
  const [resources, setResources] = useState<PublicResourceSummary[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [quota, setQuota] = useState<CompanionQuota | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [contextOpen, setContextOpen] = useState(false)
  const [contextSaving, setContextSaving] = useState(false)
  const [contextNotice, setContextNotice] = useState<Record<string, string>>({})
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list')
  const pendingKey = useRef<string | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const messagesRef = useRef<HTMLDivElement | null>(null)
  const nearBottomRef = useRef(true)
  const streamTextRef = useRef('')
  const requestControllerRef = useRef<AbortController | null>(null)

  const activeId = active?.conversationId ?? ''
  const message = activeId ? (drafts[activeId] ?? '') : ''
  const contextCount = active
    ? Number(active.context.sources.plan) +
      Number(active.context.sources.diary) +
      Number(active.context.sources.screening) +
      active.context.sources.resourceIds.length
    : 0
  const filteredConversations = conversations.filter((conversation) =>
    conversation.title
      .toLocaleLowerCase('vi')
      .includes(search.toLocaleLowerCase('vi')),
  )

  const setMessage = (value: string) => {
    if (!activeId) return
    setDrafts((current) => ({ ...current, [activeId]: value }))
    pendingKey.current = null
  }

  const setContextVisibility = (open: boolean) => setContextOpen(open)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const today = localDate()
      const [history, resourceResult] = await Promise.all([
        companionBrowserClient.list(),
        Promise.all([
          getResourceCatalogue(),
          getResourceProgress(shiftDate(today, -31), today),
        ]).catch(() => null),
      ])
      setConversations(history.items)
      setActive(
        history.items[0]
          ? await companionBrowserClient.get(history.items[0].conversationId)
          : null,
      )
      if (resourceResult) {
        const [catalogue, progress] = resourceResult
        const viewed = new Set(progress.map((item) => item.resourceId))
        setResources(catalogue.items.filter((item) => viewed.has(item.id)))
      } else setResources([])
    } catch (cause) {
      setError(friendlyError(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const allowConversationChange = async () => {
    if (!message.trim()) return true
    return confirm({
      title: 'Bạn còn một tin nhắn chưa gửi',
      description:
        'Bản nháp sẽ được giữ lại trong hội thoại này. Bạn có muốn chuyển sang hội thoại khác không?',
      confirmLabel: 'Chuyển hội thoại',
      cancelLabel: 'Ở lại',
      tone: 'warning',
    })
  }

  const createConversation = async () => {
    if (!(await allowConversationChange())) return
    setError('')
    try {
      const created = await companionBrowserClient.create()
      setConversations((current) => [
        created,
        ...current.filter(
          (item) => item.conversationId !== created.conversationId,
        ),
      ])
      setActive(created)
      setQuota(null)
      setMobileView('chat')
      pendingKey.current = null
      showActionToast({ title: 'Đã tạo cuộc trò chuyện mới' })
    } catch (cause) {
      setError(friendlyError(cause))
    }
  }

  const selectConversation = async (id: string) => {
    if (id === activeId) {
      setMobileView('chat')
      return
    }
    if (!(await allowConversationChange())) return
    setError('')
    try {
      setActive(await companionBrowserClient.get(id))
      setQuota(null)
      setMobileView('chat')
      pendingKey.current = null
    } catch (cause) {
      setError(friendlyError(cause))
    }
  }

  const send = async () => {
    const text = message.trim()
    if (!active || !text || sending) return
    setSending(true)
    setError('')
    pendingKey.current ??= crypto.randomUUID()
    const controller = new AbortController()
    requestControllerRef.current = controller
    let animating = false
    try {
      const result = await companionBrowserClient.send(
        active.conversationId,
        { message: text },
        pendingKey.current,
        controller.signal,
      )
      if (controller.signal.aborted) return
      animating = true
      setQuota(result.quota)
      streamTextRef.current = ''
      setStreamingId(result.assistantMessageId)
      setActive((current) =>
        current?.conversationId === active.conversationId
          ? {
              ...current,
              messages: [
                ...current.messages,
                {
                  messageId: result.userMessageId,
                  role: 'USER',
                  content: text,
                  createdAt: result.createdAt,
                  contextKinds: [],
                },
                {
                  messageId: result.assistantMessageId,
                  role: 'ASSISTANT',
                  content: result.assistant,
                  createdAt: result.createdAt,
                  contextKinds: result.contextKinds,
                },
              ],
              updatedAt: result.createdAt,
            }
          : current,
      )
      setConversations((current) => [
        { ...active, updatedAt: result.createdAt },
        ...current.filter(
          (item) => item.conversationId !== active.conversationId,
        ),
      ])
      setDrafts((current) => ({ ...current, [active.conversationId]: '' }))
      pendingKey.current = null
    } catch (cause) {
      if (controller.signal.aborted) return
      if (
        cause instanceof CompanionBrowserError &&
        cause.code !== 'CHAT_REQUEST_IN_PROGRESS' &&
        cause.code !== 'COMPANION_OUTCOME_UNKNOWN'
      )
        pendingKey.current = null
      setError(friendlyError(cause))
    } finally {
      requestControllerRef.current = null
      if (!animating) setSending(false)
    }
  }

  const stopResponse = () => {
    requestControllerRef.current?.abort()
    requestControllerRef.current = null
    if (streamingId) {
      const partial = streamTextRef.current
      setActive((current) =>
        current
          ? {
              ...current,
              messages: current.messages.map((item) =>
                item.messageId === streamingId && partial
                  ? { ...item, content: partial }
                  : item,
              ),
            }
          : current,
      )
    }
    setStreamingId(null)
    setSending(false)
  }

  const finishStreaming = useCallback(() => {
    setStreamingId(null)
    setSending(false)
  }, [])

  const trackStreaming = useCallback((value: string) => {
    streamTextRef.current = value
    if (nearBottomRef.current) {
      window.requestAnimationFrame(() => {
        const container = messagesRef.current
        if (container) container.scrollTop = container.scrollHeight
      })
    } else setShowScrollButton(true)
  }, [])

  const saveContext = async (sources: CompanionContextSources) => {
    if (!active) return
    setContextSaving(true)
    setError('')
    try {
      const updated = await companionBrowserClient.updateContext(
        active.conversationId,
        { sources },
      )
      setActive(updated)
      setConversations((current) =>
        current.map((item) =>
          item.conversationId === updated.conversationId
            ? { ...item, updatedAt: updated.updatedAt }
            : item,
        ),
      )
      const enabled = [
        sources.plan ? 'Kế hoạch hỗ trợ' : '',
        sources.diary ? 'Nhật ký' : '',
        sources.screening ? 'Bài sàng lọc' : '',
        sources.resourceIds.length > 0
          ? `${String(sources.resourceIds.length)} tài nguyên`
          : '',
      ].filter(Boolean)
      setContextNotice((current) => ({
        ...current,
        [updated.conversationId]: enabled.length
          ? `Bạn đã bật ${enabled.join(', ')} cho cuộc trò chuyện này.`
          : 'Bạn đã tắt tất cả nguồn thông tin cho cuộc trò chuyện này.',
      }))
      setContextVisibility(false)
      showActionToast({ title: 'Đã lưu nguồn thông tin' })
    } catch (cause) {
      setError(friendlyError(cause))
    } finally {
      setContextSaving(false)
    }
  }

  const remove = async () => {
    if (!active) return
    const removedId = active.conversationId
    const confirmed = await confirm({
      title: 'Xóa cuộc trò chuyện?',
      description:
        'Toàn bộ tin nhắn trong cuộc trò chuyện này sẽ bị xóa vĩnh viễn và không thể khôi phục.',
      confirmLabel: 'Xóa cuộc trò chuyện',
    })
    if (!confirmed) return
    try {
      await companionBrowserClient.remove(removedId)
      const remaining = conversations.filter(
        (item) => item.conversationId !== removedId,
      )
      setConversations(remaining)
      setActive(
        remaining[0]
          ? await companionBrowserClient.get(remaining[0].conversationId)
          : null,
      )
      setDrafts((current) => {
        const next = { ...current }
        delete next[removedId]
        return next
      })
      setQuota(null)
      setMobileView('list')
      showActionToast({
        title: 'Đã xóa cuộc trò chuyện',
        description: 'Các tin nhắn trong cuộc trò chuyện đã được xóa.',
      })
    } catch (cause) {
      setError(friendlyError(cause))
    }
  }

  const chooseStarter = (starter: string) => {
    setMessage(starter)
    window.setTimeout(() => composerRef.current?.focus(), 0)
  }

  if (loading)
    return (
      <main className={styles.loading} aria-busy="true">
        Đang tải AI Companion…
      </main>
    )

  return (
    <main className={styles.page} data-mobile-view={mobileView}>
      <aside className={styles.sidebar} aria-label="Danh sách hội thoại">
        <div className={styles.sidebarHeader}>
          <div>
            <span>AI Companion</span>
            <h1>Hội thoại</h1>
          </div>
          <button type="button" onClick={() => void createConversation()}>
            <span aria-hidden="true">＋</span> Cuộc trò chuyện mới
          </button>
        </div>

        {conversations.length > 4 ? (
          <label className={styles.search}>
            <span className="sr-only">Tìm kiếm hội thoại</span>
            <Icon>
              <circle cx="10.8" cy="10.8" r="6.3" />
              <path d="m15.5 15.5 4 4" />
            </Icon>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm hội thoại cũ"
            />
          </label>
        ) : null}

        <details className={styles.aiNote}>
          <summary>
            <InfoIcon />
            <span>AI đồng hành, không thay thế chuyên gia</span>
          </summary>
          <p>
            AI hỗ trợ bạn suy ngẫm; không chẩn đoán, chấm điểm, quyết định an
            toàn hay tự thay đổi kế hoạch hỗ trợ.
          </p>
        </details>

        <div className={styles.history}>
          {filteredConversations.length === 0 ? (
            <div className={styles.historyEmpty}>
              <SparkIcon />
              <p>
                {search
                  ? 'Không tìm thấy hội thoại phù hợp.'
                  : 'Chưa có cuộc trò chuyện nào.'}
              </p>
            </div>
          ) : (
            filteredConversations.map((conversation, index) => (
              <button
                type="button"
                key={conversation.conversationId}
                style={
                  {
                    '--entry-delay': `${Math.min(index, 7) * 45}ms`,
                  } as CSSProperties
                }
                className={
                  activeId === conversation.conversationId
                    ? styles.activeConversation
                    : undefined
                }
                onClick={() =>
                  void selectConversation(conversation.conversationId)
                }
              >
                <span className={styles.conversationCopy}>
                  <strong>{conversation.title}</strong>
                  <small>
                    {activeId === conversation.conversationId &&
                    active?.messages.at(-1)
                      ? active.messages.at(-1)?.content
                      : 'Tiếp tục cuộc trò chuyện của bạn'}
                  </small>
                </span>
                <time dateTime={conversation.updatedAt}>
                  {formatConversationTime(conversation.updatedAt)}
                </time>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className={styles.chat} aria-label="AI Companion">
        <header className={styles.chatHeader}>
          <div className={styles.chatIdentity}>
            <button
              type="button"
              className={styles.mobileBack}
              aria-label="Quay lại danh sách hội thoại"
              onClick={() => setMobileView('list')}
            >
              <Icon>
                <path d="m15 5-7 7 7 7" />
              </Icon>
            </button>
            <span className={styles.companionMark} aria-hidden="true">
              <SparkIcon />
            </span>
            <div>
              <strong>{active?.title ?? 'AI Companion'}</strong>
              <small>
                {active
                  ? `Bắt đầu ${formatConversationTime(active.createdAt)} · ${quotaCopy(quota)}`
                  : 'Một không gian riêng để bạn chia sẻ'}
              </small>
            </div>
          </div>
          <div className={styles.headerActions}>
            {active ? (
              <button
                type="button"
                className={styles.headerInfoButton}
                aria-label="Nguồn thông tin AI được đọc"
                onClick={() => setContextVisibility(true)}
              >
                <InfoIcon />
              </button>
            ) : null}
            <Link
              href="/safety-directory"
              className={styles.safetyAction}
              aria-label="Cần trợ giúp ngay"
            >
              <Icon>
                <path d="M12 21s-7-4.4-7-11a4 4 0 0 1 7-2.7A4 4 0 0 1 19 10c0 6.6-7 11-7 11Z" />
                <path d="M9 12h6M12 9v6" />
              </Icon>
              <span>Cần trợ giúp ngay</span>
            </Link>
            {active ? (
              <details className={styles.moreMenu}>
                <summary aria-label="Tùy chọn hội thoại">
                  <span aria-hidden="true">•••</span>
                </summary>
                <div>
                  <button
                    type="button"
                    onClick={() => setContextVisibility(true)}
                  >
                    Nguồn thông tin AI được đọc
                  </button>
                  <button type="button" onClick={() => void remove()}>
                    Xóa cuộc trò chuyện
                  </button>
                </div>
              </details>
            ) : null}
          </div>
        </header>

        {error ? (
          <div className={styles.error} role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => void load()}>
              Tải lại
            </button>
          </div>
        ) : null}

        {!active ? (
          <div className={styles.empty}>
            <span className={styles.emptyMascot} aria-hidden="true">
              <SparkIcon />
            </span>
            <h2>Bắt đầu khi bạn sẵn sàng</h2>
            <p>
              Nội dung trò chuyện được mã hóa và tự xóa theo thời hạn lưu giữ.
            </p>
            <button type="button" onClick={() => void createConversation()}>
              Bắt đầu trò chuyện
            </button>
          </div>
        ) : (
          <>
            <div
              ref={messagesRef}
              className={styles.messages}
              aria-live="polite"
              onScroll={(event) => {
                const element = event.currentTarget
                const distance =
                  element.scrollHeight -
                  element.scrollTop -
                  element.clientHeight
                nearBottomRef.current = distance <= 80
                if (nearBottomRef.current) setShowScrollButton(false)
              }}
            >
              {active.messages.length === 0 ? (
                <div className={styles.welcome}>
                  <span className={styles.welcomeMascot} aria-hidden="true">
                    <SparkIcon />
                  </span>
                  <span className={styles.eyebrow}>
                    Không cần bắt đầu hoàn hảo
                  </span>
                  <h2>Mình đang lắng nghe</h2>
                  <p>
                    Chọn một gợi ý hoặc chia sẻ theo cách tự nhiên nhất với bạn.
                  </p>
                  <div className={styles.starters} aria-label="Gợi ý mở đầu">
                    {starters.map((starter) => (
                      <button
                        type="button"
                        key={starter}
                        onClick={() => chooseStarter(starter)}
                      >
                        {starter}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                active.messages.map((item) => (
                  <article
                    key={item.messageId}
                    className={`${styles.messageRow} ${item.role === 'USER' ? styles.userMessage : styles.aiMessage}`}
                  >
                    <span className={styles.avatar} aria-hidden="true">
                      {item.role === 'USER' ? 'B' : <SparkIcon />}
                    </span>
                    <div className={styles.messageBubble}>
                      <header>
                        <strong>
                          {item.role === 'USER' ? 'Bạn' : 'AI Companion'}
                        </strong>
                        <time dateTime={item.createdAt}>
                          {new Intl.DateTimeFormat('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          }).format(new Date(item.createdAt))}
                        </time>
                      </header>
                      <p>
                        {streamingId === item.messageId ? (
                          <StreamingText
                            key={`${item.messageId}:${item.content}`}
                            text={item.content}
                            onProgress={trackStreaming}
                            onComplete={finishStreaming}
                          />
                        ) : (
                          item.content
                        )}
                      </p>
                      {item.contextKinds.length > 0 ? (
                        <details className={styles.messageContextChip}>
                          <summary>
                            <InfoIcon /> Đã dùng {item.contextKinds.length}{' '}
                            nguồn
                          </summary>
                          <div>
                            <strong>Nguồn đã dùng cho câu trả lời này</strong>
                            <ul>
                              {item.contextKinds.map((kind) => (
                                <li key={kind}>{contextLabels[kind]}</li>
                              ))}
                            </ul>
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </article>
                ))
              )}
              {contextNotice[activeId] ? (
                <div className={styles.contextTimelineNotice} role="status">
                  <InfoIcon />
                  <span>{contextNotice[activeId]}</span>
                </div>
              ) : null}
              {sending && !streamingId ? (
                <article className={`${styles.messageRow} ${styles.aiMessage}`}>
                  <span className={styles.avatar} aria-hidden="true">
                    <SparkIcon />
                  </span>
                  <div
                    className={`${styles.messageBubble} ${styles.thinking}`}
                    role="status"
                  >
                    <span>AI Companion đang suy nghĩ</span>
                    <i aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </i>
                  </div>
                </article>
              ) : null}
            </div>

            {showScrollButton ? (
              <button
                type="button"
                className={styles.scrollToBottom}
                onClick={() => {
                  const container = messagesRef.current
                  if (container) container.scrollTop = container.scrollHeight
                  nearBottomRef.current = true
                  setShowScrollButton(false)
                }}
              >
                Cuộn xuống ↓
              </button>
            ) : null}

            <div className={styles.composer}>
              <div className={styles.composerContextRow}>
                <button
                  type="button"
                  onClick={() => setContextVisibility(true)}
                  aria-label={`Mở nguồn ngữ cảnh, ${String(contextCount)} nguồn đang bật`}
                >
                  <InfoIcon />
                  Ngữ cảnh: {contextCount} nguồn
                </button>
              </div>
              <div className={styles.composerBox}>
                <button
                  type="button"
                  className={styles.contextShortcut}
                  aria-label="Chọn thông tin để AI hiểu bạn hơn"
                  onClick={() => setContextVisibility(true)}
                >
                  <InfoIcon />
                </button>
                <label htmlFor="companion-message" className="sr-only">
                  Tin nhắn
                </label>
                <textarea
                  ref={composerRef}
                  id="companion-message"
                  value={message}
                  maxLength={2_000}
                  rows={2}
                  disabled={sending}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      void send()
                    }
                  }}
                  placeholder="Chia sẻ điều bạn đang nghĩ…"
                />
                <button
                  type="button"
                  className={styles.sendButton}
                  aria-label={sending ? 'Dừng phản hồi' : 'Gửi'}
                  disabled={!sending && message.trim().length === 0}
                  onClick={() => (sending ? stopResponse() : void send())}
                >
                  {sending ? (
                    <>
                      <span>Dừng</span>
                      <span className={styles.stopIcon} aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      <span>Gửi</span>
                      <Icon>
                        <path d="m5 12 14-7-4 14-3-6-7-1Z" />
                        <path d="m12 13 7-8" />
                      </Icon>
                    </>
                  )}
                </button>
              </div>
              <div className={styles.composerMeta}>
                <small>
                  AI có thể mắc lỗi. Hãy kiểm tra thông tin quan trọng.
                </small>
                <small>{message.length}/2000</small>
              </div>
            </div>
          </>
        )}
      </section>
      {active && contextOpen ? (
        <CompanionContextDialog
          sources={active.context.sources}
          resources={resources}
          saving={contextSaving}
          onClose={() => setContextVisibility(false)}
          onSave={(sources) => void saveContext(sources)}
        />
      ) : null}
    </main>
  )
}
