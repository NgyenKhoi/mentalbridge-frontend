'use client'

import { useState } from 'react'

import { getSupportPlan } from '../api/browser-support-plan'
import type { SupportPlan } from '../api/support-plan-contract'

const statusLabel = {
  COMPLETED: 'Đã kết thúc',
  SUPERSEDED: 'Đã được thay thế',
  DISCARDED: 'Bản nháp đã hủy',
} as const

const reasonLabel = {
  USER_DECISION: 'Người dùng chủ động kết thúc',
  PLAN_NO_LONGER_FITS: 'Kế hoạch không còn phù hợp',
  OTHER: 'Lý do khác',
} as const

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
          <span>Lịch sử bất biến</span>
          <h2 id="plan-history-title">SupportPlan trước đây</h2>
        </div>
        <p>
          Chỉ hiển thị dữ liệu Care đã lưu. Kết thúc kế hoạch không mang ý nghĩa
          hồi phục hoặc kết quả lâm sàng.
        </p>
      </header>

      {loading && <p role="status">Đang tải lịch sử SupportPlan…</p>}
      {!loading && message && (
        <div className="support-plan-history-state" role="alert">
          <p>{message}</p>
          <button className="btn btn-ghost" type="button" onClick={onRetry}>
            Tải lại lịch sử
          </button>
        </div>
      )}
      {!loading && !message && items.length === 0 && (
        <p>Chưa có SupportPlan nào trong lịch sử.</p>
      )}
      {items.length > 0 && (
        <ol>
          {items.map((plan) => (
            <li key={plan.supportPlanId}>
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
            <div>
              <dt>Chính sách lựa chọn</dt>
              <dd>{detail.source.selectionPolicyVersion}</dd>
            </div>
            <div>
              <dt>Phiên bản quyền gói</dt>
              <dd>{detail.entitlement.version}</dd>
            </div>
          </dl>
          <h4>Nội dung trong snapshot</h4>
          <ul>
            {detail.slots.flatMap((slot) =>
              slot.selectedResource ? (
                <li key={slot.slotId}>
                  <strong>{slot.selectedResource.title}</strong>
                  <span>
                    Phiên bản {slot.selectedResource.contentVersion} ·{' '}
                    {slot.targetDomain}
                  </span>
                </li>
              ) : (
                []
              ),
            )}
          </ul>
        </aside>
      )}
    </section>
  )
}
