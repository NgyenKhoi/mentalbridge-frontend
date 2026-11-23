'use client'

import { useReducedMotion } from 'framer-motion'
import { Check, Plus } from 'lucide-react'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'

import { emotionPresentation } from '@/lib/emotion-check-in/presentation'

import { dayMonth, moodLabel, moodTone, weekdayOf } from './look-back-copy'
import type { LookBack } from './look-back-model'
import styles from './LookBack.module.css'

type Day = LookBack['days'][number]
type Filter = 'all' | 'first' | 'second'

// Stage space of the approved reference (1000 × 400): week 1 sits in the left zone, week 2 in the right one.
const xOf = (index: number) =>
  index < 7 ? 60 + index * 60 : 540 + (index - 7) * 66
const yOf = (level: number) => 120 + ((5 - level) / 4) * 180
const NO_MOOD = '#9AA6A0'
const CARD_DELAY_MS = 1600

/** Every day gets a station on one continuous road; a day without a mood sits between its neighbours. */
function stationPoints(days: readonly Day[]) {
  const known = days.flatMap((day, index) =>
    day.emotionLevel === null ? [] : [{ index, y: yOf(day.emotionLevel) }],
  )
  return days.map((day, index) => {
    if (day.emotionLevel !== null)
      return { x: xOf(index), y: yOf(day.emotionLevel) }
    const before = known.filter((point) => point.index < index).at(-1)
    const after = known.find((point) => point.index > index)
    const y =
      before && after
        ? before.y +
          ((after.y - before.y) * (index - before.index)) /
            (after.index - before.index)
        : ((before ?? after)?.y ?? yOf(3))
    return { x: xOf(index), y }
  })
}

function roadPath(points: ReadonlyArray<{ x: number; y: number }>) {
  const [start, ...rest] = points
  let path = `M ${start.x} ${start.y}`
  let previous = start
  for (const point of rest) {
    const middle = (previous.x + point.x) / 2
    path += ` C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`
    previous = point
  }
  return path
}

const toneOf = (day: Day) =>
  day.emotionLevel === null ? null : moodTone[moodLabel(day.emotionLevel).key]

function compareText(days: readonly Day[], index: number) {
  const level = days[index].emotionLevel
  if (level === null) return 'Hôm này bạn chưa ghi cảm xúc.'
  const previous = days
    .slice(0, index)
    .findLast((item) => item.emotionLevel !== null)
  if (!previous || previous.emotionLevel === null)
    return 'Lần ghi cảm xúc đầu tiên trong 14 ngày này.'
  const when = dayMonth(previous.localDate)
  if (level > previous.emotionLevel)
    return `Nhẹ nhõm hơn lần ghi trước (${when}).`
  if (level < previous.emotionLevel) return `Nặng hơn lần ghi trước (${when}).`
  return `Giữ mức như lần ghi trước (${when}).`
}

function DayCard({
  data,
  index,
  point,
}: Readonly<{
  data: LookBack
  index: number
  point: { x: number; y: number }
}>) {
  const day = data.days[index]
  const mood = day.emotionLevel === null ? null : moodLabel(day.emotionLevel)
  const tone = toneOf(day)
  const talks =
    data.conversations?.filter((item) => item.localDate === day.localDate) ?? []
  const x = point.x / 10
  return (
    <aside
      className={styles.dayCard}
      data-place={point.y < 200 ? 'below' : 'above'}
      data-edge={x < 22 ? 'start' : x > 78 ? 'end' : undefined}
      style={{ '--x': `${x}%`, '--y': `${point.y / 4}%` } as CSSProperties}
      aria-label={`Chi tiết ngày ${index + 1}`}
    >
      <div className={styles.cardHead}>
        <div>
          <div className={styles.cardDate}>
            Ngày {index + 1} • {dayMonth(day.localDate)}
          </div>
          <div className={styles.cardWeekday}>{weekdayOf(day.localDate)}</div>
        </div>
        <div
          className={styles.cardMood}
          style={
            tone ? { background: tone.soft, color: tone.color } : undefined
          }
        >
          {mood ? `${mood.label} (${day.emotionLevel}/5)` : 'Chưa ghi cảm xúc'}
        </div>
      </div>
      {talks.length > 0 && (
        <div className={styles.cardTalk}>
          <div className={styles.cardTalkLabel}>Trò chuyện cùng Mầm</div>
          {talks.map((talk) => (
            <div key={talk.id} className={styles.cardTalkTitle}>
              {talk.title ?? 'Một cuộc trò chuyện'}
            </div>
          ))}
        </div>
      )}
      <div className={styles.cardNote}>{compareText(data.days, index)}</div>
      <div className={styles.cardFacts}>
        <div>
          <Plus size={14} aria-hidden="true" />
          {day.supportCompleted ?? '–'} hoạt động đã làm
        </div>
        <div data-done={(day.journalEntries ?? 0) > 0 || undefined}>
          {day.journalEntries === null ? (
            'Nhật ký: –'
          ) : day.journalEntries > 0 ? (
            <>
              <Check size={14} aria-hidden="true" /> Đã viết nhật ký
            </>
          ) : (
            'Chưa ghi nhật ký'
          )}
        </div>
      </div>
    </aside>
  )
}

