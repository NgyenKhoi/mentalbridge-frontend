'use client'

import { useMemo, useState } from 'react'
import './specialist-availability-manager.css'

type AvailabilityTab = 'calendar' | 'rules' | 'timeoff'
type Slot = { time: string; status: 'open' | 'booked'; client?: string }
type SelectedSlot = Slot & { dayIndex: number; key: string }

const DAY_NAMES = [
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
  'Chủ nhật',
]
const BASE_DATE = new Date(2026, 7, 24)
const CURRENT_SLOTS: Record<number, Slot[]> = {
  0: [
    { time: '09:00', status: 'open' },
    { time: '10:00', status: 'open' },
    { time: '11:00', status: 'booked', client: 'Nguyễn Minh Anh' },
  ],
  1: [
    { time: '13:30', status: 'open' },
    { time: '14:30', status: 'open' },
    { time: '15:30', status: 'open' },
  ],
  2: [
    { time: '09:00', status: 'booked', client: 'Trần Gia Hân' },
    { time: '10:00', status: 'open' },
    { time: '14:00', status: 'booked', client: 'Lê Hoàng Nam' },
  ],
  3: [
    { time: '09:00', status: 'open' },
    { time: '10:00', status: 'open' },
  ],
  4: [
    { time: '14:00', status: 'open' },
    { time: '15:00', status: 'open' },
  ],
}

const tabs: { id: AvailabilityTab; label: string; helper: string }[] = [
  { id: 'calendar', label: 'Lịch tuần', helper: 'Khung giờ đang mở' },
  { id: 'rules', label: 'Quy tắc lặp', helper: 'Thiết lập lịch mặc định' },
  { id: 'timeoff', label: 'Ngày nghỉ', helper: 'Ngoại lệ và thời gian nghỉ' },
]

const formatShortDate = (date: Date) =>
  `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <button
      type="button"
      className={`sa-toggle ${checked ? 'is-on' : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
    >
      <span />
    </button>
  )
}

