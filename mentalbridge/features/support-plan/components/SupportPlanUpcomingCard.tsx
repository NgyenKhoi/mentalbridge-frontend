'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  getResourceDetail,
  type PublicResourceDetail,
} from '@/features/resources/api/browser-resources'
import type { SupportPlanOccurrence } from '../api/support-plan-contract'
import SupportPlanIcon from './SupportPlanIcon'
import { formatActivityDateTime } from './support-plan-format'

const sourceLabels: Record<SupportPlanOccurrence['source']['type'], string> = {
  RESOURCE: 'Hoạt động',
  JOURNAL_PROMPT: 'Nhật ký',
  EMOTION_CHECK_IN_PROMPT: 'Cảm xúc',
}

const stateLabels: Record<SupportPlanOccurrence['displayState'], string> = {
  SCHEDULED: 'Sắp tới',
  MISSED: 'Đã qua giờ',
  COMPLETED: 'Đã hoàn thành',
  SKIPPED: 'Đã bỏ qua',
  CANCELLED: 'Đã huỷ',
}

type Props = Readonly<{
  occurrence: SupportPlanOccurrence
  position: number
  isNext: boolean
  listMode?: boolean
  isToday?: boolean
  isEditing: boolean
  renderForm: () => ReactNode
  onOpen: () => void
}>

export default function SupportPlanUpcomingCard({
  occurrence,
  position,
  isNext,
  listMode = false,
  isToday = false,
  isEditing,
  renderForm,
  onOpen,
}: Props) {
  const [resource, setResource] = useState<PublicResourceDetail | null>(null)
  const [resourceUnavailable, setResourceUnavailable] = useState(false)
  const resourceId =
    occurrence.source.type === 'RESOURCE' ? occurrence.source.resourceId : null
  const contentVersion = occurrence.source.contentVersion ?? undefined

  useEffect(() => {
    if (!resourceId || !contentVersion) return

    const controller = new AbortController()
    void getResourceDetail(resourceId, contentVersion, controller.signal)
      .then((detail) => setResource(detail))
      .catch(() => {
        if (!controller.signal.aborted) setResourceUnavailable(true)
      })

    return () => controller.abort()
  }, [contentVersion, resourceId])

  const completed = occurrence.displayState === 'COMPLETED'
  const priority = isNext && occurrence.displayState === 'SCHEDULED'
  const canStart =
    priority &&
    occurrence.source.type === 'RESOURCE' &&
    Boolean(occurrence.source.resourceId && occurrence.source.contentVersion)
  const actionLabel = canStart
    ? 'Bắt đầu ngay'
    : completed
      ? 'Xem lại'
      : 'Xem chi tiết'
  const categoryLabel =
    resource?.category === 'ARTICLE'
      ? 'Bài đọc'
      : resource?.category === 'VIDEO'
        ? 'Video'
        : resource?.resourceKind === 'PRACTICE'
          ? 'Bài thực hành'
          : sourceLabels[occurrence.source.type]

  return (
    <article
      className={`mb-sp-card${priority ? ' is-featured' : ''}${listMode ? ' is-list-card' : ''}`}
    >
      <span
        className={`mb-sp-card-left${completed ? ' is-completed' : ''}`}
        aria-hidden="true"
      >
        {completed ? <SupportPlanIcon name="check" size={18} /> : position}
      </span>
      <div className="mb-sp-card-middle">
        <div className="mb-sp-card-meta">
          <span className="mb-sp-chip">
            {listMode ? categoryLabel : sourceLabels[occurrence.source.type]}
          </span>
          {!listMode ? <span>{formatActivityDateTime(occurrence)}</span> : null}
          {resource?.expectedDurationMinutes ? (
            <span>· {resource.expectedDurationMinutes} phút</span>
          ) : null}
          <span className="mb-sp-card-state">
            {stateLabels[occurrence.displayState]}
          </span>
          {priority ? (
            <span className="mb-sp-card-priority">
              Ưu tiên tiếp theo{listMode && isToday ? ' · Hôm nay' : ''}
            </span>
          ) : null}
        </div>
        <h5 className="mb-sp-card-title">{occurrence.source.title}</h5>
        {resource?.summary || occurrence.reflection || resourceUnavailable ? (
          <p className="mb-sp-card-desc">
            {resource?.summary ||
              occurrence.reflection ||
              'Chưa tải được tóm tắt. Chọn xem chi tiết để thử lại.'}
          </p>
        ) : null}
        {isEditing ? renderForm() : null}
      </div>
      {!isEditing ? (
        <button
          type="button"
          className={canStart ? 'mb-sp-primary-btn' : 'mb-sp-card-detail-btn'}
          aria-label={`${actionLabel}: ${occurrence.source.title}`}
          onClick={onOpen}
        >
          {actionLabel}
          {canStart ? <SupportPlanIcon name="arrow_forward" size={16} /> : null}
        </button>
      ) : null}
    </article>
  )
}
