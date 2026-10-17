'use client'

import React from 'react'
import type { JournalSummary } from '@/lib/journal/journal-contract'
import type { JournalDateGroup } from '../types'
import { JournalEntryCard } from './JournalEntryCard'

interface JournalTimelineProps {
  year: number
  month: number // 0-indexed
  groupedByDate: JournalDateGroup[]
  hasTotalEntries: boolean
  loading: boolean
  error?: string
  onRetry: () => void
  onOpenCreate: () => void
  onResetFilters: () => void
  onOpenDetail: (entry: JournalSummary, target: HTMLElement) => void
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
}

export function JournalTimeline({
  year,
  month,
  groupedByDate,
  hasTotalEntries,
  loading,
  error,
  onRetry,
  onOpenCreate,
  onResetFilters,
  onOpenDetail,
  hasMore,
  loadingMore,
  onLoadMore,
}: JournalTimelineProps) {
  if (loading) {
    return (
      <div className="timeline-loading" role="status" aria-live="polite">
        <div className="month-skeleton" />
        <div className="card-skeleton" />
        <div className="card-skeleton" />
        <p className="sr-only">Đang tải nhật ký…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="empty journal-error-state" role="alert">
        <p>{error}</p>
        <button type="button" className="btn" onClick={onRetry}>
          Thử lại
        </button>
      </div>
    )
  }

  // Entire account has 0 entries
  if (!hasTotalEntries) {
    return (
      <div className="empty no-entries-state">
        <h3>Chưa có nhật ký</h3>
        <p>Ghi lại điều bạn muốn lưu giữ theo cách riêng của mình.</p>
        <button type="button" className="btn" onClick={onOpenCreate}>
          Viết nhật ký đầu tiên
        </button>
      </div>
    )
  }

  // Filter returned no matches
  if (groupedByDate.length === 0) {
    return (
      <div className="empty">
        <p>Không có ghi chép phù hợp.</p>
        <button
          type="button"
          className="reset-filters-btn"
          onClick={onResetFilters}
        >
          Xóa bộ lọc
        </button>
      </div>
    )
  }

  return (
    <div className="timeline-wrapper">
      <div className="month">
        Tháng {month + 1}, {year}
      </div>

      <div className="tl">
        {groupedByDate.map((group) => (
          <div key={group.dateKey} className="timeline-group">
            <div className="dh">
              {group.title} <span>{group.subtitle}</span>
            </div>
            {group.entries.map((entry) => (
              <JournalEntryCard
                key={entry.id}
                entry={entry}
                onOpenDetail={onOpenDetail}
              />
            ))}
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="load-more-row">
          <button
            type="button"
            className="journal-load-more"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Đang tải…' : 'Xem thêm nhật ký cũ hơn'}
          </button>
        </div>
      )}
    </div>
  )
}
