'use client'

import { ArrowRight, Heart, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type Ref,
} from 'react'

import { Skeleton } from '@/components/ui/Skeleton'
import { levelLabels } from '@/features/assessment/components/assessment-meanings'

import { getLookBack } from './browser-look-back'
import { ChapterSection, type LookBackChapterRef } from './ChapterSection'
import { JourneyStrip } from './JourneyStrip'
import {
  defaultClosedChapter,
  hasHardNews,
  pickableChapters,
  type LookBackJourney,
} from './look-back-chapters'
import {
  dateRange,
  dayMonth,
  dimensionLabel,
  moodLabel,
  moodTone,
  narrativeCopy,
  nextStepAction,
} from './look-back-copy'
import type { LookBack } from './look-back-model'
import { useMamSuppress } from '@/features/mam/mam-suppression'
import { JourneyMap } from './JourneyMap'
import styles from './LookBack.module.css'

type State =
  | Readonly<{ phase: 'loading' }>
  | Readonly<{ phase: 'error' }>
  | Readonly<{ phase: 'ready'; data: LookBack }>

const VISIBLE_CONVERSATIONS = 2
const count = (value: number | null) => value ?? '–'
// Staggered entrance in reading order, matching the approved reference.
const rise = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

function Stat({
  label,
  first,
  second,
  caption,
  index,
}: Readonly<{
  label: string
  first: number | null
  second: number | null
  caption: string
  index: number
}>) {
  const lower = first !== null && second !== null && second < first
  return (
    <div
      className={`${styles.stat} ${styles.rise}`}
      style={rise(200 + index * 60)}
    >
      <dt className={styles.statLabel}>{label}</dt>
      <dd className={styles.pair}>
        <div className={styles.num}>{count(first)}</div>
        <div className={styles.arrow} aria-hidden="true">
          →
        </div>
        <div className={styles.num} data-lower={lower || undefined}>
          {count(second)}
        </div>
      </dd>
      <dd className={styles.caption}>{caption}</dd>
    </div>
  )
}

function Stats({ data }: Readonly<{ data: LookBack }>) {
  const [a, b] = data.weeks
  const skipped = (a.supportSkipped ?? 0) > 0 || (b.supportSkipped ?? 0) > 0
  const checkIns =
    a.checkInDays !== null && b.checkInDays !== null
      ? `Duy trì đều đặn ${a.checkInDays + b.checkInDays}/${data.days.length} ngày`
      : 'Tuần 1 → Tuần 2'
  return (
    <dl className={styles.stats}>
      <Stat
        label="Ngày viết nhật ký"
        first={a.journalDays}
        second={b.journalDays}
        caption="Tuần 1 → Tuần 2"
        index={0}
      />
      <Stat
        label="Hoạt động hỗ trợ đã làm"
        first={a.supportCompleted}
        second={b.supportCompleted}
        caption={
          skipped
            ? `Tuần 1 → Tuần 2 · Bỏ qua: ${count(a.supportSkipped)} → ${count(b.supportSkipped)}`
            : 'Tuần 1 → Tuần 2'
        }
        index={1}
      />
      <Stat
        label="Ngày ghi cảm xúc"
        first={a.checkInDays}
        second={b.checkInDays}
        caption={checkIns}
        index={2}
      />
      <div className={`${styles.stat} ${styles.rise}`} style={rise(380)}>
        <dt className={styles.statLabel}>Hỗ trợ chuyên gia</dt>
        <dd className={styles.pair}>
          <div className={styles.num}>{count(data.completedSessions)}</div>
          <div className={styles.unit}>buổi tư vấn đã diễn ra</div>
        </dd>
        <dd className={styles.caption} data-dot>
          Trong {data.days.length} ngày qua
        </dd>
      </div>
    </dl>
  )
}

