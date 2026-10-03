'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import LightSelect from './LightSelect'
import './specialist-clients-manager.css'

export type SpecialistClientRow = {
  id: string
  title: string
  meta: string
  status: string
  detail: string
}

type Props = {
  rows: SpecialistClientRow[]
  initialAppointmentId?: string
}

type DetailTab = 'prepare' | 'summary' | 'history'
type AppointmentState = 'ready' | 'early' | 'completed'

type Appointment = {
  id: string
  date: string
  day: string
  month: string
  time: string
  status: 'Đã xác nhận' | 'Đã hoàn thành'
  state: AppointmentState
}

type ClientProfile = {
  initials: string
  topics: string[]
  appointments: Appointment[]
}

const profileSeed: Record<
  string,
  Omit<ClientProfile, 'appointments'> & {
    appointments: Omit<Appointment, 'id'>[]
  }
> = {
  c1: {
    initials: 'MA',
    topics: ['Lo âu', 'Giấc ngủ'],
    appointments: [
      {
        date: '03/10/2026',
        day: '03',
        month: '10',
        time: '17:00–18:00',
        status: 'Đã xác nhận',
        state: 'ready',
      },
      {
        date: '26/09/2026',
        day: '26',
        month: '09',
        time: '17:00–18:00',
        status: 'Đã hoàn thành',
        state: 'completed',
      },
    ],
  },
  c2: {
    initials: 'GH',
    topics: ['Căng thẳng', 'Cân bằng công việc'],
    appointments: [
      {
        date: '10/10/2026',
        day: '10',
        month: '10',
        time: '10:00–11:00',
        status: 'Đã xác nhận',
        state: 'early',
      },
    ],
  },
}

