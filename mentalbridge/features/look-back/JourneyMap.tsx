'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'

import { emotionPresentation } from '@/lib/emotion-check-in/presentation'

import { dayMonth, moodLabel } from './look-back-copy'
import type { LookBack } from './look-back-model'
import styles from './LookBack.module.css'

type Day = LookBack['days'][number]
type Filter = 'all' | 'first' | 'second'

const xAt = (index: number, count: number) =>
  48 + (index * 904) / Math.max(1, count - 1)
const yAt = (level: number) => 78 + ((5 - level) / 4) * 190

function moodRuns(days: readonly Day[]) {
  const runs: Array<Array<{ x: number; y: number }>> = []
  let current: Array<{ x: number; y: number }> = []
  days.forEach((day, index) => {
    if (day.emotionLevel === null) {
      if (current.length > 1) runs.push(current)
      current = []
    } else {
      current.push({ x: xAt(index, days.length), y: yAt(day.emotionLevel) })
    }
  })
  if (current.length > 1) runs.push(current)
  return runs.map((run) => {
    const [start, ...rest] = run
    let path = `M ${start.x} ${start.y}`
    let previous = start
    for (const point of rest) {
      const middle = (previous.x + point.x) / 2
      path += ` C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`
      previous = point
    }
    return path
  })
}

function DayDetail({
  day,
  index,
}: Readonly<{
  day: Day
  index: number
}>) {
  const mood = day.emotionLevel === null ? null : moodLabel(day.emotionLevel)
  return (
    <aside
      className={styles.dayDetail}
      aria-live="polite"
      aria-label={`Chi tiết ngày ${index + 1}`}
    >
      <div className={styles.detailHead}>
        <strong>
          Ngày {index + 1} · {dayMonth(day.localDate)}
        </strong>
        <span className={styles.moodPill}>
          {mood?.label ?? 'Chưa ghi cảm xúc'}
        </span>
      </div>
      {mood && (
        <div className={styles.detailMood}>
          Mức cảm xúc: {mood.label} ({day.emotionLevel}/5)
        </div>
      )}
      <div className={styles.detailFacts}>
        <span>Hoạt động đã làm: {day.supportCompleted ?? '–'}</span>
        <span>
          Nhật ký:{' '}
          {day.journalEntries === null
            ? '–'
            : day.journalEntries > 0
              ? `${day.journalEntries} bài`
              : 'Chưa ghi'}
        </span>
      </div>
    </aside>
  )
}

