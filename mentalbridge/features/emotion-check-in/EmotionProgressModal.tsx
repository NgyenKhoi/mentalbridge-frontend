'use client'

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

import { Dialog } from '@/components/ui/Dialog'
import { Skeleton } from '@/components/ui/Skeleton'
import type {
  Emotion,
  EmotionCheckIn,
  EmotionCheckInProgress,
  EmotionProgressWindow,
} from '@/lib/emotion-check-in/contract'

import {
  getEmotionCheckInProgress,
  listEmotionCheckIns,
} from './api/browser-emotion-check-in'
import styles from './EmotionProgressModal.module.css'

type Props = Readonly<{
  isOpen: boolean
  onClose: () => void
}>

type Period = 7 | 14 | 30
type ReadyState = Readonly<{
  phase: 'ready'
  progress: EmotionCheckInProgress
  history: EmotionCheckIn[]
}>
type State = Readonly<{ phase: 'loading' | 'error' }> | ReadyState

const periods = [7, 14, 30] as const
const emotions = ['GREAT', 'GOOD', 'OKAY', 'LOW', 'VERY_LOW'] as const

const emotionCopy: Record<
  Emotion,
  Readonly<{ emoji: string; label: string; color: string; background: string }>
> = {
  GREAT: {
    emoji: '🤩',
    label: 'Rất tốt',
    color: '#F5B942',
    background: '#FDF3DC',
  },
  GOOD: {
    emoji: '🙂',
    label: 'Tốt',
    color: '#3FB6A8',
    background: '#DDF3F0',
  },
  OKAY: {
    emoji: '😐',
    label: 'Bình thường',
    color: '#6C9BD2',
    background: '#E3EDF8',
  },
  LOW: {
    emoji: '😕',
    label: 'Không tốt',
    color: '#9D8CD6',
    background: '#EAE6F7',
  },
  VERY_LOW: {
    emoji: '😞',
    label: 'Rất không tốt',
    color: '#5B5FA8',
    background: '#DCDDF0',
  },
}

const localDateToOrdinal = (localDate: string) => {
  const [year, month, day] = localDate.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

const ordinalToLocalDate = (ordinal: number) =>
  new Date(ordinal * 86_400_000).toISOString().slice(0, 10)

const datesInWindow = (window: EmotionProgressWindow) => {
  const start = localDateToOrdinal(window.startLocalDate)
  const end = localDateToOrdinal(window.endLocalDate)
  return Array.from({ length: end - start + 1 }, (_, index) =>
    ordinalToLocalDate(start + index),
  )
}

const dateValue = (localDate: string) => new Date(`${localDate}T00:00:00.000Z`)

const fullDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  timeZone: 'UTC',
})
const accessibleDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})
const weekdayFormatter = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'short',
  timeZone: 'UTC',
})

const formatRangeDate = (localDate: string) => {
  const [, month, day] = localDate.split('-')
  return `${day}/${month}`
}
const formatFullDate = (localDate: string) => {
  const value = fullDateFormatter.format(dateValue(localDate))
  return value.charAt(0).toUpperCase() + value.slice(1)
}
const formatAccessibleDate = (localDate: string) => {
  const value = accessibleDateFormatter.format(dateValue(localDate))
  return value.charAt(0).toUpperCase() + value.slice(1)
}
const formatWeekday = (localDate: string) => {
  const value = weekdayFormatter.format(dateValue(localDate))
  return value.replace('Th ', 'T').replace('CN', 'CN')
}
const mondayColumn = (localDate: string) => {
  const sundayBased = dateValue(localDate).getUTCDay()
  return sundayBased === 0 ? 7 : sundayBased
}

const emotionStyle = (emotion: Emotion) =>
  ({
    '--emotion-color': emotionCopy[emotion].color,
    '--emotion-background': emotionCopy[emotion].background,
  }) as CSSProperties

function LineIcon({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  )
}

function IntensityDots({ value }: Readonly<{ value: number }>) {
  return (
    <span className={styles.intensityDots} aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <i key={index} data-filled={index < value ? 'true' : undefined} />
      ))}
    </span>
  )
}

