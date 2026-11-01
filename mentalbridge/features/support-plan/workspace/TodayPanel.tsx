'use client'

import Link from 'next/link'
import { Fragment, useEffect, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, PauseCircle, RotateCcw } from 'lucide-react'
import type {
  ActionOccurrence,
  SupportPlanV3,
} from '../api/support-plan-contract'
import { MamCardButton } from '@/features/mam/MamCardButton'
import { useMamTarget } from '@/features/mam/use-mam-target'
import SupportPlanContextualCompanion from '../components/SupportPlanContextualCompanion'
import type { MamActionExplain } from './mam-support-plan'
import type { CompanionController } from './use-companion'
import { actionDestination, REASSESSMENT_HREF } from './workspace-links'
import { journalPlanHref } from '../journal-plan-origin'
import { hasContentCompletion } from '../resource-plan-origin'
import {
  barrierLine,
  BARRIERS,
  dayLabel,
  earlierOpenRows,
  formatTimeIn,
  nextOpenAfter,
  rowCapability,
  stateReasonLine,
  todayCounts,
  todayRows,
  type Barrier,
  type PlannedOccurrence,
  type TodayFocus,
  type TodayRow,
} from './workspace-model'

export { dayLabel }
export type { Barrier }

export type RowState = Readonly<{
  busy: Record<string, boolean>
  messages: Record<string, string>
}>

type Props = Readonly<{
  plan: SupportPlanV3
  focus: TodayFocus
  occurrences: ActionOccurrence[]
  today: string
  timezone: string
  /** Rows were read for this plan and window; before that nothing may be concluded. */
  ready: boolean
  loadError: boolean
  /** Safety help is on screen: no bar or check motion. */
  still?: boolean
  returnedOccurrenceId?: string
  rows: RowState
  busy: boolean
  /** Occurrences whose engagement can be read and changed safely (native, or v1-backed adapter). */
  engageable: ReadonlySet<string>
  companion: CompanionController
  /** Global Mầm presentation: replaces the legacy Companion entry. */
  mam?: MamActionExplain
  onRetry: () => void
  onSkip: (item: PlannedOccurrence) => void
  onReopen: (item: PlannedOccurrence) => void
  onAcknowledge: (item: PlannedOccurrence) => void
  onRate: (item: PlannedOccurrence, value: Helpfulness, reuse: boolean) => void
  onBarrier: (item: PlannedOccurrence, value: Barrier, reuse: boolean) => void
  onResume: () => void
  onOpenReview: () => void
  onOpenPlan: () => void
}>

const MAX_EARLIER = 3

function scheduleOf({ occurrence, action }: PlannedOccurrence) {
  return action.schedules?.find(
    (schedule) =>
      schedule.scheduleId === occurrence.scheduleId &&
      schedule.version === occurrence.scheduleVersion,
  )
}

export const titleOf = (item: PlannedOccurrence) =>
  item.action.presentation?.title || 'Việc trong kế hoạch'

/** The owner-scheduled local time; a malformed value falls back to the instant, then to nothing. */
function timeOf(item: PlannedOccurrence, timezone: string) {
  const local = scheduleOf(item)?.localTime
  return typeof local === 'string' && /^\d{2}:\d{2}/.test(local)
    ? local.slice(0, 5)
    : formatTimeIn(timezone, item.occurrence.scheduledAt)
}

/** Only owner-scheduled facts; an unknown duration is left out, never guessed. */
function durationOf(item: PlannedOccurrence) {
  const minutes = scheduleOf(item)?.estimatedDurationMinutes
  return minutes ? `khoảng ${minutes} phút` : ''
}

/** Read-only link to the accepted entry; the stored Journal fact wins over any URL candidate. */
export function acceptedJournalHref({ occurrence }: PlannedOccurrence) {
  const evidence = occurrence.completionEvidence
  if (
    occurrence.actionType !== 'JOURNAL' ||
    occurrence.state !== 'COMPLETED' ||
    evidence?.kind !== 'JOURNAL_ENTRY' ||
    evidence.ownerDomain !== 'JOURNAL_AI'
  )
    return undefined
  return journalPlanHref(
    {
      source: 'journal',
      occurrenceId: occurrence.occurrenceId,
      actionId: occurrence.actionId,
      localDate: occurrence.localDate,
      journalId: evidence.factId,
    },
    '/journal',
  )
}