function Conversations({
  items,
  days,
}: Readonly<{
  items: NonNullable<LookBack['conversations']>
  days: LookBack['days']
}>) {
  const row = (item: (typeof items)[number]) => {
    const level = days.find(
      (day) => day.localDate === item.localDate,
    )?.emotionLevel
    const mood = level == null ? null : moodLabel(level)
    const tone = mood ? moodTone[mood.key] : null
    return (
      <li key={item.id} className={styles.talkItem}>
        <time
          className={styles.talkDate}
          dateTime={item.localDate}
          style={
            tone ? { background: tone.soft, color: tone.color } : undefined
          }
        >
          {dayMonth(item.localDate).slice(0, 2)}
        </time>
        <div className={styles.talkBody}>
          <div className={styles.talkTitle}>
            {item.title ?? 'Một cuộc trò chuyện'}
          </div>
          <div className={styles.talkMeta}>
            {dayMonth(item.localDate)} • Trò chuyện cùng Mầm
          </div>
        </div>
        {mood && tone && (
          <div
            className={styles.talkMood}
            style={{ background: tone.soft, color: tone.color }}
          >
            {mood.label}
          </div>
        )}
      </li>
    )
  }
  const more = items.slice(VISIBLE_CONVERSATIONS)
  return (
    <>
      <ol className={styles.timeline}>
        {items.slice(0, VISIBLE_CONVERSATIONS).map(row)}
      </ol>
      {more.length > 0 && (
        <details className={styles.more}>
          <summary>Xem thêm {more.length} cuộc trò chuyện</summary>
          <ol className={styles.timeline}>{more.map(row)}</ol>
        </details>
      )}
    </>
  )
}

function Screening({ data }: Readonly<{ data: LookBack }>) {
  const band = (level: keyof typeof levelLabels) =>
    `Mức ${levelLabels[level].toLowerCase()}`
  return (
    // Clinical result: it reads still, with no entrance and no celebration.
    <section
      className={styles.block}
      aria-labelledby="look-back-screening"
      data-page-motion="off"
    >
      <h2 id="look-back-screening" className={styles.h2}>
        Kết quả tự đánh giá
      </h2>
      <ul className={styles.bands}>
        {data.screening.map((item) => (
          <li key={item.instrument} className={styles.band}>
            <div className={styles.statLabel}>
              {dimensionLabel[item.instrument].plain}
            </div>
            <div className={styles.transition}>
              {item.direction === 'SAME'
                ? `${band(item.current.level)}, giữ nguyên`
                : `${band(item.previous.level)} → ${band(item.current.level)}`}
            </div>
          </li>
        ))}
      </ul>
      <details className={styles.more}>
        <summary>Xem chi tiết điểm</summary>
        <ul className={styles.details}>
          {data.screening.map((item) => (
            <li key={item.instrument}>
              {dimensionLabel[item.instrument].name}: {item.previous.score} →{' '}
              {item.current.score} điểm
              {item.previous.localDate && item.current.localDate
                ? ` (${dayMonth(item.previous.localDate)} → ${dayMonth(item.current.localDate)})`
                : ''}
            </li>
          ))}
        </ul>
      </details>
      {data.professionalPointer && (
        <div className={styles.pointer}>
          <div>
            Muốn được giải thích rõ hơn về kết quả? Bạn có thể trao đổi với
            chuyên gia.
          </div>
          <Link className={styles.quiet} href="/specialists">
            Tìm chuyên gia
          </Link>
        </div>
      )}
    </section>
  )
}

function WeekMood({
  label,
  average,
}: Readonly<{ label: string; average: number }>) {
  const mood = moodLabel(average)
  return (
    <div>
      <small>{label}</small>
      <strong style={{ color: moodTone[mood.key].color }}>
        {mood.label} ({average.toFixed(1)}/5)
      </strong>
    </div>
  )
}

function Header({
  headingRef,
}: Readonly<{ headingRef: Ref<HTMLHeadingElement> }>) {
  return (
    <header
      data-user-page-header
      className={`${styles.header} ${styles.rise}`}
      style={rise(50)}
    >
      <div data-user-page-heading>
        <div
          className={
            styles.kicker
          } /* taste-skill-ignore: approved MB-898 Stitch header */
        >
          <i aria-hidden="true" />
          Báo cáo sức khỏe tinh thần
        </div>
        <h1 ref={headingRef} tabIndex={-1}>
          Nhìn lại hành trình
        </h1>
        <p>
          Mỗi chặng là một kế hoạch 14 ngày, khép lại bằng một lần đánh giá lại.
        </p>
      </div>
    </header>
  )
}

