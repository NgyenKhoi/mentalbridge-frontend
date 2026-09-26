'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { ApiError } from '@/lib/api/api-error'
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferencePatch,
  type NotificationPreferences,
} from '@/features/notifications/api/browser-notification-preferences'
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from '@/features/notifications/api/browser-notifications'

import './notifications.css'

type View = 'inbox' | 'settings'

const typeMeta: Readonly<
  Record<Notification['kind'], { label: string; icon: string; tone: string }>
> = {
  REMINDER: { label: 'Nhắc nhở', icon: '✎', tone: 'amber' },
  MESSAGE: { label: 'Tin nhắn', icon: '◇', tone: 'teal' },
  APPOINTMENT: { label: 'Lịch hẹn', icon: '◷', tone: 'lavender' },
  SYSTEM_RESOURCE: { label: 'Tài nguyên', icon: '✦', tone: 'sage' },
  ASSESSMENT_REASSESSMENT: {
    label: 'Sàng lọc',
    icon: '✓',
    tone: 'amber',
  },
  STREAK_MILESTONE: { label: 'Cột mốc', icon: '↗', tone: 'terra' },
}

function notificationTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

const groups = [
  [
    'journalReminder',
    '✎',
    'Nhật ký và lời nhắc',
    'Nhắc nhẹ theo thói quen viết nhật ký bạn đã chọn.',
  ],
  [
    'emotionCheckIn',
    '♡',
    'Kiểm tra cảm xúc',
    'Nhắc bạn dừng lại và ghi nhận cảm xúc của mình.',
  ],
  [
    'streakMilestone',
    '↗',
    'Chuỗi hoạt động và cột mốc',
    'Cập nhật về những cột mốc sử dụng có ý nghĩa.',
  ],
  [
    'screeningReassessment',
    '✓',
    'Sàng lọc và đánh giá lại',
    'Nhắc thời điểm phù hợp để xem lại tiến trình.',
  ],
  [
    'appointmentMessage',
    '◇',
    'Lịch hẹn và tin nhắn',
    'Xác nhận, thay đổi lịch và tin nhắn từ chuyên gia.',
  ],
  [
    'resourceSystem',
    '✦',
    'Tài nguyên và hệ thống',
    'Nội dung mới và cập nhật quan trọng của tài khoản.',
  ],
] as const

const timeZones = [
  'Asia/Ho_Chi_Minh',
  'Asia/Bangkok',
  'UTC',
  'Europe/Paris',
  'America/New_York',
]

