'use client'

import React from 'react'
import type { CalendarDayItem } from '../hooks/useJournalTimeline'

interface JournalCalendarProps {
  year: number
  month: number // 0-indexed
  calendarData: {
    offset: number
    days: CalendarDayItem[]
  }
  selectedDay: string | null
  onSelectDay: (dateKey: string | null) => void
  onPrevMonth: () => void
  onNextMonth: () => void
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

export function JournalCalendar({
  year,
  month,
  calendarData,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
}: JournalCalendarProps) {
  const now = new Date()
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  return (
    <div className="card cal" aria-label="Lịch nhật ký theo tháng">
      <div className="ch">
        <button
          type="button"
          className="nav"
          onClick={onPrevMonth}
          aria-label="Tháng trước"
        >
          ‹
        </button>
        <span className="cal-title">
          Tháng {month + 1}, {year}
        </span>
        <button
          type="button"
          className="nav"
          onClick={onNextMonth}
          aria-label="Tháng sau"
        >
          ›
        </button>
      </div>

      <div
        className="g"
        role="grid"
        aria-label={`Tháng ${month + 1} năm ${year}`}
      >
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="w" role="columnheader">
            {wd}
          </div>
        ))}

        {/* Empty slots for month starting offset */}
        {Array.from({ length: calendarData.offset }).map((_, i) => (
          <div key={`empty-${i}`} aria-hidden="true" />
        ))}

        {/* Day cells */}
        {calendarData.days.map((item) => {
          const isToday = item.dateKey === todayKey
          return (
            <button
              key={item.dateKey}
              type="button"
              className={`dy ${item.hasEntries ? 'has' : ''} ${item.isSelected ? 'sel' : ''} ${isToday ? 'today' : ''}`}
              disabled={!item.hasEntries}
              tabIndex={item.hasEntries ? 0 : -1}
              aria-pressed={item.isSelected}
              aria-label={`Ngày ${item.day} tháng ${month + 1}${item.hasEntries ? ' (có nhật ký)' : ''}`}
              style={
                {
                  '--c': item.latestMoodColor || 'transparent',
                } as React.CSSProperties
              }
              onClick={() => onSelectDay(item.isSelected ? null : item.dateKey)}
            >
              {item.day}
              <s aria-hidden="true" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
