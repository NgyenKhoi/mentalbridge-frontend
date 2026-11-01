'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { Disclosure } from '@/components/ui/Disclosure'
import type {
  AdaptiveReviewConfirmation,
  NativeSupportPlanReplacementReview,
  SupportPlanV3,
} from '../api/support-plan-contract'
import SupportPlanMamReview from '../components/SupportPlanMamReview'
import AdaptiveReview from './AdaptiveReview'
import { dayLabel } from './TodayPanel'
import { REASSESSMENT_HREF } from './workspace-links'
import { planActions } from './workspace-model'

type Props = Readonly<{
  plan: SupportPlanV3
  replacement?: SupportPlanV3
  review?: NativeSupportPlanReplacementReview
  busy: boolean
  dirty: boolean
  reviewOpen: boolean
  /** Global Mầm presentation: the review explanation opens inline. */
  mamReview?: boolean
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

const reviewOutcome = {
  CURRENT_PLAN_VALID_ALTERNATIVES_AVAILABLE:
    'Có một phương án khác phù hợp. Kế hoạch hiện tại vẫn ổn nếu bạn muốn giữ.',
  CURRENT_PLAN_NOT_ADMISSIBLE:
    'Kế hoạch hiện tại không còn phù hợp với kết quả mới nhất. Bạn có thể chuyển sang phương án mới.',
  CURRENT_PLAN_VALID_NO_BETTER_ALTERNATIVE:
    'Phương án mới chưa khác kế hoạch hiện tại. Bạn cứ tiếp tục như đang làm.',
} as const

export default function AdjustPanel({
  plan,
  replacement,
  review,
  busy,
  dirty,
  reviewOpen,
  mamReview,
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
  if (due !== wasDue) {
    // Open the review when the plan becomes due while this tab is shown.
    setWasDue(due)
    if (due) setReviewShown(true)
  }
  const reviewDisclosure = (
    <Disclosure
      id="mbw-review"
      summary="Xem lại kế hoạch"
      open={reviewShown || undefined}
      onToggle={(event) => setReviewShown(event.currentTarget.open)}
    >
      {reviewShown && (
        <AdaptiveReview
          plan={plan}
          locked={locked}
          pendingDraft={replacement}
          onApplied={onApplied}
          onDiscardDraft={onDiscardDraft}
          onRefreshPlan={onRefreshPlan}
        />
      )}
    </Disclosure>
  )
  // What matters now: a review that is due, or its invite with the date.
  const inviteDay =
    cycle && ['IN_PROGRESS', 'PAUSED', 'REVIEW_DUE'].includes(cycle.state)
      ? dayLabel(cycle.reviewDueOn)
      : ''
  const showNow = due || Boolean(inviteDay)
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
          <p>
            Bạn chọn giữ, đổi hoặc thử phương án khác. Kế hoạch không đổi cho
            đến khi bạn chọn.
          </p>
          {reviewDisclosure}
        </section>
      )}
      <div className="mbw-quiet-list">
        {!showNow && reviewDisclosure}
        <Disclosure summary="Lịch và thời lượng">{schedule}</Disclosure>
        <Disclosure summary="Điều bạn muốn ưu tiên">{preferences}</Disclosure>

        <Disclosure
          summary="Phương án khác"
          open={Boolean(replacement) || undefined}
        >
          {!replacement ? (
            <>
              <p>
                Phương án mới dựa trên lần kiểm tra lại gần nhất. Kế hoạch hiện
                tại không đổi cho đến khi bạn xác nhận.
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
                  Làm bài kiểm tra lại trước
                </Link>
              </div>
            </>
          ) : (
            <div className="mbw-replacement">
              <div
                className="mbw-compare"
                role="group"
                aria-label="So sánh hai phương án"
              >
                <section>
                  <p className="mbw-row-title">Đang dùng</p>
                  <ul>
                    {planActions(plan).map((action) => (
                      <li key={action.actionId}>{action.presentation.title}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <p className="mbw-row-title">Phương án mới</p>
                  <ul>
                    {planActions(replacement).map((action) => (
                      <li key={action.actionId}>{action.presentation.title}</li>
                    ))}
                  </ul>
                </section>
              </div>
              {/* Always mounted so the outcome is announced when it arrives. */}
              {mamReview ? (
                <SupportPlanMamReview review={review}>
                  <p role="status">
                    {review ? reviewOutcome[review.outcome] : ''}
                  </p>
                </SupportPlanMamReview>
              ) : (
                <p role="status">
                  {review ? reviewOutcome[review.outcome] : ''}
                </p>
              )}
              <div className="mbw-actions">
                {review ? (
                  <button
                    type="button"
                    className="mbw-primary"
                    disabled={
                      locked ||
                      review.outcome ===
                        'CURRENT_PLAN_VALID_NO_BETTER_ALTERNATIVE'
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
                    So sánh với kế hoạch hiện tại
                  </button>
                )}
                <button
                  type="button"
                  className="mbw-text-button"
                  disabled={busy}
                  onClick={onDiscardReplacement}
                >
                  Không dùng phương án này
                </button>
              </div>
            </div>
          )}
        </Disclosure>

        <Disclosure summary="Hỗ trợ từ chuyên gia">
          <p>
            Bạn tự chọn chuyên gia và tự xác nhận lịch hẹn. Kế hoạch không tự
            đặt lịch.
          </p>
          <Link className="mbw-secondary" href="/specialists">
            Tìm chuyên gia
          </Link>
        </Disclosure>

        <Disclosure summary="Tạm dừng hoặc kết thúc">
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

        <Disclosure summary="Các kế hoạch trước">{history}</Disclosure>
      </div>
    </div>
  )
}
