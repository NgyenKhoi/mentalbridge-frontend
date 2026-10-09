'use client'

import { useEffect, useId, useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import {
  getResourceDetail,
  type PublicResourceDetail,
} from '@/features/resources/api/browser-resources'
import { structuredResourceContent } from '@/features/resources/model/structured-resource-content'
import type { SupportPlanOccurrence } from '../api/support-plan-contract'
import SupportPlanIcon from './SupportPlanIcon'
import { formatActivityDateTime } from './support-plan-format'

type EditableState = 'COMPLETED' | 'SKIPPED'

type Props = Readonly<{
  occurrence: SupportPlanOccurrence | null
  open: boolean
  onClose: () => void
  authoritativePlanStatus: 'ACTIVE' | 'PAUSED'
  busy: boolean
  href: string | null
  onStartEditing: (state: EditableState) => void
  onReopen: () => void
  onToggleVisibility: () => void
  onRemove: () => void
}>

export default function SupportPlanActivityModal({
  occurrence,
  open,
  onClose,
  authoritativePlanStatus,
  busy,
  href,
  onStartEditing,
  onReopen,
  onToggleVisibility,
  onRemove,
}: Props) {
  const titleId = useId()
  const descId = useId()
  const [resource, setResource] = useState<PublicResourceDetail | null>(null)
  const [resourceError, setResourceError] = useState(false)
  const resourceId =
    occurrence?.source.type === 'RESOURCE' ? occurrence.source.resourceId : null
  const contentVersion = occurrence?.source.contentVersion ?? undefined

  useEffect(() => {
    if (!open || !resourceId || !contentVersion) return

    const controller = new AbortController()
    void getResourceDetail(resourceId, contentVersion, controller.signal)
      .then((detail) => {
        setResource(detail)
        setResourceError(false)
      })
      .catch(() => {
        if (!controller.signal.aborted) setResourceError(true)
      })

    return () => controller.abort()
  }, [contentVersion, open, resourceId])

  if (!occurrence) return null

  const canEdit = authoritativePlanStatus === 'ACTIVE'
  const isScheduled = occurrence.state === 'SCHEDULED'
  const editableState: EditableState | undefined =
    occurrence.state === 'COMPLETED' || occurrence.state === 'SKIPPED'
      ? occurrence.state
      : undefined
  const structured = resource ? structuredResourceContent(resource) : null
  const steps = structured?.steps ?? []
  const cautions = [
    ...(structured?.cautions ?? []),
    ...(resource?.safetyNotes ?? []),
  ]
  const sourceLabel = {
    RESOURCE: 'Hoạt động',
    JOURNAL_PROMPT: 'Nhật ký',
    EMOTION_CHECK_IN_PROMPT: 'Cảm xúc',
  }[occurrence.source.type]
  const stateLabel = {
    SCHEDULED: 'Sắp tới',
    MISSED: 'Đã qua giờ',
    COMPLETED: 'Đã hoàn thành',
    SKIPPED: 'Đã bỏ qua',
    CANCELLED: 'Đã huỷ',
  }[occurrence.displayState]

  function handleAction(fn: () => void) {
    fn()
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onClose}
      labelledBy={titleId}
      describedBy={descId}
      className="mb-sp-dialog-override"
    >
      <div className="mb-sp-modal-content">
        <div className="mb-sp-modal-svg-header">
          <button
            type="button"
            className="mb-sp-modal-close"
            aria-label="Đóng popup"
            onClick={onClose}
          >
            <SupportPlanIcon name="close" size={20} />
          </button>
          <svg
            viewBox="0 0 640 96"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <path
              d="M0,96 L640,96 L640,64 Q480,32 320,64 Q160,96 0,64 Z"
              fill="#b0e0c9"
              opacity="0.5"
            />
            <circle cx="500" cy="30" r="20" fill="#f8ead0" />
          </svg>
        </div>

        <div className="mb-sp-modal-body">
          <div className="mb-sp-modal-intro">
            <div className="mb-sp-modal-header-meta">
              <span className="mb-sp-chip highlight">{stateLabel}</span>
              <span className="mb-sp-modal-date">
                {formatActivityDateTime(occurrence)}
              </span>
              {resource?.expectedDurationMinutes ? (
                <span>· {resource.expectedDurationMinutes} phút</span>
              ) : null}
            </div>
            <h2 id={titleId} className="mb-sp-modal-title">
              {occurrence.source.title}
            </h2>
            <p id={descId} className="mb-sp-modal-desc">
              {resource?.summary ??
                (resourceId && contentVersion
                  ? resourceError
                    ? 'Chưa tải được nội dung chi tiết. Vui lòng mở lại để thử lần nữa.'
                    : 'Đang tải nội dung hoạt động…'
                  : 'Mục này nằm trong lịch của kế hoạch hỗ trợ của bạn.')}
            </p>
          </div>

          <div className="mb-sp-modal-links">
            <span className="mb-sp-modal-link-chip">
              Thuộc: <strong>Kế hoạch hỗ trợ</strong>
            </span>
            <span className="mb-sp-modal-link-chip">
              Loại: <strong>{sourceLabel}</strong>
            </span>
            {resource?.sourceOrganization ? (
              <span className="mb-sp-modal-link-chip">
                Nguồn: <strong>{resource.sourceOrganization}</strong>
              </span>
            ) : null}
          </div>

          {steps.length > 0 ? (
            <section className="mb-sp-modal-steps">
              <h3 className="mb-sp-modal-steps-title">Cách thực hiện</h3>
              {steps.map((step, index) => (
                <div className="mb-sp-modal-step" key={`${index}-${step}`}>
                  <span className="mb-sp-modal-step-num" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </section>
          ) : null}

          {cautions.length > 0 ? (
            <section className="mb-sp-modal-safety">
              <SupportPlanIcon name="info" size={18} />
              <div className="mb-sp-modal-safety-text">
                <strong>Lưu ý khi thực hiện</strong>
                {cautions.map((note, index) => (
                  <p key={`${index}-${note}`}>{note}</p>
                ))}
              </div>
            </section>
          ) : null}

          {canEdit && occurrence.state !== 'CANCELLED' ? (
            <button
              type="button"
              className="mb-sp-modal-visibility"
              aria-label={
                occurrence.hidden
                  ? 'Hiện lại hoạt động'
                  : 'Ẩn hoạt động khỏi danh sách'
              }
              disabled={busy}
              onClick={() => handleAction(onToggleVisibility)}
            >
              <SupportPlanIcon
                name={occurrence.hidden ? 'visibility' : 'visibility_off'}
                size={16}
              />
              {occurrence.hidden ? 'Hiện lại hoạt động' : 'Ẩn khỏi danh sách'}
            </button>
          ) : null}
        </div>

        <div className="mb-sp-modal-footer">
          {href ? (
            <a
              href={href}
              className="mb-sp-primary-btn"
              aria-label={
                isScheduled ? 'Bắt đầu hoạt động' : 'Xem lại hoạt động'
              }
            >
              {isScheduled ? 'Bắt đầu' : 'Xem lại'}
              <SupportPlanIcon name="arrow_forward" size={16} />
            </a>
          ) : null}

          {isScheduled && canEdit ? (
            <button
              type="button"
              className="mb-sp-btn-outline"
              aria-label="Ghi nhận đã làm"
              disabled={busy}
              onClick={() => handleAction(() => onStartEditing('COMPLETED'))}
            >
              Ghi nhận đã làm
            </button>
          ) : null}

          {editableState && canEdit ? (
            <button
              type="button"
              className="mb-sp-btn-outline"
              aria-label="Sửa ghi nhận"
              disabled={busy}
              onClick={() => handleAction(() => onStartEditing(editableState))}
            >
              Sửa ghi nhận
            </button>
          ) : null}

          {editableState && canEdit ? (
            <button
              type="button"
              className="mb-sp-btn-outline"
              aria-label="Mở lại hoạt động"
              disabled={busy}
              onClick={() => handleAction(onReopen)}
            >
              Mở lại
            </button>
          ) : null}

          {isScheduled && canEdit ? (
            <button
              type="button"
              className="mb-sp-btn-text"
              aria-label="Bỏ qua hoạt động"
              disabled={busy}
              onClick={() => handleAction(() => onStartEditing('SKIPPED'))}
            >
              Bỏ qua
            </button>
          ) : editableState && canEdit ? (
            <button
              type="button"
              className="mb-sp-btn-text"
              aria-label="Xóa phần tự ghi nhận"
              disabled={busy}
              onClick={() => handleAction(onRemove)}
            >
              Xóa ghi nhận
            </button>
          ) : null}
        </div>
      </div>
    </Dialog>
  )
}
