'use client'

import { usePathname } from 'next/navigation'
import { NotificationToast } from '@/components/ui/NotificationToast'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  getChatConversations,
  type ChatConversation,
} from '../api/browser-community-chat'

const inboxChanged = 'mentalbridge:community-inbox-changed'

export function refreshCommunityInbox() {
  window.dispatchEvent(new Event(inboxChanged))
}

const InboxContext = createContext<{
  unreadCount: number
  revision: number
} | null>(null)

export function useCommunityInbox() {
  return useContext(InboxContext)
}

export function CommunityInboxProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const currentPath = useRef(pathname)
  const [snapshot, setSnapshot] = useState({ unreadCount: 0, revision: 0 })
  const [notice, setNotice] = useState<{
    conversationId: string
    count: number
  } | null>(null)
  const dismiss = useCallback(() => setNotice(null), [])

  useEffect(() => {
    currentPath.current = pathname
    if (pathname.startsWith('/community/messages/')) refreshCommunityInbox()
  }, [pathname])

  useEffect(() => {
    let alive = true
    let busy = false
    let queued = false
    let previous: Map<string, number> | null = null
    let signature = ''
    async function refresh() {
      if (!alive || !navigator.onLine) return
      if (busy) {
        queued = true
        return
      }
      busy = true
      try {
        const items: ChatConversation[] = []
        const cursors = new Set<string>()
        let cursor: string | undefined
        do {
          const page = await getChatConversations(cursor)
          if (!alive) return
          items.push(...page.items)
          cursor = page.nextCursor ?? undefined
          if (cursor && cursors.has(cursor))
            throw new Error('Invalid inbox cursor')
          if (cursor) cursors.add(cursor)
        } while (cursor)
        const counts = new Map(
          items.map((item) => [item.conversationId, item.unreadCount]),
        )
        const changed = items.filter(
          (item) =>
            previous !== null &&
            item.unreadCount > (previous.get(item.conversationId) ?? 0),
        )
        const nextSignature = JSON.stringify(items)
        if (nextSignature !== signature) {
          signature = nextSignature
          setSnapshot((current) => ({
            unreadCount: items.reduce(
              (total, item) => total + item.unreadCount,
              0,
            ),
            revision: current.revision + 1,
          }))
        }
        const incoming = changed.find(
          (item) =>
            document.hidden ||
            !document.hasFocus() ||
            currentPath.current !==
              `/community/messages/${item.conversationId}`,
        )
        if (incoming)
          setNotice({
            conversationId: incoming.conversationId,
            count: incoming.unreadCount,
          })
        else
          setNotice((current) =>
            current && !counts.get(current.conversationId) ? null : current,
          )
        previous = counts
      } catch {
        if (!alive) return
        previous = null
        signature = ''
        setNotice(null)
        setSnapshot((current) => ({
          unreadCount: 0,
          revision: current.revision,
        }))
      } finally {
        busy = false
        if (queued && alive) {
          queued = false
          void refresh()
        }
      }
    }
    const timer = window.setTimeout(() => void refresh(), 0)
    const interval = window.setInterval(() => void refresh(), 12000)
    const foreground = () => {
      if (!document.hidden) void refresh()
    }
    const changed = () => void refresh()
    window.addEventListener(inboxChanged, changed)
    window.addEventListener('online', changed)
    document.addEventListener('visibilitychange', foreground)
    return () => {
      alive = false
      clearTimeout(timer)
      clearInterval(interval)
      window.removeEventListener(inboxChanged, changed)
      window.removeEventListener('online', changed)
      document.removeEventListener('visibilitychange', foreground)
    }
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(dismiss, 9000)
    return () => clearTimeout(timer)
  }, [notice, dismiss])

  return (
    <InboxContext.Provider value={snapshot}>
      {children}
      <NotificationToast
        label="Thông báo tin nhắn cộng đồng"
        items={
          notice
            ? [
                {
                  id: notice.conversationId,
                  title: 'Bạn có tin nhắn mới',
                  description: `${notice.count} tin nhắn chưa đọc trong cuộc trò chuyện.`,
                  tone: 'info',
                  duration: 9000,
                  action: {
                    label: 'Mở cuộc trò chuyện',
                    href: `/community/messages/${notice.conversationId}`,
                  },
                },
              ]
            : []
        }
        onDismiss={dismiss}
      />
    </InboxContext.Provider>
  )
}
