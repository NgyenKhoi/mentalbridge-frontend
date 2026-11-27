'use client'

import Link from 'next/link'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

import { dispatchMamEvent, type MamEvent } from '@/features/mam/mam-events'
import { GOAL_LABEL } from '@/features/mam/companion-copy'
import { useMamAccountId } from '@/features/mam/MamDockSlot'
import { useCompanionState } from '@/features/mam/use-companion-state'
import {
  localDate,
  shiftDate,
} from '@/features/resources/model/resource-experience'
import type { ReviewPreference } from '@/features/support-plan/workspace/workspace-links'
import type {
  CompanionChapterConnected,
  CompanionChapterInput,
  CompanionChapterObstacle,
  CompanionChapterRating,
} from '@/lib/companion-state/contract'

import { insightSentence, lookBackInsight } from './look-back-insight'
import type { LookBack } from './look-back-model'
import styles from './LookBack.module.css'

/** The chặng on screen: its key (start date), its last day when closed, and how far a running one is. */
export type LookBackChapterRef = Readonly<{
  start: string
  end: string | null
  closed: boolean
  day: number
}>

const RATINGS: readonly Option<CompanionChapterRating>[] = [
  { value: 'LIGHTER', label: 'Nhẹ hơn' },
  { value: 'SAME', label: 'Như cũ' },
  { value: 'HEAVIER', label: 'Nặng hơn' },
  { value: 'UNSURE', label: 'Chưa rõ' },
]
const OBSTACLES: readonly Option<CompanionChapterObstacle>[] = [
  { value: 'BUSY', label: 'Bận quá' },
  { value: 'FORGOT', label: 'Hay quên' },
  { value: 'LOW_ENERGY', label: 'Không còn sức' },
  { value: 'NOT_A_FIT', label: 'Việc không hợp' },
  { value: 'OTHER', label: 'Lý do khác' },
]
const CONNECTED: readonly Option<CompanionChapterConnected>[] = [
  { value: 'YES', label: 'Rồi' },
  { value: 'NOT_YET', label: 'Chưa' },
  { value: 'PREFER_NOT_SAY', label: 'Không muốn nói' },
]
const PREFER: Record<CompanionChapterObstacle, ReviewPreference | null> = {
  BUSY: 'DIFFERENT_TIME',
  FORGOT: 'DIFFERENT_TIME',
  LOW_ENERGY: 'LOWER_WORKLOAD',
  NOT_A_FIT: 'ALTERNATIVE_ACTION',
  OTHER: null,
}

type Option<T extends string> = Readonly<{ value: T; label: string }>

/**
 * One self-report question: chips as a radio group (arrows move focus, Space or Enter answers, so arrowing never
 * saves), then the answer with "Đổi" and Mầm's reply, which fades in place.
 */
