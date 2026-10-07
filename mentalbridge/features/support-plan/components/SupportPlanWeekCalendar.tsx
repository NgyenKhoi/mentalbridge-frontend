'use client'

import React from 'react'
import type { SupportPlanOccurrence } from '../api/support-plan-contract'
import SupportPlanIcon from './SupportPlanIcon'

const VI_WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN']

interface SupportPlanWeekCalendarProps {
  weekDays: string[]
  selectedDate: string
  today: string
  occurrences: SupportPlanOccurrence[]
  onSelectDate: (date: string) => void
  onPrevWeek: () => void
  onNextWeek: () => void
  weekRangeLabel: string
  viewMode?: 'calendar' | 'list'
  onViewModeChange?: (mode: 'calendar' | 'list') => void
  pausedStatusBadge?: React.ReactNode
}

function formatDayNumber(dateStr: string): number {
  const parts = dateStr.split('-')
  return parseInt(parts[2] ?? '1', 10)
}

function formatTime(scheduledAt: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
      hour12: false,
    }).format(new Date(scheduledAt))
  } catch {
    return '08:00'
  }
}

export default function SupportPlanWeekCalendar({
  weekDays,
  selectedDate,
  today,
  occurrences,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  weekRangeLabel,
  viewMode = 'calendar',
  onViewModeChange,
  pausedStatusBadge,
}: SupportPlanWeekCalendarProps) {
  return (
    <section
      className="support-plan-week-calendar"
      aria-label="Lịch trình chăm sóc 7 ngày"
    >
      {/* Calendar Header Controls: Aligned horizontally */}
      <div className="support-plan-calendar-header">
        <div className="support-plan-calendar-heading-group">
          <div className="support-plan-calendar-icon-wrap" aria-hidden="true">
            <SupportPlanIcon name="calendar_month" size={20} />
          </div>
          <div>
            <h3 className="support-plan-calendar-title">
              Lịch trình chăm sóc 7 ngày
            </h3>
            <p className="support-plan-calendar-subtitle">
              Chọn một ngày để lọc và xem bài tập tương ứng
            </p>
          </div>
          {pausedStatusBadge}
        </div>

        <div className="support-plan-calendar-controls-right">
          {onViewModeChange && (
            <div
              className="support-plan-view-switcher"
              role="group"
              aria-label="Chế độ xem hoạt động"
            >
              <button
                type="button"
                className={`support-plan-view-btn ${viewMode === 'calendar' ? 'is-active' : ''}`}
                onClick={() => onViewModeChange('calendar')}
              >
                <SupportPlanIcon name="calendar_view_week" size={16} />
                <span>Lịch biểu</span>
              </button>
              <button
                type="button"
                className={`support-plan-view-btn ${viewMode === 'list' ? 'is-active' : ''}`}
                onClick={() => onViewModeChange('list')}
              >
                <SupportPlanIcon name="view_agenda" size={16} />
                <span>Danh sách</span>
              </button>
            </div>
          )}

          <div className="support-plan-calendar-nav">
            <span className="support-plan-calendar-range">
              {weekRangeLabel}
            </span>
            <div className="support-plan-calendar-nav-buttons">
              <button
                type="button"
                aria-label="Tuần trước"
                className="support-plan-cal-btn"
                onClick={onPrevWeek}
              >
                <SupportPlanIcon name="chevron_left" size={18} />
              </button>
              <button
                type="button"
                aria-label="Tuần kế tiếp"
                className="support-plan-cal-btn"
                onClick={onNextWeek}
              >
                <SupportPlanIcon name="chevron_right" size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 7-Day Grid */}
      <div
        className="support-plan-calendar-grid"
        role="listbox"
        aria-label="Chọn ngày trong tuần"
      >
        {weekDays.map((dateStr, idx) => {
          const isToday = dateStr === today
          const isSelected = dateStr === selectedDate
          const dayOccurrences = occurrences.filter(
            (o) => !o.hidden && o.localDate === dateStr,
          )
          const allCompleted =
            dayOccurrences.length > 0 &&
            dayOccurrences.every((o) => o.state === 'COMPLETED')
          const isRestDay = dayOccurrences.length === 0
          const isPast = dateStr < today
          let statusClass = 'state-upcoming'
          let statusTitle = 'Lịch trình kế tiếp'
          if (allCompleted) {
            statusClass = 'state-done'
            statusTitle = 'Đã hoàn thành'
          } else if (isToday) {
            statusClass = 'state-today'
            statusTitle = 'Hôm nay & Đang làm'
          } else if (isRestDay) {
            statusClass = 'state-rest'
            statusTitle = 'Nghỉ ngơi linh hoạt'
          } else if (isPast) {
            statusClass = 'state-past'
            statusTitle = 'Đã qua'
          }

          return (
            <div
              key={dateStr}
              role="option"
              tabIndex={0}
              aria-selected={isSelected}
              className={`support-plan-cal-col ${statusClass} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`}
              onClick={() => onSelectDate(dateStr)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelectDate(dateStr)
                }
              }}
            >
              {isToday && (
                <div className="support-plan-today-badge">Hôm nay</div>
              )}

              <div className="support-plan-cal-day-top">
                <div className="support-plan-cal-header-row">
                  <span className="support-plan-cal-weekday">
                    {VI_WEEKDAYS[idx]}
                  </span>
                  <span
                    className={`support-plan-status-dot ${isToday ? 'animate-pulse' : ''}`}
                    title={statusTitle}
                    aria-hidden="true"
                  />
                </div>
                <span className="support-plan-cal-day-number">
                  {formatDayNumber(dateStr)}
                </span>
              </div>

              {/* Tối đa 2 chip rút gọn + badge +N nếu nhiều hơn */}
              <div className="support-plan-cal-chips">
                {dayOccurrences.slice(0, 2).map((item) => (
                  <div
                    key={item.occurrenceId}
                    className="support-plan-cal-chip"
                    title={`${formatTime(item.scheduledAt, item.timezone)} ${item.source.title}`}
                  >
                    <SupportPlanIcon
                      name={
                        item.state === 'COMPLETED'
                          ? 'check_circle'
                          : item.source.type === 'RESOURCE'
                            ? 'psychology'
                            : 'self_improvement'
                      }
                      size={12}
                      className="support-plan-cal-chip-icon"
                    />
                    <span className="support-plan-cal-chip-text">
                      {formatTime(item.scheduledAt, item.timezone)}{' '}
                      {item.source.title}
                    </span>
                  </div>
                ))}
                {dayOccurrences.length > 2 && (
                  <span
                    className="support-plan-cal-more-badge"
                    title={`Còn ${dayOccurrences.length - 2} hoạt động khác`}
                  >
                    +{dayOccurrences.length - 2}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Status Legend Bar */}
      <div
        className="support-plan-calendar-legend"
        aria-label="Chú thích trạng thái"
      >
        <div className="support-plan-legend-item">
          <span className="support-plan-legend-dot state-done" />
          <span>Đã hoàn thành</span>
        </div>
        <div className="support-plan-legend-item">
          <span className="support-plan-legend-dot state-today" />
          <span>Hôm nay &amp; Đang làm</span>
        </div>
        <div className="support-plan-legend-item">
          <span className="support-plan-legend-dot state-upcoming" />
          <span>Lịch trình kế tiếp</span>
        </div>
        <div className="support-plan-legend-item">
          <span className="support-plan-legend-dot state-rest" />
          <span>Nghỉ ngơi linh hoạt</span>
        </div>
      </div>
    </section>
  )
}
