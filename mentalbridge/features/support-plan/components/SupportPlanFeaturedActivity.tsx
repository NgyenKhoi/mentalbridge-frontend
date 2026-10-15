'use client'

import type { ReactNode } from 'react'

import { Disclosure } from '@/components/ui/Disclosure'

import type { SupportPlanOccurrence } from '../api/support-plan-contract'
import SupportPlanIcon, { type SupportPlanIconName } from './SupportPlanIcon'
import { formatActivityDateTime } from './support-plan-format'

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

export const stateLabels: Record<
  SupportPlanOccurrence['displayState'],
  string
> = {
  SCHEDULED: 'Sắp tới',
  MISSED: 'Đã qua giờ',
  COMPLETED: 'Bạn đã ghi nhận là đã làm',
  SKIPPED: 'Bạn đã ghi nhận là bỏ qua',
  CANCELLED: 'Đã huỷ theo kế hoạch',
}

const sourceLabels: Record<SupportPlanOccurrence['source']['type'], string> = {
  RESOURCE: 'Hoạt động',
  JOURNAL_PROMPT: 'Nhật ký',
  EMOTION_CHECK_IN_PROMPT: 'Cảm xúc',
}

const technicalSourceLabels: Record<
  SupportPlanOccurrence['source']['type'],
  string
> = {
  RESOURCE: 'Tài nguyên',
  JOURNAL_PROMPT: 'Nhật ký',
  EMOTION_CHECK_IN_PROMPT: 'Cảm xúc',
}

const sourceIcons: Record<
  SupportPlanOccurrence['source']['type'],
  SupportPlanIconName
> = {
  RESOURCE: 'menu_book',
  JOURNAL_PROMPT: 'edit_note',
  EMOTION_CHECK_IN_PROMPT: 'sentiment_satisfied',
}

export function timeLabel(occurrence: SupportPlanOccurrence) {
  return occurrence.localTime.slice(0, 5)
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

function statusClass(state: SupportPlanOccurrence['displayState']) {
  if (state === 'COMPLETED') return 'is-completed'
  if (state === 'SKIPPED' || state === 'MISSED' || state === 'CANCELLED') {
    return 'is-skipped'
  }
  return 'is-upcoming'
}

type FeaturedActionsProps = Pick<
  Props,
  'busy' | 'onStartEditing' | 'onReopen' | 'onToggleVisibility' | 'onRemove'
> &
  Readonly<{
    occurrence: SupportPlanOccurrence
    isScheduled: boolean
    canEdit: boolean
    editableState?: EditableState
    href?: string | null
  }>

function FeaturedActions({
  occurrence,
  busy,
  isScheduled,
  canEdit,
  editableState,
  href,
  onStartEditing,
  onReopen,
  onToggleVisibility,
  onRemove,
}: FeaturedActionsProps) {
  return (
    <div className="support-plan-featured-actions">
      <div className="support-plan-featured-primary-actions">
        {href ? (
          <a
            className="support-plan-featured-start-btn"
            href={href}
            aria-label="Bắt đầu hoạt động"
          >
            <span>Bắt đầu hoạt động</span>
            <SupportPlanIcon name="arrow_forward" />
          </a>
        ) : null}
        {isScheduled ? (
          <>
            <button
              className="support-plan-btn-ghost"
              type="button"
              disabled={busy}
              onClick={() => onStartEditing('COMPLETED')}
            >
              <SupportPlanIcon name="check" size={14} />
              <span>Ghi nhận đã làm</span>
            </button>
            <button
              className="support-plan-btn-ghost"
              type="button"
              disabled={busy}
              onClick={() => onStartEditing('SKIPPED')}
            >
              Ghi nhận bỏ qua
            </button>
          </>
        ) : null}
        {editableState ? (
          <>
            <button
              className="support-plan-btn-ghost"
              type="button"
              disabled={busy}
              onClick={() => onStartEditing(editableState)}
            >
              Chỉnh sửa tự ghi nhận
            </button>
            <button
              className="support-plan-btn-ghost"
              type="button"
              disabled={busy}
              onClick={onReopen}
            >
              Mở lại
            </button>
            <button
              className="support-plan-btn-ghost"
              type="button"
              disabled={busy}
              onClick={onRemove}
            >
              Xoá tự ghi nhận
            </button>
          </>
        ) : null}
        {canEdit && occurrence.state !== 'CANCELLED' ? (
          <button
            className="support-plan-btn-ghost"
            type="button"
            disabled={busy}
            onClick={onToggleVisibility}
          >
            {occurrence.hidden ? 'Hiện lại' : 'Ẩn khỏi danh sách'}
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default function SupportPlanFeaturedActivity({
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
    <article className="support-plan-featured-card">
      <span className="support-plan-featured-accent-bar" aria-hidden="true" />
      <div className="support-plan-featured-body">
        <span className="support-plan-featured-icon-box" aria-hidden="true">
          <SupportPlanIcon name={sourceIcons[occurrence.source.type]} />
        </span>
        <div className="support-plan-featured-info">
          <div className="support-plan-featured-badges">
            <span
              className={`support-plan-featured-status-badge ${statusClass(occurrence.displayState)}`}
            >
              {stateLabels[occurrence.displayState]}
            </span>
            <span className="support-plan-featured-type-badge">
              {sourceLabels[occurrence.source.type]}
            </span>
          </div>
          <div className="support-plan-featured-time-meta">
            <span>{formatActivityDateTime(occurrence)}</span>
          </div>
          <h4 className="support-plan-featured-title">
            {occurrence.source.title}
          </h4>
          {occurrence.reflection ? (
            <p className="support-plan-reflection">{occurrence.reflection}</p>
          ) : null}
          <Disclosure
            className="support-plan-featured-disclosure"
            summary="Chi tiết hoạt động"
          >
            <p>
              {technicalSourceLabels[occurrence.source.type]} trong kế hoạch ·
              lịch {occurrence.scheduleVersion} · SupportPlan{' '}
              {occurrence.source.supportPlanVersion}
            </p>
            {occurrence.source.contentVersion ? (
              <p>
                Phiên bản tài nguyên {occurrence.source.contentVersion}
                {occurrence.source.slotId
                  ? ` · slot ${occurrence.source.slotId}`
                  : ''}
              </p>
            ) : null}
          </Disclosure>
        </div>
      </div>
      {isEditing ? renderForm() : null}
      {!isEditing ? (
        <FeaturedActions
          occurrence={occurrence}
          busy={busy}
          isScheduled={isScheduled && canEdit}
          canEdit={canEdit}
          editableState={canEdit ? editableState : undefined}
          href={href}
          onStartEditing={onStartEditing}
          onReopen={onReopen}
          onToggleVisibility={onToggleVisibility}
          onRemove={onRemove}
        />
      ) : null}
    </article>
  )
}