function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean
  onChange: () => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`notification-switch ${checked ? 'is-on' : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
    >
      <span />
    </button>
  )
}

function patchOf(value: NotificationPreferences): NotificationPreferencePatch {
  return {
    notificationsEnabled: value.notificationsEnabled,
    channels: value.channels,
    contentGroups: value.contentGroups,
    quietHours: value.quietHours,
    email: value.email,
  }
}

export default function NotificationsPage() {
  const router = useRouter()
  const [view, setView] = useState<View>('inbox')
  const [items, setItems] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [inboxLoading, setInboxLoading] = useState(true)
  const [inboxLoadingMore, setInboxLoadingMore] = useState(false)
  const [inboxError, setInboxError] = useState('')
  const [inboxActionId, setInboxActionId] = useState('')
  const [preferences, setPreferences] = useState<NotificationPreferences>()
  const [saved, setSaved] = useState<NotificationPreferences>()
  const [etag, setEtag] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const loadInbox = useCallback(async (cursor?: string, append = false) => {
    if (append) setInboxLoadingMore(true)
    else setInboxLoading(true)
    setInboxError('')
    try {
      const page = await getNotifications(cursor)
      setItems((current) => {
        if (!append) return page.items
        const known = new Set(current.map((item) => item.id))
        return [...current, ...page.items.filter((item) => !known.has(item.id))]
      })
      setUnreadCount(page.unreadCount)
      setNextCursor(page.nextCursor)
    } catch {
      setInboxError('Hộp thư thông báo tạm thời chưa tải được.')
    } finally {
      setInboxLoading(false)
      setInboxLoadingMore(false)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await getNotificationPreferences()
      setPreferences(result.preferences)
      setSaved(result.preferences)
      setEtag(result.etag)
    } catch {
      setError('Cài đặt thông báo tạm thời chưa tải được.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    void getNotificationPreferences()
      .then((result) => {
        if (!active) return
        setPreferences(result.preferences)
        setSaved(result.preferences)
        setEtag(result.etag)
      })
      .catch(() => {
        if (active) setError('Cài đặt thông báo tạm thời chưa tải được.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    void getNotifications()
      .then((page) => {
        if (!active) return
        setItems(page.items)
        setUnreadCount(page.unreadCount)
        setNextCursor(page.nextCursor)
      })
      .catch(() => {
        if (active) setInboxError('Hộp thư thông báo tạm thời chưa tải được.')
      })
      .finally(() => {
        if (active) setInboxLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const dirty = Boolean(
    preferences &&
    saved &&
    JSON.stringify(preferences) !== JSON.stringify(saved),
  )
  const summary = useMemo(
    () =>
      preferences
        ? {
            channels: [
              preferences.channels.inApp && 'Trong ứng dụng',
              preferences.channels.email && 'Email',
              preferences.channels.push && 'Push (tương lai)',
            ].filter(Boolean) as string[],
            groups: Object.values(preferences.contentGroups).filter(Boolean)
              .length,
          }
        : { channels: [] as string[], groups: 0 },
    [preferences],
  )

  function change(next: NotificationPreferences) {
    setPreferences(next)
    setError('')
  }

  async function openNotification(item: Notification) {
    if (inboxActionId) return
    setInboxActionId(item.id)
    setInboxError('')
    try {
      const current = item.read ? item : await markNotificationRead(item.id)
      if (!item.read) {
        setItems((values) =>
          values.map((value) => (value.id === current.id ? current : value)),
        )
        setUnreadCount((count) => Math.max(0, count - 1))
      }
      if (current.action) router.push(current.action.href)
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        cause.status !== undefined &&
        [404, 410].includes(cause.status)
      ) {
        setItems((values) => values.filter((value) => value.id !== item.id))
        if (!item.read) setUnreadCount((count) => Math.max(0, count - 1))
        setToast('Thông báo này không còn trong hộp thư.')
      } else {
        setInboxError('Chưa thể cập nhật thông báo. Vui lòng thử lại.')
      }
    } finally {
      setInboxActionId('')
    }
  }

  async function removeNotification(item: Notification) {
    if (inboxActionId) return
    setInboxActionId(item.id)
    setInboxError('')
    try {
      await deleteNotification(item.id)
      setItems((values) => values.filter((value) => value.id !== item.id))
      if (!item.read) setUnreadCount((count) => Math.max(0, count - 1))
      setToast('Đã xóa thông báo khỏi hộp thư.')
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        cause.status !== undefined &&
        [404, 410].includes(cause.status)
      ) {
        setItems((values) => values.filter((value) => value.id !== item.id))
        if (!item.read) setUnreadCount((count) => Math.max(0, count - 1))
        setToast('Thông báo này không còn trong hộp thư.')
      } else {
        setInboxError('Chưa thể xóa thông báo. Vui lòng thử lại.')
      }
    } finally {
      setInboxActionId('')
    }
  }

  async function markAllRead() {
    if (inboxActionId) return
    setInboxActionId('all')
    setInboxError('')
    try {
      await markAllNotificationsRead()
      await loadInbox()
      setToast('Đã đánh dấu tất cả là đã đọc.')
    } catch {
      setInboxError('Chưa thể đánh dấu tất cả là đã đọc. Vui lòng thử lại.')
    } finally {
      setInboxActionId('')
    }
  }

  async function savePreferences() {
    if (!preferences || !etag) return
    if (
      preferences.quietHours.enabled &&
      preferences.quietHours.start === preferences.quietHours.end
    ) {
      setError('Giờ bắt đầu và kết thúc phải khác nhau.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const result = await saveNotificationPreferences(
        patchOf(preferences),
        etag,
      )
      setPreferences(result.preferences)
      setSaved(result.preferences)
      setEtag(result.etag)
      setToast('Đã lưu cài đặt thông báo.')
      window.setTimeout(() => setToast(''), 2600)
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 412
          ? 'Cài đặt đã thay đổi trên thiết bị khác. Hãy tải lại trước khi lưu.'
          : 'Không thể lưu cài đặt lúc này. Vui lòng thử lại.',
      )
    } finally {
      setSaving(false)
    }
  }

  function settingsView() {
    if (loading)
      return (
        <section
          className="notification-settings-state"
          role="status"
          aria-busy="true"
        >
          <h2>Đang tải cài đặt…</h2>
          <p>Các lựa chọn đã lưu của bạn đang được đồng bộ.</p>
        </section>
      )
    if (!preferences || !saved || !etag)
      return (
        <section className="notification-settings-state" role="alert">
          <h2>{error || 'Cài đặt thông báo tạm thời chưa tải được.'}</h2>
          <button type="button" onClick={() => void load()}>
            Thử lại
          </button>
        </section>
      )

    const disabled = !preferences.notificationsEnabled
    return (
      <div className="notification-settings-layout">
        <main
          className={`notification-settings-main ${disabled ? 'is-paused' : ''}`}
        >
          <section className="notification-master">
            <div className="notification-master-icon" aria-hidden="true">
              ◎
            </div>
            <div>
              <span>Cài đặt chung</span>
              <h2>Cho phép nhận thông báo</h2>
              <p>Tạm dừng tất cả thông báo tùy chọn từ MentalBridge.</p>
            </div>
            <Toggle
              checked={preferences.notificationsEnabled}
              onChange={() =>
                change({
                  ...preferences,
                  notificationsEnabled: !preferences.notificationsEnabled,
                })
              }
              label="Cho phép nhận thông báo"
            />
          </section>

          <section className="notification-settings-section">
            <header>
              <div>
                <span>01</span>
                <h2>Kênh nhận thông báo</h2>
              </div>
              <p>Chọn nơi bạn muốn nhận cập nhật.</p>
            </header>
            <div className="notification-channel-grid">
              {(
                [
                  [
                    'inApp',
                    'Trong ứng dụng',
                    'Hiển thị tại trung tâm thông báo',
                  ],
                  ['email', 'Email', 'Chỉ gửi cho nội dung bạn đồng ý'],
                  [
                    'push',
                    'Thông báo đẩy',
                    'Lưu lựa chọn cho ứng dụng di động trong tương lai',
                  ],
                ] as const
              ).map(([key, title, description]) => (
                <article key={key}>
                  <span
                    className="notification-channel-icon"
                    aria-hidden="true"
                  >
                    {key === 'email' ? '✉' : key === 'push' ? '▯' : '◉'}
                  </span>
                  <div>
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </div>
                  <em>
                    {key === 'push'
                      ? 'Chưa kích hoạt gửi push trên thiết bị'
                      : 'Áp dụng cho tài khoản của bạn'}
                  </em>
                  <Toggle
                    checked={preferences.channels[key]}
                    onChange={() =>
                      change({
                        ...preferences,
                        channels: {
                          ...preferences.channels,
                          [key]: !preferences.channels[key],
                        },
                      })
                    }
                    label={title}
                    disabled={disabled}
                  />
                </article>
              ))}
            </div>
          </section>

          <section className="notification-settings-section">
            <header>
              <div>
                <span>02</span>
                <h2>Nội dung bạn muốn nhận</h2>
              </div>
              <p>Mỗi nhóm được lưu độc lập.</p>
            </header>
            <div className="notification-category-list">
              {groups.map(([key, icon, title, description]) => (
                <article key={key}>
                  <span>{icon}</span>
                  <div>
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </div>
                  <Toggle
                    checked={preferences.contentGroups[key]}
                    onChange={() =>
                      change({
                        ...preferences,
                        contentGroups: {
                          ...preferences.contentGroups,
                          [key]: !preferences.contentGroups[key],
                        },
                      })
                    }
                    label={title}
                    disabled={disabled}
                  />
                </article>
              ))}
            </div>
          </section>

          <section className="notification-settings-section notification-schedule">
            <header>
              <div>
                <span>03</span>
                <h2>Giờ yên tĩnh và múi giờ</h2>
              </div>
              <p>Khoảng giờ có thể đi qua nửa đêm.</p>
            </header>
            <div className="notification-quiet-row">
              <div>
                <strong>Bật giờ yên tĩnh</strong>
                <small>
                  Các dịch vụ gửi áp dụng chính sách đã được phê duyệt.
                </small>
              </div>
              <Toggle
                checked={preferences.quietHours.enabled}
                onChange={() =>
                  change({
                    ...preferences,
                    quietHours: {
                      ...preferences.quietHours,
                      enabled: !preferences.quietHours.enabled,
                    },
                  })
                }
                label="Giờ yên tĩnh"
                disabled={disabled}
              />
            </div>
            <div className="notification-time-grid">
              <label>
                <span>Bắt đầu</span>
                <input
                  aria-label="Bắt đầu"
                  type="time"
                  value={preferences.quietHours.start}
                  onChange={(event) =>
                    change({
                      ...preferences,
                      quietHours: {
                        ...preferences.quietHours,
                        start: event.target.value,
                      },
                    })
                  }
                  disabled={disabled || !preferences.quietHours.enabled}
                />
              </label>
              <label>
                <span>Kết thúc</span>
                <input
                  aria-label="Kết thúc"
                  type="time"
                  value={preferences.quietHours.end}
                  onChange={(event) =>
                    change({
                      ...preferences,
                      quietHours: {
                        ...preferences.quietHours,
                        end: event.target.value,
                      },
                    })
                  }
                  disabled={disabled || !preferences.quietHours.enabled}
                />
              </label>
              <label>
                <span>Múi giờ</span>
                <select
                  aria-label="Múi giờ"
                  value={preferences.quietHours.timeZone}
                  onChange={(event) =>
                    change({
                      ...preferences,
                      quietHours: {
                        ...preferences.quietHours,
                        timeZone: event.target.value,
                      },
                    })
                  }
                >
                  {timeZones.map((zone) => (
                    <option value={zone} key={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="notification-settings-section">
            <header>
              <div>
                <span>04</span>
                <h2>Tùy chọn email</h2>
              </div>
              <p>Chỉ gửi khi kênh email và lựa chọn tương ứng đều bật.</p>
            </header>
            <div className="notification-time-grid">
              <label>
                <span>Tần suất email</span>
                <select
                  aria-label="Tần suất email"
                  value={preferences.email.cadence}
                  onChange={(event) =>
                    change({
                      ...preferences,
                      email: {
                        ...preferences.email,
                        cadence: event.target
                          .value as NotificationPreferences['email']['cadence'],
                      },
                    })
                  }
                  disabled={disabled || !preferences.channels.email}
                >
                  <option value="IMMEDIATE">Gửi ngay</option>
                  <option value="DAILY_DIGEST">Tổng hợp mỗi ngày</option>
                  <option value="WEEKLY_DIGEST">Tổng hợp mỗi tuần</option>
                </select>
              </label>
            </div>
            <div className="notification-category-list">
              {(
                [
                  [
                    'wellbeingDigestEnabled',
                    'Tổng hợp sức khỏe tinh thần',
                    'Nhận bản tổng hợp định kỳ khi hành vi này được hỗ trợ.',
                  ],
                  [
                    'resourceRemindersEnabled',
                    'Nhắc tài nguyên',
                    'Nhận email nhắc về tài nguyên bạn đã chủ động chọn.',
                  ],
                ] as const
              ).map(([key, title, description]) => (
                <article key={key}>
                  <span>✉</span>
                  <div>
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </div>
                  <Toggle
                    checked={preferences.email[key]}
                    onChange={() =>
                      change({
                        ...preferences,
                        email: {
                          ...preferences.email,
                          [key]: !preferences.email[key],
                        },
                      })
                    }
                    label={title}
                    disabled={disabled || !preferences.channels.email}
                  />
                </article>
              ))}
            </div>
          </section>
        </main>

        <aside className="notification-settings-summary">
          <span className="notification-summary-kicker">Tóm tắt cài đặt</span>
          <div
            className={`notification-summary-orb ${disabled ? '' : 'is-on'}`}
          >
            <i />
            <strong>{disabled ? 'Đã tạm dừng' : 'Đang hoạt động'}</strong>
          </div>
          <h2>{summary.channels.length} kênh đang bật</h2>
          <div className="notification-summary-channels">
            {summary.channels.map((channel) => (
              <span key={channel}>✓ {channel}</span>
            ))}
          </div>
          <dl>
            <div>
              <dt>Nhóm nội dung</dt>
              <dd>{summary.groups}/6</dd>
            </div>
            <div>
              <dt>Giờ yên tĩnh</dt>
              <dd>
                {preferences.quietHours.enabled
                  ? `${preferences.quietHours.start}–${preferences.quietHours.end}`
                  : 'Không dùng'}
              </dd>
            </div>
            <div>
              <dt>Múi giờ</dt>
              <dd>{preferences.quietHours.timeZone}</dd>
            </div>
          </dl>
          <div className="notification-safety-note">
            <span>i</span>
            <p>
              <strong>Quyền riêng tư được giữ ở mức tối thiểu</strong>Nội dung
              nhạy cảm từ nhật ký, sàng lọc hoặc tin nhắn không được lưu trong
              cài đặt này. Hệ thống không tự động gửi email an toàn.
            </p>
          </div>
        </aside>

        <footer
          className={`notification-savebar ${dirty ? 'has-changes' : ''}`}
        >
          <div>
            <strong>
              {dirty ? '● Có thay đổi chưa lưu' : '✓ Cài đặt đã được lưu'}
            </strong>
            <small>Áp dụng cho tài khoản trên mọi thiết bị đã đăng nhập.</small>
            {error && <small role="alert">{error}</small>}
          </div>
          <div>
            {error.includes('thiết bị khác') && (
              <button type="button" onClick={() => void load()}>
                Tải lại
              </button>
            )}
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => {
                setPreferences(saved)
                setError('')
              }}
            >
              Hủy thay đổi
            </button>
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => void savePreferences()}
            >
              {saving ? 'Đang lưu…' : 'Lưu cài đặt'}
            </button>
          </div>
        </footer>
      </div>
    )
  }

  return (
    <div className="notifications-page">
      <header className="notifications-hero">
        <div>
          <span>Trung tâm thông báo</span>
          <h1>Thông báo của bạn</h1>
          <p>
            Theo dõi những cập nhật quan trọng và chọn cách MentalBridge liên hệ
            với bạn.
          </p>
        </div>
        <div className="notifications-hero-mark" aria-hidden="true">
          <span>{unreadCount}</span>
          <small>chưa đọc</small>
        </div>
      </header>
      <nav className="notifications-tabs" aria-label="Trung tâm thông báo">
        <button
          type="button"
          className={view === 'inbox' ? 'is-active' : ''}
          onClick={() => setView('inbox')}
        >
          <span>Hộp thư</span>
          {unreadCount > 0 && <b>{unreadCount}</b>}
          <small>Cập nhật gần đây</small>
        </button>
        <button
          type="button"
          className={view === 'settings' ? 'is-active' : ''}
          onClick={() => setView('settings')}
        >
          <span>Cài đặt</span>
          <i>Điều chỉnh</i>
          <small>Kênh nhận và tần suất</small>
        </button>
      </nav>
      {view === 'inbox' ? (
        <section className="notifications-inbox">
          <div className="notifications-list-head">
            <div>
              <h2>Cập nhật gần đây</h2>
              <p>
                {unreadCount > 0
                  ? `Bạn còn ${unreadCount} thông báo chưa đọc.`
                  : 'Bạn đã xem tất cả thông báo.'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={inboxActionId !== ''}
                onClick={() => void markAllRead()}
              >
                ✓ Đánh dấu đã đọc tất cả
              </button>
            )}
          </div>
          {inboxLoading ? (
            <section
              className="notification-settings-state"
              role="status"
              aria-busy="true"
            >
              <h2>Đang tải thông báo…</h2>
              <p>Hộp thư đã lưu của bạn đang được đồng bộ.</p>
            </section>
          ) : inboxError && items.length === 0 ? (
            <section className="notification-settings-state" role="alert">
              <h2>{inboxError}</h2>
              <button type="button" onClick={() => void loadInbox()}>
                Thử lại
              </button>
            </section>
          ) : items.length === 0 ? (
            <section className="notification-settings-state" role="status">
              <h2>Chưa có thông báo</h2>
              <p>Các cập nhật đã xác minh sẽ xuất hiện tại đây.</p>
            </section>
          ) : (
            <>
              {inboxError && (
                <div className="notifications-inline-error" role="alert">
                  <span>{inboxError}</span>
                  <button type="button" onClick={() => void loadInbox()}>
                    Tải lại
                  </button>
                </div>
              )}
              <div className="notifications-list">
                {items.map((item) => {
                  const meta = typeMeta[item.kind]
                  return (
                    <article
                      key={item.id}
                      className={`notification-item ${item.read ? '' : 'is-unread'}`}
                    >
                      <button
                        type="button"
                        className="notification-item-open"
                        disabled={inboxActionId !== ''}
                        onClick={() => void openNotification(item)}
                      >
                        <span
                          className={`notification-item-icon ${meta.tone}`}
                          aria-hidden="true"
                        >
                          {meta.icon}
                        </span>
                        <span className="notification-item-copy">
                          <span>
                            <b>{meta.label}</b>
                            <time dateTime={item.occurredAt}>
                              {notificationTime(item.occurredAt)}
                            </time>
                          </span>
                          <strong>{item.title}</strong>
                          <p>{item.body}</p>
                        </span>
                        {!item.read && (
                          <i
                            className="notification-unread"
                            aria-label="Chưa đọc"
                          />
                        )}
                        {item.action && (
                          <span
                            className="notification-arrow"
                            aria-hidden="true"
                          >
                            →
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        className="notification-item-delete"
                        disabled={inboxActionId !== ''}
                        aria-label={`Xóa thông báo: ${item.title}`}
                        onClick={() => void removeNotification(item)}
                      >
                        Xóa
                      </button>
                    </article>
                  )
                })}
              </div>
              {nextCursor && (
                <button
                  type="button"
                  className="notifications-load-more"
                  disabled={inboxLoadingMore}
                  onClick={() => void loadInbox(nextCursor, true)}
                >
                  {inboxLoadingMore ? 'Đang tải…' : 'Xem thêm thông báo'}
                </button>
              )}
              <p className="notifications-history-note">
                Thông báo cũ hơn 90 ngày sẽ được tự động xóa khỏi hộp thư.
              </p>
            </>
          )}
        </section>
      ) : (
        settingsView()
      )}
      {toast && (
        <div className="notifications-toast" role="status">
          <span>✓</span>
          {toast}
        </div>
      )}
    </div>
  )
}