function LoadingContent() {
  return (
    <div
      className={styles.loading}
      aria-busy="true"
      aria-label="Đang tải tiến trình cảm xúc"
    >
      <Skeleton className={styles.periodSkeleton} height={44} />
      <div className={styles.summaryGrid}>
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton
            key={index}
            className={styles.summarySkeleton}
            height={124}
          />
        ))}
      </div>
      <Skeleton className={styles.calendarSkeleton} height={176} />
      <Skeleton className={styles.sectionSkeleton} height={250} />
      <Skeleton className={styles.sectionSkeleton} height={280} />
    </div>
  )
}

function EmptyState() {
  return (
    <section
      className={styles.emptyState}
      aria-labelledby="emotion-empty-title"
    >
      <svg viewBox="0 0 150 112" aria-hidden="true">
        <path d="M25 30c18-8 34-5 50 6v57C59 82 43 79 25 87V30Z" />
        <path d="M125 30c-18-8-34-5-50 6v57c16-11 32-14 50-6V30Z" />
        <path d="M75 36v57" />
        <path d="M89 28c1-10 8-16 19-18-1 11-7 18-19 18Z" />
        <path d="M89 29c-7-8-15-10-24-7 5 9 13 12 24 7Z" />
        <path d="M89 28v16" />
      </svg>
      <h3 id="emotion-empty-title">Chưa có ghi nhận nào</h3>
      <p>Khi bạn ghi lại cảm xúc, chúng sẽ hiện ở đây.</p>
    </section>
  )
}

function ErrorState({ onRetry }: Readonly<{ onRetry: () => void }>) {
  return (
    <section className={styles.errorState} role="alert">
      <span aria-hidden="true">○</span>
      <h3>Không thể tải dữ liệu lúc này</h3>
      <p>Ghi nhận của bạn vẫn được giữ nguyên. Bạn có thể thử tải lại.</p>
      <button type="button" onClick={onRetry}>
        Thử lại
      </button>
    </section>
  )
}

function SummaryCards({
  progress,
  window,
}: Readonly<{
  progress: EmotionCheckInProgress
  window: EmotionProgressWindow
}>) {
  const current = progress.currentEmotion
  return (
    <section
      className={styles.summaryGrid}
      aria-label="Tổng quan ghi nhận cảm xúc"
    >
      <article className={styles.summaryCard}>
        <span className={styles.cardIcon}>
          <LineIcon>
            <circle cx="12" cy="12" r="8" />
            <path d="M8.5 14.5c2.2 2 4.8 2 7 0M9 9h.01M15 9h.01" />
          </LineIcon>
        </span>
        <p>Hôm nay</p>
        {current ? (
          <strong className={styles.currentEmotion}>
            <span aria-hidden="true">{emotionCopy[current].emoji}</span>
            {emotionCopy[current].label}
          </strong>
        ) : (
          <strong className={styles.notRecorded}>
            <i aria-hidden="true" />
            Chưa ghi nhận
          </strong>
        )}
      </article>

      <article className={styles.summaryCard}>
        <span className={styles.cardIcon}>
          <LineIcon>
            <path d="M7 7h10v10H7zM9.5 4v3M14.5 4v3M4 9.5h3M17 9.5h3" />
          </LineIcon>
        </span>
        <p>Chuỗi hiện tại</p>
        <strong>{progress.currentStreak} ngày</strong>
        {progress.currentStreak > 0 && current === null ? (
          <small>Chuỗi vẫn được giữ nếu hôm nay bạn chưa ghi.</small>
        ) : null}
      </article>

      <article className={styles.summaryCard}>
        <span className={styles.cardIcon}>
          <LineIcon>
            <path d="m6 15 4-4 3 3 5-6" />
            <path d="M14 8h4v4" />
          </LineIcon>
        </span>
        <p>Chuỗi dài nhất</p>
        <strong>{progress.longestStreak} ngày</strong>
      </article>

      <article className={styles.summaryCard}>
        <span className={styles.cardIcon}>
          <LineIcon>
            <path d="M5 6.5h14v12H5zM8 4v4M16 4v4M5 10h14" />
          </LineIcon>
        </span>
        <p>Đã ghi nhận</p>
        <strong>
          {window.checkedInDays}/{window.totalDays} ngày
        </strong>
        <span className={styles.coverageDots} aria-hidden="true">
          {Array.from({ length: window.totalDays }, (_, index) => (
            <i
              key={index}
              data-filled={index < window.checkedInDays ? 'true' : undefined}
            />
          ))}
        </span>
      </article>
    </section>
  )
}

