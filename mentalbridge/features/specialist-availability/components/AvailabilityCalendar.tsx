'use client'

import { useMemo, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  MessageSquare,
  Video,
} from 'lucide-react'
import type { AvailabilitySlot } from '@/lib/consultation/consultation-validation'
import {
  addDays,
  dateInTimezone,
  formatDate,
  formatTime,
} from './availability-time'
import styles from './AvailabilityCalendar.module.css'

export type AvailabilityView = 'list' | 'calendar'

export function AvailabilityViewSwitch({
  value,
  onChange,
}: {
  value: AvailabilityView
  onChange: (value: AvailabilityView) => void
}) {
  return (
    <div
      className={styles.viewSwitch}
      role="group"
      aria-label="Cách xem lịch khả dụng"
    >
      <button
        type="button"
        aria-pressed={value === 'list'}
        onClick={() => onChange('list')}
      >
        <List size={15} aria-hidden="true" /> Danh sách
      </button>
      <button
        type="button"
        aria-pressed={value === 'calendar'}
        onClick={() => onChange('calendar')}
      >
        <CalendarDays size={15} aria-hidden="true" /> Lịch
      </button>
    </div>
  )
}

type Props = {
  slots: readonly AvailabilitySlot[]
  anchor: string
  today: string
  timezone: string
  busy: boolean
  readinessLabels: Readonly<Record<AvailabilitySlot['readiness'], string>>
  onNavigate: (date: string) => void
  onSelect: (slot: AvailabilitySlot) => void
}

