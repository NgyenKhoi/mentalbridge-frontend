'use client'

import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import './notifications.css'

type View = 'inbox' | 'settings'
type NotificationItem = {
  id: number
  type:
    | 'reminder'
    | 'message'
    | 'appointment'
    | 'system'
    | 'assessment'
    | 'achievement'
  title: string
  message: string
  time: string
  read: boolean
}
type Preferences = {
  enabled: boolean
  inApp: boolean
  email: boolean
  push: boolean
  appointments: boolean
  messages: boolean
  assessments: boolean
  wellbeing: boolean
  product: boolean
  quietHours: boolean
  quietFrom: string
  quietTo: string
  digest: string
}

const initialNotifications: NotificationItem[] = [
  {
    id: 1,
    type: 'reminder',
    title: 'Nhắc bạn viết nhật ký hôm nay',
    message:
      'Bạn chưa ghi lại cảm xúc hôm nay. Một vài phút quan sát bản thân có thể giúp bạn nhận ra điều mình đang cần.',
    time: '2 giờ trước',
    read: false,
  },
  {
    id: 2,
    type: 'message',
    title: 'Tin nhắn mới từ TS. Nguyễn Thị Lan',
    message:
      'Buổi tư vấn tiếp theo của chúng ta là thứ Năm lúc 10:00. Bạn có thể gửi trước điều muốn trao đổi.',
    time: '3 giờ trước',
    read: false,
  },
  {
    id: 3,
    type: 'appointment',
    title: 'Lịch tư vấn sắp diễn ra',
    message: 'Bạn có buổi tư vấn với ThS. Trần Văn Minh vào 10:00 ngày mai.',
    time: 'Hôm qua',
    read: true,
  },
  {
    id: 4,
    type: 'system',
    title: 'Tài nguyên mới đã được cập nhật',
    message:
      'MentalBridge vừa bổ sung bài tập thở và thiền ngắn trong thư viện tự hỗ trợ.',
    time: '2 ngày trước',
    read: true,
  },
  {
    id: 5,
    type: 'assessment',
    title: 'Đã đến lúc đánh giá lại',
    message:
      'Đã hai tuần kể từ lần đánh giá gần nhất. Bạn có thể làm lại PHQ-9 để theo dõi tiến trình.',
    time: '3 ngày trước',
    read: true,
  },
  {
    id: 6,
    type: 'achievement',
    title: 'Bạn đã duy trì nhật ký 7 ngày',
    message:
      'Bảy ngày liên tiếp là một nhịp theo dõi tốt. Hãy tiếp tục theo cách phù hợp với bạn.',
    time: '1 tuần trước',
    read: true,
  },
]

const initialPreferences: Preferences = {
  enabled: true,
  inApp: true,
  email: true,
  push: false,
  appointments: true,
  messages: true,
  assessments: true,
  wellbeing: false,
  product: false,
  quietHours: true,
  quietFrom: '22:00',
  quietTo: '07:00',
  digest: 'instant',
}
const typeMeta = {
  reminder: { label: 'Nhắc nhở', icon: '✎', tone: 'amber' },
  message: { label: 'Tin nhắn', icon: '◇', tone: 'teal' },
  appointment: { label: 'Lịch hẹn', icon: '◷', tone: 'lavender' },
  system: { label: 'Hệ thống', icon: '✦', tone: 'sage' },
  assessment: { label: 'Đánh giá', icon: '✓', tone: 'amber' },
  achievement: { label: 'Cột mốc', icon: '↗', tone: 'terra' },
} as const

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

function ChannelIcon({ type }: { type: 'app' | 'email' | 'push' }) {
  if (type === 'email')
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    )
  if (type === 'push')
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect x="7" y="2" width="10" height="20" rx="3" />
        <path d="M10 18h4" />
      </svg>
    )
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 6-3 8-3 8h18s-3-2-3-8" />
      <path d="M10 20h4" />
    </svg>
  )
}

