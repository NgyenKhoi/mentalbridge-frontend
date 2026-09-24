'use client'

import { useState } from 'react'

import { Disclosure } from '@/components/ui/Disclosure'
import { Skeleton } from '@/components/ui/Skeleton'
import { getSupportPlan } from '../api/browser-support-plan'
import type { SupportPlan } from '../api/support-plan-contract'

const statusLabel = {
  COMPLETED: 'Đã kết thúc',
  SUPERSEDED: 'Đã được thay thế',
  DISCARDED: 'Đã hủy trước khi bắt đầu',
} as const

const reasonLabel = {
  USER_DECISION: 'Người dùng chủ động kết thúc',
  PLAN_NO_LONGER_FITS: 'Kế hoạch không còn phù hợp',
  OTHER: 'Lý do khác',
} as const

const domainLabel: Record<string, string> = {
  DEPRESSIVE_SYMPTOMS: 'Hỗ trợ dấu hiệu trầm cảm',
  ANXIETY_SYMPTOMS: 'Hỗ trợ dấu hiệu lo âu',
}

function terminalAt(plan: SupportPlan) {
  return (
    plan.completedAt ?? plan.supersededAt ?? plan.discardedAt ?? plan.updatedAt
  )
}

type Props = Readonly<{
  items: SupportPlan[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  message: string
  onRetry: () => void
  onLoadMore: () => void
}>

export default function SupportPlanHistory({
  items,
  loading,
  loadingMore,
  hasMore,
  message,
  onRetry,
  onLoadMore,
}: Props) {
  const [detail, setDetail] = useState<SupportPlan>()
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailMessage, setDetailMessage] = useState('')

  const openDetail = async (supportPlanId: string) => {
    setDetailLoading(true)
    setDetailMessage('')
    try {
      setDetail(await getSupportPlan(supportPlanId))
    } catch {
      setDetail(undefined)
      setDetailMessage(
        'Chưa thể tải chi tiết lịch sử. Không có dữ liệu cục bộ nào được dùng thay thế.',
      )
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <section
      className="support-plan-history"
      aria-labelledby="plan-history-title"
    >
      <header>
        <div>
          <span>Lịch sử kế hoạch</span>
          <h2 id="plan-history-title">Các kế hoạch trước đây</h2>
        </div>
        <p>
          Kết thúc một kế hoạch không có nghĩa là bạn đã hồi phục hoặc có kết
          quả lâm sàng.
        </p>
      </header>

      {loading && (
        <div className="support-plan-history-loading" role="status">
          <span className="sr-only">Đang tải các kế hoạch trước đây…</span>
          <Skeleton width="36%" height={16} />
          <Skeleton width="100%" height={74} />
        </div>
      )}
      {!loading && message && (
        <div className="support-plan-history-state" role="alert">
          <p>{message}</p>
          <button className="btn btn-ghost" type="button" onClick={onRetry}>
            Tải lại lịch sử
          </button>
        </div>
      )}
      {!loading && !message && items.length === 0 && (
        <p>Chưa có kế hoạch hỗ trợ nào trong lịch sử.</p>
      )}
      {items.length > 0 && (
        <ol>
          {items.map((plan, index) => (
            <li
              key={plan.supportPlanId}
              style={
                {
                  '--entry-delay': `${Math.min(index, 7) * 45}ms`,
                } as React.CSSProperties
              }
            >
              <div>
                <strong>
                  {statusLabel[plan.status as keyof typeof statusLabel] ??
                    plan.status}
                </strong>
                <time dateTime={terminalAt(plan)}>
                  {new Date(terminalAt(plan)).toLocaleString('vi-VN')}
                </time>
                <small>{plan.selectedResourceCount} nội dung đã lưu</small>
              </div>
              <button
                className="btn btn-outline"
                type="button"
                disabled={detailLoading}
                onClick={() => void openDetail(plan.supportPlanId)}
              >
                Xem chi tiết
              </button>
            </li>
          ))}
        </ol>
      )}
      {hasMore && !message && (
        <button
          className="btn btn-ghost"
          type="button"
          disabled={loadingMore}
          onClick={onLoadMore}
        >
          {loadingMore ? 'Đang tải thêm…' : 'Tải thêm lịch sử'}
        </button>
      )}

      {detailMessage && <p role="alert">{detailMessage}</p>}
      {detail && (
        <aside className="support-plan-history-detail" aria-live="polite">
          <div>
            <div>
              <span>Chi tiết đã lưu</span>
              <h3>
                {statusLabel[detail.status as keyof typeof statusLabel] ??
                  detail.status}
              </h3>
            </div>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setDetail(undefined)}
            >
              Đóng chi tiết
            </button>
          </div>
          <dl>
            <div>
              <dt>Thời điểm</dt>
              <dd>{new Date(terminalAt(detail)).toLocaleString('vi-VN')}</dd>
            </div>
            <div>
              <dt>Lý do kết thúc</dt>
              <dd>
                {detail.completionReason
                  ? reasonLabel[detail.completionReason]
                  : 'Không ghi nhận lý do'}
              </dd>
            </div>
          </dl>
          <h4>Nội dung trong kế hoạch đã lưu</h4>
          <ul>
            {detail.slots.flatMap((slot) =>
              slot.selectedResource ? (
                <li key={slot.slotId}>
                  <strong>{slot.selectedResource.title}</strong>
                  <span>
                    {domainLabel[slot.targetDomain] ?? slot.targetDomain}
                  </span>
                </li>
              ) : (
                []
              ),
            )}
          </ul>
          <Disclosure summary="Thông tin kỹ thuật">
            <dl>
              <div>
                <dt>Quy tắc lựa chọn</dt>
                <dd>{detail.source.selectionPolicyVersion}</dd>
              </div>
              <div>
                <dt>Quyền lợi gói</dt>
                <dd>{detail.entitlement.version}</dd>
              </div>
            </dl>
          </Disclosure>
        </aside>
      )}
    </section>
  )
}
