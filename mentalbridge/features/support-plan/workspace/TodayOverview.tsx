'use client'

import Link from 'next/link'
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Heart,
  MessageCircle,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import type {
  ActionOccurrence,
  SupportPlanV3,
} from '../api/support-plan-contract'
import { actionDestination } from './workspace-links'
import { activityPresentation } from './activity-presentation'
import {
  dayLabel,
  formatTimeIn,
  isDailyWork,
  joinOccurrences,
  occurrenceWindow,
  todayCounts,
  todayRows,
  weekDates,
  type PlannedOccurrence,
  type TodayCounts,
} from './workspace-model'

const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

export default function TodayOverview({
  plan,
  occurrences,
  today,
  timezone,
  counts,
  next,
  now,
  onOpenPlan,
}: Readonly<{
  plan: SupportPlanV3
  occurrences: ActionOccurrence[]
  today: string
  timezone: string
  counts: TodayCounts
  next?: PlannedOccurrence
  now: number
  onOpenPlan: () => void
}>) {
  const dates = /^\d{4}-\d{2}-\d{2}$/.test(today) ? weekDates(today) : []
  const window = dates.length > 0 ? occurrenceWindow(plan, today) : null
  const week = joinOccurrences(plan, occurrences).filter(
    (item) =>
      isDailyWork(item) &&
      dates.includes(item.occurrence.localDate) &&
      item.occurrence.state !== 'CANCELLED',
  )
  const completed = week.filter(
    (item) => item.occurrence.state === 'COMPLETED',
  ).length
  const percentage = week.length
    ? Math.round((completed / week.length) * 100)
    : null
  const destination = next && actionDestination(plan, next, today)
  const schedule = next?.action.schedules?.find(
    (item) =>
      item.scheduleId === next.occurrence.scheduleId &&
      item.version === next.occurrence.scheduleVersion,
  )
  const nextTime = next && formatTimeIn(timezone, next.occurrence.scheduledAt)
  const nextPresentation = next && activityPresentation(next)

  return (
    <>
      <section
        className="mbw-today-hero"
        data-surface="dark"
        aria-labelledby="mbw-today-date"
      >
        <div>
          <div className="mbw-hero-meta">
            <span>
              <CalendarDays size={15} aria-hidden="true" /> Lịch trình hôm nay
            </span>
            <span>
              {counts.total === 0
                ? 'Một khoảng nghỉ cho mình'
                : `${counts.total} hoạt động theo lịch`}
            </span>
          </div>
          <h2 id="mbw-today-date">{dayLabel(today) || 'Hôm nay'}</h2>
          <p>
            {counts.total === 0
              ? 'Hôm nay chưa có hoạt động theo lịch. Bạn có thể xem kế hoạch hoặc dành một chút thời gian cho mình.'
              : counts.done === counts.total
                ? 'Bạn đã hoàn thành các hoạt động hôm nay. Những gì bạn ghi nhận đã được lưu trong kế hoạch.'
                : `Bạn đã hoàn thành ${counts.done} trên ${counts.total} hoạt động hôm nay. Chọn một việc để tiếp tục theo nhịp của mình.`}
          </p>
        </div>
        <div className="mbw-hero-action">
          <button type="button" onClick={onOpenPlan}>
            Xem toàn bộ kế hoạch
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <span>Từng bước, theo nhịp của bạn</span>
        </div>
      </section>

      <div className="mbw-overview-grid">
        <section
          className="mbw-overview-progress"
          aria-labelledby="mbw-week-heading"
        >
          <h3 id="mbw-week-heading">
            <TrendingUp size={18} aria-hidden="true" /> Tiến độ tuần này
          </h3>
          {percentage === null ? (
            <p className="mbw-quiet">Chưa có hoạt động trong lịch tuần này.</p>
          ) : (
            <div className="mbw-week-summary">
              <div
                className="mbw-week-ring"
                role="progressbar"
                aria-label="Hoạt động đã hoàn thành trong tuần"
                aria-valuemin={0}
                aria-valuemax={week.length}
                aria-valuenow={completed}
                aria-valuetext={`${completed} trên ${week.length} hoạt động`}
              >
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <circle className="mbw-ring-track" cx="50" cy="50" r="41" />
                  <circle
                    className="mbw-ring-value"
                    cx="50"
                    cy="50"
                    r="41"
                    pathLength="100"
                    strokeDasharray={`${percentage} 100`}
                  />
                </svg>
                <strong>{percentage}%</strong>
              </div>
              <div>
                <strong>
                  {completed}/{week.length} hoạt động
                </strong>
                <p>Đã hoàn thành trong tuần này</p>
              </div>
            </div>
          )}
          {dates.length > 0 && (
            <div className="mbw-week-calendar">
              <span className="mbw-week-caption">Nhịp tuần của bạn</span>
              <ol className="mbw-week-days" aria-label="Các ngày trong tuần">
                {dates.map((date, index) => {
                  const known =
                    window !== null &&
                    date >= window.from &&
                    date <= window.through
                  const daily = known
                    ? todayCounts(todayRows(plan, occurrences, date, now))
                    : null
                  const done =
                    date <= today &&
                    daily !== null &&
                    daily.total > 0 &&
                    daily.done === daily.total
                  return (
                    <li
                      key={date}
                      aria-current={date === today ? 'date' : undefined}
                      className={done ? 'is-done' : undefined}
                    >
                      <span>{weekdays[index]}</span>
                      <span className="mbw-week-day-mark" aria-hidden="true">
                        {done ? (
                          <Check size={16} />
                        ) : date === today ? (
                          'Nay'
                        ) : (
                          Number(date.slice(-2))
                        )}
                      </span>
                      <span className="mbw-visually-hidden">
                        {dayLabel(date)}.{' '}
                        {!known
                          ? 'Chưa có dữ liệu'
                          : daily?.total
                            ? `${daily.done} trên ${daily.total} hoạt động đã xong`
                            : 'Không có hoạt động theo lịch'}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </div>
          )}
        </section>

        <section
          className="mbw-overview-next"
          aria-labelledby="mbw-upcoming-heading"
        >
          <h3 id="mbw-upcoming-heading">
            <Sparkles size={18} aria-hidden="true" /> Hoạt động tiếp theo
          </h3>
          {next ? (
            <>
              {nextPresentation && (
                <span
                  className={`mbw-activity-badge is-${nextPresentation.tone}`}
                >
                  {nextPresentation.label}
                </span>
              )}
              <span className="mbw-upcoming-date">
                <CalendarDays size={15} aria-hidden="true" />
                {dayLabel(next.occurrence.localDate)}
                {nextTime ? ` lúc ${nextTime}` : ''}
              </span>
              <p className="mbw-upcoming-title">
                {next.action.presentation?.title || 'Hoạt động trong kế hoạch'}
              </p>
              {(next.action.presentation?.summary || next.action.rationale) && (
                <p>
                  {next.action.presentation?.summary || next.action.rationale}
                </p>
              )}
              {schedule?.estimatedDurationMinutes ? (
                <span className="mbw-duration">
                  <Clock3 size={15} aria-hidden="true" />
                  Khoảng {schedule.estimatedDurationMinutes} phút
                </span>
              ) : null}
              <div className="mbw-overview-footer">
                {destination ? (
                  <Link href={destination.href}>
                    Mở hoạt động
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                ) : (
                  <button type="button" onClick={onOpenPlan}>
                    Xem trong kế hoạch
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <p>Chưa có hoạt động tiếp theo trong lịch đã tải.</p>
              <div className="mbw-overview-footer">
                <button type="button" onClick={onOpenPlan}>
                  Xem kế hoạch
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            </>
          )}
        </section>

        <section
          className="mbw-overview-checkin"
          aria-labelledby="mbw-checkin-heading"
        >
          <Heart size={24} aria-hidden="true" />
          <h3 id="mbw-checkin-heading">Hôm nay bạn cảm thấy thế nào?</h3>
          <p>
            Dành một chút thời gian ghi lại cảm xúc hoặc trò chuyện về điều bạn
            đang nghĩ.
          </p>
          <Link className="mbw-checkin-link" href="/dashboard">
            Ghi nhận cảm xúc
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link className="mbw-companion-link" href="/ai-companion">
            <MessageCircle size={17} aria-hidden="true" />
            Trò chuyện cùng AI Companion
          </Link>
        </section>
      </div>
    </>
  )
}