export default function SpecialistAvailabilityManager({
  onCreate,
}: {
  onCreate: () => void
}) {
  const [activeTab, setActiveTab] = useState<AvailabilityTab>('calendar')
  const [weekOffset, setWeekOffset] = useState(0)
  const [acceptingBookings, setAcceptingBookings] = useState(true)
  const [autoRepeat, setAutoRepeat] = useState(true)
  const [bufferEnabled, setBufferEnabled] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null)
  const [removedSlots, setRemovedSlots] = useState<string[]>([])
  const [notice, setNotice] = useState('')

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = new Date(BASE_DATE)
        date.setDate(BASE_DATE.getDate() + weekOffset * 7 + index)
        return {
          name: DAY_NAMES[index],
          date,
          slots: weekOffset === 0 ? (CURRENT_SLOTS[index] ?? []) : [],
        }
      }),
    [weekOffset],
  )

  const visibleSlots = days
    .flatMap((day, dayIndex) =>
      day.slots.map((slot) => ({
        ...slot,
        key: `${weekOffset}-${dayIndex}-${slot.time}`,
      })),
    )
    .filter((slot) => !removedSlots.includes(slot.key))
  const openCount = visibleSlots.filter((slot) => slot.status === 'open').length
  const bookedCount = visibleSlots.filter(
    (slot) => slot.status === 'booked',
  ).length
  const activeDays = days.filter((day, dayIndex) =>
    day.slots.some(
      (slot) =>
        !removedSlots.includes(`${weekOffset}-${dayIndex}-${slot.time}`),
    ),
  ).length
  const rangeLabel = `${days[0].date.getDate()}–${days[6].date.getDate()} tháng ${days[6].date.getMonth() + 1}, ${days[6].date.getFullYear()}`

  const selectSlot = (slot: Slot, dayIndex: number) => {
    setSelectedSlot({
      ...slot,
      dayIndex,
      key: `${weekOffset}-${dayIndex}-${slot.time}`,
    })
  }

  const removeSelected = () => {
    if (!selectedSlot || selectedSlot.status === 'booked') return
    setRemovedSlots((current) => [...current, selectedSlot.key])
    setSelectedSlot(null)
    setNotice('Đã xóa khung giờ trống khỏi lịch tuần.')
    window.setTimeout(() => setNotice(''), 2600)
  }

  return (
    <section className="sa-manager">
      <header className="sa-heading">
        <div>
          <span className="sa-eyebrow">Không gian chuyên gia</span>
          <h1>Lịch khả dụng</h1>
          <p>
            Thiết lập thời gian nhận tư vấn và kiểm soát những khung giờ khách
            hàng có thể đặt.
          </p>
        </div>
        <div className="sa-heading-actions">
          <div className="sa-live-state">
            <i className={acceptingBookings ? 'is-on' : ''} />
            <span>
              <strong>
                {acceptingBookings ? 'Đang nhận lịch' : 'Đã tạm dừng'}
              </strong>
              <small>Hiển thị với khách hàng</small>
            </span>
            <Toggle
              checked={acceptingBookings}
              onChange={() => setAcceptingBookings((value) => !value)}
              label="Bật hoặc tắt nhận lịch"
            />
          </div>
          <button type="button" className="sa-create" onClick={onCreate}>
            + Thêm khung giờ
          </button>
        </div>
      </header>

      <section className="sa-summary" aria-label="Tổng quan lịch khả dụng">
        <article className="is-primary">
          <span>Khung giờ còn trống</span>
          <strong>{openCount}</strong>
          <p>Sẵn sàng để khách hàng đặt</p>
        </article>
        <article>
          <span>Đã được đặt</span>
          <strong>{bookedCount}</strong>
          <p>Phiên đã giữ chỗ tuần này</p>
        </article>
        <article>
          <span>Ngày làm việc</span>
          <strong>
            {activeDays}
            <small>/7</small>
          </strong>
          <p>Phân bổ trong tuần</p>
        </article>
        <article>
          <span>Thời lượng mặc định</span>
          <strong>
            60<small> phút</small>
          </strong>
          <p>Nghỉ đệm 15 phút</p>
        </article>
      </section>

      <section className="sa-workspace">
        <nav
          className="sa-tabs"
          role="tablist"
          aria-label="Quản lý lịch khả dụng"
        >
          {tabs.map((tab) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? 'is-active' : ''}
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setSelectedSlot(null)
              }}
            >
              <span>
                {tab.id === 'calendar' ? '▦' : tab.id === 'rules' ? '↻' : '—'}
              </span>
              <div>
                <strong>{tab.label}</strong>
                <small>{tab.helper}</small>
              </div>
            </button>
          ))}
        </nav>

        {activeTab === 'calendar' && (
          <div className="sa-calendar-view">
            <header className="sa-calendar-toolbar">
              <div>
                <button
                  type="button"
                  aria-label="Tuần trước"
                  onClick={() => {
                    setWeekOffset((value) => value - 1)
                    setSelectedSlot(null)
                  }}
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWeekOffset(0)
                    setSelectedSlot(null)
                  }}
                >
                  Tuần này
                </button>
                <button
                  type="button"
                  aria-label="Tuần sau"
                  onClick={() => {
                    setWeekOffset((value) => value + 1)
                    setSelectedSlot(null)
                  }}
                >
                  ›
                </button>
              </div>
              <span>{rangeLabel}</span>
              <div className="sa-legend">
                <span>
                  <i className="open" />
                  Còn trống
                </span>
                <span>
                  <i className="booked" />
                  Đã đặt
                </span>
              </div>
            </header>
            <div className="sa-calendar-scroll">
              <div className="sa-week-grid">
                {days.map((day, dayIndex) => {
                  const daySlots = day.slots.filter(
                    (slot) =>
                      !removedSlots.includes(
                        `${weekOffset}-${dayIndex}-${slot.time}`,
                      ),
                  )
                  const isToday = weekOffset === 0 && dayIndex === 2
                  return (
                    <article
                      className={`sa-day ${isToday ? 'is-today' : ''}`}
                      key={day.name}
                    >
                      <header>
                        <span>{day.name}</span>
                        <strong>{formatShortDate(day.date)}</strong>
                        {isToday && <small>Hôm nay</small>}
                      </header>
                      <div>
                        {daySlots.length ? (
                          daySlots.map((slot) => {
                            const key = `${weekOffset}-${dayIndex}-${slot.time}`
                            return (
                              <button
                                type="button"
                                className={`sa-slot ${slot.status} ${selectedSlot?.key === key ? 'is-selected' : ''}`}
                                key={key}
                                onClick={() => selectSlot(slot, dayIndex)}
                              >
                                <strong>{slot.time}</strong>
                                <span>
                                  {slot.status === 'booked'
                                    ? slot.client
                                    : 'Có thể đặt'}
                                </span>
                                <i>{slot.status === 'booked' ? '●' : '+'}</i>
                              </button>
                            )
                          })
                        ) : (
                          <button
                            type="button"
                            className="sa-day-empty"
                            onClick={onCreate}
                          >
                            <span>＋</span>
                            <strong>Chưa có lịch</strong>
                            <small>Thêm khung giờ</small>
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
            {selectedSlot && (
              <aside className="sa-selection">
                <div>
                  <span className={selectedSlot.status} />
                  <p>
                    <strong>
                      {DAY_NAMES[selectedSlot.dayIndex]} · {selectedSlot.time}
                    </strong>
                    <small>
                      {selectedSlot.status === 'booked'
                        ? `Đã đặt bởi ${selectedSlot.client}`
                        : 'Khung giờ đang mở cho khách hàng'}
                    </small>
                  </p>
                </div>
                <div>
                  <button type="button" onClick={() => setSelectedSlot(null)}>
                    Đóng
                  </button>
                  <button
                    type="button"
                    disabled={selectedSlot.status === 'booked'}
                    onClick={removeSelected}
                  >
                    Xóa khung giờ
                  </button>
                  <button
                    type="button"
                    disabled={selectedSlot.status === 'booked'}
                    onClick={onCreate}
                  >
                    Chỉnh sửa
                  </button>
                </div>
              </aside>
            )}
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="sa-rules-view">
            <header>
              <div>
                <span>Thiết lập lịch mặc định</span>
                <h2>Quy tắc lặp hằng tuần</h2>
                <p>
                  Áp dụng lịch đều đặn để không phải tạo lại từng khung giờ.
                </p>
              </div>
              <button
                type="button"
                className="sa-save-rule"
                onClick={() => {
                  setNotice('Đã lưu quy tắc lịch khả dụng.')
                  window.setTimeout(() => setNotice(''), 2600)
                }}
              >
                Lưu quy tắc
              </button>
            </header>
            <div className="sa-rule-list">
              <article>
                <div>
                  <i>↻</i>
                  <p>
                    <strong>Lặp lại lịch mỗi tuần</strong>
                    <span>Tự động tạo khung giờ từ lịch mặc định.</span>
                  </p>
                </div>
                <Toggle
                  checked={autoRepeat}
                  onChange={() => setAutoRepeat((value) => !value)}
                  label="Lặp lại lịch mỗi tuần"
                />
              </article>
              <article>
                <div>
                  <i>◷</i>
                  <p>
                    <strong>Thời gian nghỉ giữa hai phiên</strong>
                    <span>Dành 15 phút để hoàn tất ghi chú và chuẩn bị.</span>
                  </p>
                </div>
                <Toggle
                  checked={bufferEnabled}
                  onChange={() => setBufferEnabled((value) => !value)}
                  label="Thời gian nghỉ giữa hai phiên"
                />
              </article>
            </div>
            <section className="sa-default-hours">
              <div>
                <span>Thứ Hai – Thứ Sáu</span>
                <strong>09:00–17:00</strong>
                <small>Nghỉ trưa 12:00–13:30</small>
              </div>
              <div>
                <span>Thứ Bảy – Chủ nhật</span>
                <strong>Tạm nghỉ</strong>
                <small>Không nhận lịch mặc định</small>
              </div>
              <button type="button" onClick={onCreate}>
                Điều chỉnh giờ làm việc <b>→</b>
              </button>
            </section>
          </div>
        )}

        {activeTab === 'timeoff' && (
          <div className="sa-timeoff-view">
            <header>
              <div>
                <span>Ngoại lệ lịch làm việc</span>
                <h2>Ngày nghỉ sắp tới</h2>
                <p>
                  Khách hàng sẽ không thể đặt lịch trong các khoảng thời gian
                  này.
                </p>
              </div>
              <button
                type="button"
                className="sa-create-timeoff"
                onClick={() => {
                  setNotice(
                    'Biểu mẫu thêm ngày nghỉ đã sẵn sàng để kết nối API.',
                  )
                  window.setTimeout(() => setNotice(''), 2600)
                }}
              >
                + Thêm ngày nghỉ
              </button>
            </header>
            <div className="sa-timeoff-list">
              <article>
                <time>
                  <strong>02</strong>
                  <span>Tháng 9</span>
                </time>
                <div>
                  <strong>Nghỉ cả ngày</strong>
                  <span>Việc cá nhân · Thứ Tư</span>
                </div>
                <button type="button" aria-label="Xóa ngày nghỉ">
                  ×
                </button>
              </article>
              <article>
                <time>
                  <strong>12</strong>
                  <span>Tháng 9</span>
                </time>
                <div>
                  <strong>Buổi chiều</strong>
                  <span>13:00–18:00 · Hội thảo chuyên môn</span>
                </div>
                <button type="button" aria-label="Xóa ngày nghỉ">
                  ×
                </button>
              </article>
            </div>
            <aside className="sa-timeoff-note">
              <i>i</i>
              <p>
                <strong>Các lịch hẹn đã xác nhận không bị tự động hủy</strong>
                <span>
                  Nếu ngày nghỉ trùng lịch hẹn, bạn cần liên hệ khách hàng và
                  thực hiện đổi lịch riêng.
                </span>
              </p>
            </aside>
          </div>
        )}
      </section>
      {notice && (
        <div className="sa-notice">
          <span>✓</span>
          {notice}
        </div>
      )}
    </section>
  )
}
