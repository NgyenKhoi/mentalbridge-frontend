'use client'

import Link from 'next/link'
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import { useFeedback } from '@/components/ui/FeedbackProvider'
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from '@/features/notifications/api/browser-notifications'
import { subscribeNotificationCreated } from '@/features/notifications/api/realtime-notifications'
import styles from './NotificationBell.module.css'

export const NOTIFICATIONS_UPDATED_EVENT = 'mb:notifications-updated'
const POLL_MS = 20_000
const PREVIEW_COUNT = 5

function relativeTime(iso: string) {
  const minutes = Math.floor((Date.now() - Date.parse(iso)) / 60000)
  if (!(minutes >= 1)) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} giờ trước`
  return `${Math.floor(minutes / 1440)} ngày trước`
}

export default function NotificationBell({
  viewAllHref,
  className,
  children,
}: {
  viewAllHref: string
  /** Host topbar button look; the bell only adds reset + badge. */
  className: string
  /** Bell icon. */
  children: ReactNode
}) {
  const { showNotificationToast, showActionToast } = useFeedback()
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const [pops, setPops] = useState(0)
  const [marking, setMarking] = useState(false)
  const previous = useRef<number | null>(null)
  const inflight = useRef(false)
  const queued = useRef(false)
  const toasted = useRef<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const popover = useRef<HTMLDivElement>(null)
  const popoverId = useId()

  // `urgent` (socket pointer) must not be lost to a read already in flight.
  const load = useCallback(
    async (urgent = false) => {
      if (inflight.current) {
        queued.current ||= urgent
        return
      }
      inflight.current = true
      do {
        queued.current = false
        try {
          const page = await getNotifications()
          const before = previous.current
          previous.current = page.unreadCount
          setItems(page.items)
          setUnread(page.unreadCount)
          setFailed(false)
          if (before !== null && page.unreadCount > before) {
            const newest =
              page.items.find((item) => !item.read) ?? page.items[0]
            setPops((count) => count + 1)
            if (newest && toasted.current !== newest.id) {
              toasted.current = newest.id
              showNotificationToast({
                title: newest.title,
                description: newest.body,
                tone: 'info',
                ...(newest.action
                  ? { action: { label: 'Xem', href: newest.action.href } }
                  : {}),
              })
            }
            window.dispatchEvent(
              new CustomEvent(NOTIFICATIONS_UPDATED_EVENT, {
                detail: { unreadCount: page.unreadCount, newest },
              }),
            )
          }
        } catch {
          setFailed(true)
        }
      } while (queued.current)
      inflight.current = false
      setLoaded(true)
    },
    [showNotificationToast],
  )

  // Push: refetch at once when the server says a notification exists; polling
  // below stays as the fallback. The unread-count rise toasts once however the
  // read was triggered, so socket and poll cannot double-toast.
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })
  useEffect(
    () => subscribeNotificationCreated(() => void loadRef.current(true)),
    [],
  )

  // Poll only while the tab is visible; refresh on focus/visibility.
  useEffect(() => {
    let timer: number | undefined
    const stop = () => {
      window.clearInterval(timer)
      timer = undefined
    }
    const start = () => {
      if (document.visibilityState !== 'visible') return
      void load()
      if (timer === undefined) timer = window.setInterval(load, POLL_MS)
    }
    const onVisibility = () =>
      document.visibilityState === 'visible' ? start() : stop()
    start()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', start)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', start)
    }
  }, [load])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Keep the popover inside a narrow viewport (the bell sits near the right edge).
  useLayoutEffect(() => {
    const element = popover.current
    if (!open || !element) return
    element.style.translate = ''
    const { left, width } = element.getBoundingClientRect()
    if (width > 0 && left < 8) element.style.translate = `${8 - left}px 0`
  }, [open])

  const toggle = () => {
    if (!open) void load()
    setOpen((value) => !value)
  }

  const markAll = async () => {
    if (marking || unread === 0) return
    setMarking(true)
    try {
      await markAllNotificationsRead()
      previous.current = 0
      setUnread(0)
      setItems((current) => current.map((item) => ({ ...item, read: true })))
    } catch {
      showActionToast({ title: 'Chưa đánh dấu được. Thử lại sau ít phút.' })
    } finally {
      setMarking(false)
      trigger.current?.focus()
    }
  }

  const openItem = (item: Notification) => {
    setOpen(false)
    if (item.read) return
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, read: true } : entry,
      ),
    )
    const next = Math.max(0, unread - 1)
    previous.current = next
    setUnread(next)
    void markNotificationRead(item.id).catch(() => undefined)
  }

  const label = unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'
  const preview = items.slice(0, PREVIEW_COUNT)

  return (
    <div
      ref={root}
      className={styles.root}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null
        if (open && next && !root.current?.contains(next)) setOpen(false)
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={`${className} ${styles.trigger}`}
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={toggle}
      >
        {children}
        {unread > 0 && (
          <b
            key={pops}
            className={`${styles.badge} ${pops > 0 ? styles.pop : ''}`}
            aria-hidden="true"
          >
            {unread > 99 ? '99+' : unread}
          </b>
        )}
      </button>
      {open && (
        <div
          ref={popover}
          id={popoverId}
          className={styles.popover}
          role="region"
          aria-label="Thông báo gần đây"
        >
          <div className={styles.head}>
            <strong>Thông báo</strong>
            <button
              type="button"
              className={styles.textButton}
              onClick={markAll}
              disabled={marking || unread === 0}
            >
              Đánh dấu đã đọc tất cả
            </button>
          </div>
          {preview.length > 0 ? (
            <ul className={styles.list}>
              {preview.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.action?.href ?? viewAllHref}
                    className={styles.item}
                    onClick={() => openItem(item)}
                  >
                    <i
                      className={`${styles.dot} ${item.read ? styles.dotRead : ''}`}
                      aria-hidden="true"
                    />
                    <div className={styles.itemText}>
                      <strong>
                        {item.read ? (
                          ''
                        ) : (
                          <span className={styles.srOnly}>Chưa đọc: </span>
                        )}
                        {item.title}
                      </strong>
                      <p>{item.body}</p>
                      <small>{relativeTime(item.createdAt)}</small>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty} role="status">
              {!loaded
                ? 'Đang tải thông báo…'
                : failed
                  ? 'Chưa tải được thông báo. Thử lại sau ít phút.'
                  : 'Chưa có thông báo nào.'}
            </p>
          )}
          <Link
            href={viewAllHref}
            className={styles.viewAll}
            onClick={() => setOpen(false)}
          >
            Xem tất cả
          </Link>
        </div>
      )}
    </div>
  )
}
