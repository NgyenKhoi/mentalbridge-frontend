'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from 'react'

import { Skeleton } from '@/components/ui/Skeleton'
import { levelLabels } from '@/features/assessment/components/assessment-meanings'

import { getLookBack } from './browser-look-back'
import {
  dayMonth,
  dimensionLabel,
  moodComparison,
  narrativeCopy,
  nextStepAction,
} from './look-back-copy'
import type { LookBack } from './look-back-model'
import { useMamSuppress } from '@/features/mam/mam-suppression'
import { MoodChart } from './MoodChart'
import styles from './LookBack.module.css'

type State =
  | Readonly<{ phase: 'loading' }>
  | Readonly<{ phase: 'error' }>
  | Readonly<{ phase: 'ready'; data: LookBack }>

const VISIBLE_CONVERSATIONS = 6
const count = (value: number | null) => value ?? '–'

function Pair({
  first,
  second,
  index,
}: Readonly<{ first: number | null; second: number | null; index: number }>) {
  const value = (amount: number | null, caption: string) => (
    <div className={styles.value}>
      <div
        key={amount}
        className={styles.num}
        style={{ '--i': index } as CSSProperties}
      >
        {count(amount)}
      </div>
      <div className={styles.caption}>{caption}</div>
    </div>
  )
  return (
    <>
      {value(first, 'Tuần 1')}
      <div className={styles.arrow} aria-hidden="true">
        →
      </div>
      {value(second, 'Tuần 2')}
    </>
  )
}

function Stats({ data }: Readonly<{ data: LookBack }>) {
  const [a, b] = data.weeks
  const skipped = (a.supportSkipped ?? 0) > 0 || (b.supportSkipped ?? 0) > 0
  return (
    <dl className={styles.stats}>
      <div className={styles.stat}>
        <dt className={styles.statLabel}>Ngày viết nhật ký</dt>
        <dd className={styles.pair}>
          <Pair first={a.journalDays} second={b.journalDays} index={0} />
        </dd>
      </div>
      <div className={styles.stat}>
        <dt className={styles.statLabel}>
          Hoạt động hỗ trợ đã làm
          {skipped && (
            <span className={styles.secondary}>
              Bỏ qua: {count(a.supportSkipped)} → {count(b.supportSkipped)}
            </span>
          )}
        </dt>
        <dd className={styles.pair}>
          <Pair
            first={a.supportCompleted}
            second={b.supportCompleted}
            index={1}
          />
        </dd>
      </div>
      <div className={styles.stat}>
        <dt className={styles.statLabel}>Ngày ghi cảm xúc</dt>
        <dd className={styles.pair}>
          <Pair first={a.checkInDays} second={b.checkInDays} index={2} />
        </dd>
      </div>
    </dl>
  )
}

function Conversations({
  items,
}: Readonly<{ items: NonNullable<LookBack['conversations']> }>) {
  const row = (item: (typeof items)[number]) => (
    <li key={item.id} className={styles.talkItem}>
      <time className={styles.talkDate} dateTime={item.localDate}>
        {dayMonth(item.localDate)}
      </time>
      <div className={styles.talkTitle}>
        {item.title ?? 'Một cuộc trò chuyện'}
      </div>
    </li>
  )
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
              {item.current.score} điểm ({dayMonth(item.previous.localDate)} →{' '}
              {dayMonth(item.current.localDate)})
            </li>
          ))}
        </ul>
        <p className={styles.note}>
          Đây là kết quả sàng lọc từ câu trả lời của bạn, không phải chẩn đoán.
        </p>
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

function Header({
  headingRef,
}: Readonly<{ headingRef: Ref<HTMLHeadingElement> }>) {
  return (
    <header data-user-page-header>
      <div data-user-page-heading>
        <h1 ref={headingRef} tabIndex={-1}>
          Hành trình 14 ngày của bạn
        </h1>
      </div>
    </header>
  )
}

function Ready({ data }: Readonly<{ data: LookBack }>) {
  const next = nextStepAction[data.nextStep]
  const narrative = data.narrative
  // Mood-based sections need a readable, non-sparse mood; the screening result does not.
  const hasMood = narrative !== 'SPARSE' && narrative !== 'UNKNOWN'
  return (
    <>
      {narrative !== 'UNKNOWN' && (
        <section className={styles.voice} aria-label="Mầm nhắn bạn">
          <div className={styles.narrative}>{narrativeCopy[narrative]}</div>
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
          {hasMood && (
            <section className={styles.block} aria-labelledby="look-back-mood">
              <h2 id="look-back-mood" className={styles.h2}>
                Cảm xúc của bạn
              </h2>
              <p className={styles.lead}>{moodComparison(data.weeks)}</p>
              <MoodChart days={data.days} />
            </section>
          )}
          <section className={styles.block} aria-labelledby="look-back-did">
            <h2 id="look-back-did" className={styles.h2}>
              Những gì bạn đã làm
            </h2>
            <Stats data={data} />
            {!!data.appointments && (
              <p className={styles.note}>
                Bạn đã có {data.appointments} buổi tư vấn với chuyên gia.
              </p>
            )}
          </section>
          {!!data.conversations?.length && (
            <section className={styles.block} aria-labelledby="look-back-talk">
              <h2 id="look-back-talk" className={styles.h2}>
                Bạn đã trò chuyện với Mầm về
              </h2>
              <Conversations items={data.conversations} />
            </section>
          )}
        </>
      )}
      {data.screening.length > 0 && <Screening data={data} />}
      <section className={styles.next} aria-label="Bước tiếp theo">
        <Link className={styles.primary} href={next.href}>
          {next.label} <ArrowRight aria-hidden="true" size={18} />
        </Link>
      </section>
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

export function LookBackPage() {
  const [state, setState] = useState<State>({ phase: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const errorId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  // No celebration, queued award or welcome while loading or beside hard news (host gates honour this zone).
  useMamSuppress(
    state.phase !== 'ready' ||
      state.data.professionalPointer ||
      state.data.narrative === 'HARDER',
  )
  // After "Thử lại" the button disappears: keep focus on the page title.
  useEffect(() => {
    if (attempt > 0) headingRef.current?.focus()
  }, [attempt])

  useEffect(() => {
    const controller = new AbortController()
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    getLookBack(timezone, controller.signal)
      .then((data) => setState({ phase: 'ready', data }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ phase: 'error' })
      })
    return () => controller.abort()
  }, [attempt])

  return (
    <div className={styles.page} aria-busy={state.phase === 'loading'}>
      <Header headingRef={headingRef} />
      {state.phase === 'loading' ? (
        <Loading />
      ) : state.phase === 'error' ? (
        <>
          <section className={styles.block} aria-labelledby={errorId}>
            <h2 id={errorId} className={styles.h2}>
              Chưa tải được phần nhìn lại
            </h2>
            <p className={styles.lead} role="alert">
              Bạn thử lại sau một chút nhé.
            </p>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                setState({ phase: 'loading' })
                setAttempt((value) => value + 1)
              }}
            >
              Thử lại
            </button>
          </section>
        </>
      ) : (
        <Ready data={state.data} />
      )}
    </div>
  )
}
