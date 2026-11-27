'use client'

import { ArrowLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Disclosure } from '@/components/ui/Disclosure'
import type {
  AdaptiveReviewConfirmation,
  NativeSupportPlanReplacementReview,
  SupportPlanV3,
} from '../api/support-plan-contract'
import SupportPlanMamReview from '../components/SupportPlanMamReview'
import AdaptiveReview from './AdaptiveReview'
import { dayLabel } from './TodayPanel'
import { REASSESSMENT_HREF, type ReviewPreference } from './workspace-links'
import { planActions, replacementDiff } from './workspace-model'

type Props = Readonly<{
  plan: SupportPlanV3
  replacement?: SupportPlanV3
  review?: NativeSupportPlanReplacementReview
  busy: boolean
  dirty: boolean
  reviewOpen: boolean
  /** Global Mầm presentation: the review explanation opens inline. */
  mamReview?: boolean
  /** Option kind the adaptive review shows first. */
  preferKind?: ReviewPreference
  schedule: ReactNode
  preferences: ReactNode
  history: ReactNode
  onApplied: (result: AdaptiveReviewConfirmation) => Promise<void> | void
  onDiscardDraft: () => Promise<void> | void
  onRefreshPlan: () => Promise<void> | void
  onProposeReplacement: () => void
  onReviewReplacement: () => void
  onConfirmReplacement: () => void
  onDiscardReplacement: () => void
  onTogglePause: () => void
  onEnd: () => void
}>

type Detail = 'schedule' | 'preferences' | 'alternatives'

const reviewOutcome = {
  CURRENT_PLAN_VALID_ALTERNATIVES_AVAILABLE:
    'Có một phương án khác phù hợp. Kế hoạch hiện tại vẫn ổn nếu bạn muốn giữ.',
  CURRENT_PLAN_NOT_ADMISSIBLE:
    'Kế hoạch hiện tại không còn phù hợp với kết quả mới nhất. Bạn có thể chuyển sang phương án mới.',
  CURRENT_PLAN_VALID_NO_BETTER_ALTERNATIVE:
    'Phương án mới chưa khác kế hoạch hiện tại. Bạn cứ tiếp tục như đang làm.',
} as const

const detailCopy: Record<Detail, { title: string; lead: string }> = {
  schedule: {
    title: 'Lịch và thời lượng',
    lead: 'Đổi ngày, giờ và thời lượng của từng hoạt động cho hợp với nhịp sinh hoạt của bạn.',
  },
  preferences: {
    title: 'Điều bạn muốn ưu tiên',
    lead: 'Chọn điều bạn muốn tập trung để các hoạt động gợi ý hợp với bạn hơn.',
  },
  alternatives: {
    title: 'Phương án khác',
    lead: 'Phương án dựa trên bài đánh giá lại gần nhất. Kế hoạch hiện tại không đổi cho đến khi bạn xác nhận.',
  },
}

function AdjustRow({
  title,
  meta,
  onOpen,
  rowRef,
}: Readonly<{
  title: string
  meta: string
  onOpen: () => void
  rowRef: (node: HTMLButtonElement | null) => void
}>) {
  return (
    <button
      type="button"
      ref={rowRef}
      className="mbw-adjust-row"
      onClick={onOpen}
    >
      <span>
        <strong>{title}</strong>
        <small>{meta}</small>
      </span>
      <ChevronRight size={20} aria-hidden="true" />
    </button>
  )
}

