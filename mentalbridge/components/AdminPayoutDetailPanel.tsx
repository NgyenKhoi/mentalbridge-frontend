'use client'

import { useEffect, useState } from 'react'
import { Clock, ReceiptText } from 'lucide-react'
import { adminPayoutsBrowserClient } from '@/features/specialist-earnings/api/browser-client'
import {
  adminFailureLines,
  adminPayoutStatusLabel,
  maskedHint,
  payoutProviderName,
  resolveSpecialistName,
  resolveClientPaidInfo,
} from '@/features/specialist-earnings/payout-labels'
import type { AdminPayoutList } from '@/lib/consultation/consultation-validation'
import type { AdminPayoutDetail } from '@/lib/consultation/reconciliation-validation'
import { Disclosure } from './ui/Disclosure'
import { Skeleton } from './ui/Skeleton'

type Props = {
  payout?: AdminPayoutList['items'][number]
  history: boolean
  refresh: number
}

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

const timestamp = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Asia/Ho_Chi_Minh',
})

function PayoutHistory({ detail }: { detail: AdminPayoutDetail }) {
  return (
    <div className="apo-history">
      <h4 className="apo-history-subtitle">Các lần chuyển tiền</h4>
      {detail.attempts.length ? (
        <ol>
          {[...detail.attempts]
            .sort((a, b) => b.attemptNumber - a.attemptNumber)
            .map((attempt) => (
              <li key={attempt.attemptId}>
                <div>
                  <strong>
                    Lần {attempt.attemptNumber} ·{' '}
                    {payoutProviderName[attempt.provider]}
                  </strong>
                  <span>
                    {adminPayoutStatusLabel(
                      attempt.status,
                      attempt.reconciliationStatus,
                    )}
                  </span>
                </div>
                <time dateTime={attempt.requestedAt}>
                  {timestamp.format(new Date(attempt.requestedAt))} GMT+7
                </time>
                {attempt.confirmedAt && (
                  <p>
                    Xác nhận lúc{' '}
                    {timestamp.format(new Date(attempt.confirmedAt))}
                  </p>
                )}
                {attempt.failedAt && (
                  <p>
                    Ghi nhận chưa thành công lúc{' '}
                    {timestamp.format(new Date(attempt.failedAt))}
                  </p>
                )}
                {attempt.failureCode && (
                  <p>
                    {adminFailureLines[attempt.failureCode] ??
                      attempt.failureCode}
                  </p>
                )}
                {attempt.nextReconciliationAt && (
                  <p>
                    Đối soát tiếp lúc{' '}
                    {timestamp.format(new Date(attempt.nextReconciliationAt))}
                  </p>
                )}
                {attempt.providerReference && (
                  <code>{attempt.providerReference}</code>
                )}
              </li>
            ))}
        </ol>
      ) : (
        <p className="apo-detail-caption">Chưa ghi nhận lần chuyển tiền.</p>
      )}

      <h4 className="apo-history-subtitle" style={{ marginTop: '16px' }}>
        Sự kiện từ cổng chi trả
      </h4>
      {detail.events.length ? (
        <ol>
          {[...detail.events]
            .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt))
            .map((event) => (
              <li key={event.eventId}>
                <div>
                  <strong>{event.provider}</strong>
                  <code>{event.eventType}</code>
                </div>
                <time dateTime={event.receivedAt}>
                  {timestamp.format(new Date(event.receivedAt))} GMT+7
                </time>
                <p>{event.processingStatus}</p>
                {event.failureCode && (
                  <p>
                    {adminFailureLines[event.failureCode] ?? event.failureCode}
                  </p>
                )}
                {event.processedAt && (
                  <p>
                    Xử lý lúc {timestamp.format(new Date(event.processedAt))}
                  </p>
                )}
              </li>
            ))}
        </ol>
      ) : (
        <p className="apo-detail-caption">
          Chưa có sự kiện từ cổng chi trả cho yêu cầu này.
        </p>
      )}
    </div>
  )
}

