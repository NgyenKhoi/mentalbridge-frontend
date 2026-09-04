'use client'

import { useMemo, useState } from 'react'
import ConsultationNotesModal, {
  type ConsultationNote,
} from './ConsultationNotesModal'
import './specialist-appointments-manager.css'

export type SpecialistAppointmentRow = {
  id: string
  title: string
  meta: string
  status: string
  detail: string
}

type Props = {
  rows: SpecialistAppointmentRow[]
  onCreate: () => void
  onSelect: (row: SpecialistAppointmentRow) => void
}

type AppointmentView = SpecialistAppointmentRow & {
  day: string
  date: string
  time: string
  endTime: string
  duration: string
  format: string
  note: string
  tone: 'confirmed' | 'pending' | 'completed'
}

const details: Record<
  string,
  Omit<AppointmentView, keyof SpecialistAppointmentRow>
> = {
  a1: {
    day: 'Hôm nay',
    date: '26/08',
    time: '10:30',
    endTime: '11:15',
    duration: '45 phút',
    format: 'Video call',
    note: 'Đã chuẩn bị ghi chú phiên',
    tone: 'confirmed',
  },
  a2: {
    day: 'Ngày mai',
    date: '27/08',
    time: '14:00',
    endTime: '14:45',
    duration: '45 phút',
    format: 'Tại phòng tư vấn',
    note: 'Yêu cầu mới · cần phản hồi',
    tone: 'pending',
  },
  a3: {
    day: '12 tháng 8',
    date: '12/08',
    time: '09:00',
    endTime: '09:45',
    duration: '45 phút',
    format: 'Video call',
    note: 'Đã hoàn thành ghi chú sau phiên',
    tone: 'completed',
  },
}

const tabs = [
  { key: 'upcoming', label: 'Sắp tới' },
  { key: 'pending', label: 'Chờ xác nhận' },
  { key: 'history', label: 'Lịch sử' },
] as const