export default function AdjustPanel({
  plan,
  replacement,
  review,
  busy,
  dirty,
  reviewOpen,
  mamReview,
  preferKind,
  schedule,
  preferences,
  history,
  onApplied,
  onDiscardDraft,
  onRefreshPlan,
  onProposeReplacement,
  onReviewReplacement,
  onConfirmReplacement,
  onDiscardReplacement,
  onTogglePause,
  onEnd,
}: Props) {
  const cycle = plan.cycle
  const locked = busy || dirty
  const due = cycle?.state === 'REVIEW_DUE'
  const [reviewShown, setReviewShown] = useState(reviewOpen || due)
  const [wasDue, setWasDue] = useState(due)
  const [detail, setDetail] = useState<Detail>()
  const [blockedBack, setBlockedBack] = useState(false)
  const [awaitingProposal, setAwaitingProposal] = useState(false)
  const [wasBusy, setWasBusy] = useState(busy)
  if (due !== wasDue) {
    // Open the review when the plan becomes due while this tab is shown.
    setWasDue(due)
    if (due) setReviewShown(true)
  }
  // Only the plan asked for here opens its screen; a draft a review option prepares is compared inside the review.
  if (awaitingProposal && replacement) {
    setAwaitingProposal(false)
    setDetail('alternatives')
  } else if (busy !== wasBusy) {
    setWasBusy(busy)
    if (!busy && !replacement) setAwaitingProposal(false)
  }

  function propose() {
    setAwaitingProposal(true)
    onProposeReplacement()
  }

  const rows = useRef<Partial<Record<Detail, HTMLButtonElement | null>>>({})
  const detailTitle = useRef<HTMLHeadingElement>(null)
  const returnTo = useRef<Detail | undefined>(undefined)
  useEffect(() => {
    // Keyboard and screen-reader users land on the new screen, and back on the row they came from.
    if (detail) detailTitle.current?.focus()
    else if (returnTo.current) rows.current[returnTo.current]?.focus()
  }, [detail])

  function openDetail(next: Detail) {
    setBlockedBack(false)
    setDetail(next)
  }

  function back() {
    if (dirty) {
      setBlockedBack(true)
      return
    }
    returnTo.current = detail
    setDetail(undefined)
  }

  const reviewNode = (
    <AdaptiveReview
      plan={plan}
      locked={locked}
      prefer={preferKind}
      pendingDraft={replacement}
      onApplied={onApplied}
      onDiscardDraft={onDiscardDraft}
      onRefreshPlan={onRefreshPlan}
      onProposeReplacement={propose}
      onOpenAlternatives={() => openDetail('alternatives')}
    />
  )
  const reviewDisclosure = (
    <Disclosure
      id="mbw-review"
      summary="Xem lại kế hoạch"
      open={reviewShown || undefined}
      onToggle={(event) => setReviewShown(event.currentTarget.open)}
    >
      {reviewShown && reviewNode}
    </Disclosure>
  )
  // What matters now: a review that is due, or its invite with the date.
  const inviteDay =
    cycle && ['IN_PROGRESS', 'PAUSED', 'REVIEW_DUE'].includes(cycle.state)
      ? dayLabel(cycle.reviewDueOn)
      : ''
  const showNow = due || Boolean(inviteDay)

  if (detail) {
    const copy = detailCopy[detail]
    return (
      <section
        className="mbw-adjust mbw-adjust-detail"
        aria-labelledby="mbw-detail-title"
      >
        <button type="button" className="mbw-back" onClick={back}>
          <ArrowLeft size={18} aria-hidden="true" />
          Quay lại Điều chỉnh
        </button>
        {blockedBack && dirty && (
          <p className="mbw-inline-alert" role="alert">
            Hãy lưu hoặc hoàn tác thay đổi đang dở trước khi quay lại.
          </p>
        )}
        <header className="mbw-detail-head">
          <h2 id="mbw-detail-title" ref={detailTitle} tabIndex={-1}>
            {copy.title}
          </h2>
          <p>{copy.lead}</p>
        </header>
        {/* The schedule and preference editors bring their own surface; only the alternatives need a card. */}
        {detail === 'schedule' && schedule}
        {detail === 'preferences' && preferences}
        {detail === 'alternatives' && (
          <div className="mbw-tile mbw-detail-card">
            <Alternatives
              plan={plan}
              replacement={replacement}
              review={review}
              mamReview={mamReview}
              busy={busy}
              locked={locked}
              onProposeReplacement={propose}
              onReviewReplacement={onReviewReplacement}
              onConfirmReplacement={onConfirmReplacement}
              onDiscardReplacement={onDiscardReplacement}
            />
          </div>
        )}
      </section>
    )
  }

  const actionCount = planActions(plan).length
  return (
    <div className="mbw-adjust">
      {dirty && (
        <p className="mbw-inline-alert" role="status">
          Hãy lưu hoặc hoàn tác thay đổi đang dở trước khi chọn việc khác.
        </p>
      )}
      {showNow && (
        <section
          className="mbw-tile mbw-nowcard"
          aria-labelledby="mbw-now-title"
        >
          <h2 id="mbw-now-title">
            {due
              ? 'Đã đến lúc xem lại kế hoạch'
              : `Lời mời xem lại: ${inviteDay}`}
          </h2>
          {due ? (
            <div id="mbw-review">{reviewNode}</div>
          ) : (
            <>
              <p>
                Bạn chọn giữ, đổi hoặc thử phương án khác. Kế hoạch không đổi
                cho đến khi bạn chọn.
              </p>
              {reviewDisclosure}
            </>
          )}
        </section>
      )}
      <div className="mbw-adjust-groups">
        <section className="mbw-adjust-group" aria-labelledby="mbw-group-cycle">
          <h3 id="mbw-group-cycle">Tùy chỉnh chu kỳ</h3>
          <div className="mbw-row-list">
            {!showNow && reviewDisclosure}
            <AdjustRow
              title="Lịch và thời lượng"
              meta={
                cycle
                  ? `${actionCount} hoạt động · chu kỳ ${cycle.lengthDays} ngày`
                  : `${actionCount} hoạt động`
              }
              rowRef={(node) => (rows.current.schedule = node)}
              onOpen={() => openDetail('schedule')}
            />
            <AdjustRow
              title="Điều bạn muốn ưu tiên"
              meta="Chọn điều bạn muốn tập trung"
              rowRef={(node) => (rows.current.preferences = node)}
              onOpen={() => openDetail('preferences')}
            />
            <AdjustRow
              title="Phương án khác"
              meta={
                replacement
                  ? 'Có phương án mới chờ bạn xem'
                  : 'Dựa trên bài đánh giá lại gần nhất'
              }
              rowRef={(node) => (rows.current.alternatives = node)}
              onOpen={() => openDetail('alternatives')}
            />
          </div>
        </section>

        <section
          className="mbw-adjust-group"
          aria-labelledby="mbw-group-support"
        >
          <h3 id="mbw-group-support">Hỗ trợ và quản lý</h3>
          <div className="mbw-row-list">
            <Disclosure
              summary="Hỗ trợ từ chuyên gia"
              meta="Bạn tự chọn và đặt lịch"
            >
              <p>
                Bạn tự chọn chuyên gia và tự xác nhận lịch hẹn. Kế hoạch không
                tự đặt lịch.
              </p>
              <Link className="mbw-secondary" href="/specialists">
                Tìm chuyên gia
              </Link>
            </Disclosure>
            <Disclosure summary="Các kế hoạch trước" meta="Các chu kỳ đã qua">
              {history}
            </Disclosure>
            <Disclosure
              summary="Tạm dừng hoặc kết thúc"
              meta={plan.status === 'PAUSED' ? 'Đang tạm dừng' : 'Khi cần nghỉ'}
            >
              <p>Tạm dừng khi bạn cần nghỉ, tiếp tục lúc nào cũng được.</p>
              <div className="mbw-actions">
                <button
                  type="button"
                  className="mbw-secondary"
                  disabled={locked}
                  onClick={onTogglePause}
                >
                  {plan.status === 'PAUSED'
                    ? 'Tiếp tục kế hoạch'
                    : 'Tạm dừng kế hoạch'}
                </button>
                <button
                  type="button"
                  className="mbw-text-button"
                  disabled={locked}
                  onClick={onEnd}
                >
                  Kết thúc kế hoạch
                </button>
              </div>
            </Disclosure>
          </div>
        </section>
      </div>
    </div>
  )
}

