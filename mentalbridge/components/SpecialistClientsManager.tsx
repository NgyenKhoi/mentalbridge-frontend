'use client'

import { useMemo, useState } from 'react'
import './specialist-clients-manager.css'

export type SpecialistClientRow = {
  id: string
  title: string
  meta: string
  status: string
  detail: string
}

type Props = { rows: SpecialistClientRow[] }
type DetailTab = 'overview' | 'assessments' | 'emotion' | 'followup'
type EmotionRange = '7d' | '30d' | '90d'

const clientProfiles = {
  c1: {
    initials: 'MA',
    age: '24 tuổi',
    since: 'Đồng hành từ 04/2026',
    lastSession: '20/08/2026',
    nextSession: '28/08 · 10:30',
    format: 'Video call',
    focus: ['Lo âu', 'Giấc ngủ'],
    consent: ['Kết quả assessment', 'Xu hướng cảm xúc', 'Kế hoạch theo dõi'],
    privateItems: ['Nội dung nhật ký', 'Ghi chú cá nhân'],
    mood: [3, 4, 3, 4, 5, 4, 4],
    assessment: {
      name: 'GAD-7',
      score: '8/21',
      level: 'Mức nhẹ',
      change: 'Giảm 3 điểm',
    },
    followup: {
      title: 'Ổn định giấc ngủ',
      completed: 3,
      total: 5,
      due: 'Check-in tiếp theo: Thứ Sáu',
    },
  },
  c2: {
    initials: 'GH',
    age: '29 tuổi',
    since: 'Đồng hành từ 06/2026',
    lastSession: '18/08/2026',
    nextSession: '27/08 · 14:00',
    format: 'Tại phòng tư vấn',
    focus: ['Căng thẳng', 'Cân bằng công việc'],
    consent: ['Thông tin tổng quan', 'Kế hoạch theo dõi'],
    privateItems: [
      'Nội dung nhật ký',
      'Chi tiết assessment',
      'Ghi nhận cảm xúc',
    ],
    mood: [2, 3, 3, 2, 4, 3, 4],
    assessment: {
      name: 'DASS-21',
      score: '—',
      level: 'Không được chia sẻ',
      change: 'Cần quyền truy cập',
    },
    followup: {
      title: 'Quản lý căng thẳng',
      completed: 2,
      total: 4,
      due: 'Check-in tiếp theo: 30/08',
    },
  },
} as const

const tabs: { key: DetailTab; label: string }[] = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'assessments', label: 'Đánh giá' },
  { key: 'emotion', label: 'Cảm xúc' },
  { key: 'followup', label: 'Theo dõi' },
]

const emotionSeries: Record<EmotionRange, { label: string; value: number }[]> =
  {
    '7d': [
      { label: 'T2', value: 3 },
      { label: 'T3', value: 4 },
      { label: 'T4', value: 3 },
      { label: 'T5', value: 4 },
      { label: 'T6', value: 5 },
      { label: 'T7', value: 4 },
      { label: 'CN', value: 4 },
    ],
    '30d': [
      { label: '29/7', value: 2 },
      { label: '01/8', value: 3 },
      { label: '04/8', value: 3 },
      { label: '07/8', value: 4 },
      { label: '10/8', value: 3 },
      { label: '13/8', value: 4 },
      { label: '16/8', value: 4 },
      { label: '19/8', value: 5 },
      { label: '22/8', value: 4 },
      { label: '26/8', value: 4 },
    ],
    '90d': [
      { label: 'T6', value: 2 },
      { label: 'T7', value: 3 },
      { label: 'T8', value: 3 },
      { label: 'T9', value: 4 },
      { label: 'T10', value: 3 },
      { label: 'T11', value: 4 },
      { label: 'T12', value: 4 },
      { label: 'T13', value: 4 },
    ],
  }

const emotionEntries = [
  {
    date: '26/08/2026',
    time: '20:40',
    emoji: '🙂',
    mood: 'Tốt',
    score: 4,
    context: 'Check-in cảm xúc',
    note: 'Không chia sẻ ghi chú',
  },
  {
    date: '25/08/2026',
    time: '21:15',
    emoji: '😊',
    mood: 'Rất tốt',
    score: 5,
    context: 'Check-in cảm xúc',
    note: 'Sau hoạt động tự chăm sóc',
  },
  {
    date: '24/08/2026',
    time: '19:30',
    emoji: '😐',
    mood: 'Bình thường',
    score: 3,
    context: 'Check-in cảm xúc',
    note: 'Không chia sẻ ghi chú',
  },
  {
    date: '23/08/2026',
    time: '22:05',
    emoji: '🙂',
    mood: 'Tốt',
    score: 4,
    context: 'Check-in cảm xúc',
    note: 'Sau bài tập thở',
  },
]