/** The window being looked at (the running chapter's days so far, or the last 14), with its two-week mood. */
function WindowHead({
  data,
  title,
  note,
  action,
}: Readonly<{
  data: LookBack
  title: string
  note?: string
  action?: { label: string; href: string }
}>) {
  const [first, second] = data.weeks
  return (
    <div className={`${styles.windowHead} ${styles.rise}`} style={rise(100)}>
      <div>
        <h2 className={styles.windowTitle}>{title}</h2>
        <p className={styles.windowDates}>
          {dayMonth(data.startLocalDate)}/{data.startLocalDate.slice(0, 4)} —{' '}
          {dayMonth(data.asOfLocalDate)}/{data.asOfLocalDate.slice(0, 4)}
          {note ? ` · ${note}` : ''}
        </p>
      </div>
      {first.moodAverage != null && second.moodAverage != null && (
        <div
          className={styles.weekBadge}
          aria-label="Mức cảm xúc trung bình hai tuần"
        >
          <WeekMood label="Tuần 1" average={first.moodAverage} />
          <WeekMood label="Tuần 2" average={second.moodAverage} />
        </div>
      )}
      {action && (
        <Link className={styles.primary} href={action.href}>
          {action.label} <ArrowRight aria-hidden="true" size={18} />
        </Link>
      )}
    </div>
  )
}

const RUNNING = 'running'

type Tab = Readonly<{ id: string; name: string; sub: string }>

/** One tab per chặng, oldest left; manual activation (arrows move focus, Enter or Space picks) so arrowing never fetches. */
function ChapterTabs({
  tabs,
  active,
  panelId,
  onSelect,
}: Readonly<{
  tabs: readonly Tab[]
  active: string | null
  panelId: string
  onSelect: (id: string) => void
}>) {
  const list = useRef<HTMLDivElement>(null)
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]'),
    ]
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const target = {
      ArrowRight: (at + 1) % buttons.length,
      ArrowLeft: (at - 1 + buttons.length) % buttons.length,
      Home: 0,
      End: buttons.length - 1,
    }[event.key]
    if (at < 0 || target === undefined) return
    event.preventDefault()
    buttons[target].focus()
  }
  // The chosen chặng may sit off-screen in the scroll row (375px): bring it to the middle once.
  useEffect(() => {
    const row = list.current
    const tab = row?.querySelector<HTMLElement>('[aria-selected=true]')
    if (row && tab)
      row.scrollTo?.({
        left: tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2,
      })
  }, [])
  return (
    <div
      ref={list}
      className={`${styles.chapterTabs} ${styles.rise}`}
      style={rise(80)}
      role="tablist"
      aria-label="Chọn chặng"
      onKeyDown={move}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          id={`${panelId}-${tab.id}`}
          type="button"
          role="tab"
          className={styles.chapterTab}
          aria-selected={tab.id === active}
          aria-controls={panelId}
          tabIndex={tab.id === active ? 0 : -1}
          onClick={() => onSelect(tab.id)}
        >
          <strong>{tab.name}</strong>
          <small>{tab.sub}</small>
        </button>
      ))}
    </div>
  )
}

function ErrorBlock({ onRetry }: Readonly<{ onRetry: () => void }>) {
  const errorId = useId()
  return (
    <section className={styles.block} aria-labelledby={errorId}>
      <h2 id={errorId} className={styles.h2}>
        Chưa tải được phần nhìn lại
      </h2>
      <p className={styles.lead} role="alert">
        Bạn thử lại sau một chút nhé.
      </p>
      <button type="button" className={styles.primary} onClick={onRetry}>
        Thử lại
      </button>
    </section>
  )
}

