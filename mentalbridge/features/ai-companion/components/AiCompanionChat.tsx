'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  CompanionConversation,
  CompanionConversationSummary,
  CompanionQuota,
} from '@/lib/companion/companion-contract'
import type { JournalSummary } from '@/lib/journal/journal-contract'
import { parseJournalPage } from '@/lib/journal/journal-validation'
import {
  CompanionBrowserError,
  companionBrowserClient,
} from '../api/browser-client'
import styles from './AiCompanionChat.module.css'

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

const refreshAfterSendError =
  'Tin nhắn đã được gửi nhưng chưa thể tải lại cuộc trò chuyện. Hãy chọn Tải lại để xem lịch sử mới nhất.'

const quotaCopy = (quota: CompanionQuota | null) => {
  if (!quota)
    return 'Hạn mức sẽ được xác nhận bởi máy chủ sau câu trả lời đầu tiên.'
  if (quota.plan === 'PREMIUM')
    return 'Premium không hiển thị giới hạn trả lời hằng ngày; giới hạn token, tốc độ và sử dụng hợp lý vẫn áp dụng.'
  return `Còn ${String(quota.remaining)} lượt · đặt lại ${new Intl.DateTimeFormat(
    'vi-VN',
    {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    },
  ).format(new Date(quota.resetAt))}`
}