export default function NotificationsPage() {
  const [view, setView] = useState<View>('inbox')
  const [items, setItems] = useState(initialNotifications)
  const [preferences, setPreferences] = useState(initialPreferences)
  const [savedPreferences, setSavedPreferences] = useState(initialPreferences)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const unreadCount = items.filter((item) => !item.read).length
  const dirty = JSON.stringify(preferences) !== JSON.stringify(savedPreferences)
  const activeSummary = useMemo(
    () => ({
      channels: [
        preferences.inApp && 'Trong ứng dụng',
        preferences.email && 'Email',
        preferences.push && 'Thông báo đẩy',
      ].filter(Boolean) as string[],
      categories: [
        preferences.appointments,
        preferences.messages,
        preferences.assessments,
        preferences.wellbeing,
        preferences.product,
      ].filter(Boolean).length,
    }),
    [preferences],
  )
  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
    setPreferences((current) => ({ ...current, [key]: value }))
  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }
  const markAllRead = () => {
    setItems((current) => current.map((item) => ({ ...item, read: true })))
    showToast('Đã đánh dấu tất cả là đã đọc.')
  }
  const savePreferences = () => {
    setSaving(true)
    window.setTimeout(() => {
      setSavedPreferences(preferences)
      setSaving(false)
      showToast('Đã lưu cài đặt thông báo.')
    }, 650)
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
        <motion.section
          className="notifications-inbox"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="notifications-list-head">
            <div>
              <h2>Cập nhật gần đây</h2>
              <p>
                {unreadCount
                  ? `Bạn còn ${unreadCount} thông báo chưa đọc.`
                  : 'Bạn đã xem tất cả thông báo.'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead}>
                ✓ Đánh dấu đã đọc tất cả
              </button>
            )}
          </div>
          <div className="notifications-list">
            {items.map((item, index) => {
              const meta = typeMeta[item.type]
              return (
                <motion.button
                  type="button"
                  key={item.id}
                  className={`notification-item ${item.read ? '' : 'is-unread'}`}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.035 }}
                  onClick={() =>
                    setItems((current) =>
                      current.map((notification) =>
                        notification.id === item.id
                          ? { ...notification, read: true }
                          : notification,
                      ),
                    )
                  }
                >
                  <span className={`notification-item-icon ${meta.tone}`}>
                    {meta.icon}
                  </span>
                  <span className="notification-item-copy">
                    <span>
                      <b>{meta.label}</b>
                      <time>{item.time}</time>
                    </span>
                    <strong>{item.title}</strong>
                    <p>{item.message}</p>
                  </span>
                  {!item.read && (
                    <i className="notification-unread" aria-label="Chưa đọc" />
                  )}
                  <span className="notification-arrow" aria-hidden="true">
                    →
                  </span>
                </motion.button>
              )
            })}
          </div>
          <p className="notifications-history-note">
            Thông báo cũ hơn 90 ngày sẽ được tự động xóa khỏi hộp thư.
          </p>
        </motion.section>
      ) : (
        <motion.div
          className="notification-settings-layout"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <main
            className={`notification-settings-main ${preferences.enabled ? '' : 'is-paused'}`}
          >
            <section className="notification-master">
              <div className="notification-master-icon">
                <ChannelIcon type="app" />
              </div>
              <div>
                <span>Cài đặt chung</span>
                <h2>Cho phép nhận thông báo</h2>
                <p>Tạm dừng tất cả thông báo không khẩn cấp từ MentalBridge.</p>
              </div>
              <Toggle
                checked={preferences.enabled}
                onChange={() => update('enabled', !preferences.enabled)}
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
                <article>
                  <span className="notification-channel-icon">
                    <ChannelIcon type="app" />
                  </span>
                  <div>
                    <strong>Trong ứng dụng</strong>
                    <small>Hiển thị tại trung tâm thông báo</small>
                  </div>
                  <em>Luôn bật cho cảnh báo tài khoản</em>
                  <Toggle
                    checked={preferences.inApp}
                    onChange={() => update('inApp', !preferences.inApp)}
                    label="Thông báo trong ứng dụng"
                    disabled={!preferences.enabled}
                  />
                </article>
                <article>
                  <span className="notification-channel-icon">
                    <ChannelIcon type="email" />
                  </span>
                  <div>
                    <strong>Email</strong>
                    <small>Gửi tới user@example.com</small>
                  </div>
                  <em>Phù hợp với lịch hẹn và tổng hợp</em>
                  <Toggle
                    checked={preferences.email}
                    onChange={() => update('email', !preferences.email)}
                    label="Thông báo qua email"
                    disabled={!preferences.enabled}
                  />
                </article>
                <article>
                  <span className="notification-channel-icon">
                    <ChannelIcon type="push" />
                  </span>
                  <div>
                    <strong>Thông báo đẩy</strong>
                    <small>Trên thiết bị bạn đang sử dụng</small>
                  </div>
                  <em>Hiện đang tắt</em>
                  <Toggle
                    checked={preferences.push}
                    onChange={() => update('push', !preferences.push)}
                    label="Thông báo đẩy"
                    disabled={!preferences.enabled}
                  />
                </article>
              </div>
            </section>
            <section className="notification-settings-section">
              <header>
                <div>
                  <span>02</span>
                  <h2>Nội dung bạn muốn nhận</h2>
                </div>
                <p>Bạn có thể thay đổi bất cứ lúc nào.</p>
              </header>
              <div className="notification-category-list">
                {(
                  [
                    [
                      'appointments',
                      '◷',
                      'Lịch hẹn và phiên tư vấn',
                      'Xác nhận, nhắc lịch, đổi lịch hoặc hủy lịch.',
                    ],
                    [
                      'messages',
                      '◇',
                      'Tin nhắn từ chuyên gia',
                      'Thông báo khi chuyên gia gửi tin nhắn mới.',
                    ],
                    [
                      'assessments',
                      '✓',
                      'Đánh giá tâm lý',
                      'Nhắc thời điểm phù hợp để đánh giá lại tiến trình.',
                    ],
                    [
                      'wellbeing',
                      '✎',
                      'Nhật ký và hoạt động tự hỗ trợ',
                      'Nhắc nhẹ theo thói quen chăm sóc bạn đã chọn.',
                    ],
                    [
                      'product',
                      '✦',
                      'Tài nguyên và cập nhật sản phẩm',
                      'Nội dung mới, tính năng và thông tin từ MentalBridge.',
                    ],
                  ] as const
                ).map(([key, icon, title, description]) => (
                  <article key={key}>
                    <span>{icon}</span>
                    <div>
                      <strong>{title}</strong>
                      <small>{description}</small>
                    </div>
                    <Toggle
                      checked={preferences[key]}
                      onChange={() => update(key, !preferences[key])}
                      label={title}
                      disabled={!preferences.enabled}
                    />
                  </article>
                ))}
              </div>
            </section>
            <section className="notification-settings-section notification-schedule">
              <header>
                <div>
                  <span>03</span>
                  <h2>Nhịp thông báo</h2>
                </div>
                <p>Giữ khoảng thời gian nghỉ ngơi không bị gián đoạn.</p>
              </header>
              <div className="notification-quiet-row">
                <div>
                  <strong>Giờ yên tĩnh</strong>
                  <small>
                    Chỉ cảnh báo an toàn hoặc thay đổi lịch khẩn mới được gửi.
                  </small>
                </div>
                <Toggle
                  checked={preferences.quietHours}
                  onChange={() => update('quietHours', !preferences.quietHours)}
                  label="Giờ yên tĩnh"
                  disabled={!preferences.enabled}
                />
              </div>
              <div className="notification-time-grid">
                <label>
                  <span>Bắt đầu</span>
                  <input
                    type="time"
                    value={preferences.quietFrom}
                    onChange={(event) =>
                      update('quietFrom', event.target.value)
                    }
                    disabled={!preferences.enabled || !preferences.quietHours}
                  />
                </label>
                <label>
                  <span>Kết thúc</span>
                  <input
                    type="time"
                    value={preferences.quietTo}
                    onChange={(event) => update('quietTo', event.target.value)}
                    disabled={!preferences.enabled || !preferences.quietHours}
                  />
                </label>
                <label>
                  <span>Tần suất email</span>
                  <select
                    value={preferences.digest}
                    onChange={(event) => update('digest', event.target.value)}
                    disabled={!preferences.enabled || !preferences.email}
                  >
                    <option value="instant">Gửi ngay</option>
                    <option value="daily">Tổng hợp mỗi ngày</option>
                    <option value="weekly">Tổng hợp mỗi tuần</option>
                  </select>
                </label>
              </div>
              <p className="notification-timezone">
                Múi giờ hiện tại: Asia/Bangkok (UTC+7)
              </p>
            </section>
          </main>
          <aside className="notification-settings-summary">
            <span className="notification-summary-kicker">Tóm tắt cài đặt</span>
            <div
              className={`notification-summary-orb ${preferences.enabled ? 'is-on' : ''}`}
            >
              <i />
              <strong>
                {preferences.enabled ? 'Đang hoạt động' : 'Đã tạm dừng'}
              </strong>
            </div>
            <h2>{activeSummary.channels.length} kênh đang bật</h2>
            <div className="notification-summary-channels">
              {activeSummary.channels.map((channel) => (
                <span key={channel}>✓ {channel}</span>
              ))}
            </div>
            <dl>
              <div>
                <dt>Nhóm nội dung</dt>
                <dd>{activeSummary.categories}/5</dd>
              </div>
              <div>
                <dt>Giờ yên tĩnh</dt>
                <dd>
                  {preferences.quietHours
                    ? `${preferences.quietFrom}–${preferences.quietTo}`
                    : 'Không dùng'}
                </dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>
                  {preferences.digest === 'instant'
                    ? 'Gửi ngay'
                    : preferences.digest === 'daily'
                      ? 'Mỗi ngày'
                      : 'Mỗi tuần'}
                </dd>
              </div>
            </dl>
            <div className="notification-safety-note">
              <span>i</span>
              <p>
                <strong>Thông báo an toàn luôn được ưu tiên</strong>Cảnh báo bảo
                mật và thay đổi quan trọng về phiên tư vấn vẫn có thể được gửi.
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
              <small>Áp dụng cho tài khoản và các thiết bị đã đăng nhập.</small>
            </div>
            <div>
              <button
                type="button"
                disabled={!dirty || saving}
                onClick={() => setPreferences(savedPreferences)}
              >
                Hủy thay đổi
              </button>
              <button
                type="button"
                disabled={!dirty || saving}
                onClick={savePreferences}
              >
                {saving ? 'Đang lưu…' : 'Lưu cài đặt'}
              </button>
            </div>
          </footer>
        </motion.div>
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