export function JourneyMap({ data }: Readonly<{ data: LookBack }>) {
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedDate, setSelectedDate] = useState(data.asOfLocalDate)
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const scroll = scrollRef.current
    if (scroll && window.matchMedia?.('(max-width: 560px)').matches) {
      scroll.scrollLeft = scroll.scrollWidth - scroll.clientWidth
    }
  }, [filter])
  const days =
    filter === 'first'
      ? data.days.slice(0, 7)
      : filter === 'second'
        ? data.days.slice(7)
        : data.days
  const selected = data.days.findIndex((day) => day.localDate === selectedDate)
  const selectedDay = data.days[selected] ?? data.days.at(-1)
  const dates = (first: number, last: number) =>
    `${dayMonth(data.days[first].localDate)} – ${dayMonth(data.days[last].localDate)}`
  const filters: readonly { key: Filter; label: string }[] = [
    { key: 'all', label: 'Tất cả (14 ngày)' },
    { key: 'first', label: `Tuần 1 (${dates(0, 6)})` },
    { key: 'second', label: `Tuần 2 (${dates(7, 13)})` },
  ]
  return (
    <section className={styles.mapSurface} aria-labelledby="look-back-mood">
      <div className={styles.mapHead}>
        <div>
          <h2 id="look-back-mood" className={styles.h2}>
            Bản đồ hành trình cảm xúc{' '}
            <small aria-hidden="true">14 trạm dừng</small>
          </h2>
          <p className={styles.lead}>
            Chọn một ngày để xem cảm xúc và những điều bạn đã ghi nhận.
          </p>
        </div>
        <div className={styles.legend} aria-label="Mức cảm xúc">
          {(['GREAT', 'GOOD', 'OKAY', 'LOW', 'VERY_LOW'] as const).map(
            (key) => (
              <span key={key}>
                <i style={{ background: emotionPresentation[key].color }} />
                {emotionPresentation[key].label}
              </span>
            ),
          )}
        </div>
      </div>
      <div className={styles.filterRow}>
        <div
          className={styles.filters}
          role="group"
          aria-label="Xem khoảng thời gian"
        >
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={filter === item.key}
              onClick={() => {
                setFilter(item.key)
                setSelectedDate(
                  data.days[item.key === 'first' ? 6 : 13].localDate,
                )
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className={styles.filterHint} role="status">
          {filter === 'all'
            ? 'Đang xem cả 14 ngày'
            : filter === 'first'
              ? 'Đang xem tuần 1'
              : 'Đang xem tuần 2'}
        </div>
      </div>
      <div className={styles.mapScroll} ref={scrollRef}>
        <div className={styles.mapStage}>
          {filter !== 'second' && (
            <div
              className={`${styles.zoneFirst} ${filter === 'first' ? styles.zoneOnly : ''}`}
            >
              <strong>CHẶNG 1 · TUẦN 1</strong>
            </div>
          )}
          {filter !== 'first' && (
            <div
              className={`${styles.zoneSecond} ${filter === 'second' ? styles.zoneOnly : ''}`}
            >
              <strong>CHẶNG 2 · TUẦN 2</strong>
            </div>
          )}
          <svg
            viewBox="0 0 1000 340"
            preserveAspectRatio="none"
            role="img"
            aria-label="Biểu đồ cảm xúc theo từng ngày. Chọn các trạm ngày để xem mức cảm xúc."
            className={styles.road}
          >
            {moodRuns(days).map((path) => (
              <g key={path}>
                <path d={path} className={styles.roadBase} />
                <path d={path} className={styles.roadLine} />
                <path d={path} className={styles.roadDashes} />
              </g>
            ))}
          </svg>
          {days.map((day, index) => {
            const mood =
              day.emotionLevel === null ? null : moodLabel(day.emotionLevel)
            const hasMoment =
              (day.supportCompleted ?? 0) > 0 ||
              (data.conversations?.some(
                (item) => item.localDate === day.localDate,
              ) ??
                false)
            return (
              <button
                key={day.localDate}
                type="button"
                className={`${styles.station} ${mood ? '' : styles.stationMissing} ${hasMoment ? styles.stationMoment : ''}`}
                style={
                  {
                    '--x': `${(xAt(index, days.length) / 1000) * 100}%`,
                    '--y': `${(yAt(day.emotionLevel ?? 3) / 340) * 100}%`,
                    '--station-color': mood
                      ? emotionPresentation[mood.key].color
                      : '#9aa6a0',
                  } as CSSProperties
                }
                aria-label={`Ngày ${data.days.indexOf(day) + 1}, ${dayMonth(day.localDate)}: ${mood?.label ?? 'chưa ghi cảm xúc'}`}
                aria-pressed={selectedDay?.localDate === day.localDate}
                onClick={() => setSelectedDate(day.localDate)}
              >
                <span className={styles.stationNumber}>
                  {data.days.indexOf(day) + 1}
                </span>
                <span className={styles.stationDate}>
                  {dayMonth(day.localDate)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <p className={styles.mapSwipe}>Vuốt ngang để xem các ngày còn lại.</p>
      {selectedDay && <DayDetail day={selectedDay} index={selected} />}
      <p className={styles.mapFoot}>
        Đường nối chỉ những ngày có ghi nhận cảm xúc liên tiếp. Vòng nhấn là
        ngày có hoạt động hoặc cuộc trò chuyện.
      </p>
    </section>
  )
}