export default function SpecialistClientsManager({ rows }: Props) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(rows[0]?.id || '')
  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [emotionRange, setEmotionRange] = useState<EmotionRange>('30d')
  const [notice, setNotice] = useState('')

  const clients = useMemo(
    () =>
      rows.map((row, index) => ({
        ...row,
        profile: clientProfiles[row.id as keyof typeof clientProfiles] || {
          initials: row.title
            .split(' ')
            .slice(-2)
            .map((part) => part.charAt(0))
            .join(''),
          age: '—',
          since: 'Đang đồng hành',
          lastSession: '—',
          nextSession: 'Chưa có lịch',
          format: '—',
          focus: ['Theo dõi'],
          consent: ['Thông tin tổng quan'],
          privateItems: ['Nội dung nhật ký'],
          mood: [3, 3, 3, 3, 3, 3, 3],
          assessment: { name: 'Chưa có', score: '—', level: '—', change: '—' },
          followup: {
            title: 'Chưa thiết lập',
            completed: 0,
            total: 1,
            due: 'Chưa có check-in',
          },
        },
        unread: index === 0 ? 2 : 0,
      })),
    [rows],
  )

  const visibleClients = clients.filter((client) =>
    `${client.title} ${client.profile.focus.join(' ')}`
      .toLocaleLowerCase('vi')
      .includes(query.trim().toLocaleLowerCase('vi')),
  )
  const selected =
    clients.find((client) => client.id === selectedId) || clients[0]
  const hasEmotionConsent =
    selected?.profile.consent.some((item) => item === 'Xu hướng cảm xúc') ||
    false

  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2600)
  }

  if (!selected)
    return (
      <section className="scm-empty-page">
        <h1>Chưa có khách hàng</h1>
        <p>Khách hàng đã đồng ý chia sẻ sẽ xuất hiện tại đây.</p>
      </section>
    )

  return (
    <section className="scm-manager">
      <header className="scm-heading">
        <div>
          <span className="scm-eyebrow">Không gian chuyên gia</span>
          <h1>Thông tin khách hàng</h1>
          <p>
            Xem thông tin được khách hàng cho phép chia sẻ để chuẩn bị và theo
            dõi quá trình tư vấn.
          </p>
        </div>
        <aside>
          <span>✓</span>
          <div>
            <strong>Dữ liệu theo phạm vi đồng ý</strong>
            <small>Quyền truy cập có thể được thu hồi bất cứ lúc nào</small>
          </div>
        </aside>
      </header>

      <section className="scm-stats" aria-label="Tổng quan khách hàng">
        <article className="is-primary">
          <span>Đang đồng hành</span>
          <strong>{clients.length}</strong>
          <p>Khách hàng đang hoạt động</p>
        </article>
        <article>
          <span>Lịch hẹn tuần này</span>
          <strong>4</strong>
          <p>Phiên tiếp theo ngày 27/08</p>
        </article>
        <article>
          <span>Cần theo dõi</span>
          <strong>1</strong>
          <p>Check-in cần xem hôm nay</p>
        </article>
        <article>
          <span>Tin nhắn mới</span>
          <strong>2</strong>
          <p>Từ Nguyễn Minh Anh</p>
        </article>
      </section>

      <div className="scm-layout">
        <aside className="scm-directory">
          <header>
            <div>
              <span>Danh sách</span>
              <h2>Khách hàng của tôi</h2>
            </div>
            <b>{clients.length}</b>
          </header>
          <label className="scm-search">
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm tên hoặc chủ đề..."
            />
          </label>
          <div className="scm-client-list">
            {visibleClients.map((client) => (
              <button
                type="button"
                key={client.id}
                className={selected.id === client.id ? 'is-active' : ''}
                onClick={() => {
                  setSelectedId(client.id)
                  setActiveTab('overview')
                }}
              >
                <span className="scm-list-avatar">
                  {client.profile.initials}
                </span>
                <span className="scm-list-copy">
                  <strong>{client.title}</strong>
                  <small>{client.profile.focus.join(' · ')}</small>
                  <em>
                    <i />
                    {client.status}
                  </em>
                </span>
                {client.unread > 0 ? (
                  <b>{client.unread}</b>
                ) : (
                  <span className="scm-list-arrow">›</span>
                )}
              </button>
            ))}
            {!visibleClients.length && (
              <div className="scm-no-results">
                <span>○</span>
                <strong>Không tìm thấy</strong>
                <button type="button" onClick={() => setQuery('')}>
                  Xóa tìm kiếm
                </button>
              </div>
            )}
          </div>
          <footer>
            <span>ⓘ</span>
            <p>
              Chỉ khách hàng đã cấp quyền mới xuất hiện trong danh sách này.
            </p>
          </footer>
        </aside>

        <section className="scm-profile">
          <header className="scm-profile-head">
            <div className="scm-profile-person">
              <span className="scm-profile-avatar">
                {selected.profile.initials}
                <i />
              </span>
              <div>
                <span className="scm-profile-kicker">Hồ sơ khách hàng</span>
                <h2>{selected.title}</h2>
                <p>
                  {selected.profile.age} · {selected.profile.since}
                </p>
                <div>
                  {selected.profile.focus.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="scm-profile-actions">
              <button
                type="button"
                onClick={() =>
                  showNotice(`Đã mở cuộc trò chuyện với ${selected.title}.`)
                }
              >
                ◇ Nhắn tin
              </button>
              <button
                type="button"
                onClick={() =>
                  showNotice(
                    'Biểu mẫu tạo lịch hẹn đã sẵn sàng để kết nối API.',
                  )
                }
              >
                ＋ Đặt lịch
              </button>
            </div>
          </header>

          <section className="scm-consent-strip">
            <span>✓</span>
            <div>
              <strong>Quyền truy cập đang hoạt động</strong>
              <p>
                Cập nhật lần cuối 18/08/2026 · Khách hàng có thể thay đổi quyền
                chia sẻ.
              </p>
            </div>
            <button
              type="button"
              onClick={() => showNotice('Đã mở chi tiết phạm vi đồng ý.')}
            >
              Xem phạm vi <span>→</span>
            </button>
          </section>

          <nav className="scm-tabs" aria-label="Thông tin khách hàng">
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.key}
                className={activeTab === tab.key ? 'is-active' : ''}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="scm-detail-content">
            {activeTab === 'overview' && (
              <div className="scm-overview">
                <section className="scm-session-card">
                  <header>
                    <span>Phiên sắp tới</span>
                    <b>Đã xác nhận</b>
                  </header>
                  <strong>{selected.profile.nextSession}</strong>
                  <h3>{selected.profile.format}</h3>
                  <p>Thời lượng dự kiến 45 phút</p>
                  <button
                    type="button"
                    onClick={() =>
                      showNotice('Đã mở phần chuẩn bị phiên tư vấn.')
                    }
                  >
                    Chuẩn bị phiên <span>→</span>
                  </button>
                </section>
                <section className="scm-progress-card">
                  <header>
                    <div>
                      <span>Tiến trình gần đây</span>
                      <h3>Nhịp cảm xúc 7 ngày</h3>
                    </div>
                    <small>1 · Khó khăn　5 · Tốt</small>
                  </header>
                  <div
                    className="scm-mini-chart"
                    aria-label="Biểu đồ cảm xúc 7 ngày"
                  >
                    {selected.profile.mood.map((value, index) => (
                      <span key={index}>
                        <i style={{ height: `${value * 15}%` }} />
                        <small>
                          {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][index]}
                        </small>
                      </span>
                    ))}
                  </div>
                  <footer>
                    <strong>Xu hướng ổn định</strong>
                    <span>Điểm trung bình 3,9/5</span>
                  </footer>
                </section>
                <section className="scm-assessment-card">
                  <header>
                    <span>Đánh giá gần nhất</span>
                    <small>14/08/2026</small>
                  </header>
                  <div>
                    <strong>{selected.profile.assessment.name}</strong>
                    <b>{selected.profile.assessment.score}</b>
                  </div>
                  <h3>{selected.profile.assessment.level}</h3>
                  <p>{selected.profile.assessment.change} so với lần trước</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('assessments')}
                  >
                    Xem đánh giá <span>→</span>
                  </button>
                </section>
                <section className="scm-followup-card">
                  <header>
                    <span>Kế hoạch theo dõi</span>
                    <b>Đang tiến hành</b>
                  </header>
                  <h3>{selected.profile.followup.title}</h3>
                  <p>
                    {selected.profile.followup.completed}/
                    {selected.profile.followup.total} nhiệm vụ đã hoàn thành
                  </p>
                  <div>
                    <i
                      style={{
                        width: `${(selected.profile.followup.completed / selected.profile.followup.total) * 100}%`,
                      }}
                    />
                  </div>
                  <small>{selected.profile.followup.due}</small>
                  <button
                    type="button"
                    onClick={() => setActiveTab('followup')}
                  >
                    Xem kế hoạch <span>→</span>
                  </button>
                </section>
              </div>
            )}

            {activeTab === 'assessments' && (
              <section className="scm-tab-panel">
                <header>
                  <div>
                    <span>Dữ liệu được chia sẻ</span>
                    <h3>Lịch sử đánh giá tâm lý</h3>
                    <p>
                      Kết quả hỗ trợ theo dõi và không thay thế chẩn đoán chuyên
                      môn.
                    </p>
                  </div>
                  <b>2 kết quả</b>
                </header>
                <article>
                  <div>
                    <span>GAD-7</span>
                    <strong>Đánh giá mức độ lo âu</strong>
                    <small>14/08/2026 · Hoàn thành</small>
                  </div>
                  <b>8/21</b>
                  <em>Mức nhẹ</em>
                  <button type="button">Xem chi tiết →</button>
                </article>
                <article>
                  <div>
                    <span>PHQ-9</span>
                    <strong>Đánh giá sức khỏe tinh thần</strong>
                    <small>02/08/2026 · Hoàn thành</small>
                  </div>
                  <b>6/27</b>
                  <em>Mức nhẹ</em>
                  <button type="button">Xem chi tiết →</button>
                </article>
              </section>
            )}

            {activeTab === 'emotion' &&
              (hasEmotionConsent ? (
                <section className="scm-emotion-history">
                  <header className="scm-emotion-head">
                    <div>
                      <span>Lịch sử cảm xúc</span>
                      <h3>Nhịp cảm xúc của {selected.title}</h3>
                      <p>
                        Dữ liệu do khách hàng chủ động ghi nhận và đồng ý chia
                        sẻ.
                      </p>
                    </div>
                    <div
                      className="scm-emotion-ranges"
                      aria-label="Khoảng thời gian"
                    >
                      {(
                        [
                          ['7d', '7 ngày'],
                          ['30d', '30 ngày'],
                          ['90d', '3 tháng'],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          type="button"
                          key={value}
                          className={emotionRange === value ? 'is-active' : ''}
                          onClick={() => setEmotionRange(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </header>
                  <aside className="scm-emotion-consent">
                    <span>✓</span>
                    <p>
                      <strong>Được khách hàng cho phép chia sẻ</strong>Chỉ hiển
                      thị điểm cảm xúc và ngữ cảnh đã chia sẻ; nội dung nhật ký
                      vẫn riêng tư.
                    </p>
                    <small>Cập nhật 26/08/2026</small>
                  </aside>
                  <div className="scm-emotion-metrics">
                    <article className="is-primary">
                      <span>Điểm trung bình</span>
                      <strong>
                        3,9<small>/5</small>
                      </strong>
                      <p>Tăng 0,6 so với kỳ trước</p>
                    </article>
                    <article>
                      <span>Cảm xúc nổi bật</span>
                      <strong>🙂 Tốt</strong>
                      <p>Chiếm 42% ghi nhận</p>
                    </article>
                    <article>
                      <span>Số lần ghi nhận</span>
                      <strong>12</strong>
                      <p>6 ngày liên tiếp</p>
                    </article>
                    <article>
                      <span>Độ ổn định</span>
                      <strong>
                        78<small>%</small>
                      </strong>
                      <p>Ít biến động hơn</p>
                    </article>
                  </div>
                  <div className="scm-emotion-grid">
                    <section className="scm-emotion-chart-card">
                      <header>
                        <div>
                          <span>Xu hướng theo thời gian</span>
                          <h4>Điểm cảm xúc trung bình</h4>
                        </div>
                        <small>1 · Khó khăn　5 · Rất tốt</small>
                      </header>
                      <div
                        className="scm-emotion-chart"
                        aria-label={`Biểu đồ cảm xúc ${emotionRange}`}
                      >
                        {emotionSeries[emotionRange].map((item, index) => (
                          <span key={`${item.label}-${index}`}>
                            <b>{item.value}</b>
                            <i style={{ height: `${item.value * 17}%` }} />
                            <small>{item.label}</small>
                          </span>
                        ))}
                      </div>
                      <footer>
                        <span>
                          <i /> Điểm ghi nhận
                        </span>
                        <strong>
                          Xu hướng tích cực hơn <b>↗</b>
                        </strong>
                      </footer>
                    </section>
                    <aside className="scm-emotion-insight">
                      <span>Điểm đáng chú ý</span>
                      <h4>Nhịp cảm xúc đang ổn định hơn</h4>
                      <ul>
                        <li>
                          <i>↗</i>
                          <p>
                            <strong>Cải thiện trong 14 ngày</strong>Điểm trung
                            bình tăng từ 3,3 lên 3,9.
                          </p>
                        </li>
                        <li>
                          <i>◷</i>
                          <p>
                            <strong>Thường ghi nhận buổi tối</strong>9/12
                            check-in được tạo sau 19:00.
                          </p>
                        </li>
                        <li>
                          <i>✓</i>
                          <p>
                            <strong>Liên quan hoạt động chăm sóc</strong>3 lần
                            ghi nhận sau bài tập thở.
                          </p>
                        </li>
                      </ul>
                      <small>
                        Thông tin hỗ trợ theo dõi, không phải kết luận lâm sàng.
                      </small>
                    </aside>
                  </div>
                  <section className="scm-emotion-log">
                    <header>
                      <div>
                        <span>Ghi nhận gần đây</span>
                        <h4>Lịch sử check-in</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          showNotice(
                            'Bộ lọc lịch sử cảm xúc đã sẵn sàng để kết nối API.',
                          )
                        }
                      >
                        ≡ Lọc lịch sử
                      </button>
                    </header>
                    <div>
                      {emotionEntries.map((entry) => (
                        <button
                          type="button"
                          key={`${entry.date}-${entry.time}`}
                          onClick={() =>
                            showNotice(`Đã chọn ghi nhận ngày ${entry.date}.`)
                          }
                        >
                          <time>
                            <strong>{entry.date.slice(0, 5)}</strong>
                            <small>{entry.time}</small>
                          </time>
                          <span className="scm-emotion-emoji">
                            {entry.emoji}
                          </span>
                          <span className="scm-emotion-copy">
                            <strong>{entry.mood}</strong>
                            <small>{entry.context}</small>
                          </span>
                          <span className="scm-emotion-score">
                            <b>{entry.score}</b>/5
                          </span>
                          <span className="scm-emotion-note">{entry.note}</span>
                          <i>›</i>
                        </button>
                      ))}
                    </div>
                  </section>
                </section>
              ) : (
                <section className="scm-emotion-locked">
                  <span>⌁</span>
                  <h3>Lịch sử cảm xúc chưa được chia sẻ</h3>
                  <p>
                    {selected.title} chưa cấp quyền cho chuyên gia xem dữ liệu
                    cảm xúc. Các điểm số, ghi nhận và biểu đồ được giữ riêng tư.
                  </p>
                  <div>
                    <strong>Quyền hiện tại</strong>
                    {selected.profile.consent.map((item) => (
                      <span key={item}>✓ {item}</span>
                    ))}
                  </div>
                  <small>
                    Không yêu cầu quyền ngoài mục đích tư vấn đã thống nhất.
                  </small>
                </section>
              ))}

            {activeTab === 'followup' && (
              <section className="scm-tab-panel scm-followup-panel">
                <header>
                  <div>
                    <span>Kế hoạch đang hoạt động</span>
                    <h3>{selected.profile.followup.title}</h3>
                    <p>{selected.profile.followup.due}</p>
                  </div>
                  <b>
                    {selected.profile.followup.completed}/
                    {selected.profile.followup.total}
                  </b>
                </header>
                {[
                  'Ghi nhận giờ ngủ mỗi ngày',
                  'Thực hành thở 4–7–8',
                  'Check-in cảm xúc cuối ngày',
                  'Hạn chế caffeine sau 15:00',
                  'Hoàn thành GAD-7 cuối tuần',
                ].map((task, index) => (
                  <article
                    key={task}
                    className={
                      index < selected.profile.followup.completed
                        ? 'is-done'
                        : ''
                    }
                  >
                    <span>
                      {index < selected.profile.followup.completed
                        ? '✓'
                        : index + 1}
                    </span>
                    <div>
                      <strong>{task}</strong>
                      <small>
                        {index < selected.profile.followup.completed
                          ? 'Đã hoàn thành'
                          : 'Đang chờ khách hàng'}
                      </small>
                    </div>
                  </article>
                ))}
              </section>
            )}
          </div>

          <footer className="scm-privacy">
            <div>
              <span>⌁</span>
              <p>
                <strong>Thông tin riêng tư được bảo vệ</strong>Nội dung nhật ký
                và ghi chú cá nhân không được hiển thị.
              </p>
            </div>
            <button
              type="button"
              onClick={() => showNotice('Đã mở thông tin quyền riêng tư.')}
            >
              Quyền riêng tư
            </button>
          </footer>
        </section>
      </div>
      {notice && (
        <div className="scm-notice" role="status">
          <span>✓</span>
          {notice}
        </div>
      )}
    </section>
  )
}