export default function AdminPayoutDetailPanel({
  payout,
  history,
  refresh,
}: Props) {
  const [detail, setDetail] = useState<AdminPayoutDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const payoutId = payout?.payoutId
  const payoutStatus = payout?.status
  const reconciliationStatus = payout?.reconciliationStatus
  const closedAt = payout?.closedAt

  useEffect(() => {
    if (!payoutId) return
    let active = true
    queueMicrotask(() => {
      if (!active) return
      setLoading(true)
      setFailed(false)
      adminPayoutsBrowserClient.detail(payoutId).then(
        (response) => {
          if (!active) return
          setDetail(response)
          setLoading(false)
        },
        () => {
          if (!active) return
          setFailed(true)
          setLoading(false)
        },
      )
    })
    return () => {
      active = false
    }
  }, [payoutId, payoutStatus, reconciliationStatus, closedAt, refresh, retry])

  if (!payout) {
    return (
      <aside
        className="apo-detail-panel apo-detail-empty"
        id="apo-payout-detail"
      >
        <ReceiptText size={28} aria-hidden="true" />
        <h2>Chi tiết đối soát</h2>
        <p>
          Chọn một yêu cầu chi trả để xem bóc tách khoản thu và tiến trình đối
          soát thời gian thực.
        </p>
      </aside>
    )
  }

  const current = detail?.payout ?? payout
  const statusClass = current.closedAt
    ? 'closed'
    : current.reconciliationStatus === 'NEEDS_REVIEW'
      ? 'needs_review'
      : current.status.toLowerCase()
  const isSucceeded = current.status === 'SUCCEEDED'

  const apiEarnings = detail?.earnings ?? []
  const itemsToDisplay = apiEarnings.map((earning) => {
    const clientInfo = resolveClientPaidInfo(
      earning.appointmentId,
      earning.amountVnd,
    )
    return {
      id: earning.earningId,
      title: `Phiên tư vấn · #${earning.appointmentId.slice(0, 8)}`,
      subtitle: `Ghi nhận ${timestamp.format(new Date(earning.earnedAt))}`,
      amount: earning.amountVnd,
      clientName: clientInfo.clientName,
      clientPaid: clientInfo.clientPaid,
    }
  })
  const earningsTotal = apiEarnings.reduce(
    (sum, earning) => sum + earning.amountVnd,
    0,
  )
  const totalClientPaid = itemsToDisplay.reduce(
    (sum, item) => sum + item.clientPaid,
    0,
  )
  const bankBrand = payoutProviderName[current.provider]
  const specialistName = resolveSpecialistName(current.specialistAccountId)
  return (
    <aside
      className="apo-detail-panel"
      id="apo-payout-detail"
      aria-labelledby="apo-detail-title"
      aria-busy={loading}
    >
      {/* Header Banner */}
      <header className="apo-detail-heading">
        <div>
          <span className="apo-detail-label">CHI TIẾT ĐỐI SOÁT</span>
          <div className="apo-detail-title-row">
            <h2 id="apo-detail-title">
              {specialistName}
            </h2>
            <span className={`apo-status-badge is-${statusClass}`}>
              {isSucceeded && !current.closedAt
                ? 'Hoàn tất'
                : adminPayoutStatusLabel(
                    current.status,
                    current.reconciliationStatus,
                    current.closedAt,
                  )}
            </span>
          </div>
        </div>
        <div className="apo-payout-reference">
          <span>Mã lệnh Payout</span>
          <code title={current.payoutId}>
            {current.providerReference ?? current.payoutId.slice(0, 8)}
          </code>
        </div>
      </header>

      <div className="apo-detail-body">
        {/* Section 1: TÀI KHOẢN THỤ HƯỞNG ĐÃ XÁC MINH */}
        <section className="apo-beneficiary-section">
          <h3 className="apo-section-title">TÀI KHOẢN THỤ HƯỞNG</h3>
          <div className="apo-beneficiary-card">
            <div
              className={`apo-bank-logo is-${current.provider.toLowerCase()}`}
              aria-hidden="true"
            >
              {bankBrand}
            </div>
            <div className="apo-beneficiary-info">
              <strong>{specialistName}</strong>
              <div className="apo-beneficiary-account">
                <span>{maskedHint(current.destinationHint)}</span>
              </div>
            </div>
            <div className="apo-channel-badge">
              Kênh chuyển {payoutProviderName[current.provider]}
            </div>
          </div>
        </section>

        {failed && (
          <div className="apo-detail-error" role="alert">
            <p>Chưa tải được thêm chi tiết lịch sử API.</p>
            <button
              type="button"
              className="apo-link"
              onClick={() => setRetry((value) => value + 1)}
            >
              Thử lại
            </button>
          </div>
        )}

        {loading && !detail && (
          <div
            className="apo-detail-loading"
            role="status"
            aria-label="Đang tải chi tiết chi trả"
          >
            <Skeleton height={58} width="100%" />
            <Skeleton height={58} width="100%" />
          </div>
        )}

        {/* Section 2: BÓC TÁCH CÁC KHOẢN THU TẠO SỐ TIỀN */}
        <section className="apo-breakdown-section">
          <h3 className="apo-section-title">
            BÓC TÁCH CÁC KHOẢN THU TẠO SỐ TIỀN
          </h3>
          <ul className="apo-breakdown-list">
            {itemsToDisplay.map((item) => (
              <li key={item.id} className="apo-breakdown-item enhanced">
                <div className="apo-breakdown-info">
                  <div className="apo-breakdown-title-row">
                    <strong>{item.title}</strong>
                    {item.clientName && (
                      <span className="apo-client-paid-badge">
                        Thân chủ: <strong>{item.clientName}</strong>
                      </span>
                    )}
                  </div>
                  <div className="apo-breakdown-client-meta">
                    <span>{item.subtitle}</span>
                    {item.clientPaid > 0 && (
                      <>
                        <span className="apo-meta-sep">•</span>
                        <span className="apo-client-paid-amount">
                          Khách trả: <strong>{currency.format(item.clientPaid)}</strong>
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="apo-breakdown-amount-col">
                  <span className="apo-amount-label">Chuyên gia nhận:</span>
                  <b className="apo-breakdown-amount">
                    {currency.format(item.amount)}
                  </b>
                </div>
              </li>
            ))}
          </ul>
          {detail && !itemsToDisplay.length && (
            <p className="apo-detail-caption">
              Chưa có chi tiết khoản thu trong yêu cầu này.
            </p>
          )}

          {/* Financial Calculation */}
          <div className="apo-financial-summary">
            {apiEarnings.length > 0 && (
              <>
                <div className="apo-summary-row">
                  <span>Tổng số tiền khách hàng đã trả</span>
                  <b>{currency.format(totalClientPaid)}</b>
                </div>
                <div className="apo-summary-row">
                  <span>Tổng thù lao chuyên gia trong yêu cầu</span>
                  <b>{currency.format(earningsTotal)}</b>
                </div>
              </>
            )}
            <div className="apo-summary-total">
              <span>
                {isSucceeded
                  ? 'Đã chuyển cho chuyên gia'
                  : 'Số tiền yêu cầu chi trả'}
              </span>
              <strong>{currency.format(current.amountVnd)}</strong>
            </div>
          </div>
        </section>

        {/* Section 3: LỊCH SỬ TIẾN TRÌNH PAYOUT API */}
        <section className="apo-history-section">
          {history ? (
            <>
              <h3 className="apo-section-title">
                LỊCH SỬ TIẾN TRÌNH PAYOUT API
              </h3>
              {detail ? (
                <PayoutHistory detail={detail} />
              ) : (
                <p className="apo-detail-caption">
                  Đang chuẩn bị bản ghi nhật ký Payout API...
                </p>
              )}
            </>
          ) : (
            <Disclosure
              className="apo-history-disclosure"
              summary="LỊCH SỬ TIẾN TRÌNH PAYOUT API"
            >
              {detail ? (
                <PayoutHistory detail={detail} />
              ) : (
                <div style={{ padding: '12px 0' }}>
                  <p className="apo-detail-caption">
                    <Clock size={13} aria-hidden="true" />
                    Yêu cầu lúc{' '}
                    {timestamp.format(new Date(current.requestedAt))} GMT+7
                  </p>
                  {current.completedAt && (
                    <p className="apo-detail-caption">
                      Ghi nhận kết quả lúc{' '}
                      {timestamp.format(new Date(current.completedAt))}
                    </p>
                  )}
                  {current.closedAt && (
                    <p className="apo-detail-caption">
                      Đóng yêu cầu lúc{' '}
                      {timestamp.format(new Date(current.closedAt))}
                    </p>
                  )}
                  {current.failureCode && !current.closedAt && (
                    <p className="apo-detail-error">
                      {adminFailureLines[current.failureCode] ??
                        'Yêu cầu cần được đối soát lại trước khi tiếp tục.'}
                    </p>
                  )}
                </div>
              )}
            </Disclosure>
          )}
        </section>
      </div>
    </aside>
  )
}