function Ready({
  journey,
  data,
  shownId,
  phase,
  active,
  onSelect,
  onRetry,
}: Readonly<{
  journey: LookBackJourney | null
  /** The look-back on screen: the picked chặng's, or the previous one (dimmed) while the pick loads; null before any. */
  data: LookBack | null
  /** The chặng `data` belongs to. */
  shownId: string | null
  phase: State['phase']
  active: string | null
  onSelect: (id: string) => void
  onRetry: () => void
}>) {
  const panelId = useId()
  const chapters = pickableChapters(journey)
  const running = journey?.running
  const closed = journey?.closedAwaitingChoice
    ? journey.chapters.at(-1)
    : undefined
  const stale = phase === 'loading' && data !== null
  const chapter = chapters.find((item) => item.summaryId === shownId)
  const tabs: Tab[] = [
    ...chapters.map((item) => ({
      id: item.summaryId,
      name: `Chặng ${item.number}`,
      sub: dateRange(item.startLocalDate, item.endLocalDate),
    })),
    ...(running
      ? [{ id: RUNNING, name: `Chặng ${running.number}`, sub: 'đang diễn ra' }]
      : []),
  ]
  const tabbed = tabs.length > 1
  const label = tabs.find((tab) => tab.id === active)?.name.toLowerCase()
  // Polite status for the swap: the old chặng stays on screen until the new one arrives.
  const [status, setStatus] = useState('')
  const switched = useRef(false)
  useEffect(() => {
    if (!switched.current) {
      switched.current = true
      return
    }
    setStatus(
      phase === 'loading'
        ? `Đang tải ${label}…`
        : phase === 'ready'
          ? `Đã mở ${label}`
          : '',
    )
  }, [active, phase, label])
  const runningActive = running && shownId === RUNNING
  // The chặng the questions belong to; the rolling 14 days belong to none.
  const chapterRef: LookBackChapterRef | null = runningActive
    ? {
        start: running.startLocalDate,
        end: null,
        closed: false,
        day: running.currentDay,
      }
    : chapter
      ? {
          start: chapter.startLocalDate,
          end: chapter.endLocalDate,
          closed: true,
          day: 14,
        }
      : null
  // The override belongs to the chặng it concerns: the newest closed one, or the running one.
  const pending =
    closed && shownId === closed.summaryId
      ? {
          label: 'Chọn kế hoạch tiếp theo',
          href: '/support-plan?review=open',
          title: 'Chọn kế hoạch cho chặng tiếp theo',
          body: 'Chặng vừa rồi đã khép lại với lần đánh giá mới. Bạn chọn giữ nguyên kế hoạch, điều chỉnh hay lập kế hoạch mới.',
        }
      : runningActive && running.state === 'REVIEW_DUE'
        ? {
            label: 'Làm bài đánh giá lại',
            href: '/initial-check?purpose=reassessment',
            title: 'Khép lại chặng này',
            body: 'Đã đủ 14 ngày. Làm bài đánh giá lại để xem chặng vừa qua và chọn kế hoạch tiếp theo.',
          }
        : undefined
  return (
    <>
      {closed && (
        <section
          className={`${styles.closedBanner} ${styles.rise}`}
          style={rise(60)}
          aria-labelledby="look-back-closed"
        >
          <div>
            <h2 id="look-back-closed" className={styles.bannerTitle}>
              Chặng {closed.number} đã khép lại
            </h2>
          </div>
        </section>
      )}
      {tabbed && (
        <ChapterTabs
          tabs={tabs}
          active={active}
          panelId={panelId}
          onSelect={onSelect}
        />
      )}
      <div role="status" className="sr-only">
        {status}
      </div>
      <div
        id={panelId}
        className={`${styles.panel} ${stale ? styles.panelStale : ''}`}
        role={tabbed ? 'tabpanel' : undefined}
        aria-labelledby={tabbed && active ? `${panelId}-${active}` : undefined}
        aria-busy={phase === 'loading'}
      >
        {phase === 'error' ? (
          <ErrorBlock onRetry={onRetry} />
        ) : !data ? (
          <Loading />
        ) : (
          // Keyed by chặng: the road and its week tabs start over for the chặng picked.
          <Fragment key={shownId ?? 'rolling'}>
            <WindowHead
              data={data}
              title={
                runningActive
                  ? `Chặng ${running.number} · ngày ${running.currentDay}/${running.lengthDays}`
                  : chapter
                    ? `Chặng ${chapter.number}`
                    : '14 ngày gần đây'
              }
              note={
                runningActive && running.state === 'PAUSED'
                  ? 'đang tạm dừng'
                  : chapter
                    ? 'đã khép lại'
                    : undefined
              }
              action={
                runningActive && running.state === 'REVIEW_DUE'
                  ? {
                      label: 'Làm bài đánh giá lại để khép chặng này',
                      href: '/initial-check?purpose=reassessment',
                    }
                  : undefined
              }
            />
            <Window data={data} pending={pending} chapter={chapterRef} />
          </Fragment>
        )}
      </div>
      {journey && journey.chapters.length > 0 && (
        <JourneyStrip journey={journey} />
      )}
      <p className={styles.note}>
        Số liệu do bạn tự ghi lại; xu hướng và điều cùng xuất hiện không phải
        chẩn đoán hay nguyên nhân.
      </p>
    </>
  )
}

