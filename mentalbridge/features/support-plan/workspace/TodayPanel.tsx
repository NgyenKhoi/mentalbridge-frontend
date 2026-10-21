'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, Check, Clock3, PauseCircle, RotateCcw } from 'lucide-react'
import type {
  ActionOccurrence,
  SupportPlanV3,
} from '../api/support-plan-contract'
import SupportPlanContextualCompanion from '../components/SupportPlanContextualCompanion'
import type { CompanionController } from './use-companion'
import {
  actionDestination,
  canAcknowledge,
  REASSESSMENT_HREF,
} from './workspace-links'
import { journalPlanHref } from '../journal-plan-origin'
import { hasContentCompletion } from '../resource-plan-origin'
import {
  isDailyWork,
  joinOccurrences,
  type PlannedOccurrence,
  type TodayFocus,
} from './workspace-model'

export type RowState = Readonly<{
  busy: Record<string, boolean>
  messages: Record<string, string>
}>

type Props = Readonly<{
  plan: SupportPlanV3
  focus: TodayFocus
  occurrences: ActionOccurrence[]
  today: string
  loading: boolean
  loadError: boolean
  returnedOccurrenceId?: string
  rows: RowState
  busy: boolean
  /** Occurrences whose engagement can be read and changed safely (native, or v1-backed adapter). */
  engageable: ReadonlySet<string>
  companion: CompanionController
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

const dayFormat = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: 'numeric',
  month: 'numeric',
  timeZone: 'UTC',
})

export function dayLabel(date: string) {
  return dayFormat.format(new Date(`${date}T00:00:00Z`))
}

function scheduleOf({ occurrence, action }: PlannedOccurrence) {
  return action.schedules.find(
    (schedule) =>
      schedule.scheduleId === occurrence.scheduleId &&
      schedule.version === occurrence.scheduleVersion,
  )
}

/** Only owner-scheduled facts; an unknown duration is left out, never guessed. */
function timing(item: PlannedOccurrence) {
  const schedule = scheduleOf(item)
  if (!schedule) return ''
  const minutes = schedule.estimatedDurationMinutes
  return minutes
    ? `${schedule.localTime.slice(0, 5)} · khoảng ${minutes} phút`
    : schedule.localTime.slice(0, 5)
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
  return item.action.rationale ?? item.action.presentation.summary
}

export type Helpfulness = 'HELPFUL' | 'A_LITTLE_HELPFUL' | 'NOT_HELPFUL'
const RATINGS: ReadonlyArray<readonly [Helpfulness, string]> = [
  ['HELPFUL', 'Có'],
  ['A_LITTLE_HELPFUL', 'Một chút'],
  ['NOT_HELPFUL', 'Chưa hợp'],
]