export default function AiCompanionChat() {
  const [conversations, setConversations] = useState<
    CompanionConversationSummary[]
  >([])
  const [active, setActive] = useState<CompanionConversation | null>(null)
  const [journals, setJournals] = useState<JournalSummary[]>([])
  const [selectedJournals, setSelectedJournals] = useState<string[]>([])
  const [includePlan, setIncludePlan] = useState(true)
  const [message, setMessage] = useState('')
  const [quota, setQuota] = useState<CompanionQuota | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const pendingKey = useRef<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [history, journalResponse] = await Promise.all([
        companionBrowserClient.list(),
        fetch('/api/journals', { cache: 'no-store' }),
      ])
      setConversations(history.items)
      if (history.items[0]) {
        setActive(
          await companionBrowserClient.get(history.items[0].conversationId),
        )
      } else setActive(null)
      const journalValue = (await journalResponse.json()) as unknown
      const journalPage = journalResponse.ok
        ? parseJournalPage(journalValue)
        : null
      setJournals(journalPage?.items ?? [])
    } catch (cause) {
      setError(friendlyError(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const createConversation = async () => {
    setError('')
    try {
      const created = await companionBrowserClient.create()
      setConversations((current) => [created, ...current])
      setActive(created)
      setQuota(null)
      setMessage('')
    } catch (cause) {
      setError(friendlyError(cause))
    }
  }

  const selectConversation = async (id: string) => {
    setError('')
    try {
      setActive(await companionBrowserClient.get(id))
      setQuota(null)
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
    try {
      const result = await companionBrowserClient.send(
        active.conversationId,
        {
          message: text,
          context: {
            journalIds: selectedJournals,
            includeCurrentSupportPlan: includePlan,
            includeReminderContext: false,
          },
        },
        pendingKey.current,
      )
      setQuota(result.quota)
      setActive({
        ...active,
        messages: [
          ...active.messages,
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
            contextKinds: [],
          },
        ],
        updatedAt: result.createdAt,
      })
      setConversations((current) => [
        { ...active, updatedAt: result.createdAt },
        ...current.filter(
          (item) => item.conversationId !== active.conversationId,
        ),
      ])
      setMessage('')
      pendingKey.current = null
      try {
        setActive(await companionBrowserClient.get(active.conversationId))
      } catch {
        setError(refreshAfterSendError)
      }
    } catch (cause) {
      if (
        cause instanceof CompanionBrowserError &&
        cause.code !== 'CHAT_REQUEST_IN_PROGRESS' &&
        cause.code !== 'COMPANION_OUTCOME_UNKNOWN'
      )
        pendingKey.current = null
      setError(friendlyError(cause))
    } finally {
      setSending(false)
    }
  }

  const remove = async () => {
    if (!active || !window.confirm('Xóa vĩnh viễn cuộc trò chuyện này?')) return
    try {
      await companionBrowserClient.remove(active.conversationId)
      const remaining = conversations.filter(
        (item) => item.conversationId !== active.conversationId,
      )
      setConversations(remaining)
      setActive(
        remaining[0]
          ? await companionBrowserClient.get(remaining[0].conversationId)
          : null,
      )
      setQuota(null)
    } catch (cause) {
      setError(friendlyError(cause))
    }
  }

  const toggleJournal = (id: string) => {
    setSelectedJournals((current) =>
      current.includes(id)
        ? current.filter((candidate) => candidate !== id)
        : current.length < 3
          ? [...current, id]
          : current,
    )
  }

  if (loading)
    return (
      <main className={styles.loading} aria-busy="true">
        Đang tải AI Companion…
      </main>
    )

  return (
    <main className={styles.page}>
      <aside className={styles.sidebar} aria-label="Lịch sử trò chuyện">
        <div className={styles.sidebarHeader}>
          <div>
            <span>AI Companion</span>
            <h1>Trò chuyện</h1>
          </div>
          <button type="button" onClick={() => void createConversation()}>
            Cuộc trò chuyện mới
          </button>
        </div>
        <p className={styles.boundary}>
          AI hỗ trợ suy ngẫm; không chẩn đoán, chấm điểm, quyết định an toàn hay
          thay đổi kế hoạch.
        </p>
        <div className={styles.history}>
          {conversations.length === 0 ? (
            <p>Chưa có cuộc trò chuyện.</p>
          ) : (
            conversations.map((conversation) => (
              <button
                type="button"
                key={conversation.conversationId}
                className={
                  active?.conversationId === conversation.conversationId
                    ? styles.activeConversation
                    : undefined
                }
                onClick={() =>
                  void selectConversation(conversation.conversationId)
                }
              >
                <strong>{conversation.title}</strong>
                <small>
                  {new Intl.DateTimeFormat('vi-VN', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  }).format(new Date(conversation.updatedAt))}
                </small>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className={styles.chat} aria-label="AI Companion">
        <header className={styles.chatHeader}>
          <div>
            <span>Hạn mức gói dịch vụ</span>
            <strong>{quotaCopy(quota)}</strong>
          </div>
          <div className={styles.headerActions}>
            <Link href="/initial-check#safety">Cần trợ giúp ngay</Link>
            {active ? (
              <button type="button" onClick={() => void remove()}>
                Xóa cuộc trò chuyện
              </button>
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
            <div className={styles.messages} aria-live="polite">
              {active.messages.length === 0 ? (
                <div className={styles.welcome}>
                  <h2>Mình đang lắng nghe</h2>
                  <p>
                    Bạn có thể chia sẻ điều đang bận tâm hoặc chọn tối đa ba
                    nhật ký để AI dùng làm bối cảnh cho câu trả lời này.
                  </p>
                </div>
              ) : (
                active.messages.map((item) => (
                  <article
                    key={item.messageId}
                    className={
                      item.role === 'USER'
                        ? styles.userMessage
                        : styles.aiMessage
                    }
                  >
                    <span>{item.role === 'USER' ? 'Bạn' : 'AI Companion'}</span>
                    <p>{item.content}</p>
                    {item.contextKinds.length > 0 ? (
                      <small>
                        Bối cảnh đã dùng: {item.contextKinds.join(', ')}
                      </small>
                    ) : null}
                  </article>
                ))
              )}
              {sending ? (
                <p className={styles.thinking} role="status">
                  AI Companion đang chuẩn bị câu trả lời…
                </p>
              ) : null}
            </div>

            <details className={styles.context}>
              <summary>Bối cảnh cho phép trong câu trả lời này</summary>
              <label>
                <input
                  type="checkbox"
                  checked={includePlan}
                  onChange={(event) => setIncludePlan(event.target.checked)}
                />
                Kế hoạch hỗ trợ hiện tại (nếu có)
              </label>
              <fieldset>
                <legend>Nhật ký đã chọn ({selectedJournals.length}/3)</legend>
                {journals.length === 0 ? (
                  <p>Không có nhật ký khả dụng.</p>
                ) : (
                  journals.map((journal) => (
                    <label key={journal.id}>
                      <input
                        type="checkbox"
                        checked={selectedJournals.includes(journal.id)}
                        disabled={
                          !selectedJournals.includes(journal.id) &&
                          selectedJournals.length >= 3
                        }
                        onChange={() => toggleJournal(journal.id)}
                      />
                      {journal.content.preview}
                    </label>
                  ))
                )}
              </fieldset>
              <small>
                Chỉ bối cảnh đã chọn và được dịch vụ sở hữu xác minh mới được
                gửi. Bối cảnh nhắc nhở chưa được bật.
              </small>
            </details>

            <div className={styles.composer}>
              <label htmlFor="companion-message">Tin nhắn</label>
              <textarea
                id="companion-message"
                value={message}
                maxLength={2_000}
                rows={3}
                disabled={sending}
                onChange={(event) => {
                  setMessage(event.target.value)
                  pendingKey.current = null
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void send()
                  }
                }}
                placeholder="Chia sẻ điều bạn đang nghĩ…"
              />
              <div>
                <small>{message.length}/2000</small>
                <button
                  type="button"
                  disabled={sending || message.trim().length === 0}
                  onClick={() => void send()}
                >
                  {sending ? 'Đang gửi…' : 'Gửi'}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