function Window({
  data,
  pending,
  chapter,
}: Readonly<{
  data: LookBack
  chapter: LookBackChapterRef | null
  /** A step the cycle is waiting for outranks the generic next step. */
  pending?: {
    label: string
    href: string
    title: string
    body: string
  }
}>) {
  const next = pending ?? nextStepAction[data.nextStep]
  const narrative = data.narrative
  // Mood-based sections need a readable, non-sparse mood; the screening result does not.
  const hasMood = narrative !== 'SPARSE' && narrative !== 'UNKNOWN'
  return (
    <>
      {narrative !== 'UNKNOWN' && (
        <section
          className={`${styles.voice} ${styles.rise}`}
          style={rise(140)}
          aria-label="Mầm nhắn bạn"
        >
          <div className={styles.voiceIcon}>
            <Heart size={20} aria-hidden="true" />
          </div>
          <div className={styles.narrative}>{narrativeCopy[narrative]}</div>
          <div className={styles.voiceByline}>
            Lời nhắn ấm áp từ Mầm • Người bạn đồng hành của bạn
          </div>
        </section>
      )}
      {/* Always mounted so a screen reader hears the note when it arrives. */}
      <div role="status" className={styles.live}>
        {data.partial && (
          <p className={styles.note}>Một phần dữ liệu chưa tải được.</p>
        )}
      </div>
      {narrative !== 'SPARSE' && (
        <>
          <ChapterSection data={data} chapter={chapter} />
          <Stats data={data} />
          {hasMood && <JourneyMap data={data} />}
        </>
      )}
      <div className={styles.bottomGrid}>
        {!!data.conversations?.length && narrative !== 'SPARSE' && (
          <section
            className={`${styles.conversations} ${styles.rise}`}
            style={rise(520)}
            aria-labelledby="look-back-talk"
          >
            <div className={styles.conversationHead}>
              <h2 id="look-back-talk" className={styles.h2}>
                <i className={styles.talkIcon} aria-hidden="true">
                  <MessageCircle size={16} />
                </i>
                Bạn đã trò chuyện với Mầm về
              </h2>
              <div className={styles.conversationRecent}>Gần đây nhất</div>
            </div>
            <Conversations items={data.conversations} days={data.days} />
            <div className={styles.conversationFoot}>
              <div>
                Những cuộc trò chuyện bạn đã ghi lại trong {data.days.length}{' '}
                ngày qua.
              </div>
              <Link className={styles.footLink} href="/ai-companion">
                Chi tiết →
              </Link>
            </div>
          </section>
        )}
        <section
          className={`${styles.next} ${styles.rise}`}
          style={rise(600)}
          aria-label="Bước tiếp theo"
        >
          <div className={styles.nextGlow} aria-hidden="true" />
          <div className={styles.nextText}>
            <div className={styles.nextKicker}>Bước tiếp theo</div>
            <div className={styles.nextTitle} role="heading" aria-level={2}>
              {pending
                ? pending.title
                : data.nextStep === 'SUPPORT'
                  ? 'Cân bằng lại cùng sự hỗ trợ phù hợp'
                  : data.nextStep === 'CHECK_IN'
                    ? 'Bắt đầu từ một ghi nhận nhỏ'
                    : 'Tiếp tục nhịp chăm sóc của bạn'}
            </div>
            <div className={styles.nextBody}>
              {pending
                ? pending.body
                : data.nextStep === 'SUPPORT'
                  ? 'Bạn có thể xem lại hướng hỗ trợ và trò chuyện với chuyên gia khi cần.'
                  : data.nextStep === 'CHECK_IN'
                    ? 'Ghi lại cảm xúc hôm nay để lần sau nhìn lại rõ hơn.'
                    : 'Một bước nhỏ hôm nay cũng là một phần trong hành trình của bạn.'}
            </div>
          </div>
          <div className={styles.nextAction}>
            <Link className={styles.primary} href={next.href}>
              {next.label} <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </div>
        </section>
      </div>
      {data.screening.length > 0 && <Screening data={data} />}
    </>
  )
}

