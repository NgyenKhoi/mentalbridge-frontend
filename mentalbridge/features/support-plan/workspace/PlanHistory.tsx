'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Disclosure } from '@/components/ui/Disclosure'
import { getSupportPlanActionHistory } from '../api/browser-support-plan-actions'
import type { SupportPlanActionHistory } from '../api/support-plan-contract'
import { planActions } from './workspace-model'

const statusLabels = {
  DRAFT: 'Chưa bắt đầu',
  ACTIVE: 'Đang dùng',
  PAUSED: 'Tạm dừng',
  COMPLETED: 'Đã kết thúc',
  SUPERSEDED: 'Đã thay bằng phương án khác',
  DISCARDED: 'Đã bỏ đề xuất',
} as const

const dateFormat = new Intl.DateTimeFormat('vi-VN', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
})

/** Loads lazily when opened; history is read-only and never mutates a plan. */
export default function PlanHistory({
  initial,
}: Readonly<{ initial?: SupportPlanActionHistory }>) {
  const [history, setHistory] = useState(initial)
  const [failed, setFailed] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const inFlight = useRef(false)
  const load = useCallback(async (cursor?: string) => {
    // One page at a time: a double tap must not append the same page twice.
    if (inFlight.current) return
    inFlight.current = true
    setLoadingMore(Boolean(cursor))
    setFailed(false)
    try {
      const page = await getSupportPlanActionHistory(cursor)
      setHistory((previous) =>
        cursor && previous
          ? { ...page, items: [...previous.items, ...page.items] }
          : page,
      )
    } catch {
      setFailed(true)
    } finally {
      inFlight.current = false
      setLoadingMore(false)
    }
  }, [])
  useEffect(() => {
    if (initial) return
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [initial, load])

  if (failed)
    return (
      <p role="alert" className="mbw-quiet">
        Chưa tải được lịch sử.{' '}
        <button
          type="button"
          className="mbw-link-button"
          onClick={() => void load()}
        >
          Thử lại
        </button>
      </p>
    )
  if (!history)
    return (
      <p role="status" className="mbw-quiet">
        Đang tải lịch sử…
      </p>
    )
  if (history.items.length === 0)
    return <p className="mbw-quiet">Chưa có kế hoạch nào đã khép lại.</p>
  return (
    <div className="mbw-history">
      {history.items.map((item) => (
        <Disclosure
          key={item.supportPlanId}
          summary={`${statusLabels[item.status]} · ${dateFormat.format(new Date(item.updatedAt))}`}
        >
          <ul>
            {planActions(item).map((action) => (
              <li key={action.actionId}>{action.presentation.title}</li>
            ))}
          </ul>
        </Disclosure>
      ))}
      {history.hasMore && history.nextCursor && (
        <button
          type="button"
          className="mbw-link-button"
          disabled={loadingMore}
          aria-busy={loadingMore}
          onClick={() => void load(history.nextCursor ?? undefined)}
        >
          {loadingMore ? 'Đang tải…' : 'Xem thêm'}
        </button>
      )}
    </div>
  )
}