const LEGEND = ['GREAT', 'GOOD', 'OKAY', 'LOW', 'VERY_LOW'] as const

export function JourneyMap({ data }: Readonly<{ data: LookBack }>) {
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState(data.days.length - 1)
  const [preview, setPreview] = useState<number | null>(null)
  const [cardOpen, setCardOpen] = useState(false)
  // null until the client knows the preference: stay still until then.
  const still = useReducedMotion() ?? true
  const scrollRef = useRef<HTMLDivElement>(null)
  const ids = useId().replace(/[^a-zA-Z0-9_-]/g, '')

  // The road draws first; the latest day's card opens once it has arrived (at once when motion is reduced).
  useEffect(() => {
    const reduce =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true
    const timer = window.setTimeout(
      () => setCardOpen(true),
      reduce ? 0 : CARD_DELAY_MS,
    )
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const scroll = scrollRef.current
    if (scroll && window.matchMedia?.('(max-width: 560px)').matches)
      scroll.scrollLeft = filter === 'first' ? 0 : scroll.scrollWidth
  }, [filter])

  const points = useMemo(() => stationPoints(data.days), [data.days])
  const path = useMemo(() => roadPath(points), [points])
  const inFilter = (index: number) =>
    filter === 'all' || (filter === 'first' ? index < 7 : index >= 7)
  const range = (first: number, last: number) =>
    `${dayMonth(data.days[first].localDate)} - ${dayMonth(data.days[last].localDate)}`
  const weekMood = (week: 0 | 1) => {
    const average = data.weeks[week].moodAverage
    return average === null
      ? ''
      : `: cảm xúc trung bình ${moodLabel(average).label.toLowerCase()}`
  }
  const filters: ReadonlyArray<{ key: Filter; label: string; badge: string }> =
    [
      { key: 'all', label: 'Tất cả (14 ngày)', badge: '14 trạm' },
      { key: 'first', label: `Tuần 1 (${range(0, 6)})`, badge: 'Chặng 1' },
      { key: 'second', label: `Tuần 2 (${range(7, 13)})`, badge: 'Chặng 2' },
    ]
  const choose = (key: Filter) => {
    setFilter(key)
    setPreview(null)
    // Week 1 opens on its lightest day; the whole road and week 2 open on the latest day.
    if (key === 'first') {
      const week = data.days.slice(0, 7).map((day) => day.emotionLevel ?? 0)
      setSelected(week.indexOf(Math.max(...week)))
    } else setSelected(data.days.length - 1)
    setCardOpen(true)
  }
  const shown = preview ?? (cardOpen ? selected : null)
  const chosen = data.days.at(selected)
  const hasMissing = data.days.some((day) => day.emotionLevel === null)

  return (
    <section
      className={`${styles.mapSurface} ${styles.rise}`}
      style={{ '--d': '440ms' } as CSSProperties}
      aria-labelledby="look-back-mood"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setCardOpen(false)
          setPreview(null)
        }
      }}
    >
      <div className={styles.mapHead}>
        <div>
          <h2 id="look-back-mood" className={styles.h2}>
            Bản đồ hành trình cảm xúc{' '}
            <small aria-hidden="true">
              {filter === 'all' ? '14 trạm dừng' : '7 trạm dừng'}
            </small>
          </h2>
          <div className={styles.mapLead}>
            Rê chuột hoặc chạm vào từng trạm ngày để xem chi tiết khoảnh khắc đã
            trải qua.
          </div>
        </div>
        <div className={styles.legend} role="group" aria-label="Mức cảm xúc">
          {LEGEND.map((key) => (
            <div key={key}>
              <i style={{ background: moodTone[key].color }} />
              {emotionPresentation[key].label}
            </div>
          ))}
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
              data-week={item.key}
              onClick={() => choose(item.key)}
            >
              {item.label}
              <i className={styles.filterBadge}>{item.badge}</i>
            </button>
          ))}
        </div>
        <div className={styles.filterHint} role="status">
          <i data-week={filter} aria-hidden="true" />
          {filter === 'all'
            ? 'Đang hiển thị toàn cảnh 14 ngày của cả hai chặng'
            : filter === 'first'
              ? `Tập trung Chặng 1${weekMood(0)}`
              : `Tập trung Chặng 2${weekMood(1)}`}
        </div>
      </div>
      <div className={styles.mapWrap}>
        <div className={styles.mapScroll} ref={scrollRef}>
          <div
            className={styles.mapStage}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setCardOpen(false)
                setPreview(null)
              }
            }}
          >
            <div
              className={`${styles.zone} ${styles.zoneFirst}`}
              data-dim={filter === 'second' || undefined}
            >
              CHẶNG 1 • TUẦN 1 ({range(0, 6)})
            </div>
            <div
              className={`${styles.zone} ${styles.zoneSecond}`}
              data-dim={filter === 'first' || undefined}
            >
              CHẶNG 2 • TUẦN 2 ({range(7, 13)})
            </div>
            <svg
              viewBox="0 0 1000 400"
              role="img"
              aria-label="Biểu đồ cảm xúc theo từng ngày. Chọn các trạm ngày để xem mức cảm xúc."
              className={styles.road}
            >
              <defs>
                <linearGradient
                  id={`${ids}-road`}
                  gradientUnits="userSpaceOnUse"
                  x1="0"
                  x2="1000"
                  y1="0"
                  y2="0"
                >
                  {data.days.map((day, index) => {
                    const tone = toneOf(day)
                    return tone ? (
                      <stop
                        key={day.localDate}
                        offset={points[index].x / 1000}
                        stopColor={tone.color}
                      />
                    ) : null
                  })}
                </linearGradient>
                <filter
                  id={`${ids}-glow`}
                  x="-20%"
                  y="-20%"
                  width="140%"
                  height="140%"
                >
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <path d={path} className={styles.roadBase} />
              <path
                d={path}
                className={styles.roadLine}
                stroke={`url(#${ids}-road)`}
                filter={`url(#${ids}-glow)`}
              />
              <path d={path} className={styles.roadLane} />
              {!still && (
                <g className={styles.spark}>
                  <circle r="5" fill="#fff" filter={`url(#${ids}-glow)`}>
                    <animateMotion
                      dur="8s"
                      repeatCount="indefinite"
                      path={path}
                    />
                  </circle>
                  <circle r="2.6" fill="#D97706">
                    <animateMotion
                      dur="8s"
                      repeatCount="indefinite"
                      path={path}
                    />
                  </circle>
                </g>
              )}
            </svg>
            {data.days.map((day, index) => {
              const mood =
                day.emotionLevel === null ? null : moodLabel(day.emotionLevel)
              const talked =
                data.conversations?.some(
                  (item) => item.localDate === day.localDate,
                ) ?? false
              const notable =
                talked ||
                (day.supportCompleted ?? 0) > 0 ||
                day.emotionLevel === 1 ||
                day.emotionLevel === 5
              const active = inFilter(index)
              return (
                <button
                  key={day.localDate}
                  type="button"
                  className={`${styles.station} ${mood ? '' : styles.stationMissing}`}
                  data-dim={!active || undefined}
                  data-notable={notable || undefined}
                  style={
                    {
                      '--x': `${points[index].x / 10}%`,
                      '--y': `${points[index].y / 4}%`,
                      '--d': `${300 + index * 90}ms`,
                      '--station-color': toneOf(day)?.color ?? NO_MOOD,
                    } as CSSProperties
                  }
                  aria-label={`Ngày ${index + 1}, ${dayMonth(day.localDate)}: ${mood?.label ?? 'chưa ghi cảm xúc'}`}
                  aria-pressed={cardOpen && selected === index}
                  onClick={() => {
                    setSelected(index)
                    setPreview(null)
                    setCardOpen(true)
                  }}
                  // Mouse only: a tap would preview and select in one go and flicker.
                  onPointerEnter={(event) => {
                    if (event.pointerType === 'mouse') setPreview(index)
                  }}
                  onPointerLeave={() => setPreview(null)}
                  onFocus={() => setPreview(index)}
                  onBlur={() => setPreview(null)}
                >
                  {notable && (
                    <i className={styles.aura} aria-hidden="true">
                      <i />
                      <i />
                    </i>
                  )}
                  <i className={styles.stationDisk}>{index + 1}</i>
                  <i className={styles.stationDate}>
                    {dayMonth(day.localDate)}
                  </i>
                </button>
              )
            })}
          </div>
        </div>
        {/* Outside the scroller so it is never clipped; floats on the road when the whole road fits. */}
        {shown !== null && (
          <DayCard
            key={shown}
            data={data}
            index={shown}
            point={points[shown]}
          />
        )}
      </div>
      {/* Announces a chosen day only; hover and focus previews stay silent. */}
      <div className="sr-only" role="status">
        {cardOpen && chosen
          ? `Ngày ${selected + 1}, ${dayMonth(chosen.localDate)}: ${
              chosen.emotionLevel === null
                ? 'chưa ghi cảm xúc'
                : moodLabel(chosen.emotionLevel).label
            }`
          : ''}
      </div>
      <div className={styles.mapSwipe}>Vuốt ngang để xem các ngày còn lại.</div>
      <div className={styles.mapFoot}>
        <div>
          <i aria-hidden="true" />
          Trạm có vòng sóng là ngày có trò chuyện, hoạt động hỗ trợ hoặc cảm xúc
          nổi bật
        </div>
        <div>
          {hasMissing
            ? 'Độ cao của đường là mức cảm xúc bạn ghi; trạm viền đứt là ngày chưa ghi'
            : 'Độ cao của đường là mức cảm xúc bạn ghi'}
        </div>
      </div>
    </section>
  )
}
