'use client'

import type { ReactNode } from 'react'

import type { SupportPlanOccurrence } from '../api/support-plan-contract'
import SupportPlanIcon from './SupportPlanIcon'
import { stateLabels, timeLabel } from './SupportPlanFeaturedActivity'
import { formatActivityDate } from './support-plan-format'

type EditableState = 'COMPLETED' | 'SKIPPED'

type Props = Readonly<{
  occurrence: SupportPlanOccurrence
  authoritativePlanStatus: 'ACTIVE' | 'PAUSED'
  busy: boolean
  isEditing: boolean
  onStartEditing: (state: EditableState) => void
  onReopen: () => void
  onToggleVisibility: () => void
  onRemove: () => void
  renderForm: () => ReactNode
}>

const sourceLabels: Record<SupportPlanOccurrence['source']['type'], string> = {
  RESOURCE: 'Hoạt động',
  JOURNAL_PROMPT: 'Nhật ký',
  EMOTION_CHECK_IN_PROMPT: 'Cảm xúc',
}

function resourceHref(occurrence: SupportPlanOccurrence) {
  if (
    occurrence.source.type !== 'RESOURCE' ||
    !occurrence.source.resourceId ||
    !occurrence.source.contentVersion
  ) {
    return null
  }
  const query = new URLSearchParams({
    from: 'support-plan',
    contentVersion: occurrence.source.contentVersion,
  })
  return `/resources/${occurrence.source.resourceId}?${query.toString()}`
}

export default function SupportPlanActivityRow({
  occurrence,
  authoritativePlanStatus,
  busy,
  isEditing,
  onStartEditing,
  onReopen,
  onToggleVisibility,
  onRemove,
  renderForm,
}: Props) {
  const href = resourceHref(occurrence)
  const canEdit = authoritativePlanStatus === 'ACTIVE'
  const isScheduled = occurrence.state === 'SCHEDULED'
  const editableState: EditableState | undefined =
    occurrence.state === 'COMPLETED' || occurrence.state === 'SKIPPED'
      ? occurrence.state
      : undefined

  return (
    <article className="support-plan-activity-row">
      <div className="support-plan-row-left">
        {canEdit && isScheduled ? (
          <button
            className="support-plan-row-check-btn is-empty"
            type="button"
            disabled={busy}
            aria-label="Ghi nhận đã làm"
            onClick={() => onStartEditing('COMPLETED')}
          />
        ) : (
          <span
            className={`support-plan-row-check-btn ${occurrence.state === 'COMPLETED' ? 'is-checked' : ''}`}
            aria-hidden="true"
          >
            <SupportPlanIcon
              name={occurrence.state === 'COMPLETED' ? 'check' : 'remove'}
            />
          </span>
        )}
      </div>
      <div className="support-plan-row-main">
        <div className="support-plan-row-meta">
          <span className="support-plan-row-date">
            {formatActivityDate(occurrence.localDate)}
          </span>
          <span className="support-plan-row-time">{timeLabel(occurrence)}</span>
          <span className="support-plan-row-type">
            {sourceLabels[occurrence.source.type]}
          </span>
          <span className="support-plan-row-duration">
            {stateLabels[occurrence.displayState]}
          </span>
        </div>
        <h5 className="support-plan-row-title">{occurrence.source.title}</h5>
        {occurrence.reflection ? (
          <p className="support-plan-row-desc">{occurrence.reflection}</p>
        ) : null}
        {isEditing ? (
          renderForm()
        ) : (
          <div className="support-plan-row-actions">
            {href ? (
              <a href={href} className="support-plan-row-start-btn">
                Bắt đầu hoạt động
              </a>
            ) : null}
            {canEdit && isScheduled ? (
              <>
                <button
                  type="button"
                  className="support-plan-btn-secondary"
                  disabled={busy}
                  onClick={() => onStartEditing('COMPLETED')}
                >
                  <SupportPlanIcon name="check" size={14} />
                  Ghi nhận đã làm
                </button>
                <button
                  type="button"
                  className="support-plan-btn-ghost"
                  disabled={busy}
                  onClick={() => onStartEditing('SKIPPED')}
                >
                  Ghi nhận bỏ qua
                </button>
              </>
            ) : null}
            {canEdit && editableState ? (
              <>
                <button
                  type="button"
                  className="support-plan-btn-ghost"
                  disabled={busy}
                  onClick={() => onStartEditing(editableState)}
                >
                  Chỉnh sửa tự ghi nhận
                </button>
                <button
                  type="button"
                  className="support-plan-btn-ghost"
                  disabled={busy}
                  onClick={onReopen}
                >
                  Mở lại
                </button>
                <button
                  type="button"
                  className="support-plan-btn-ghost"
                  disabled={busy}
                  onClick={onRemove}
                >
                  Xoá tự ghi nhận
                </button>
              </>
            ) : null}
            {canEdit && occurrence.state !== 'CANCELLED' ? (
              <button
                type="button"
                className="support-plan-btn-ghost"
                disabled={busy}
                onClick={onToggleVisibility}
              >
                {occurrence.hidden ? 'Hiện lại' : 'Ẩn khỏi danh sách'}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </article>
  )
}