export default function SpecialistAppointmentsManager({
  rows,
  onCreate,
  onSelect,
}: Props) {
  const [activeTab, setActiveTab] =
    useState<(typeof tabs)[number]['key']>('upcoming')
  const [query, setQuery] = useState('')
  const [acceptedIds, setAcceptedIds] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [notesModalAppointment, setNotesModalAppointment] =
    useState<AppointmentView | null>(null)
  const [appointmentNotes, setAppointmentNotes] = useState<
    Record<string, ConsultationNote>
  >({})

  const appointments = useMemo<AppointmentView[]>(
    () =>
      rows.map((row, index) => ({
        ...row,
        ...(details[row.id] || {
          day: index === 0 ? 'Hôm nay' : 'Sắp tới',
          date: `${26 + index}/08`,
          time: '09:00',
          endTime: '09:45',
          duration: '45 phút',
          format: 'Video call',
          note: 'Chưa có ghi chú chuẩn bị',
          tone: 'confirmed' as const,
        }),
        status: acceptedIds.includes(row.id) ? 'Đã xác nhận' : row.status,
        tone: acceptedIds.includes(row.id)
          ? 'confirmed'
          : details[row.id]?.tone || 'confirmed',
      })),
    [acceptedIds, rows],
  )

  const visibleAppointments = appointments.filter((appointment) => {
    const matchesTab =
      activeTab === 'upcoming'
        ? appointment.tone !== 'completed'
        : activeTab === 'pending'
          ? appointment.tone === 'pending'
          : appointment.tone === 'completed'
    const normalizedQuery = query.trim().toLocaleLowerCase('vi')
    return (
      matchesTab &&
      (!normalizedQuery ||
        `${appointment.title} ${appointment.format} ${appointment.status}`
          .toLocaleLowerCase('vi')
          .includes(normalizedQuery))
    )
  })

  const tabCount = (key: (typeof tabs)[number]['key']) =>
    appointments.filter((item) =>
      key === 'upcoming'
        ? item.tone !== 'completed'
        : key === 'pending'
          ? item.tone === 'pending'
          : item.tone === 'completed',
    ).length

  const acceptAppointment = (appointment: AppointmentView) => {
    setAcceptedIds((current) => [...current, appointment.id])
    setNotice(`Đã xác nhận lịch hẹn với ${appointment.title}.`)
    window.setTimeout(() => setNotice(''), 2600)
  }

  const openNotesModal = (appointment: AppointmentView) => {
    setNotesModalAppointment(appointment)
  }

  const handleSaveNotes = (
    noteData: Omit<ConsultationNote, 'id' | 'createdAt' | 'updatedAt'>,
  ) => {
    if (!notesModalAppointment) return

    const timestamp = new Date().toISOString()
    const existingNote = appointmentNotes[notesModalAppointment.id]
    const savedNote: ConsultationNote = {
      id: existingNote?.id || `note_${notesModalAppointment.id}_${Date.now()}`,
      ...noteData,
      createdAt: existingNote?.createdAt || timestamp,
      updatedAt: timestamp,
    }

    setAppointmentNotes((prev) => ({
      ...prev,
      [notesModalAppointment.id]: savedNote,
    }))

    setNotesModalAppointment(null)
    setNotice(`Đã lưu ghi chú tư vấn cho ${notesModalAppointment.title}.`)
    window.setTimeout(() => setNotice(''), 2600)
  }

  return (
    <section className="sam-manager">
      <header className="sam-heading">
        <div>
          <span className="sam-eyebrow">Không gian chuyên gia</span>
          <h1>Quản lý lịch hẹn</h1>
          <p>
            Theo dõi lịch làm việc, xử lý yêu cầu mới và chuẩn bị cho từng phiên
            tư vấn.
          </p>
        </div>
        <button type="button" className="sam-create" onClick={onCreate}>
          <span>＋</span>Tạo lịch hẹn
        </button>
      </header>

      <section className="sam-stats" aria-label="Tổng quan lịch hẹn">
        <article className="is-primary">
          <span>Phiên hôm nay</span>
          <strong>3</strong>
          <p>Phiên tiếp theo lúc 10:30</p>
        </article>
        <article>
          <span>Đang chờ xác nhận</span>
          <strong>
            {appointments.filter((item) => item.tone === 'pending').length}
          </strong>
          <p>Cần phản hồi trong hôm nay</p>
        </article>
        <article>
          <span>Lịch tuần này</span>
          <strong>8</strong>
          <p>6 video · 2 tại phòng</p>
        </article>
        <article>
          <span>Tỷ lệ hoàn thành</span>
          <strong>
            92<small>%</small>
          </strong>
          <p>Trong 30 ngày gần nhất</p>
        </article>
      </section>

      <div className="sam-layout">
        <section className="sam-board">
          <header className="sam-board-head">
            <div>
              <span>Lịch tư vấn</span>
              <h2>Các phiên cần theo dõi</h2>
            </div>
            <div className="sam-week-nav">
              <button type="button" aria-label="Tuần trước">
                ‹
              </button>
              <strong>24–30 tháng 8, 2026</strong>
              <button type="button" aria-label="Tuần sau">
                ›
              </button>
            </div>
          </header>

          <nav className="sam-tabs" aria-label="Lọc lịch hẹn">
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.key}
                className={activeTab === tab.key ? 'is-active' : ''}
                aria-current={activeTab === tab.key ? 'page' : undefined}
                onClick={() => setActiveTab(tab.key)}
              >
                <span>{tab.label}</span>
                <b>{tabCount(tab.key)}</b>
              </button>
            ))}
          </nav>

          <div className="sam-tools">
            <label>
              <span aria-hidden="true">⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm khách hàng hoặc hình thức tư vấn..."
              />
            </label>
            <button
              type="button"
              onClick={() =>
                setNotice('Bộ lọc nâng cao đã sẵn sàng để kết nối API.')
              }
            >
              <span>≡</span>Bộ lọc
            </button>
          </div>

          <div className="sam-list" aria-live="polite">
            {visibleAppointments.length ? (
              visibleAppointments.map((appointment) => (
                <article
                  className={`sam-card is-${appointment.tone}`}
                  key={appointment.id}
                >
                  <div className="sam-date">
                    <span>{appointment.day}</span>
                    <strong>{appointment.date}</strong>
                    <small>2026</small>
                  </div>
                  <div className="sam-client">
                    <span className="sam-avatar">
                      {appointment.title
                        .split(' ')
                        .slice(-2)
                        .map((part) => part.charAt(0))
                        .join('')}
                    </span>
                    <div>
                      <h3>{appointment.title}</h3>
                      <p>
                        <span>
                          {appointment.format === 'Video call' ? '▣' : '⌂'}
                        </span>
                        {appointment.format} · {appointment.duration}
                      </p>
                      <small>{appointment.note}</small>
                    </div>
                  </div>
                  <div className="sam-time">
                    <span>Thời gian</span>
                    <strong>{appointment.time}</strong>
                    <small>đến {appointment.endTime}</small>
                  </div>
                  <div className="sam-card-actions">
                    <span className={`sam-status is-${appointment.tone}`}>
                      <i />
                      {appointment.status}
                    </span>
                    <div>
                      {appointment.tone === 'pending' && (
                        <button
                          type="button"
                          className="sam-accept"
                          onClick={() => acceptAppointment(appointment)}
                        >
                          Xác nhận
                        </button>
                      )}
                      {appointment.tone === 'completed' && (
                        <button
                          type="button"
                          className="sam-notes"
                          onClick={() => openNotesModal(appointment)}
                        >
                          {appointmentNotes[appointment.id]
                            ? 'Xem ghi chú'
                            : 'Thêm ghi chú'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="sam-detail"
                        onClick={() => onSelect(appointment)}
                      >
                        Chi tiết <span>→</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="sam-empty">
                <span>○</span>
                <h3>Không có lịch hẹn phù hợp</h3>
                <p>Thử chọn trạng thái khác hoặc xóa từ khóa đang tìm.</p>
                <button type="button" onClick={() => setQuery('')}>
                  Xóa tìm kiếm
                </button>
              </div>
            )}
          </div>
        </section>

        <aside className="sam-agenda">
          <header>
            <span>Hôm nay · 26/08</span>
            <h2>Nhịp làm việc</h2>
            <p>3 phiên tư vấn · 135 phút</p>
          </header>
          <div className="sam-next">
            <span>Phiên tiếp theo</span>
            <strong>10:30</strong>
            <h3>Nguyễn Minh Anh</h3>
            <p>Video call · còn 28 phút</p>
            <button type="button" onClick={() => onSelect(appointments[0])}>
              Chuẩn bị phiên <span>→</span>
            </button>
          </div>
          <ol className="sam-timeline">
            <li className="is-done">
              <time>08:30</time>
              <i />
              <div>
                <strong>Phạm Thảo Vy</strong>
                <span>Đã hoàn thành</span>
              </div>
            </li>
            <li className="is-current">
              <time>10:30</time>
              <i />
              <div>
                <strong>Nguyễn Minh Anh</strong>
                <span>Sắp diễn ra · Video call</span>
              </div>
            </li>
            <li>
              <time>15:00</time>
              <i />
              <div>
                <strong>Lê Hoàng Nam</strong>
                <span>Tại phòng tư vấn</span>
              </div>
            </li>
          </ol>
          <footer>
            <span>Khoảng nghỉ tiếp theo</span>
            <strong>11:15–15:00</strong>
            <small>3 giờ 45 phút</small>
          </footer>
        </aside>
      </div>
      {notice && (
        <div className="sam-notice" role="status">
          <span>✓</span>
          {notice}
        </div>
      )}
      {notesModalAppointment && (
        <ConsultationNotesModal
          appointmentId={notesModalAppointment.id}
          clientName={notesModalAppointment.title}
          date={`${notesModalAppointment.day}, ${notesModalAppointment.date}/2026`}
          time={`${notesModalAppointment.time} - ${notesModalAppointment.endTime}`}
          existingNotes={appointmentNotes[notesModalAppointment.id]}
          onClose={() => setNotesModalAppointment(null)}
          onSave={handleSaveNotes}
        />
      )}
    </section>
  )
}