function why(item: PlannedOccurrence) {
  return item.action.rationale ?? item.action.presentation?.summary
}

export type Helpfulness = 'HELPFUL' | 'A_LITTLE_HELPFUL' | 'NOT_HELPFUL'
const RATINGS: ReadonlyArray<readonly [Helpfulness, string]> = [
  ['HELPFUL', 'Có'],
  ['A_LITTLE_HELPFUL', 'Một chút'],
  ['NOT_HELPFUL', 'Chưa hợp'],
]

/** Optional quick answer; it is used in the plan review only if the user ticks the box. */
function QuickAnswer<T extends string>({
  label,
  question,
  choices,
  disabled,
  onAnswer,
}: Readonly<{
  label: string
  question: string
  choices: ReadonlyArray<readonly [T, string]>
  disabled: boolean
  onAnswer: (value: T, reuse: boolean) => void
}>) {
  const [reuse, setReuse] = useState(false)
  return (
    <div className="mbw-rate" role="group" aria-label={label}>
      <span className="mbw-quiet">{question}</span>
      {/* Consent comes before the answer: answering closes this group. */}
      <label className="mbw-reuse">
        <input
          type="checkbox"
          checked={reuse}
          disabled={disabled}
          onChange={(event) => setReuse(event.currentTarget.checked)}
        />
        Dùng câu trả lời này khi xem lại kế hoạch
      </label>
      {choices.map(([value, text]) => (
        <button
          key={value}
          type="button"
          className="mbw-chip"
          disabled={disabled}
          onClick={() => onAnswer(value, reuse)}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

/** Plain, owner-worded state of one row. Unknown enum values never show as raw tokens. */
export function statusLine(item: TodayRow, timezone: string) {
  const { occurrence } = item
  switch (item.status) {
    case 'done': {
      if (hasContentCompletion(occurrence))
        return 'Đã ghi nhận từ bài luyện tập'
      const time = formatTimeIn(timezone, occurrence.outcomeRecordedAt)
      return time ? `Xong lúc ${time}` : 'Đã xong'
    }
    case 'skipped':
      return ['Để hôm khác', barrierLine(occurrence.barrierCode)]
        .filter(Boolean)
        .join(' · ')
    case 'cancelled':
      return ['Đã hủy', stateReasonLine(occurrence.stateReason)]
        .filter(Boolean)
        .join(' · ')
    case 'missed':
      return 'Chưa làm'
    case 'upcoming':
      return 'Chưa tới giờ'
    default:
      return 'Chưa rõ trạng thái'
  }
}

export function useNow(everyMs: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), everyMs)
    return () => window.clearInterval(timer)
  }, [everyMs])
  return now
}

export default function TodayPanel({
  plan,
  focus,
  occurrences,
  today,
  timezone,
  ready,
  loadError,
  still = false,
  returnedOccurrenceId,
  rows,
  busy,
  engageable,
  companion,
  mam,
  onRetry,
  onSkip,
  onReopen,
  onAcknowledge,
  onRate,
  onBarrier,
  onResume,
  onOpenReview,
  onOpenPlan,
}: Props) {
  const now = useNow(60_000)

  if (!ready && !loadError)
    return (
      <div className="mbw-tile mbw-next" aria-busy="true">
        <p className="mbw-quiet" role="status">
          Đang tải việc của hôm nay…
        </p>
        <span className="mbw-skeleton mbw-skeleton-title" />
        <span className="mbw-skeleton mbw-skeleton-line" />
      </div>
    )

  const dayRows = ready ? todayRows(plan, occurrences, today, now) : []
  const counts = todayCounts(dayRows)
  const nextId =
    focus.kind === 'OCCURRENCE' ? focus.occurrence.occurrenceId : ''
  const hasOpen = dayRows.some(
    ({ status }) => status === 'missed' || status === 'upcoming',
  )
  // A row in a state this client cannot read leaves the day unresolved, so no conclusion.
  const hasUnknown = dayRows.some(({ status }) => status === 'unknown')
  const allDone = counts.total > 0 && counts.done === counts.total
  // The marker sits before the first row whose time has not come, even if that row is done.
  const nowAt = dayRows.findIndex(
    ({ occurrence }) => Date.parse(occurrence.scheduledAt) > now,
  )
  const nowIndex = nowAt === -1 ? dayRows.length : nowAt
  const earlier = ready ? earlierOpenRows(plan, occurrences, today) : []
  const next = ready ? nextOpenAfter(plan, occurrences, today) : undefined
  const showDay =
    ready &&
    (dayRows.length > 0 ||
      focus.kind === 'OCCURRENCE' ||
      focus.kind === 'DONE_FOR_TODAY' ||
      focus.kind === 'NOTHING_TODAY')
  // Commands are not offered on rows a failed refresh may have left behind.
  const stale = ready && loadError
  const nextTime = next && timeOf(next, timezone)

  return (
    <div className="mbw-today" data-still={still ? '' : undefined}>
      {loadError && (
        <div className="mbw-inline-alert" role="alert">
          <p>
            {ready
              ? 'Chưa cập nhật được việc của hôm nay. Danh sách bên dưới có thể chưa mới nhất.'
              : 'Chưa tải được việc của hôm nay.'}
          </p>
          <button type="button" className="mbw-link-button" onClick={onRetry}>
            <RotateCcw size={16} aria-hidden="true" />
            Thử lại
          </button>
        </div>
      )}

      {focus.kind === 'RESUME' && (
        <section className="mbw-tile mbw-next" aria-labelledby="mbw-next-title">
          <PauseCircle className="mbw-next-icon" aria-hidden="true" />
          <h2 id="mbw-next-title">Kế hoạch đang tạm dừng</h2>
          <p>
            Khi sẵn sàng, bạn tiếp tục từ hôm nay. Ngày tạm dừng không tính.
          </p>
          <div className="mbw-actions">
            <button
              type="button"
              className="mbw-primary"
              disabled={busy}
              onClick={onResume}
            >
              Tiếp tục kế hoạch
            </button>
          </div>
        </section>
      )}

      {focus.kind === 'REVIEW_DUE' && (
        <section className="mbw-tile mbw-next" aria-labelledby="mbw-next-title">
          <h2 id="mbw-next-title">Đến lúc cùng xem lại kế hoạch</h2>
          <p>
            Bạn đã đi qua 14 ngày. Cùng nhìn lại những gì đã ghi nhận rồi chọn
            cách đi tiếp. Kế hoạch không đổi cho đến khi bạn chọn.
          </p>
          <div className="mbw-actions">
            <button
              type="button"
              className="mbw-primary"
              onClick={onOpenReview}
            >
              Xem lại kế hoạch
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <Link className="mbw-secondary" href={REASSESSMENT_HREF}>
              Làm bài kiểm tra lại
            </Link>
          </div>
        </section>
      )}

      {showDay && (
        <section className="mbw-tile mbw-day" aria-labelledby="mbw-day-title">
          <div className="mbw-day-head">
            <h2 id="mbw-day-title" tabIndex={-1}>
              {dayLabel(today) || 'Hôm nay'}
            </h2>
            {counts.total > 0 && (
              <div className="mbw-day-count">
                <span className="mbw-quiet">
                  <b key={counts.done} className="mbw-settle">
                    {counts.done}
                  </b>
                  {` / ${counts.total} việc hôm nay`}
                  {counts.skipped > 0 && ` · ${counts.skipped} để hôm khác`}
                </span>
              </div>
            )}
          </div>
          {counts.total > 0 && (
            <div
              className="mbw-bar"
              role="progressbar"
              aria-label="Việc đã xong hôm nay"
              aria-valuemin={0}
              aria-valuemax={counts.total}
              aria-valuenow={counts.done}
              aria-valuetext={`${counts.done} trên ${counts.total} việc đã xong`}
            >
              <motion.i
                initial={{ scaleX: 0 }}
                animate={{ scaleX: counts.done / counts.total }}
                transition={{
                  duration: still ? 0 : 0.48,
                  ease: [0.16, 1, 0.3, 1],
                }}
              />
            </div>
          )}

          {counts.total === 0 && (
            <p>
              Hôm nay không có việc nào.{' '}
              {next
                ? `Việc tiếp theo: ${titleOf(next)}, ${dayLabel(next.occurrence.localDate)}${nextTime ? ` lúc ${nextTime}` : ''}.`
                : 'Chưa có việc nào sắp tới trong lịch.'}
            </p>
          )}

          {dayRows.length > 0 && (
            <ol className="mbw-rows">
              {dayRows.map((item, index) => (
                <Fragment key={item.occurrence.occurrenceId}>
                  {hasOpen && index === nowIndex && (
                    <li className="mbw-now">Bây giờ</li>
                  )}
                  <DayRow
                    plan={plan}
                    item={item}
                    index={index}
                    today={today}
                    timezone={timezone}
                    expanded={item.occurrence.occurrenceId === nextId}
                    returned={
                      returnedOccurrenceId === item.occurrence.occurrenceId
                    }
                    still={still}
                    stale={stale}
                    rows={rows}
                    engageable={engageable.has(item.occurrence.occurrenceId)}
                    companion={companion}
                    mam={mam}
                    onSkip={onSkip}
                    onReopen={onReopen}
                    onAcknowledge={onAcknowledge}
                    onRate={onRate}
                    onBarrier={onBarrier}
                  />
                </Fragment>
              ))}
              {hasOpen && nowIndex === dayRows.length && (
                <li className="mbw-now">Bây giờ</li>
              )}
            </ol>
          )}

          {counts.total > 0 && !hasOpen && !hasUnknown && (
            <p className="mbw-daydone">
              {allDone && <Check size={18} aria-hidden="true" />}
              {allDone
                ? 'Xong các việc hôm nay.'
                : 'Hôm nay không còn việc nào đang chờ.'}{' '}
              {next
                ? `Việc tiếp theo: ${titleOf(next)}, ${dayLabel(next.occurrence.localDate)}${nextTime ? ` lúc ${nextTime}` : ''}.`
                : 'Chưa có việc nào sắp tới trong lịch.'}
            </p>
          )}

          <div className="mbw-actions">
            <button
              type="button"
              className="mbw-text-button"
              onClick={onOpenPlan}
            >
              Xem cả kế hoạch
            </button>
          </div>
        </section>
      )}

      {earlier.length > 0 && (
        <section className="mbw-earlier" aria-labelledby="mbw-earlier-title">
          <h3 id="mbw-earlier-title">Còn lại từ những ngày trước</h3>
          <ul>
            {earlier.slice(0, MAX_EARLIER).map((item) => {
              const id = item.occurrence.occurrenceId
              const capability = rowCapability(plan, item, false)
              const destination = actionDestination(plan, item, today)
              const pending = Boolean(rows.busy[id]) || stale
              return (
                <li
                  key={id}
                  id={`activity-${id}`}
                  data-support-plan-action-id={item.action.actionId}
                  tabIndex={-1}
                >
                  <p className="mbw-row-title">
                    {titleOf(item)}
                    <span className="mbw-quiet">
                      {` · ${dayLabel(item.occurrence.localDate)}`}
                    </span>
                  </p>
                  {destination && (
                    <Link className="mbw-row-link" href={destination.href}>
                      {destination.label}
                      <span className="mbw-visually-hidden">
                        : {titleOf(item)}
                      </span>
                    </Link>
                  )}
                  {capability.complete && (
                    <button
                      type="button"
                      className="mbw-row-link"
                      disabled={pending}
                      onClick={() => onAcknowledge(item)}
                    >
                      Đã làm xong
                      <span className="mbw-visually-hidden">
                        : {titleOf(item)}
                      </span>
                    </button>
                  )}
                  {capability.skip && (
                    <button
                      type="button"
                      className="mbw-row-link"
                      disabled={pending}
                      onClick={() => onSkip(item)}
                    >
                      Để hôm khác
                      <span className="mbw-visually-hidden">
                        : {titleOf(item)}
                      </span>
                    </button>
                  )}
                  {rows.messages[id] && (
                    <p className="mbw-row-note" role="alert">
                      {rows.messages[id]}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
          {earlier.length > MAX_EARLIER && (
            <p className="mbw-quiet">
              {`Và ${earlier.length - MAX_EARLIER} việc khác từ các ngày trước.`}
            </p>
          )}
        </section>
      )}
    </div>
  )
}

function DayRow({
  plan,
  item,
  index,
  today,
  timezone,
  expanded,
  returned,
  still,
  stale,
  rows,
  engageable,
  companion,
  mam,
  onSkip,
  onReopen,
  onAcknowledge,
  onRate,
  onBarrier,
}: Readonly<{
  plan: SupportPlanV3
  item: TodayRow
  index: number
  today: string
  timezone: string
  expanded: boolean
  returned: boolean
  still: boolean
  stale: boolean
  rows: RowState
  engageable: boolean
  companion: CompanionController
  mam?: MamActionExplain
  onSkip: (item: PlannedOccurrence) => void
  onReopen: (item: PlannedOccurrence) => void
  onAcknowledge: (item: PlannedOccurrence) => void
  onRate: (item: PlannedOccurrence, value: Helpfulness, reuse: boolean) => void
  onBarrier: (item: PlannedOccurrence, value: Barrier, reuse: boolean) => void
}>) {
  const { occurrence, action, status } = item
  const id = occurrence.occurrenceId
  const title = titleOf(item)
  const capability = rowCapability(plan, item, engageable)
  const destination = actionDestination(plan, item, today)
  const acknowledge = capability.complete
  const pending = Boolean(rows.busy[id]) || stale
  const message = rows.messages[id]
  // After a Resource round trip, or with nowhere to open, confirming is the one thing left.
  const confirmFirst = acknowledge && (returned || !destination)
  const explainable = ['RESOURCE', 'JOURNAL', 'EMOTION_CHECK_IN'].includes(
    action.actionType,
  )
  const mamRef = useMamTarget(
    expanded && mam && explainable
      ? {
          kind: 'support-plan.focus',
          context: {
            supportPlanId: plan.supportPlanId,
            actionId: action.actionId,
          },
        }
      : null,
    mam &&
      (async (intent, { signal }) =>
        intent === 'EXPLAIN'
          ? mam.explain(plan.supportPlanId, action.actionId, 'TODAY', signal)
          : null),
  )
  const reason = why(item)
  const time = timeOf(item, timezone)
  const duration = durationOf(item)
  const journalHref = acceptedJournalHref(item)
  const open = status === 'missed' || status === 'upcoming'
  const readOnly =
    !destination && !capability.complete && !capability.skip && open
  const rowClass = [
    'mbw-row',
    `is-${status}`,
    expanded && 'is-next',
    returned && 'is-returned',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <motion.li
      ref={mamRef}
      layout={still ? false : 'position'}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      id={`activity-${id}`}
      className={rowClass}
      data-support-plan-action-id={action.actionId}
      data-mam={expanded && mam && explainable ? '' : undefined}
      tabIndex={-1}
    >
      <div className="mbw-row-grid" style={{ '--i': index } as CSSProperties}>
        <span className="mbw-row-time">{time}</span>
        <span className="mbw-row-dot" aria-hidden="true">
          <svg width="13" height="13" viewBox="0 0 14 14">
            <path d="M2 7.5l3 3 7-7" fill="none" strokeWidth="2.2" />
          </svg>
        </span>
        <div className="mbw-row-main">
          {expanded && (
            <p className="mbw-meta">
              {[
                occurrence.displayState === 'OVERDUE'
                  ? 'Vẫn kịp làm hôm nay'
                  : 'Tiếp theo',
                duration,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          <h3 className="mbw-row-title">{title}</h3>
          {!expanded && (
            <p className="mbw-quiet">
              {[
                statusLine(item, timezone),
                open && status === 'upcoming' ? duration : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}

          <AnimatePresence initial={false} mode="wait">
            {expanded && (
              <motion.div
                key="open"
                className="mbw-row-open"
                initial={still ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: still ? 0 : 0.2 }}
              >
                {reason && <p className="mbw-why">{reason}</p>}
                {action.actionType === 'JOURNAL' && (
                  <p className="mbw-quiet">
                    Nhật ký vẫn riêng tư. Kế hoạch chỉ biết bạn đã lưu một bài.
                  </p>
                )}
                <div className="mbw-actions">
                  {confirmFirst ? (
                    <button
                      type="button"
                      className="mbw-primary"
                      disabled={pending}
                      onClick={() => onAcknowledge(item)}
                    >
                      <Check size={18} aria-hidden="true" />
                      {rows.busy[id] ? 'Đang ghi nhận…' : 'Đã làm xong'}
                    </button>
                  ) : (
                    destination && (
                      <Link className="mbw-primary" href={destination.href}>
                        {destination.label}
                        <ArrowRight size={18} aria-hidden="true" />
                      </Link>
                    )
                  )}
                  {acknowledge && !confirmFirst && (
                    <button
                      type="button"
                      className="mbw-secondary"
                      disabled={pending}
                      onClick={() => onAcknowledge(item)}
                    >
                      {rows.busy[id] ? 'Đang ghi nhận…' : 'Đã làm xong'}
                    </button>
                  )}
                  {capability.skip && (
                    <button
                      type="button"
                      className="mbw-text-button"
                      disabled={pending}
                      onClick={() => onSkip(item)}
                    >
                      Để hôm khác
                    </button>
                  )}
                </div>
                {readOnly && (
                  <p className="mbw-quiet">
                    Việc này chưa có thao tác nào ở đây.
                  </p>
                )}
                {!mam && explainable && (
                  <SupportPlanContextualCompanion
                    supportPlanId={plan.supportPlanId}
                    actionId={action.actionId}
                    actionTitle={title}
                    surface="TODAY"
                    disabled={companion.interrupted}
                    interruptionActive={companion.interrupted}
                    requestPending={companion.pending}
                    snapshot={companion.snapshot}
                    onRequest={(request) => void companion.request(request)}
                    onDismiss={companion.dismiss}
                  />
                )}
                {mam && explainable && (
                  <MamCardButton
                    label={`Mầm giải thích: ${title}`}
                    disabled={
                      mam.pendingActionId !== undefined &&
                      mam.pendingActionId !== action.actionId
                    }
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {!expanded && open && destination && (
            <Link className="mbw-row-link" href={destination.href}>
              {destination.label}
            </Link>
          )}
          {journalHref && (
            <Link className="mbw-row-link" href={journalHref}>
              Xem bài đã viết
              <span className="mbw-visually-hidden">: {title}</span>
            </Link>
          )}
          {capability.rate && (
            <QuickAnswer
              label={`Hoạt động “${title}” có giúp bạn không?`}
              question="Có giúp bạn không?"
              choices={RATINGS}
              disabled={pending}
              onAnswer={(value, reuse) => onRate(item, value, reuse)}
            />
          )}
          {capability.barrier && (
            <QuickAnswer
              label={`Vì sao để “${title}” sang hôm khác?`}
              question="Vì sao để sang hôm khác? (không bắt buộc)"
              choices={BARRIERS}
              disabled={pending}
              onAnswer={(value, reuse) => onBarrier(item, value, reuse)}
            />
          )}
          {capability.reopen && (
            <button
              type="button"
              className="mbw-row-link"
              disabled={pending}
              onClick={() => onReopen(item)}
            >
              Làm lại hôm nay
            </button>
          )}
          {message && (
            <p className="mbw-row-note" role="alert">
              {message}
            </p>
          )}
        </div>
      </div>
    </motion.li>
  )
}