function Answer<T extends string>({
  name,
  prompt,
  options,
  saved,
  onSave,
  reply,
}: Readonly<{
  /** Accessible name when there is no visible prompt (the heading above asks). */
  name?: string
  prompt?: string
  options: readonly Option<T>[]
  saved: T | undefined
  onSave: (value: T) => Promise<boolean>
  reply: (value: T) => ReactNode
}>) {
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState<T | null>(null)
  const [failed, setFailed] = useState(false)
  const changeRef = useRef<HTMLButtonElement>(null)
  const groupRef = useRef<HTMLDivElement>(null)
  const refocus = useRef<'change' | 'chip' | null>(null)
  const promptId = useId()
  const answerId = useId()
  const answered = saved !== undefined && !editing
  // Swapping chips for the answer (or back) would drop focus: move it to the control that replaced the old one.
  useEffect(() => {
    if (refocus.current === 'change') changeRef.current?.focus()
    else if (refocus.current === 'chip')
      groupRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus()
    refocus.current = null
  }, [answered])

  const pick = async (value: T) => {
    if (pending !== null) return
    // Set before saving: the saved answer arrives through the store and flips the view before this resolves.
    refocus.current = 'change'
    if (value !== saved) {
      setPending(value)
      setFailed(false)
      const ok = await onSave(value)
      setPending(null)
      if (!ok) {
        refocus.current = null
        return setFailed(true)
      }
    }
    setEditing(false)
  }
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const radios = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role=radio]',
      ),
    ]
    const at = radios.indexOf(document.activeElement as HTMLButtonElement)
    const target = {
      ArrowRight: at + 1,
      ArrowDown: at + 1,
      ArrowLeft: at - 1,
      ArrowUp: at - 1,
      Home: 0,
      End: radios.length - 1,
    }[event.key]
    if (at < 0 || target === undefined) return
    event.preventDefault()
    radios[(target + radios.length) % radios.length].focus()
  }
  const stop = saved ?? options[0].value
  const label = options.find((option) => option.value === saved)?.label

  return (
    <div className={styles.answerBlock}>
      {prompt && (
        <p id={promptId} className={styles.prompt}>
          {prompt}
        </p>
      )}
      {answered ? (
        <div className={styles.answered}>
          <div id={answerId} className={styles.answer}>
            {label}
          </div>
          <button
            ref={changeRef}
            type="button"
            className={styles.change}
            aria-describedby={answerId}
            onClick={() => {
              refocus.current = 'chip'
              setEditing(true)
            }}
          >
            Đổi
          </button>
        </div>
      ) : (
        <div
          ref={groupRef}
          className={styles.chips}
          role="radiogroup"
          aria-label={prompt ? undefined : name}
          aria-labelledby={prompt ? promptId : undefined}
          aria-busy={pending !== null}
          onKeyDown={move}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              className={styles.chip}
              aria-checked={(pending ?? saved) === option.value}
              aria-disabled={pending !== null || undefined}
              tabIndex={option.value === stop ? 0 : -1}
              onClick={() => void pick(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {failed && (
        <p className={styles.note} role="alert">
          Chưa lưu được. Bạn thử lại nhé.
        </p>
      )}
      <div role="status" className={styles.replyWrap}>
        {answered && (
          <div key={saved} className={styles.reply}>
            {reply(saved)}
          </div>
        )}
      </div>
    </div>
  )
}

type Commitments = ReturnType<typeof useCompanionState>

/** "Chưa" to the connection question: a message drafted with Mầm, or a lời hẹn to be asked again tomorrow. */
function ConnectActions({
  booked,
  createCommitment,
}: Readonly<{
  booked: boolean
  createCommitment: Commitments['createCommitment']
}>) {
  const [result, setResult] = useState<'busy' | 'limit' | 'failed' | null>(null)
  const book = async () => {
    setResult('busy')
    const made = await createCommitment({
      kind: 'CONNECT_PERSON',
      minutes: null,
      dueOn: shiftDate(localDate(), 1),
      source: 'LOOK_BACK',
    })
    setResult(made === 'COMMITMENT_LIMIT' ? 'limit' : made ? null : 'failed')
  }
  return (
    <>
      <div className={styles.actions}>
        <Link className={styles.act} href="/ai-companion?draft=connect">
          Soạn tin cùng Mầm
        </Link>
        {/* Stays mounted once booked so focus is not lost. */}
        <button
          type="button"
          className={styles.act}
          aria-disabled={booked || result === 'busy' || undefined}
          onClick={() => !booked && result !== 'busy' && void book()}
        >
          {booked ? 'Đã hẹn, mai Mầm hỏi bạn' : 'Hẹn Mầm mai nhắc'}
        </button>
      </div>
      {result === 'limit' && (
        <p>Bạn đang có 3 lời hẹn rồi, làm xong một cái rồi hẹn thêm nhé.</p>
      )}
      {result === 'failed' && <p>Chưa hẹn được. Bạn thử lại nhé.</p>}
    </>
  )
}

/**
 * "Chặng này của bạn": what seems to help (association only) and the three questions Mầm asks about the chặng.
 * Renders when any block does; the questions need the companion state, so without it only the insight shows.
 */
export function ChapterSection({
  data,
  chapter,
}: Readonly<{ data: LookBack; chapter: LookBackChapterRef | null }>) {
  const accountId = useMamAccountId()
  const { state, patch, createCommitment } = useCompanionState(accountId)
  const insight = lookBackInsight(data.days)
  const known = chapter && state ? state : null
  const saved = known?.chapters.find(
    (item) => item.startedOn === chapter?.start,
  )
  // A focus chosen after a closed chặng ended belongs to the next one.
  const focus = known?.focus
  const goal =
    saved?.goal ??
    (focus && (!chapter?.end || focus.chosenOn <= chapter.end)
      ? focus.goal
      : undefined)
  const atEnd = !!chapter && (chapter.closed || chapter.day >= 12)
  const [first, second] = data.weeks
  // Week 2 counts only when it has days; a half-lived week would always look lower.
  const slipped =
    (data.days.length >= 14 &&
      first.supportCompleted !== null &&
      second.supportCompleted !== null &&
      second.supportCompleted < first.supportCompleted) ||
    (data.days.length > 7 && (second.supportSkipped ?? 0) > 0)
  const asks = !!known && (slipped || atEnd)
  if (!insight && !goal && !asks) return null

  const save = async (
    kind: Extract<MamEvent, { type: 'lookback-answer' }>['kind'],
    value: string,
    input: Omit<CompanionChapterInput, 'startedOn' | 'goal'>,
  ) => {
    const next = await patch({
      chapter: { startedOn: chapter!.start, ...(goal && { goal }), ...input },
    })
    if (next)
      // Mầm hears each saved answer (enum values only, never free text).
      dispatchMamEvent({
        type: 'lookback-answer',
        kind,
        value,
        moderatePlus: data.professionalPointer,
      })
    return next !== null
  }

  return (
    <section
      className={`${styles.block} ${styles.self} ${styles.rise}`}
      style={{ '--d': '170ms' } as CSSProperties}
      aria-labelledby="look-back-self"
    >
      <h2 id="look-back-self" className={styles.h2}>
        Chặng này của bạn
      </h2>
      {insight && (
        <div className={styles.insight}>
          <h3 className={styles.h3}>Điều có vẻ giúp bạn</h3>
          <p className={styles.insightText}>{insightSentence(insight)}</p>
        </div>
      )}
      {known && goal && (
        <div className={styles.question}>
          <h3 className={styles.h3}>Mục tiêu chặng này</h3>
          <p className={styles.insightText}>{GOAL_LABEL[goal]}</p>
          {atEnd && (
            <Answer
              prompt="Sau 14 ngày, điều đó nhẹ đi chưa?"
              options={RATINGS}
              saved={saved?.rating}
              onSave={(value) => save('rating', value, { rating: value })}
              reply={(value) => (
                <>
                  <p>
                    {
                      {
                        LIGHTER:
                          'Vui cùng bạn nè. Mình giữ những việc đã giúp nhé.',
                        SAME: 'Có khi cần thêm thời gian hoặc đổi cách. Mình chọn kế hoạch tiếp theo cùng nhau nhé.',
                        HEAVIER:
                          'Cảm ơn bạn đã nói thật. Lúc này nói chuyện với chuyên gia có thể giúp nhiều hơn.',
                        UNSURE: 'Chưa rõ cũng là một câu trả lời.',
                      }[value]
                    }
                  </p>
                  {value === 'HEAVIER' && (
                    <Link className={styles.quiet} href="/specialists">
                      Tìm chuyên gia
                    </Link>
                  )}
                </>
              )}
            />
          )}
        </div>
      )}
      {known && slipped && (
        <div className={styles.question}>
          <h3 className={styles.h3}>Điều gì cản bạn?</h3>
          <Answer
            name="Điều gì cản bạn?"
            options={OBSTACLES}
            saved={saved?.obstacle}
            onSave={(value) => save('obstacle', value, { obstacle: value })}
            reply={(value) => {
              const prefer = PREFER[value]
              return (
                <>
                  <p>
                    Hiểu rồi nè. Mình chọn kế hoạch nhẹ hơn cho chặng sau nhé.
                  </p>
                  <Link
                    className={styles.quiet}
                    href={`/support-plan?review=open${prefer ? `&prefer=${prefer}` : ''}`}
                  >
                    Xem lựa chọn phù hợp
                  </Link>
                </>
              )
            }}
          />
        </div>
      )}
      {known && atEnd && (
        <div className={styles.question}>
          <h3 className={styles.h3}>Kết nối</h3>
          <Answer
            prompt="14 ngày qua bạn đã nói chuyện thật lòng với ai chưa?"
            options={CONNECTED}
            saved={saved?.connected}
            onSave={(value) => save('connected', value, { connected: value })}
            reply={(value) =>
              value === 'NOT_YET' && (
                <>
                  <p>
                    Thử nhắn cho một người bạn tin nhé, ngắn thôi cũng được.
                  </p>
                  <ConnectActions
                    booked={known.commitments.some(
                      (item) =>
                        item.kind === 'CONNECT_PERSON' &&
                        item.status === 'OPEN',
                    )}
                    createCommitment={createCommitment}
                  />
                </>
              )
            }
          />
        </div>
      )}
    </section>
  )
}