export type Barrier = 'NOT_ENOUGH_TIME' | 'LOW_ENERGY' | 'NOT_A_GOOD_FIT'
const BARRIERS: ReadonlyArray<readonly [Barrier, string]> = [
  ['NOT_ENOUGH_TIME', 'Không đủ thời gian'],
  ['LOW_ENERGY', 'Thiếu năng lượng'],
  ['NOT_A_GOOD_FIT', 'Chưa hợp với mình'],
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

const doneLabel = {
  COMPLETED: 'Đã xong',
  SKIPPED: 'Để hôm khác',
  CANCELLED: 'Không còn trong lịch',
  SCHEDULED: '',
} as const

export default function TodayPanel({
  plan,
  focus,
  occurrences,
  today,
  loading,
  loadError,
  returnedOccurrenceId,
  rows,
  busy,
  engageable,
  companion,
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
  const todays = joinOccurrences(plan, occurrences).filter(
    (item) => item.occurrence.localDate === today && isDailyWork(item),
  )
  const finished = todays.filter(
    ({ occurrence }) => occurrence.state !== 'SCHEDULED',
  )

  if (loading)
    return (
      <div className="mbw-tile mbw-next" aria-busy="true">
        <p className="mbw-quiet" role="status">
          Đang tải việc của hôm nay…
        </p>
        <span className="mbw-skeleton mbw-skeleton-title" />
        <span className="mbw-skeleton mbw-skeleton-line" />
      </div>
    )

  return (
    <div className="mbw-today">
      {loadError && (
        <div className="mbw-inline-alert" role="alert">
          <p>Chưa tải được việc của hôm nay.</p>
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

      {focus.kind === 'OCCURRENCE' && (
        <NextCard
          plan={plan}
          item={focus}
          today={today}
          returned={returnedOccurrenceId === focus.occurrence.occurrenceId}
          rows={rows}
          companion={companion}
          onSkip={onSkip}
          onAcknowledge={onAcknowledge}
        />
      )}

      {(focus.kind === 'DONE_FOR_TODAY' || focus.kind === 'NOTHING_TODAY') && (
        <section className="mbw-tile mbw-next" aria-labelledby="mbw-next-title">
          {focus.kind === 'DONE_FOR_TODAY' && (
            <Check className="mbw-next-icon" aria-hidden="true" />
          )}
          <h2 id="mbw-next-title">
            {focus.kind === 'DONE_FOR_TODAY'
              ? 'Bạn đã xong việc của hôm nay'
              : 'Hôm nay không có hoạt động nào'}
          </h2>
          <p>
            {focus.nextDate
              ? `Hoạt động tiếp theo vào ${dayLabel(focus.nextDate)}.`
              : 'Chưa có hoạt động nào sắp tới trong lịch.'}
          </p>
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

      {focus.kind === 'OCCURRENCE' && focus.later.length > 0 && (
        <section className="mbw-later" aria-labelledby="mbw-later-title">
          <h3 id="mbw-later-title">Sau đó trong hôm nay</h3>
          <ul>
            {focus.later.map((item) => {
              const destination = actionDestination(plan, item, today)
              return (
                <li
                  key={item.occurrence.occurrenceId}
                  id={`activity-${item.occurrence.occurrenceId}`}
                  data-support-plan-action-id={item.action.actionId}
                  tabIndex={-1}
                  className={
                    returnedOccurrenceId === item.occurrence.occurrenceId
                      ? 'is-returned'
                      : undefined
                  }
                >
                  <div>
                    <p className="mbw-row-title">
                      {item.action.presentation.title}
                    </p>
                    <p className="mbw-quiet">{timing(item)}</p>
                  </div>
                  {destination && (
                    <Link className="mbw-row-link" href={destination.href}>
                      {destination.label}
                    </Link>
                  )}
                  {rows.messages[item.occurrence.occurrenceId] && (
                    <p className="mbw-row-note" role="alert">
                      {rows.messages[item.occurrence.occurrenceId]}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {finished.length > 0 && (
        <section className="mbw-later" aria-labelledby="mbw-finished-title">
          <h3 id="mbw-finished-title">Đã ghi nhận hôm nay</h3>
          <ul>
            {finished.map((item) => (
              <li
                key={item.occurrence.occurrenceId}
                id={`activity-${item.occurrence.occurrenceId}`}
                tabIndex={-1}
                className={
                  returnedOccurrenceId === item.occurrence.occurrenceId
                    ? 'is-returned'
                    : undefined
                }
              >
                <div>
                  <p className="mbw-row-title">
                    {item.action.presentation.title}
                  </p>
                  <p className="mbw-quiet">
                    {hasContentCompletion(item.occurrence)
                      ? 'Đã ghi nhận từ bài luyện tập'
                      : doneLabel[item.occurrence.state]}
                  </p>
                </div>
                {acceptedJournalHref(item) && (
                  <Link
                    className="mbw-row-link"
                    href={acceptedJournalHref(item)!}
                  >
                    Xem bài đã viết
                    <span className="mbw-visually-hidden">
                      : {item.action.presentation.title}
                    </span>
                  </Link>
                )}
                {item.occurrence.state === 'COMPLETED' &&
                  plan.status === 'ACTIVE' &&
                  engageable.has(item.occurrence.occurrenceId) &&
                  !item.occurrence.helpfulness && (
                    <QuickAnswer
                      label={`Hoạt động “${item.action.presentation.title}” có giúp bạn không?`}
                      question="Có giúp bạn không?"
                      choices={RATINGS}
                      disabled={Boolean(
                        rows.busy[item.occurrence.occurrenceId],
                      )}
                      onAnswer={(value, reuse) => onRate(item, value, reuse)}
                    />
                  )}
                {item.occurrence.state === 'SKIPPED' &&
                  plan.status === 'ACTIVE' &&
                  item.occurrence.representationMode === 'NATIVE_V3' &&
                  engageable.has(item.occurrence.occurrenceId) &&
                  !item.occurrence.barrierCode && (
                    <QuickAnswer
                      label={`Vì sao để “${item.action.presentation.title}” sang hôm khác?`}
                      question="Vì sao để sang hôm khác? (không bắt buộc)"
                      choices={BARRIERS}
                      disabled={Boolean(
                        rows.busy[item.occurrence.occurrenceId],
                      )}
                      onAnswer={(value, reuse) => onBarrier(item, value, reuse)}
                    />
                  )}
                {item.occurrence.state === 'SKIPPED' &&
                  plan.status === 'ACTIVE' &&
                  engageable.has(item.occurrence.occurrenceId) && (
                    <button
                      type="button"
                      className="mbw-row-link"
                      disabled={rows.busy[item.occurrence.occurrenceId]}
                      onClick={() => onReopen(item)}
                    >
                      Làm lại hôm nay
                    </button>
                  )}
                {rows.messages[item.occurrence.occurrenceId] && (
                  <p className="mbw-row-note" role="alert">
                    {rows.messages[item.occurrence.occurrenceId]}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function NextCard({
  plan,
  item,
  today,
  returned,
  rows,
  companion,
  onSkip,
  onAcknowledge,
}: Readonly<{
  plan: SupportPlanV3
  item: PlannedOccurrence
  today: string
  returned: boolean
  rows: RowState
  companion: CompanionController
  onSkip: (item: PlannedOccurrence) => void
  onAcknowledge: (item: PlannedOccurrence) => void
}>) {
  const destination = actionDestination(plan, item, today)
  const acknowledge = canAcknowledge(plan, item)
  const pending = Boolean(rows.busy[item.occurrence.occurrenceId])
  const message = rows.messages[item.occurrence.occurrenceId]
  // After a Resource round trip, or with nowhere to open, confirming is the one thing left.
  const confirmFirst = acknowledge && (returned || !destination)
  const reason = why(item)
  return (
    <section
      className={`mbw-tile mbw-next${returned ? ' is-returned' : ''}`}
      aria-labelledby="mbw-next-title"
      id={`activity-${item.occurrence.occurrenceId}`}
      data-support-plan-action-id={item.action.actionId}
      tabIndex={-1}
    >
      {(timing(item) || item.occurrence.displayState === 'OVERDUE') && (
        <p className="mbw-meta">
          <Clock3 size={16} aria-hidden="true" />
          {[
            item.occurrence.displayState === 'OVERDUE' && 'Vẫn kịp làm hôm nay',
            timing(item),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
      <h2 id="mbw-next-title">{item.action.presentation.title}</h2>
      {reason && <p className="mbw-why">{reason}</p>}
      {item.action.actionType === 'JOURNAL' && (
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
            {pending ? 'Đang ghi nhận…' : 'Đã làm xong'}
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
            {pending ? 'Đang ghi nhận…' : 'Đã làm xong'}
          </button>
        )}
        {plan.status === 'ACTIVE' && (
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
      {['RESOURCE', 'JOURNAL', 'EMOTION_CHECK_IN'].includes(
        item.action.actionType,
      ) && (
        <SupportPlanContextualCompanion
          supportPlanId={plan.supportPlanId}
          actionId={item.action.actionId}
          actionTitle={item.action.presentation.title}
          surface="TODAY"
          disabled={companion.interrupted}
          interruptionActive={companion.interrupted}
          requestPending={companion.pending}
          snapshot={companion.snapshot}
          onRequest={(request) => void companion.request(request)}
          onDismiss={companion.dismiss}
        />
      )}
      {message && (
        <p className="mbw-row-note" role="alert">
          {message}
        </p>
      )}
    </section>
  )
}