export function AvailabilityCalendar({
  slots,
  anchor,
  today,
  timezone,
  busy,
  readinessLabels,
  onNavigate,
  onSelect,
}: Props) {
  const [selectedDay, setSelectedDay] = useState(anchor)
  const monthStart = `${anchor.slice(0, 7)}-01`
  const first = new Date(`${monthStart}T12:00:00Z`)
  const leadingDays = (first.getUTCDay() + 6) % 7
  const monthEnd = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  )
  const weekCount = Math.ceil((leadingDays + monthEnd.getUTCDate()) / 7)
  const gridStart = addDays(monthStart, -leadingDays)
  const loadedFrom = addDays(anchor, -7)
  const loadedTo = addDays(anchor, 89)
  const grouped = useMemo(() => {
    const days = new Map<string, AvailabilitySlot[]>()
    for (const slot of slots) {
      const day = dateInTimezone(Date.parse(slot.startAt), timezone)
      const items = days.get(day) ?? []
      items.push(slot)
      days.set(day, items)
    }
    return days
  }, [slots, timezone])
  const selectedSlots = grouped.get(selectedDay) ?? []
  const title = formatDate(monthStart, { month: 'long', year: 'numeric' })

  function navigateMonth(offset: number) {
    const next = new Date(first)
    next.setUTCMonth(next.getUTCMonth() + offset)
    onNavigate(next.toISOString().slice(0, 10))
  }

  function chooseDay(day: string) {
    if (
      day < loadedFrom ||
      day > loadedTo ||
      day.slice(0, 7) !== anchor.slice(0, 7)
    ) {
      onNavigate(day)
    } else {
      setSelectedDay(day)
    }
  }

  return (
    <div className={styles.calendar} aria-busy={busy}>
      <div className={styles.toolbar}>
        <div>
          <h3 aria-live="polite">{title}</h3>
          <p>Giờ hiển thị: {timezone}</p>
        </div>
        <div className={styles.navigation}>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setSelectedDay(today)
              onNavigate(today)
            }}
          >
            Hôm nay
          </button>
          <button
            type="button"
            aria-label="Xem tháng trước"
            disabled={busy}
            onClick={() => navigateMonth(-1)}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Xem tháng sau"
            disabled={busy}
            onClick={() => navigateMonth(1)}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className={styles.mobileHint}>
        Vuốt ngang để xem đủ các ngày trong tuần.
      </p>
      <div className={styles.scroll}>
        <table className={styles.month} aria-label={`Lịch khả dụng ${title}`}>
          <thead>
            <tr>
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => (
                <th key={day} scope="col">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: weekCount }, (_, week) => (
              <tr key={week}>
                {Array.from({ length: 7 }, (_, weekday) => {
                  const day = addDays(gridStart, week * 7 + weekday)
                  const items = grouped.get(day) ?? []
                  const outsideRange = day < loadedFrom || day > loadedTo
                  return (
                    <td
                      key={day}
                      data-outside-month={
                        day.slice(0, 7) !== anchor.slice(0, 7)
                      }
                    >
                      <button
                        type="button"
                        className={styles.day}
                        aria-label={`${formatDate(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${outsideRange ? 'chọn để xem khung giờ' : `${items.length} khung giờ`}`}
                        aria-pressed={day === selectedDay}
                        aria-current={day === today ? 'date' : undefined}
                        data-unloaded={outsideRange}
                        disabled={busy}
                        onClick={() => chooseDay(day)}
                      >
                        <span className={styles.dayNumber}>
                          {Number(day.slice(-2))}
                        </span>
                        <span className={styles.previews}>
                          {items.slice(0, 2).map((slot) => (
                            <span
                              className={styles.preview}
                              data-readiness={slot.readiness}
                              key={slot.id}
                              title={readinessLabels[slot.readiness]}
                            >
                              {formatTime(slot.startAt, timezone)}
                              {slot.modality === 'IN_APP_CHAT' ? (
                                <MessageSquare size={11} aria-hidden="true" />
                              ) : (
                                <Video size={11} aria-hidden="true" />
                              )}
                            </span>
                          ))}
                          {items.length > 2 && (
                            <span className={styles.more}>
                              +{items.length - 2} khung giờ
                            </span>
                          )}
                          {outsideRange && (
                            <span className={styles.more}>Xem ngày này</span>
                          )}
                        </span>
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.legend}>
        <span>
          <i data-state="AVAILABLE" />
          Có thể đặt
        </span>
        <span>
          <i data-state="STARTED" />
          Đã bắt đầu / video đang tắt
        </span>
        <span>
          <i data-state="WITHDRAWN" />
          Đã rút
        </span>
      </div>
      <section
        className={styles.agenda}
        aria-label="Khung giờ của ngày đang chọn"
      >
        <div className={styles.agendaHeading}>
          <h4>
            {formatDate(selectedDay, {
              weekday: 'long',
              day: '2-digit',
              month: '2-digit',
            })}
          </h4>
          <span>{selectedSlots.length} khung giờ</span>
        </div>
        {selectedSlots.length === 0 ? (
          <p className={styles.empty}>
            {busy
              ? 'Đang tải khung giờ…'
              : 'Chưa có khung giờ trong ngày này. Chọn ngày khác để xem lịch.'}
          </p>
        ) : (
          <ul className={styles.events}>
            {selectedSlots.map((slot) => (
              <li key={slot.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSelect(slot)}
                >
                  <span className={styles.eventIcon}>
                    {slot.modality === 'IN_APP_CHAT' ? (
                      <MessageSquare size={18} aria-hidden="true" />
                    ) : (
                      <Video size={18} aria-hidden="true" />
                    )}
                  </span>
                  <span className={styles.eventCopy}>
                    <strong>
                      {formatTime(slot.startAt, timezone)} –{' '}
                      {formatTime(slot.endAt, timezone)}
                      {dateInTimezone(Date.parse(slot.endAt), timezone) !==
                      dateInTimezone(Date.parse(slot.startAt), timezone)
                        ? ' (+1 ngày)'
                        : ''}
                    </strong>
                    <span>
                      {slot.modality === 'IN_APP_CHAT'
                        ? 'Chat trong ứng dụng'
                        : 'Video trong ứng dụng'}
                    </span>
                  </span>
                  <span
                    className={styles.status}
                    data-readiness={slot.readiness}
                  >
                    {readinessLabels[slot.readiness]}
                  </span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.hint}>
          Chọn một khung giờ để xem chi tiết trong danh sách.
        </p>
      </section>
    </div>
  )
}