function WorkspaceIcon({
  name,
}: {
  name:
    | 'calendar'
    | 'chat'
    | 'shield'
    | 'clock'
    | 'file'
    | 'history'
    | 'search'
    | 'chevron'
    | 'lock'
    | 'check'
}) {
  const paths = {
    calendar: (
      <>
        <path d="M7 2v3M17 2v3M3 9h18" />
        <rect x="3" y="4" width="18" height="17" rx="3" />
      </>
    ),
    chat: (
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    file: (
      <>
        <path d="M6 2h8l4 4v16H6z" />
        <path d="M14 2v5h5M9 13h6M9 17h4" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5M12 7v5l3 2" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    chevron: <path d="m9 6 6 6-6 6" />,
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

const appointmentLabel = (appointment: Appointment) =>
  `${appointment.date.slice(0, 5)} · ${appointment.time.split('–')[0]}`

export default function SpecialistClientsManager({
  rows,
  initialAppointmentId,
}: Props) {
  const clients = useMemo(
    () =>
      rows.map((row, clientIndex) => {
        const seed = profileSeed[row.id] ?? {
          initials: row.title
            .split(' ')
            .slice(-2)
            .map((part) => part.charAt(0))
            .join(''),
          topics: ['Theo dõi'],
          appointments: [
            {
              date: 'Chưa có lịch',
              day: '—',
              month: '—',
              time: 'Chưa xác định',
              status: 'Đã xác nhận' as const,
              state: 'early' as const,
            },
          ],
        }
        return {
          ...row,
          profile: {
            ...seed,
            appointments: seed.appointments.map(
              (appointment, appointmentIndex) => ({
                ...appointment,
                id:
                  clientIndex === 0 &&
                  appointmentIndex === 0 &&
                  initialAppointmentId
                    ? initialAppointmentId
                    : `demo-${row.id}-${appointmentIndex}`,
              }),
            ),
          },
        }
      }),
    [initialAppointmentId, rows],
  )

  const firstClientId = clients[0]?.id ?? ''
  const firstAppointmentId = clients[0]?.profile.appointments[0]?.id ?? ''
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(firstClientId)
  const [appointmentId, setAppointmentId] = useState(firstAppointmentId)
  const [activeTab, setActiveTab] = useState<DetailTab>('prepare')
  const [notice, setNotice] = useState('')

  const selected =
    clients.find((client) => client.id === selectedId) ?? clients[0]
  const appointment =
    selected?.profile.appointments.find((item) => item.id === appointmentId) ??
    selected?.profile.appointments[0]
  const visibleClients = clients.filter((client) =>
    `${client.title} ${client.profile.topics.join(' ')}`
      .toLocaleLowerCase('vi')
      .includes(query.trim().toLocaleLowerCase('vi')),
  )
  const completedCount = clients.reduce(
    (count, client) =>
      count +
      client.profile.appointments.filter((item) => item.state === 'completed')
        .length,
    0,
  )
  const upcomingCount = clients.reduce(
    (count, client) =>
      count +
      client.profile.appointments.filter((item) => item.state !== 'completed')
        .length,
    0,
  )

  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2600)
  }

  const selectClient = (clientId: string) => {
    const client = clients.find((item) => item.id === clientId)
    if (!client) return
    const nextAppointment = client.profile.appointments[0]
    setSelectedId(client.id)
    setAppointmentId(nextAppointment.id)
    setActiveTab(nextAppointment.state === 'completed' ? 'summary' : 'prepare')
    setNotice('')
  }

  const selectAppointment = (nextAppointmentId: string) => {
    const nextAppointment = selected.profile.appointments.find(
      (item) => item.id === nextAppointmentId,
    )
    if (!nextAppointment) return
    setAppointmentId(nextAppointment.id)
    setActiveTab(nextAppointment.state === 'completed' ? 'summary' : 'prepare')
    setNotice('')
  }

  if (!selected || !appointment) {
    return (
      <section className="scm-empty-page">
        <h1>Chưa có khách hàng</h1>
        <p>Khách hàng có lịch hẹn với bạn sẽ xuất hiện tại đây.</p>
      </section>
    )
  }

  const isRealAppointment = !appointment.id.startsWith('demo-')
  const messageHref = isRealAppointment
    ? `/specialist/messages?appointmentId=${encodeURIComponent(appointment.id)}`
    : '/specialist/messages'

  return (
    <section className="scm-manager">
      <header className="scm-heading">
        <div>
          <span className="scm-eyebrow">Không gian chuyên gia</span>
          <h1>Khách hàng &amp; phiên tư vấn</h1>
          <p>
            Chọn khách hàng và lịch hẹn để chuẩn bị cho cuộc trao đổi, mở đúng
            phòng chat hoặc xem lại tổng kết sau phiên.
          </p>
        </div>
        <Link className="scm-heading-action" href="/specialist/appointments">
          <WorkspaceIcon name="calendar" /> Quản lý lịch hẹn
        </Link>
      </header>

      <section className="scm-stats" aria-label="Tổng quan lịch hẹn">
        <button
          type="button"
          className="is-primary"
          onClick={() => selectClient(clients[0].id)}
        >
          <strong>1</strong>
          <span>Lịch hẹn hôm nay</span>
          <small>Phiên tiếp theo lúc 17:00</small>
        </button>
        <button
          type="button"
          onClick={() => showNotice('Đang hiển thị các lịch hẹn đã xác nhận.')}
        >
          <strong>{upcomingCount}</strong>
          <span>Phiên sắp tới</span>
          <small>Sẵn sàng để chuẩn bị</small>
        </button>
        <Link href="/specialist/follow-up">
          <strong>{completedCount}</strong>
          <span>Phiên đã hoàn thành</span>
          <small>Xem nội dung sau tư vấn</small>
        </Link>
      </section>

      <label className="scm-mobile-picker">
        <span>Chọn khách hàng</span>
        <select
          value={selected.id}
          onChange={(event) => selectClient(event.target.value)}
        >
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.title} ·{' '}
              {appointmentLabel(client.profile.appointments[0])}
            </option>
          ))}
        </select>
      </label>

      <div className="scm-layout">
        <aside className="scm-directory">
          <header>
            <span>Theo lịch hẹn</span>
            <h2>Khách hàng của tôi</h2>
          </header>
          <label className="scm-search">
            <WorkspaceIcon name="search" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm tên khách hàng…"
              aria-label="Tìm khách hàng"
            />
          </label>
          <div className="scm-client-list">
            {visibleClients.map((client) => {
              const nextAppointment = client.profile.appointments[0]
              return (
                <button
                  type="button"
                  key={client.id}
                  className={selected.id === client.id ? 'is-active' : ''}
                  aria-pressed={selected.id === client.id}
                  onClick={() => selectClient(client.id)}
                >
                  <span className="scm-list-avatar">
                    {client.profile.initials}
                  </span>
                  <span className="scm-list-copy">
                    <strong>{client.title}</strong>
                    <small>{appointmentLabel(nextAppointment)}</small>
                    <em>
                      <i />
                      {nextAppointment.status}
                    </em>
                  </span>
                  <span className="scm-list-arrow">
                    <WorkspaceIcon name="chevron" />
                  </span>
                </button>
              )
            })}
            {!visibleClients.length && (
              <div className="scm-no-results">
                <strong>Không tìm thấy khách hàng</strong>
                <button type="button" onClick={() => setQuery('')}>
                  Xóa tìm kiếm
                </button>
              </div>
            )}
          </div>
          <footer>
            <WorkspaceIcon name="shield" />
            <p>
              Thông tin được mở theo lịch hẹn và quyền chia sẻ của từng phiên.
            </p>
          </footer>
        </aside>

        <section className="scm-workspace">
          <header className="scm-profile-head">
            <span className="scm-profile-avatar">
              {selected.profile.initials}
            </span>
            <div className="scm-profile-copy">
              <span>Không gian phiên tư vấn</span>
              <h2>{selected.title}</h2>
              <p>
                {selected.profile.appointments.length} lịch hẹn với bạn · Chat
                trong ứng dụng
              </p>
            </div>
          </header>

          <section className="scm-appointment-card">
            <div className="scm-date">
              <strong>{appointment.day}</strong>
              <small>THÁNG {appointment.month}</small>
            </div>
            <div className="scm-appointment-copy">
              <span>Lịch hẹn đang chọn</span>
              <strong>{appointment.time}</strong>
              <p>{appointment.date} · 60 phút</p>
            </div>
            <span
              className={`scm-status ${appointment.state === 'completed' ? 'is-completed' : ''}`}
            >
              <i />
              {appointment.status}
            </span>
            {appointment.state !== 'completed' && (
              <Link className="scm-chat-action" href={messageHref}>
                <WorkspaceIcon name="chat" /> Mở phiên chat
              </Link>
            )}
            {selected.profile.appointments.length > 1 && (
              <div className="scm-appointment-picker">
                <label
                  id="scm-appointment-picker-label"
                  htmlFor="scm-appointment-picker"
                >
                  Đổi lịch hẹn
                </label>
                <LightSelect
                  id="scm-appointment-picker"
                  className="scm-appointment-select"
                  value={appointment.id}
                  onChange={selectAppointment}
                  options={selected.profile.appointments.map((item) => ({
                    value: item.id,
                    label: `${appointmentLabel(item)} — ${item.status}`,
                  }))}
                />
              </div>
            )}
          </section>

          <nav className="scm-tabs" aria-label="Nội dung của lịch hẹn">
            {(
              [
                ['prepare', 'Chuẩn bị phiên', 'shield'],
                ['summary', 'Tổng kết phiên', 'file'],
                ['history', 'Lịch sử lịch hẹn', 'history'],
              ] as const
            ).map(([key, label, icon]) => (
              <button
                type="button"
                key={key}
                className={activeTab === key ? 'is-active' : ''}
                aria-pressed={activeTab === key}
                onClick={() => setActiveTab(key)}
              >
                <WorkspaceIcon name={icon} />
                {label}
              </button>
            ))}
          </nav>

          <div className="scm-content">
            {notice && (
              <div className="scm-inline-notice" role="status">
                <WorkspaceIcon name="check" />
                {notice}
              </div>
            )}

            {activeTab === 'prepare' && appointment.state === 'ready' && (
              <section className="scm-prepare">
                <header>
                  <div>
                    <span>Chuẩn bị phiên</span>
                    <h3>Tóm tắt trước buổi tư vấn</h3>
                  </div>
                  <b>
                    <WorkspaceIcon name="shield" /> Được phép xem
                  </b>
                </header>
                <div className="scm-access-line">
                  <WorkspaceIcon name="check" />
                  <span>
                    Nội dung được người dùng phê duyệt cho lịch hẹn này.
                  </span>
                </div>
                <article className="scm-reading">
                  <span>Tình hình hiện tại</span>
                  <blockquote>
                    “Gần đây mình khó thư giãn sau giờ làm, thường suy nghĩ về
                    những việc chưa hoàn thành. Mình muốn trao đổi để hiểu rõ
                    điều đang khiến mình lo lắng.”
                  </blockquote>
                </article>
                <article className="scm-goals">
                  <span>Mục tiêu trao đổi</span>
                  <ol>
                    <li>
                      <b>01</b>
                      <p>Nhận diện những tình huống làm mình căng thẳng.</p>
                    </li>
                    <li>
                      <b>02</b>
                      <p>Tìm một cách nghỉ ngơi phù hợp với nhịp sinh hoạt.</p>
                    </li>
                  </ol>
                </article>
                <article className="scm-screening">
                  <header>
                    <span>Bối cảnh sàng lọc đã chia sẻ</span>
                    <small>Hỗ trợ chuẩn bị cuộc trao đổi</small>
                  </header>
                  <div>
                    <p>
                      <strong>PHQ-9</strong>
                      <small>Sàng lọc triệu chứng trầm cảm</small>
                    </p>
                    <b>Mức nhẹ</b>
                  </div>
                  <div>
                    <p>
                      <strong>GAD-7</strong>
                      <small>Sàng lọc triệu chứng lo âu</small>
                    </p>
                    <b>Mức nhẹ</b>
                  </div>
                </article>
                <details className="scm-privacy">
                  <summary>Phạm vi thông tin trong phiên này</summary>
                  <p>
                    Chỉ hiển thị tóm tắt người dùng đã phê duyệt cho lịch hẹn
                    đang chọn. Nhật ký, câu trả lời sàng lọc chi tiết và hội
                    thoại AI không nằm trong phần này.
                  </p>
                </details>
              </section>
            )}

            {activeTab === 'prepare' && appointment.state === 'early' && (
              <section className="scm-state-panel">
                <span className="scm-state-icon">
                  <WorkspaceIcon name="clock" />
                </span>
                <div>
                  <span>Chuẩn bị phiên</span>
                  <h3>Hẹn bạn gần ngày tư vấn</h3>
                  <p>
                    Tóm tắt trước buổi tư vấn chỉ mở trong thời gian cho phép,
                    nếu người dùng đã phê duyệt và quyền chia sẻ vẫn còn hiệu
                    lực.
                  </p>
                </div>
                <section>
                  <span>Thời gian dự kiến có thể xem</span>
                  <strong>09/10 lúc 10:00</strong>
                  <div>
                    <i />
                  </div>
                  <small>
                    <span>Trước phiên 24 giờ</span>
                    <span>Sau giờ bắt đầu 24 giờ</span>
                  </small>
                </section>
              </section>
            )}

            {activeTab === 'prepare' && appointment.state === 'completed' && (
              <section className="scm-state-panel is-centered">
                <span className="scm-state-icon">
                  <WorkspaceIcon name="history" />
                </span>
                <div>
                  <h3>Phiên tư vấn đã hoàn thành</h3>
                  <p>
                    Phần chuẩn bị đã đóng. Nội dung tiếp nối nằm trong tổng kết
                    của chính lịch hẹn này.
                  </p>
                  <button type="button" onClick={() => setActiveTab('summary')}>
                    Xem tổng kết phiên
                  </button>
                </div>
              </section>
            )}

            {activeTab === 'summary' && appointment.state !== 'completed' && (
              <section className="scm-state-panel is-centered">
                <span className="scm-state-icon">
                  <WorkspaceIcon name="file" />
                </span>
                <div>
                  <h3>Tổng kết được tạo sau phiên</h3>
                  <p>
                    Bạn có thể ghi lại nội dung đã trao đổi và các bước thống
                    nhất khi lịch hẹn được xác nhận hoàn thành.
                  </p>
                  <button type="button" onClick={() => setActiveTab('prepare')}>
                    Quay lại chuẩn bị
                  </button>
                </div>
              </section>
            )}

            {activeTab === 'summary' && appointment.state === 'completed' && (
              <section className="scm-summary">
                <header>
                  <div>
                    <span>Tổng kết phiên tư vấn</span>
                    <h3>Nội dung đã xuất bản</h3>
                  </div>
                  <b>
                    <WorkspaceIcon name="check" /> Đã xuất bản
                  </b>
                </header>
                <div className="scm-version">
                  <span>Xuất bản 26/09/2026 · 18:15</span>
                  <button
                    type="button"
                    onClick={() =>
                      showNotice('Đây là bản tổng kết mới nhất của phiên.')
                    }
                  >
                    Bản mới nhất
                  </button>
                </div>
                <article>
                  <span>Nội dung đã trao đổi</span>
                  <div className="scm-topic-list">
                    <b>Áp lực công việc</b>
                    <b>Nhịp nghỉ ngơi</b>
                  </div>
                  <h4>Điều đã ghi nhận trong phiên</h4>
                  <p>
                    Người dùng đã chia sẻ các tình huống gây căng thẳng trong
                    tuần và mong muốn dành thời gian nghỉ ngơi sau giờ làm.
                  </p>
                </article>
                <aside>
                  <h4>Lời nhắn đã gửi người dùng</h4>
                  <p>
                    Bạn có thể bắt đầu bằng một thay đổi nhỏ, phù hợp với nhịp
                    sinh hoạt của mình.
                  </p>
                </aside>
                <section className="scm-next-steps">
                  <h4>Các bước đã thống nhất</h4>
                  <div>
                    <b>1</b>
                    <p>
                      <strong>Dành một khoảng nghỉ sau giờ làm</strong>
                      <span>
                        Chọn một hoạt động nhẹ nhàng mà bạn cảm thấy thoải mái.
                      </span>
                    </p>
                  </div>
                  <div>
                    <b>2</b>
                    <p>
                      <strong>Ghi lại điều muốn trao đổi lần sau</strong>
                      <span>Người dùng tự lựa chọn nội dung muốn chia sẻ.</span>
                    </p>
                  </div>
                </section>
              </section>
            )}

            {activeTab === 'history' && (
              <section className="scm-history">
                <header>
                  <div>
                    <span>Theo từng phiên</span>
                    <h3>Lịch sử lịch hẹn với bạn</h3>
                  </div>
                  <b>{selected.profile.appointments.length} lịch hẹn</b>
                </header>
                {selected.profile.appointments.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => selectAppointment(item.id)}
                  >
                    <span className="scm-history-date">{item.day}</span>
                    <span>
                      <strong>
                        {item.date} · {item.time}
                      </strong>
                      <small>Chat trong ứng dụng · {item.status}</small>
                    </span>
                    <em>
                      {item.state === 'completed' ? 'Xem tổng kết' : 'Chuẩn bị'}
                      <WorkspaceIcon name="chevron" />
                    </em>
                  </button>
                ))}
                <p className="scm-history-boundary">
                  <WorkspaceIcon name="lock" />
                  Lịch sử chỉ gồm các lịch hẹn được giao cho bạn; quyền xem được
                  kiểm tra riêng theo từng phiên.
                </p>
              </section>
            )}
          </div>

          <footer className="scm-workspace-footer">
            <span>
              {appointment.state === 'completed'
                ? 'Phiên đã hoàn thành · Hội thoại chỉ đọc'
                : `Phiên bắt đầu lúc ${appointment.time.split('–')[0]} · ${appointment.date}`}
            </span>
            {activeTab !== 'prepare' && (
              <Link href={messageHref}>
                <WorkspaceIcon name="chat" />
                {appointment.state === 'completed'
                  ? 'Xem lại hội thoại'
                  : 'Mở phiên chat'}
              </Link>
            )}
          </footer>
        </section>
      </div>
    </section>
  )
}
