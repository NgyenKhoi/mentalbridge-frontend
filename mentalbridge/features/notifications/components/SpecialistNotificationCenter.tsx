'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from '../api/browser-notifications'
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferences,
} from '../api/browser-notification-preferences'
import styles from './SpecialistNotificationCenter.module.css'

type View = 'inbox' | 'settings'

function timestamp(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function SpecialistNotificationCenter() {
  const [view, setView] = useState<View>('inbox')
  const [items, setItems] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [preferences, setPreferences] = useState<NotificationPreferences>()
  const [etag, setEtag] = useState('')
  const [saved, setSaved] = useState(false)

  async function loadInbox(cursor?: string, append = false) {
    try {
      const page = await getNotifications(cursor)
      setError('')
      setItems((current) =>
        append ? [...current, ...page.items] : [...page.items],
      )
      setUnreadCount(page.unreadCount)
      setNextCursor(page.nextCursor)
    } catch {
      setError('Hộp thư thông báo tạm thời chưa tải được.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void getNotifications()
      .then((page) => {
        setItems([...page.items])
        setUnreadCount(page.unreadCount)
        setNextCursor(page.nextCursor)
      })
      .catch(() => setError('Hộp thư thông báo tạm thời chưa tải được.'))
      .finally(() => setLoading(false))
    void getNotificationPreferences()
      .then((result) => {
        setPreferences(result.preferences)
        setEtag(result.etag)
      })
      .catch(() => setError('Cài đặt thông báo tạm thời chưa tải được.'))
  }, [])

  async function markRead(item: Notification) {
    if (item.read) return
    setBusy(item.id)
    setError('')
    try {
      const updated = await markNotificationRead(item.id)
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? updated : entry)),
      )
      setUnreadCount((count) => Math.max(0, count - 1))
    } catch {
      setError('Không thể đánh dấu thông báo đã đọc. Vui lòng thử lại.')
    } finally {
      setBusy('')
    }
  }

  async function remove(item: Notification) {
    setBusy(item.id)
    setError('')
    try {
      await deleteNotification(item.id)
      setItems((current) => current.filter((entry) => entry.id !== item.id))
      if (!item.read) setUnreadCount((count) => Math.max(0, count - 1))
    } catch {
      setError('Không thể xóa thông báo. Vui lòng thử lại.')
    } finally {
      setBusy('')
    }
  }

  async function markAll() {
    setBusy('all')
    setError('')
    try {
      await markAllNotificationsRead()
      setItems((current) => current.map((item) => ({ ...item, read: true })))
      setUnreadCount(0)
    } catch {
      setError('Không thể đánh dấu tất cả đã đọc. Vui lòng thử lại.')
    } finally {
      setBusy('')
    }
  }

  function toggle(
    field: 'notificationsEnabled' | 'appointmentMessage' | 'resourceSystem',
  ) {
    setSaved(false)
    setPreferences((current) => {
      if (!current) return current
      if (field === 'notificationsEnabled') {
        return {
          ...current,
          notificationsEnabled: !current.notificationsEnabled,
        }
      }
      return {
        ...current,
        contentGroups: {
          ...current.contentGroups,
          [field]: !current.contentGroups[field],
        },
      }
    })
  }

  async function save() {
    if (!preferences || !etag) return
    setBusy('save')
    setError('')
    try {
      const result = await saveNotificationPreferences(
        {
          notificationsEnabled: preferences.notificationsEnabled,
          channels: { inApp: preferences.channels.inApp },
          contentGroups: {
            appointmentMessage: preferences.contentGroups.appointmentMessage,
            resourceSystem: preferences.contentGroups.resourceSystem,
          },
        },
        etag,
      )
      setPreferences(result.preferences)
      setEtag(result.etag)
      setSaved(true)
    } catch {
      setError('Không thể lưu cài đặt. Hãy tải lại và thử lại.')
    } finally {
      setBusy('')
    }
  }

  return (
    <section
      className={styles.center}
      aria-labelledby="specialist-notification-title"
    >
      <header className={styles.header}>
        <div>
          <span>THÔNG BÁO CHUYÊN GIA</span>
          <h1 id="specialist-notification-title">Trung tâm thông báo</h1>
          <p>Cập nhật vận hành về lịch hẹn và tài khoản chuyên gia.</p>
        </div>
        {unreadCount > 0 && <strong>{unreadCount} chưa đọc</strong>}
      </header>
      <nav className={styles.tabs} aria-label="Trung tâm thông báo">
        <button
          aria-current={view === 'inbox'}
          onClick={() => setView('inbox')}
        >
          Hộp thư
        </button>
        <button
          aria-current={view === 'settings'}
          onClick={() => setView('settings')}
        >
          Cài đặt
        </button>
      </nav>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {view === 'inbox' ? (
        <div className={styles.panel}>
          <div className={styles.toolbar}>
            <h2>Thông báo gần đây</h2>
            <button
              disabled={!unreadCount || busy === 'all'}
              onClick={() => void markAll()}
            >
              Đánh dấu tất cả đã đọc
            </button>
          </div>
          {loading && !items.length && <p>Đang tải thông báo…</p>}
          {!loading && !items.length && !error && (
            <div className={styles.empty}>
              <strong>Chưa có thông báo</strong>
              <p>Các cập nhật vận hành mới sẽ xuất hiện tại đây.</p>
            </div>
          )}
          <ul className={styles.list}>
            {items.map((item) => (
              <li
                key={item.id}
                className={item.read ? styles.read : styles.unread}
              >
                <button
                  className={styles.body}
                  disabled={busy === item.id}
                  onClick={() => void markRead(item)}
                >
                  <span>
                    {item.kind === 'APPOINTMENT' ? 'LỊCH HẸN' : 'HỆ THỐNG'}
                  </span>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  <time>{timestamp(item.occurredAt)}</time>
                </button>
                <div className={styles.actions}>
                  {item.action && (
                    <Link
                      href={item.action.href}
                      onClick={() => void markRead(item)}
                    >
                      Mở
                    </Link>
                  )}
                  <button
                    aria-label={`Xóa ${item.title}`}
                    onClick={() => void remove(item)}
                  >
                    Xóa
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {nextCursor && (
            <button
              className={styles.more}
              disabled={loading}
              onClick={() => {
                setLoading(true)
                void loadInbox(nextCursor, true)
              }}
            >
              Tải thêm
            </button>
          )}
        </div>
      ) : (
        <div className={styles.panel}>
          <h2>Cài đặt thông báo chuyên gia</h2>
          <p className={styles.note}>
            Các lựa chọn này tách biệt với lời nhắc Journal, cảm xúc và hoạt
            động wellbeing của người dùng.
          </p>
          {preferences && (
            <div className={styles.settings}>
              <label>
                <span>
                  <strong>Bật thông báo</strong>
                  <small>
                    Cho phép nhận cập nhật trong không gian chuyên gia.
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={preferences.notificationsEnabled}
                  onChange={() => toggle('notificationsEnabled')}
                />
              </label>
              <label>
                <span>
                  <strong>Lịch hẹn và tin nhắn</strong>
                  <small>
                    Yêu cầu mới, thay đổi trạng thái và cập nhật phiên tư vấn.
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={preferences.contentGroups.appointmentMessage}
                  onChange={() => toggle('appointmentMessage')}
                />
              </label>
              <label>
                <span>
                  <strong>Tài khoản và hệ thống</strong>
                  <small>
                    Cập nhật vận hành quan trọng dành cho chuyên gia.
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={preferences.contentGroups.resourceSystem}
                  onChange={() => toggle('resourceSystem')}
                />
              </label>
              <button
                className={styles.save}
                disabled={busy === 'save'}
                onClick={() => void save()}
              >
                {busy === 'save' ? 'Đang lưu…' : 'Lưu cài đặt'}
              </button>
              {saved && (
                <span className={styles.success} role="status">
                  Đã lưu cài đặt.
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