function Loading() {
  return (
    <>
      <div className={styles.voice}>
        <Skeleton width="min(100%, 560px)" height="22px" />
        <Skeleton width="min(100%, 420px)" height="22px" />
      </div>
      <div className={styles.block}>
        <Skeleton width="160px" height="20px" />
        <Skeleton width="100%" height="180px" />
      </div>
      <div className={styles.block}>
        <Skeleton width="200px" height="20px" />
        <Skeleton width="100%" height="120px" />
      </div>
      <div role="status" className="sr-only">
        Đang tải phần nhìn lại…
      </div>
    </>
  )
}

type Selection = Readonly<{ id: string; from: string; to: string }>

export function LookBackPage() {
  const [state, setState] = useState<State>({ phase: 'loading' })
  const [attempt, setAttempt] = useState(0)
  // null = the default view the first load returned; otherwise another closed chặng, fetched by its dates.
  const [selection, setSelection] = useState<Selection | null>(null)
  const [other, setOther] = useState<State>({ phase: 'loading' })
  const [otherAttempt, setOtherAttempt] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const journey = state.phase === 'ready' ? state.data.journey : null
  const shown = selection ? other : state
  // A pick keeps the previous chặng on screen (dimmed) until its own data arrives.
  const [content, setContent] = useState<{
    id: string | null
    data: LookBack
  } | null>(null)
  // The chặng on screen: the picked one, else the running one, else the newest closed (what the first load shows).
  const defaultId = journey?.running
    ? RUNNING
    : (defaultClosedChapter(journey)?.summaryId ?? null)
  const active = selection?.id ?? defaultId
  if (shown.phase === 'ready' && content?.data !== shown.data)
    setContent({ id: active, data: shown.data })
  const data = shown.phase === 'error' ? null : (content?.data ?? null)
  // No celebration, queued award or welcome while loading or beside hard news (host gates honour this zone).
  const newest = journey?.chapters.at(-1)
  const looked = journey?.chapters.find((item) => item.summaryId === active)
  useMamSuppress(
    data === null ||
      data.professionalPointer ||
      data.narrative === 'HARDER' ||
      (newest !== undefined && hasHardNews(newest)) ||
      (looked !== undefined && hasHardNews(looked)),
  )
  // After "Thử lại" the button disappears: keep focus on the page title.
  useEffect(() => {
    if (attempt > 0) headingRef.current?.focus()
  }, [attempt])

  useEffect(() => {
    const controller = new AbortController()
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    getLookBack(timezone, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setState({ phase: 'ready', data })
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ phase: 'error' })
      })
    return () => controller.abort()
  }, [attempt])

  useEffect(() => {
    if (!selection) return
    const controller = new AbortController()
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    getLookBack(timezone, controller.signal, {
      from: selection.from,
      to: selection.to,
    })
      .then((data) => {
        if (controller.signal.aborted) return
        setOther({ phase: 'ready', data })
      })
      .catch(() => {
        if (!controller.signal.aborted) setOther({ phase: 'error' })
      })
    return () => controller.abort()
  }, [selection, otherAttempt])

  const select = (id: string) => {
    if (id === active) return
    const chapter = pickableChapters(journey).find(
      (item) => item.summaryId === id,
    )
    // The default chặng is already loaded; any other is fetched by its own dates.
    if (id === defaultId || !chapter) return setSelection(null)
    setOther({ phase: 'loading' })
    setSelection({
      id,
      from: chapter.startLocalDate,
      to: chapter.endLocalDate,
    })
  }

  return (
    // The page owns its entrance (it plays when the data arrives), so the shell's page entrance stays off.
    <div
      className={styles.page}
      aria-busy={shown.phase === 'loading'}
      data-page-motion="off"
    >
      <Header headingRef={headingRef} />
      {state.phase === 'loading' ? (
        <Loading />
      ) : state.phase === 'error' ? (
        <ErrorBlock
          onRetry={() => {
            setState({ phase: 'loading' })
            setSelection(null)
            setAttempt((value) => value + 1)
          }}
        />
      ) : (
        <Ready
          journey={state.data.journey}
          data={data}
          shownId={content?.id ?? null}
          phase={shown.phase}
          active={active}
          onSelect={select}
          onRetry={() => {
            setOther({ phase: 'loading' })
            setOtherAttempt((value) => value + 1)
          }}
        />
      )}
    </div>
  )
}