function CalendarStrip({
  window,
  history,
  asOfLocalDate,
}: Readonly<{
  window: EmotionProgressWindow
  history: EmotionCheckIn[]
  asOfLocalDate: string
}>) {
  const [activeDate, setActiveDate] = useState<string | null>(null)
  const historyByDate = useMemo(
    () => new Map(history.map((item) => [item.localDate, item])),
    [history],
  )
  const dates = useMemo(() => datesInWindow(window), [window])

  return (
    <section
      className={styles.calendarSection}
      aria-labelledby="emotion-calendar-title"
    >
      <header className={styles.sectionHeader}>
        <div>
          <span>Nhìn lại từng ngày</span>
          <h3 id="emotion-calendar-title">Những cảm xúc bạn đã ghi nhận</h3>
        </div>
        <small>Mỗi ô là một ngày</small>
      </header>

      {window.checkedInDays === 0 ? (
        <p className={styles.periodEmptyNotice}>
          Không có ghi nhận nào trong {window.days} ngày này.
        </p>
      ) : null}

      <div
        className={`${styles.calendarGrid} ${styles[`period${window.days}`]}`}
      >
        {dates.map((localDate, index) => {
          const entry = historyByDate.get(localDate)
          const emotion = entry?.emotion
          const copy = emotion ? emotionCopy[emotion] : null
          const today = localDate === asOfLocalDate
          const visualDate = dateValue(localDate).getUTCDate()
          const ariaLabel = entry
            ? `${formatAccessibleDate(localDate)}, cảm xúc ${copy?.label}, mức cảm nhận ${entry.intensity} trên 5${today ? ', hôm nay' : ''}`
            : `${formatAccessibleDate(localDate)}, chưa ghi nhận${today ? ', hôm nay' : ''}`
          const placement =
            window.days === 30 && index === 0
              ? ({ gridColumnStart: mondayColumn(localDate) } as CSSProperties)
              : undefined

          return (
            <button
              type="button"
              key={localDate}
              className={`${styles.dayCell} ${entry ? styles.hasEmotion : styles.missingDay} ${today ? styles.today : ''}`}
              style={
                entry
                  ? ({
                      ...emotionStyle(entry.emotion),
                      ...placement,
                      '--cell-index': index,
                    } as CSSProperties)
                  : ({ ...placement, '--cell-index': index } as CSSProperties)
              }
              aria-label={ariaLabel}
              aria-pressed={activeDate === localDate}
              onFocus={() => setActiveDate(localDate)}
              onBlur={() => setActiveDate(null)}
              onMouseEnter={() => setActiveDate(localDate)}
              onMouseLeave={() => setActiveDate(null)}
              onClick={() => setActiveDate(localDate)}
            >
              <span className={styles.weekday}>{formatWeekday(localDate)}</span>
              <span className={styles.dayEmotion} aria-hidden="true">
                {copy?.emoji ?? '—'}
              </span>
              <span className={styles.dayNumber}>{visualDate}</span>
              {entry ? <IntensityDots value={entry.intensity} /> : null}
              {today ? (
                <small className={styles.todayLabel}>Hôm nay</small>
              ) : null}
              {activeDate === localDate ? (
                <span className={styles.dayPopover} aria-hidden="true">
                  {entry ? (
                    <>
                      <b>{formatFullDate(localDate)}</b>
                      <span>
                        {copy?.emoji} {copy?.label} · Mức cảm nhận{' '}
                        {entry.intensity}/5
                      </span>
                    </>
                  ) : (
                    <>
                      <b>{formatFullDate(localDate)}</b>
                      <span>Chưa ghi nhận</span>
                    </>
                  )}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className={styles.legend} aria-label="Chú giải cảm xúc">
        {emotions.map((emotion) => (
          <span key={emotion}>
            <i aria-hidden="true">{emotionCopy[emotion].emoji}</i>
            {emotionCopy[emotion].label}
          </span>
        ))}
        <span>
          <i className={styles.missingLegend} aria-hidden="true" />
          Chưa ghi nhận
        </span>
        <span className={styles.dotLegend}>
          <i aria-hidden="true">•••••</i>
          Chấm = mức cảm nhận của ngày đó
        </span>
      </div>
    </section>
  )
}

function Distribution({ window }: Readonly<{ window: EmotionProgressWindow }>) {
  return (
    <section
      className={styles.distribution}
      aria-labelledby="emotion-distribution-title"
    >
      <header className={styles.sectionHeader}>
        <div>
          <span>Phân bố trong kỳ</span>
          <h3 id="emotion-distribution-title">Các cảm xúc đã được ghi lại</h3>
        </div>
        <small>{window.checkedInDays} ngày có ghi nhận</small>
      </header>

      <div
        className={`${styles.segmentedBar} ${window.checkedInDays === 0 ? styles.segmentedBarEmpty : ''}`}
        role="img"
        aria-label={`Phân bố cảm xúc trong ${window.days} ngày`}
      >
        {window.checkedInDays > 0
          ? emotions.map((emotion) => {
              const count = window.distribution[emotion]
              if (count === 0) return null
              return (
                <i
                  key={emotion}
                  style={{
                    ...emotionStyle(emotion),
                    flexGrow: count,
                  }}
                  aria-hidden="true"
                />
              )
            })
          : null}
      </div>

      <ul className={styles.distributionList}>
        {emotions.map((emotion, index) => {
          const count = window.distribution[emotion]
          const percentage =
            window.checkedInDays === 0
              ? 0
              : Math.round((count / window.checkedInDays) * 100)
          return (
            <li
              key={emotion}
              style={
                {
                  ...emotionStyle(emotion),
                  '--row-index': index,
                } as CSSProperties
              }
            >
              <div className={styles.distributionLabel}>
                <i aria-hidden="true" />
                <span aria-hidden="true">{emotionCopy[emotion].emoji}</span>
                <b>{emotionCopy[emotion].label}</b>
              </div>
              <p>
                <strong>{count} ngày</strong>
                <small>{percentage}%</small>
              </p>
              <div
                className={styles.distributionMeter}
                role="meter"
                aria-label={`${emotionCopy[emotion].label}: ${count} ngày`}
                aria-valuemin={0}
                aria-valuemax={window.checkedInDays}
                aria-valuenow={count}
              >
                <i style={{ width: `${percentage}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function RecentHistory({ history }: Readonly<{ history: EmotionCheckIn[] }>) {
  const [expanded, setExpanded] = useState(false)
  const ordered = useMemo(
    () =>
      [...history].sort((left, right) =>
        right.localDate.localeCompare(left.localDate),
      ),
    [history],
  )
  const visible = expanded ? ordered : ordered.slice(0, 5)

  return (
    <section className={styles.history} aria-labelledby="emotion-history-title">
      <header className={styles.sectionHeader}>
        <div>
          <span>Gần đây</span>
          <h3 id="emotion-history-title">Lịch sử check-in</h3>
        </div>
        <small>Tối đa 30 ghi nhận gần nhất</small>
      </header>
      <ol
        className={`${styles.historyList} ${expanded ? styles.historyListExpanded : ''}`}
      >
        {visible.map((entry) => {
          const copy = emotionCopy[entry.emotion]
          return (
            <li key={entry.id} style={emotionStyle(entry.emotion)}>
              <span className={styles.historyEmoji} aria-hidden="true">
                {copy.emoji}
              </span>
              <p>
                <time dateTime={entry.localDate}>
                  {formatFullDate(entry.localDate)}
                </time>
                <span>{copy.label}</span>
              </p>
              <div className={styles.historyIntensity}>
                <IntensityDots value={entry.intensity} />
                <b>{entry.intensity}/5</b>
              </div>
            </li>
          )
        })}
      </ol>
      {ordered.length > 5 ? (
        <button
          className={styles.expandHistory}
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Thu gọn' : `Xem thêm ${ordered.length - 5} ghi nhận`}
        </button>
      ) : null}
    </section>
  )
}

export default function EmotionProgressModal({ isOpen, onClose }: Props) {
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    [],
  )
  const [period, setPeriod] = useState<Period>(7)
  const [retry, setRetry] = useState(0)
  const [state, setState] = useState<State>({ phase: 'loading' })

  useEffect(() => {
    if (!isOpen) return
    let active = true
    Promise.all([getEmotionCheckInProgress(timezone), listEmotionCheckIns(30)])
      .then(([progress, history]) => {
        if (active)
          setState({ phase: 'ready', progress, history: history.items })
      })
      .catch(() => {
        if (active) setState({ phase: 'error' })
      })
    return () => {
      active = false
    }
  }, [isOpen, retry, timezone])

  const ready = state.phase === 'ready' ? state : null
  const window = ready?.progress.windows.find((item) => item.days === period)
  const noHistory = ready?.history.length === 0
  const close = () => {
    setPeriod(7)
    setState({ phase: 'loading' })
    onClose()
  }

  return (
    <Dialog
      className={styles.dialog}
      open={isOpen}
      onOpenChange={(open) => !open && close()}
      labelledBy="emotion-progress-title"
      describedBy="emotion-progress-description"
    >
      <article className={styles.modal}>
        <header className={styles.modalHeader}>
          <div>
            <h2 id="emotion-progress-title">Tiến trình cảm xúc</h2>
            <p id="emotion-progress-description">
              {ready
                ? `Dữ liệu tính đến ${formatRangeDate(ready.progress.asOfLocalDate)} · Múi giờ ${ready.progress.timezone}`
                : 'Nhìn lại những cảm xúc bạn đã tự ghi nhận.'}
            </p>
          </div>
          <button type="button" aria-label="Đóng" onClick={close}>
            <LineIcon>
              <path d="m7 7 10 10M17 7 7 17" />
            </LineIcon>
          </button>
        </header>

        <div className={styles.scrollBody}>
          {state.phase === 'loading' ? <LoadingContent /> : null}
          {state.phase === 'error' ? (
            <ErrorState
              onRetry={() => {
                setState({ phase: 'loading' })
                setRetry((value) => value + 1)
              }}
            />
          ) : null}
          {ready ? (
            <>
              <nav className={styles.periodBlock} aria-label="Khoảng thời gian">
                <div className={styles.periodTabs}>
                  {periods.map((days) => (
                    <button
                      key={days}
                      type="button"
                      aria-pressed={period === days}
                      onClick={() => setPeriod(days)}
                    >
                      {days} ngày
                    </button>
                  ))}
                </div>
                {window ? (
                  <p>
                    {formatRangeDate(window.startLocalDate)} –{' '}
                    {formatRangeDate(window.endLocalDate)}
                  </p>
                ) : null}
              </nav>

              {noHistory ? (
                <EmptyState />
              ) : window ? (
                <div className={styles.content} key={period}>
                  <SummaryCards progress={ready.progress} window={window} />
                  <CalendarStrip
                    window={window}
                    history={ready.history}
                    asOfLocalDate={ready.progress.asOfLocalDate}
                  />
                  <Distribution window={window} />
                  <RecentHistory history={ready.history} />
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <footer className={styles.footer}>
          <button type="button" onClick={close}>
            Đóng
          </button>
          {state.phase !== 'error' ? (
            <Link
              href="/dashboard#emotion-check-in"
              className={
                ready?.progress.currentEmotion ? styles.secondaryCta : undefined
              }
            >
              {ready?.progress.currentEmotion
                ? 'Cập nhật cảm xúc hôm nay'
                : 'Ghi lại cảm xúc hôm nay'}
            </Link>
          ) : null}
        </footer>
      </article>
    </Dialog>
  )
}