function Alternatives({
  plan,
  replacement,
  review,
  mamReview,
  busy,
  locked,
  onProposeReplacement,
  onReviewReplacement,
  onConfirmReplacement,
  onDiscardReplacement,
}: Readonly<{
  plan: SupportPlanV3
  replacement?: SupportPlanV3
  review?: NativeSupportPlanReplacementReview
  mamReview?: boolean
  busy: boolean
  locked: boolean
  onProposeReplacement: () => void
  onReviewReplacement: () => void
  onConfirmReplacement: () => void
  onDiscardReplacement: () => void
}>) {
  if (!replacement)
    return (
      <>
        <p>
          Chưa có phương án mới. Phương án được lập từ bài đánh giá lại gần
          nhất, và bạn xem trước khi áp dụng.
        </p>
        <div className="mbw-actions">
          <button
            type="button"
            className="mbw-secondary"
            disabled={locked}
            onClick={onProposeReplacement}
          >
            Xem phương án mới
          </button>
          <Link className="mbw-text-link" href={REASSESSMENT_HREF}>
            Làm bài đánh giá lại trước
          </Link>
        </div>
      </>
    )

  const diff = replacementDiff(plan, replacement)
  const outcome = (
    <p role="status">{review ? reviewOutcome[review.outcome] : ''}</p>
  )
  return (
    <div className="mbw-replacement">
      <div className="mbw-review-note">
        <p>
          <strong>{diff.summary}</strong>
        </p>
      </div>
      <ul
        className="mbw-activity-rows"
        aria-label="Hoạt động trong phương án mới"
      >
        {diff.next.map((item) => (
          <li key={item.actionId}>
            <span>{item.title}</span>
            <small>{item.kept ? 'Giữ nguyên' : 'Mới'}</small>
          </li>
        ))}
      </ul>
      {diff.removed.length > 0 && (
        <p className="mbw-quiet">
          Không còn trong phương án mới: {diff.removed.join(', ')}.
        </p>
      )}
      {/* Always mounted so the outcome is announced when it arrives. */}
      {mamReview ? (
        <SupportPlanMamReview review={review}>{outcome}</SupportPlanMamReview>
      ) : (
        outcome
      )}
      <div className="mbw-actions mbw-detail-actions">
        <button
          type="button"
          className="mbw-text-button"
          disabled={busy}
          onClick={onDiscardReplacement}
        >
          Không dùng phương án này
        </button>
        {review ? (
          <button
            type="button"
            className="mbw-primary"
            disabled={
              locked ||
              review.outcome === 'CURRENT_PLAN_VALID_NO_BETTER_ALTERNATIVE'
            }
            onClick={onConfirmReplacement}
          >
            Chuyển sang phương án mới
          </button>
        ) : (
          <button
            type="button"
            className="mbw-primary"
            disabled={locked}
            onClick={onReviewReplacement}
          >
            Kiểm tra phương án này
          </button>
        )}
      </div>
    </div>
  )
}
