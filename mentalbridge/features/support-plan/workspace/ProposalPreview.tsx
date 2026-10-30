'use client'

import { useId, type ReactNode } from 'react'
import { Disclosure } from '@/components/ui/Disclosure'
import type { SupportPlanV3 } from '../api/support-plan-contract'
import { cadenceLine } from './PlanPanel'
import { estimateDailyMinutes, planActions } from './workspace-model'

type Props = Readonly<{
  draft: SupportPlanV3
  busy: boolean
  starting: boolean
  updating: boolean
  /** Why Start is unavailable for now (a stale draft); shown next to the button. */
  blockedReason?: string
  preferences: ReactNode
  /** Resource choices, only for an older resource-based draft. */
  choices?: ReactNode
  schedule: ReactNode
  onStart: () => void
  onDiscard: () => void
}>

/** The first useful thing after starting: professional help first, then by order. */
export function firstAction(plan: SupportPlanV3) {
  const actions = planActions(plan).filter(
    (action) =>
      action.status !== 'ENDED' &&
      action.actionType !== 'REASSESSMENT_SCREENING',
  )
  return (
    actions.find(
      (action) =>
        action.actionType === 'PROFESSIONAL_SUPPORT' &&
        action.pathRole === 'PRIMARY',
    ) ?? actions[0]
  )
}

export default function ProposalPreview({
  draft,
  busy,
  starting,
  updating,
  blockedReason,
  preferences,
  choices,
  schedule,
  onStart,
  onDiscard,
}: Props) {
  const statusId = useId()
  const first = firstAction(draft)
  const fourteenDays = Boolean(draft.cycle)
  const minutes = estimateDailyMinutes(draft)
  return (
    <section className="mbw-proposal" aria-labelledby="mbw-proposal-title">
      <div className="mbw-tile mbw-proposal-head">
        <h2 id="mbw-proposal-title">
          {fourteenDays
            ? 'Kế hoạch 14 ngày dành cho bạn'
            : 'Kế hoạch đang chờ bạn bắt đầu'}
        </h2>
        <p className="mbw-lead">
          {minutes > 0 && `Khoảng ${minutes} phút mỗi ngày. `}Bạn đổi lịch được
          bất cứ lúc nào.
        </p>
        {first && (
          <div className="mbw-first">
            <p className="mbw-quiet">Việc đầu tiên</p>
            <p className="mbw-row-title">{first.presentation.title}</p>
            <p className="mbw-quiet">{cadenceLine(first)}</p>
          </div>
        )}
      </div>

      <div className="mbw-proposal-focuses">
        {(draft.focuses ?? []).map((focus) => (
          <section
            key={focus.focusId}
            className="mbw-focus"
            aria-labelledby={`proposal-focus-${focus.focusId}`}
          >
            <h3 id={`proposal-focus-${focus.focusId}`}>{focus.title}</h3>
            {focus.rationale && <p className="mbw-why">{focus.rationale}</p>}
            <ul className="mbw-action-list">
              {focus.actions
                .filter((action) => action.status !== 'ENDED')
                .map((action) => (
                  <li key={action.actionId}>
                    <p className="mbw-row-title">{action.presentation.title}</p>
                    <p className="mbw-quiet">{cadenceLine(action)}</p>
                  </li>
                ))}
            </ul>
          </section>
        ))}
        {fourteenDays && (
          <p className="mbw-quiet">
            Sau 14 ngày, bạn được mời xem lại kế hoạch. Không có gì tự thay đổi
            nếu bạn chưa chọn.
          </p>
        )}
      </div>

      <Disclosure summary="Điều chỉnh theo ý bạn (không bắt buộc)">
        {preferences}
      </Disclosure>
      {choices && (
        <Disclosure summary="Chọn nội dung (không bắt buộc)">
          {choices}
        </Disclosure>
      )}
      <Disclosure summary="Đổi giờ và nhịp">{schedule}</Disclosure>

      <div className="mbw-sticky-actions">
        {/* Always mounted so the change of text is announced. */}
        <p id={statusId} className="mbw-quiet" role="status">
          {updating
            ? 'Đang cập nhật kế hoạch theo lựa chọn của bạn…'
            : (blockedReason ?? '')}
        </p>
        <div className="mbw-actions">
          <button
            type="button"
            className="mbw-primary"
            disabled={busy || updating || Boolean(blockedReason)}
            aria-describedby={statusId}
            onClick={onStart}
          >
            {starting ? 'Đang bắt đầu…' : 'Bắt đầu kế hoạch'}
          </button>
          <button
            type="button"
            className="mbw-text-button"
            disabled={busy || updating}
            onClick={onDiscard}
          >
            Không dùng kế hoạch này
          </button>
        </div>
      </div>
    </section>
  )
}
