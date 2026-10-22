'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { browserCommercialReconciliation } from '../api/browser-client'
import type {
  AdminCommercialDiscrepancyReport,
  AdminCommercialProvenance,
  AdminPayoutDetail,
  AdminSubscriptionDetail,
} from '@/lib/consultation/reconciliation-validation'
import type { AdminPaymentList } from '@/lib/consultation/billing-validation'
import type { AdminPayoutList } from '@/lib/consultation/consultation-validation'
import './admin-commercial-reconciliation.css'

const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)

const date = (value?: string | null) =>
  value ? new Date(value).toLocaleString('vi-VN') : '—'

const statusBadgeClass = (status?: string | null) => {
  if (!status) return 'acr-badge'
  switch (status.toUpperCase()) {
    case 'SUCCEEDED':
    case 'ACTIVE':
    case 'AVAILABLE':
    case 'SETTLED':
    case 'COMPLETED':
    case 'CONSUMED':
    case 'APPLIED':
    case 'VERIFIED':
      return 'acr-badge acr-badge-success'
    case 'FAILED':
    case 'CHARGEBACK':
    case 'FORFEITED':
    case 'EXPIRED':
    case 'CANCELLED':
    case 'UNKNOWN':
    case 'REJECTED':
    case 'DISABLED':
    case 'PROCESSING_FAILED':
    case 'DUPLICATE_DELIVERY':
    case 'DUPLICATE_TRANS_ID':
      return 'acr-badge acr-badge-alert'
    case 'PENDING':
    case 'HELD':
    case 'PROCESSING':
    case 'REQUESTED':
    case 'PENDING_PAYMENT':
    case 'PENDING_SETTLEMENT':
    case 'UPGRADE_HELD':
    case 'PENDING_PROCESSING':
    case 'VERIFIED_UNMATCHED':
    case 'DISPUTED':
    case 'OPEN':
      return 'acr-badge acr-badge-warning'
    default:
      return 'acr-badge'
  }
}

export default function AdminCommercialReconciliationManager({
  onNotice,
}: {
  onNotice?: (message: string) => void
}) {
  const [activeTab, setActiveTab] = useState<
    'discrepancies' | 'provenance' | 'payments' | 'payouts' | 'actions'
  >('discrepancies')

  // Discrepancies state
  const [discrepancies, setDiscrepancies] =
    useState<AdminCommercialDiscrepancyReport | null>(null)
  const [loadingDiscrepancies, setLoadingDiscrepancies] = useState(true)
  const [errorDiscrepancies, setErrorDiscrepancies] = useState(false)

  // Provenance trace state
  const [identifierType, setIdentifierType] = useState('paymentId')
  const [identifierValue, setIdentifierValue] = useState('')
  const [provenance, setProvenance] =
    useState<AdminCommercialProvenance | null>(null)
  const [loadingProvenance, setLoadingProvenance] = useState(false)
  const [errorProvenance, setErrorProvenance] = useState<string | null>(null)

  // Request sequence trackers to prevent out-of-order race conditions
  const traceReqIdRef = useRef(0)
  const paymentsReqIdRef = useRef(0)
  const payoutsReqIdRef = useRef(0)

  // Payments browse state
  const [payments, setPayments] = useState<AdminPaymentList | null>(null)
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL')
  const [paymentOrderIdFilter, setPaymentOrderIdFilter] = useState('')
  const [paymentIdempotencyFilter, setPaymentIdempotencyFilter] = useState('')
  const [paymentFromDate, setPaymentFromDate] = useState('')
  const [paymentToDate, setPaymentToDate] = useState('')
  const [paymentPage, setPaymentPage] = useState(1)
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [errorPayments, setErrorPayments] = useState(false)

  // Payouts browse state
  const [payouts, setPayouts] = useState<AdminPayoutList | null>(null)
  const [payoutStatusFilter, setPayoutStatusFilter] = useState('ALL')
  const [payoutIdempotencyFilter, setPayoutIdempotencyFilter] = useState('')
  const [payoutFromDate, setPayoutFromDate] = useState('')
  const [payoutToDate, setPayoutToDate] = useState('')
  const [payoutPage, setPayoutPage] = useState(1)
  const [loadingPayouts, setLoadingPayouts] = useState(false)
  const [errorPayouts, setErrorPayouts] = useState(false)
  const [selectedPayoutDetail, setSelectedPayoutDetail] =
    useState<AdminPayoutDetail | null>(null)

  // Subscription detail state
  const [selectedSubscriptionDetail, setSelectedSubscriptionDetail] =
    useState<AdminSubscriptionDetail | null>(null)

  // Derived date validation errors (calculated during render without state/effects)
  const paymentDateError =
    paymentFromDate && paymentToDate && paymentFromDate > paymentToDate
      ? 'Từ ngày không thể lớn hơn đến ngày'
      : null

  const payoutDateError =
    payoutFromDate && payoutToDate && payoutFromDate > payoutToDate
      ? 'Từ ngày không thể lớn hơn đến ngày'
      : null

  // Load discrepancies — single lifecycle, no duplicated fetch
  const loadDiscrepancies = useCallback(() => {
    setLoadingDiscrepancies(true)
    setErrorDiscrepancies(false)
    const reqId = ++paymentsReqIdRef.current
    browserCommercialReconciliation.getDiscrepancies().then(
      (data) => {
        if (paymentsReqIdRef.current === reqId) {
          setDiscrepancies(data)
          setLoadingDiscrepancies(false)
        }
      },
      () => {
        if (paymentsReqIdRef.current === reqId) {
          setErrorDiscrepancies(true)
          setLoadingDiscrepancies(false)
        }
      },
    )
  }, [])

  useEffect(() => {
    loadDiscrepancies()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Build payments query from current filter state
  const buildPaymentsQuery = useCallback((): Record<string, string> => {
    const query: Record<string, string> = {
      limit: '50',
      offset: String((paymentPage - 1) * 50),
    }
    if (paymentStatusFilter !== 'ALL') query.status = paymentStatusFilter
    if (paymentOrderIdFilter.trim()) query.orderId = paymentOrderIdFilter.trim()
    if (paymentIdempotencyFilter.trim()) query.idempotencyKey = paymentIdempotencyFilter.trim()
    if (paymentFromDate) query.from = `${paymentFromDate}T00:00:00Z`
    if (paymentToDate) query.to = `${paymentToDate}T23:59:59Z`
    return query
  }, [paymentStatusFilter, paymentOrderIdFilter, paymentIdempotencyFilter, paymentFromDate, paymentToDate, paymentPage])

  // Single payments lifecycle: auto-fetch on filter/page change when tab active
  useEffect(() => {
    if (activeTab !== 'payments' || paymentDateError) return
    const reqId = ++paymentsReqIdRef.current
    setLoadingPayments(true)
    setErrorPayments(false)
    setPayments(null)
    const query = buildPaymentsQuery()
    browserCommercialReconciliation.getPayments(query).then(
      (data) => {
        if (paymentsReqIdRef.current === reqId) {
          setPayments(data)
          setLoadingPayments(false)
        }
      },
      () => {
        if (paymentsReqIdRef.current === reqId) {
          setErrorPayments(true)
          setLoadingPayments(false)
        }
      },
    )
  }, [activeTab, buildPaymentsQuery, paymentDateError])

  // Manual retry for payments resets page-local counter and re-triggers the effect
  const loadPayments = useCallback(() => {
    if (paymentDateError) return
    const reqId = ++paymentsReqIdRef.current
    setLoadingPayments(true)
    setErrorPayments(false)
    setPayments(null)
    const query = buildPaymentsQuery()
    browserCommercialReconciliation.getPayments(query).then(
      (data) => {
        if (paymentsReqIdRef.current === reqId) {
          setPayments(data)
          setLoadingPayments(false)
        }
      },
      () => {
        if (paymentsReqIdRef.current === reqId) {
          setErrorPayments(true)
          setLoadingPayments(false)
        }
      },
    )
  }, [buildPaymentsQuery, paymentDateError])

  // Build payouts query from current filter state
  const buildPayoutsQuery = useCallback((): Record<string, string> => {
    const query: Record<string, string> = {
      limit: '50',
      offset: String((payoutPage - 1) * 50),
    }
    if (payoutStatusFilter !== 'ALL') query.status = payoutStatusFilter
    if (payoutIdempotencyFilter.trim()) query.idempotencyKey = payoutIdempotencyFilter.trim()
    if (payoutFromDate) query.from = `${payoutFromDate}T00:00:00Z`
    if (payoutToDate) query.to = `${payoutToDate}T23:59:59Z`
    return query
  }, [payoutStatusFilter, payoutIdempotencyFilter, payoutFromDate, payoutToDate, payoutPage])

  // Single payouts lifecycle: auto-fetch on filter/page change when tab active
  useEffect(() => {
    if (activeTab !== 'payouts' || payoutDateError) return
    const reqId = ++payoutsReqIdRef.current
    setLoadingPayouts(true)
    setErrorPayouts(false)
    setPayouts(null)
    const query = buildPayoutsQuery()
    browserCommercialReconciliation.getPayouts(query).then(
      (data) => {
        if (payoutsReqIdRef.current === reqId) {
          setPayouts(data)
          setLoadingPayouts(false)
        }
      },
      () => {
        if (payoutsReqIdRef.current === reqId) {
          setErrorPayouts(true)
          setLoadingPayouts(false)
        }
      },
    )
  }, [activeTab, buildPayoutsQuery, payoutDateError])

  // Manual retry for payouts
  const loadPayouts = useCallback(() => {
    if (payoutDateError) return
    const reqId = ++payoutsReqIdRef.current
    setLoadingPayouts(true)
    setErrorPayouts(false)
    setPayouts(null)
    const query = buildPayoutsQuery()
    browserCommercialReconciliation.getPayouts(query).then(
      (data) => {
        if (payoutsReqIdRef.current === reqId) {
          setPayouts(data)
          setLoadingPayouts(false)
        }
      },
      () => {
        if (payoutsReqIdRef.current === reqId) {
          setErrorPayouts(true)
          setLoadingPayouts(false)
        }
      },
    )
  }, [buildPayoutsQuery, payoutDateError])

  // Handle provenance trace
  async function handleTrace(overrideType?: string, overrideValue?: string) {
    const type = overrideType || identifierType
    const val = (overrideValue || identifierValue).trim()
    if (!val) return

    const reqId = ++traceReqIdRef.current
    setLoadingProvenance(true)
    setErrorProvenance(null)
    setProvenance(null)
    try {
      const res = await browserCommercialReconciliation.getProvenance({
        [type]: val,
      })
      if (reqId === traceReqIdRef.current) {
        setProvenance(res)
        if (overrideType && overrideValue) {
          setIdentifierType(overrideType)
          setIdentifierValue(overrideValue)
          setActiveTab('provenance')
        }
      }
    } catch (e: unknown) {
      if (reqId === traceReqIdRef.current) {
        setProvenance(null)
        setErrorProvenance(
          e instanceof Error ? e.message : 'Chưa thể truy vết định danh này',
        )
      }
    } finally {
      if (reqId === traceReqIdRef.current) {
        setLoadingProvenance(false)
      }
    }
  }

  // Load payout detail modal
  async function viewPayoutDetail(payoutId: string) {
    try {
      const detail =
        await browserCommercialReconciliation.getPayoutDetail(payoutId)
      setSelectedPayoutDetail(detail)
    } catch {
      onNotice?.('Không thể tải chi tiết chi trả')
    }
  }

  // Load subscription detail modal
  async function viewSubscriptionDetail(subscriptionId: string) {
    try {
      const detail =
        await browserCommercialReconciliation.getSubscriptionDetail(
          subscriptionId,
        )
      setSelectedSubscriptionDetail(detail)
    } catch {
      onNotice?.('Không thể tải chi tiết thuê bao')
    }
  }

  return (
    <div className="acr-container" aria-label="Đối soát thương mại">
      <header className="acr-header">
        <div>
          <span className="eyebrow">Quản trị tài chính</span>
          <h1>Đối soát thương mại & Vòng đời giao dịch</h1>
          <p>
            Truy vết độc lập từ nguồn Consultation: Thanh toán → Thuê bao/Tín
            chỉ → Lịch hẹn/Xem xét → Thu nhập → Chi trả.
          </p>
        </div>
        <div className="acr-header-actions">
          <button
            type="button"
            className="acr-btn"
            disabled={loadingDiscrepancies}
            onClick={() => {
              loadDiscrepancies()
              if (activeTab === 'payments') loadPayments()
              if (activeTab === 'payouts') loadPayouts()
              onNotice?.('Đang làm mới dữ liệu đối soát.')
            }}
          >
            Làm mới
          </button>
        </div>
      </header>

      {/* Navigation tabs */}
      <nav className="acr-nav-tabs" aria-label="Phân hệ đối soát" role="tablist">
        <button
          role="tab"
          type="button"
          className="acr-tab"
          aria-selected={activeTab === 'discrepancies'}
          onClick={() => setActiveTab('discrepancies')}
        >
          Phát hiện sai lệch
          {discrepancies && discrepancies.totalDiscrepancies > 0 && (
            <span className="acr-badge acr-badge-alert">
              {discrepancies.totalDiscrepancies}
            </span>
          )}
        </button>
        <button
          role="tab"
          type="button"
          className="acr-tab"
          aria-selected={activeTab === 'provenance'}
          onClick={() => setActiveTab('provenance')}
        >
          Truy vết dòng tiền (Provenance)
        </button>
        <button
          role="tab"
          type="button"
          className="acr-tab"
          aria-selected={activeTab === 'payments'}
          onClick={() => setActiveTab('payments')}
        >
          Giao dịch thanh toán
        </button>
        <button
          role="tab"
          type="button"
          className="acr-tab"
          aria-selected={activeTab === 'payouts'}
          onClick={() => setActiveTab('payouts')}
        >
          Chi trả chuyên gia
        </button>
        <button
          role="tab"
          type="button"
          className="acr-tab"
          aria-selected={activeTab === 'actions'}
          onClick={() => setActiveTab('actions')}
        >
          Hành động đối soát & Giới hạn
        </button>
      </nav>

      {/* TAB 1: DISCREPANCIES */}
      {activeTab === 'discrepancies' && (
        <section aria-label="Sai lệch thương mại">
          {loadingDiscrepancies && !discrepancies && (
            <p role="status">Đang phân tích dữ liệu đối soát…</p>
          )}

          {errorDiscrepancies && (
            <div className="acr-alert" role="alert">
              <p>Chưa thể tải dữ liệu sai lệch từ máy chủ.</p>
              <button
                type="button"
                className="acr-btn"
                onClick={() => void loadDiscrepancies()}
              >
                Thử lại
              </button>
            </div>
          )}

          {discrepancies && (
            <div className="acr-card">
              <div className="acr-grid-2">
                <article className="acr-stat-card">
                  <span>Webhook IPN cần kiểm tra</span>
                  <strong>
                    {discrepancies.webhooks.length}
                    {discrepancies.webhooks.length >= 50 ? ' (giới hạn)' : ''}
                  </strong>
                  <p>
                    Giao dịch MoMo webhook chưa hoàn tất hoặc trùng lặp mã nhận.
                  </p>
                </article>
                <article className="acr-stat-card">
                  <span>Yêu cầu chi trả thất bại / nghi vấn</span>
                  <strong>
                    {discrepancies.payouts.length}
                    {discrepancies.payouts.length >= 50 ? ' (giới hạn)' : ''}
                  </strong>
                  <p>Yêu cầu chi trả chuyển trạng thái FAILED hoặc UNKNOWN.</p>
                </article>
                <article className="acr-stat-card">
                  <span>Khoản thu đang giữ (Held Earnings)</span>
                  <strong>
                    {discrepancies.heldEarnings.length}
                    {discrepancies.heldEarnings.length >= 50 ? ' (giới hạn)' : ''}
                  </strong>
                  <p>
                    Đang trong thời gian chờ thanh toán (grace) hoặc bị chặn bởi
                    khiếu nại.
                  </p>
                </article>
                <article className="acr-stat-card">
                  <span>Xem xét phiên tư vấn đang mở (Disputes)</span>
                  <strong>
                    {discrepancies.disputes.length}
                    {discrepancies.disputes.length >= 50 ? ' (giới hạn)' : ''}
                  </strong>
                  <p>Khiếu nại OPEN hoặc yêu cầu hoàn tín chỉ dịch vụ.</p>
                </article>
              </div>

              {discrepancies.totalDiscrepancies === 0 ? (
                <div className="acr-empty">
                  <h3>Không ghi nhận sai lệch</h3>
                  <p>
                    Không phát hiện sai lệch nào trong phạm vi giám sát hiện tại (webhook, chi trả thất bại, thu nhập bị giữ, khiếu nại mở).
                  </p>
                </div>
              ) : (
                <div style={{ marginTop: '24px' }}>
                  {discrepancies.totalDiscrepancies > 50 && (
                    <div className="acr-stage-box" style={{ marginBottom: '16px', background: '#f8fafc', borderColor: '#cbd5e1' }}>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569' }}>
                        Ghi nhận tổng cộng <strong>{discrepancies.totalDiscrepancies}</strong> trường hợp cần đối soát. Danh sách dưới đây hiển thị tối đa 50 bản ghi gần nhất cho từng nhóm.
                      </p>
                    </div>
                  )}
                  {discrepancies.webhooks.length > 0 && (
                    <div>
                      <h3>Sự kiện Webhook ({discrepancies.webhooks.length})</h3>
                      {discrepancies.webhooks.map((w) => (
                        <div key={w.id} className="acr-discrepancy-item">
                          <div>
                            <strong>Đơn hàng: {w.orderId}</strong> ·{' '}
                            <span>{w.discrepancyType}</span>
                            <br />
                            <small>
                              Nhận lúc: {date(w.receivedAt)} | Lỗi:{' '}
                              {w.failureCode || 'Không rõ'}
                            </small>
                          </div>
                          <span className="acr-badge acr-badge-warning">
                            {w.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {discrepancies.payouts.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <h3>Yêu cầu chi trả có vấn đề ({discrepancies.payouts.length})</h3>
                      {discrepancies.payouts.map((p) => (
                        <div key={p.payoutId} className="acr-discrepancy-item">
                          <div>
                            <strong>Chi trả: {p.payoutId}</strong> ·{' '}
                            <span>{money(p.amountVnd)}</span>
                            <br />
                            <small>
                              Đích: {p.destinationHint} | Mã lỗi:{' '}
                              {p.failureCode || 'N/A'} | Yêu cầu lúc:{' '}
                              {date(p.requestedAt)}
                            </small>
                          </div>
                          <div>
                            <button
                              type="button"
                              className="acr-btn"
                              style={{ marginRight: '8px' }}
                              onClick={() => void handleTrace('payoutId', p.payoutId)}
                            >
                              Truy vết
                            </button>
                            <span className="acr-badge acr-badge-alert">
                              {p.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {discrepancies.heldEarnings.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <h3>Khoản thu đang giữ ({discrepancies.heldEarnings.length})</h3>
                      {discrepancies.heldEarnings.map((h) => (
                        <div key={h.earningId} className="acr-discrepancy-item">
                          <div>
                            <strong>Thu nhập: {h.earningId}</strong> ·{' '}
                            <span>{money(h.amountVnd)}</span>
                            <br />
                            <small>
                              Lý do: {h.holdReason} | Hẹn giải ngân:{' '}
                              {date(h.settlementAvailableAt)}
                            </small>
                          </div>
                          <button
                            type="button"
                            className="acr-btn"
                            onClick={() => void handleTrace('earningId', h.earningId)}
                          >
                            Truy vết
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {discrepancies.disputes.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <h3>Xem xét phiên tư vấn ({discrepancies.disputes.length})</h3>
                      {discrepancies.disputes.map((d) => (
                        <div key={d.disputeId} className="acr-discrepancy-item">
                          <div>
                            <strong>Khiếu nại: {d.disputeId}</strong> ·{' '}
                            <span>{d.reasonCode}</span> (mở bởi {d.openedByRole})
                            <br />
                            <small>
                              Mở lúc: {date(d.openedAt)} | Hạn xử lý:{' '}
                              {date(d.eligibleUntil)}
                            </small>
                          </div>
                          <div>
                            <button
                              type="button"
                              className="acr-btn"
                              style={{ marginRight: '8px' }}
                              onClick={() => void handleTrace('appointmentId', d.appointmentId)}
                            >
                              Truy vết
                            </button>
                            <Link href="/admin/disputes" className="acr-btn acr-btn-primary">
                              Xử lý
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* TAB 2: PROVENANCE TRACING */}
      {activeTab === 'provenance' && (
        <section aria-label="Truy vết dòng tiền">
          <div className="acr-card">
            <h2>Truy vết chu trình thương mại (5 giai đoạn)</h2>
            <p>
              Nhập bất kỳ mã định danh nào để truy vết toàn bộ vòng đời tài
              chính từ thanh toán tới chi trả.
            </p>

            <form
              className="acr-trace-form"
              onSubmit={(e) => {
                e.preventDefault()
                void handleTrace()
              }}
            >
              <select
                className="acr-select"
                value={identifierType}
                onChange={(e) => setIdentifierType(e.target.value)}
                aria-label="Loại mã định danh"
              >
                <option value="paymentId">Mã thanh toán (Payment ID)</option>
                <option value="subscriptionId">Mã thuê bao (Subscription ID)</option>
                <option value="creditId">Mã tín chỉ (Credit ID)</option>
                <option value="appointmentId">Mã lịch hẹn (Appointment ID)</option>
                <option value="earningId">Mã thu nhập (Earning ID)</option>
                <option value="payoutId">Mã chi trả (Payout ID)</option>
              </select>
              <input
                type="text"
                className="acr-input"
                placeholder="Nhập UUID (ví dụ: 62200000-0000-4000-8000-000000000001)..."
                value={identifierValue}
                onChange={(e) => setIdentifierValue(e.target.value)}
                aria-label="Giá trị mã định danh"
              />
              <button
                type="submit"
                className="acr-btn acr-btn-primary"
                disabled={loadingProvenance || !identifierValue.trim()}
              >
                {loadingProvenance ? 'Đang truy vết…' : 'Truy vết'}
              </button>
            </form>

            {errorProvenance && (
              <div className="acr-alert" role="alert">
                <p>{errorProvenance}</p>
              </div>
            )}

            {provenance && (
              <div>
                {!provenance.found ? (
                  <div className="acr-empty">
                    <h3>Không tìm thấy dữ liệu</h3>
                    <p>
                      Không có bản ghi nào khớp với {provenance.queryIdentifierType}: {provenance.queryIdentifierValue}.
                    </p>
                  </div>
                ) : (
                  <div className="acr-timeline">
                    {provenance.truncated && (
                      <div className="acr-stage-box" style={{ marginBottom: '16px', background: '#fffbeb', borderColor: '#f59e0b' }}>
                        <p style={{ margin: 0, fontSize: '0.875rem', color: '#92400e' }}>
                          Một số danh sách đã đạt giới hạn hiển thị (100 bản ghi). Có thể còn dữ liệu chưa được liệt kê.
                        </p>
                      </div>
                    )}
                    {/* Stage 1: Payments */}
                    <div className="acr-stage">
                      <h3>1. Thanh toán (Payment Transactions)</h3>
                      {provenance.payments.length ? (
                        provenance.payments.map((p) => (
                          <div key={p.paymentId} className="acr-stage-box">
                            <div className="acr-item-row">
                              <span>Mã giao dịch: {p.paymentId}</span>
                              <span className={statusBadgeClass(p.status)}>{p.status}</span>
                            </div>
                            <div className="acr-item-row">
                              <span>Số tiền: <strong>{money(p.amountVnd)}</strong></span>
                              <span>Nhà cung cấp: {p.provider} ({p.purpose})</span>
                            </div>
                            <small>Tạo lúc: {date(p.createdAt)} | Xác nhận: {date(p.paidAt)}</small>
                          </div>
                        ))
                      ) : (
                        <p>Không có giao dịch thanh toán trực tiếp</p>
                      )}
                    </div>

                    {/* Stage 2: Subscription & Credits */}
                    <div className="acr-stage">
                      <h3>2. Thuê bao & Tín chỉ (Subscription & Service Credits)</h3>
                      {(() => {
                        const subs =
                          provenance.subscriptions && provenance.subscriptions.length > 0
                            ? provenance.subscriptions
                            : provenance.subscription
                            ? [provenance.subscription]
                            : []
                        return subs.length > 0 ? (
                          subs.map((s) => (
                            <div key={s.subscriptionId} className="acr-stage-box" style={{ marginBottom: '8px' }}>
                              <div className="acr-item-row">
                                <span>Thuê bao: {s.subscriptionId}</span>
                                <span className={statusBadgeClass(s.status)}>{s.status}</span>
                              </div>
                              <span>Gói: {s.planCode} ({s.pricingPolicyVersion})</span>
                              <small>Kỳ hạn: {date(s.currentPeriodStart)} → {date(s.currentPeriodEnd)}</small>
                            </div>
                          ))
                        ) : null
                      })()}
                      {provenance.credits.length ? (
                        <div className="acr-stage-box">
                          <strong>Tín chỉ ({provenance.credits.length} suất):</strong>
                          {provenance.credits.map((c) => (
                            <div key={c.creditId} className="acr-item-row">
                              <span>#{c.ordinal} · {c.creditId}</span>
                              <span>{money(c.creditAllocationVnd)} · <strong className={statusBadgeClass(c.state)}>{c.state}</strong></span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p>Không có thông tin tín chỉ</p>
                      )}
                    </div>

                    {/* Stage 3: Appointment & Disputes */}
                    <div className="acr-stage">
                      <h3>3. Lịch hẹn & Xem xét (Appointment & Disputes)</h3>
                      {provenance.appointments.length ? (
                        provenance.appointments.map((a) => (
                          <div key={a.appointmentId} className="acr-stage-box" style={{ marginBottom: '8px' }}>
                            <div className="acr-item-row">
                              <span>Lịch hẹn: {a.appointmentId}</span>
                              <span className={statusBadgeClass(a.status)}>{a.status}</span>
                            </div>
                            <div className="acr-item-row">
                              <span>Hình thức: {a.modality}</span>
                              <span>Kết quả: {a.sessionOutcome || 'Chưa hoàn tất'}</span>
                            </div>
                            <small>Quyết toán: {date(a.sessionSettledAt)} | Fact ID: {a.completionFactId || 'Chưa có'}</small>
                          </div>
                        ))
                      ) : (
                        <p>Chưa liên kết lịch hẹn</p>
                      )}
                      {provenance.disputes.map((d) => (
                        <div key={d.disputeId} className="acr-stage-box" style={{ borderColor: '#ef4444' }}>
                          <div className="acr-item-row">
                            <span>Khiếu nại: {d.disputeId}</span>
                            <span className={statusBadgeClass(d.status)}>{d.status}</span>
                          </div>
                          <span>Lý do: {d.reasonCode} (mở bởi {d.openedByRole})</span>
                          <small>Kết quả: {d.resolutionOutcome || 'Đang chờ xử lý'} | {d.resolutionReason || ''}</small>
                        </div>
                      ))}
                    </div>

                    {/* Stage 4: Specialist Earnings */}
                    <div className="acr-stage">
                      <h3>4. Thu nhập chuyên gia (Specialist Earnings)</h3>
                      {provenance.earnings.length ? (
                        provenance.earnings.map((e) => (
                          <div key={e.earningId} className="acr-stage-box">
                            <div className="acr-item-row">
                              <span>Thu nhập: {e.earningId}</span>
                              <span className={statusBadgeClass(e.status)}>{e.status}</span>
                            </div>
                            <div className="acr-item-row">
                              <span>Chuyên gia nhận ({e.specialistShareBps / 100}%): <strong>{money(e.specialistAmountVnd)}</strong></span>
                              <span>Nền tảng: {money(e.platformAllocationVnd)}</span>
                            </div>
                            <small>Thời điểm ghi nhận: {date(e.earnedAt)} | Cho phép giải ngân: {date(e.settlementAvailableAt)}</small>
                          </div>
                        ))
                      ) : (
                        <p>Chưa có thu nhập ghi nhận</p>
                      )}
                    </div>

                    {/* Stage 5: Payouts */}
                    <div className="acr-stage">
                      <h3>5. Chi trả (Specialist Payouts)</h3>
                      {provenance.payouts.length ? (
                        provenance.payouts.map((p) => (
                          <div key={p.payoutId} className="acr-stage-box">
                            <div className="acr-item-row">
                              <span>Chi trả: {p.payoutId}</span>
                              <span className={statusBadgeClass(p.status)}>{p.status}</span>
                            </div>
                            <div className="acr-item-row">
                              <span>Số tiền: <strong>{money(p.amountVnd)}</strong></span>
                              <span>Nơi nhận: {p.destinationHint} ({p.provider})</span>
                            </div>
                            <small>
                              Mã tham chiếu: {p.providerReference || 'N/A'} | Thời gian: {date(p.requestedAt)} → {date(p.completedAt)}
                            </small>
                          </div>
                        ))
                      ) : (
                        <p>Chưa tạo yêu cầu chi trả</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* TAB 3: PAYMENTS LISTING */}
      {activeTab === 'payments' && (
        <section aria-label="Giao dịch thanh toán">
          <div className="acr-card">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
              <h2>Giao dịch thanh toán</h2>
              <label>
                Lọc trạng thái:{' '}
                <select
                  className="acr-select"
                  value={paymentStatusFilter}
                  onChange={(e) => {
                    setPaymentStatusFilter(e.target.value)
                    setPaymentPage(1)
                  }}
                >
                  <option value="ALL">Tất cả</option>
                  <option value="SUCCEEDED">Đã xác nhận</option>
                  <option value="PENDING">Chờ xác nhận</option>
                  <option value="FAILED">Thất bại</option>
                  <option value="CHARGEBACK">Cần đối soát</option>
                </select>
              </label>
              <label>
                Mã đơn hàng:{' '}
                <input
                  type="text"
                  className="acr-input"
                  style={{ width: '140px' }}
                  placeholder="Order ID..."
                  value={paymentOrderIdFilter}
                  onChange={(e) => {
                    setPaymentOrderIdFilter(e.target.value)
                    setPaymentPage(1)
                  }}
                />
              </label>
              <label>
                Mã idempotency:{' '}
                <input
                  type="text"
                  className="acr-input"
                  style={{ width: '160px' }}
                  placeholder="Idempotency key..."
                  value={paymentIdempotencyFilter}
                  onChange={(e) => {
                    setPaymentIdempotencyFilter(e.target.value)
                    setPaymentPage(1)
                  }}
                />
              </label>
              <label>
                Từ ngày:{' '}
                <input
                  type="date"
                  className="acr-input"
                  value={paymentFromDate}
                  onChange={(e) => {
                    setPaymentFromDate(e.target.value)
                    setPaymentPage(1)
                  }}
                />
              </label>
              <label>
                Đến ngày:{' '}
                <input
                  type="date"
                  className="acr-input"
                  value={paymentToDate}
                  onChange={(e) => {
                    setPaymentToDate(e.target.value)
                    setPaymentPage(1)
                  }}
                />
              </label>
            </div>
            {paymentDateError && (
              <div className="acr-alert" style={{ marginBottom: '12px', padding: '8px 12px' }} role="alert">
                <p style={{ margin: 0 }}>{paymentDateError}</p>
              </div>
            )}

            {loadingPayments && !payments && <p role="status">Đang tải giao dịch…</p>}

            {errorPayments && (
              <div className="acr-alert" role="alert">
                <p>Chưa thể tải dữ liệu thanh toán từ máy chủ.</p>
                <button
                  type="button"
                  className="acr-btn"
                  onClick={() => void loadPayments()}
                >
                  Thử lại
                </button>
              </div>
            )}

            {payments && (
              <div>
                <p role="status">{payments.count} giao dịch được ghi nhận</p>
                <table className="acr-table">
                  <thead>
                    <tr>
                      <th>Mã thanh toán</th>
                      <th>Gói</th>
                      <th>Số tiền</th>
                      <th>Trạng thái</th>
                      <th>Thời gian</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.items.map((item) => (
                      <tr key={item.paymentId}>
                        <td>{item.paymentId}</td>
                        <td>{item.planCode} ({item.purpose})</td>
                        <td><strong>{money(item.amountVnd)}</strong></td>
                        <td>
                          <span className={statusBadgeClass(item.status)}>
                            {item.status}
                          </span>
                        </td>
                        <td>{date(item.createdAt)}</td>
                        <td>
                          <button
                            type="button"
                            className="acr-btn"
                            onClick={() => void handleTrace('paymentId', item.paymentId)}
                          >
                            Truy vết
                          </button>
                          <button
                            type="button"
                            className="acr-btn"
                            style={{ marginLeft: '6px' }}
                            onClick={() => void viewSubscriptionDetail(item.subscriptionId)}
                          >
                            Thuê bao
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="acr-pagination">
                  <button
                    type="button"
                    className="acr-btn"
                    disabled={paymentPage <= 1 || loadingPayments}
                    onClick={() => setPaymentPage((p) => Math.max(1, p - 1))}
                  >
                    Trang trước
                  </button>
                  <span style={{ fontSize: '0.875rem', color: '#475569' }}>
                    Trang {paymentPage} ({payments.items.length} giao dịch)
                  </span>
                  <button
                    type="button"
                    className="acr-btn"
                    disabled={payments.items.length < 50 || loadingPayments}
                    onClick={() => setPaymentPage((p) => p + 1)}
                  >
                    Trang sau
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* TAB 4: PAYOUTS LISTING */}
      {activeTab === 'payouts' && (
        <section aria-label="Chi trả chuyên gia">
          <div className="acr-card">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
              <h2>Yêu cầu chi trả</h2>
              <label>
                Lọc trạng thái:{' '}
                <select
                  className="acr-select"
                  value={payoutStatusFilter}
                  onChange={(e) => {
                    setPayoutStatusFilter(e.target.value)
                    setPayoutPage(1)
                  }}
                >
                  <option value="ALL">Tất cả</option>
                  <option value="SUCCEEDED">Đã thanh toán</option>
                  <option value="PROCESSING">Đang xử lý</option>
                  <option value="FAILED">Thất bại</option>
                  <option value="UNKNOWN">Cần đối soát</option>
                </select>
              </label>
              <label>
                Mã idempotency:{' '}
                <input
                  type="text"
                  className="acr-input"
                  style={{ width: '160px' }}
                  placeholder="Idempotency key..."
                  value={payoutIdempotencyFilter}
                  onChange={(e) => {
                    setPayoutIdempotencyFilter(e.target.value)
                    setPayoutPage(1)
                  }}
                />
              </label>
              <label>
                Từ ngày:{' '}
                <input
                  type="date"
                  className="acr-input"
                  value={payoutFromDate}
                  onChange={(e) => {
                    setPayoutFromDate(e.target.value)
                    setPayoutPage(1)
                  }}
                />
              </label>
              <label>
                Đến ngày:{' '}
                <input
                  type="date"
                  className="acr-input"
                  value={payoutToDate}
                  onChange={(e) => {
                    setPayoutToDate(e.target.value)
                    setPayoutPage(1)
                  }}
                />
              </label>
            </div>
            {payoutDateError && (
              <div className="acr-alert" style={{ marginBottom: '12px', padding: '8px 12px' }} role="alert">
                <p style={{ margin: 0 }}>{payoutDateError}</p>
              </div>
            )}

            {loadingPayouts && !payouts && <p role="status">Đang tải dữ liệu chi trả…</p>}

            {errorPayouts && (
              <div className="acr-alert" role="alert">
                <p>Chưa thể tải dữ liệu chi trả từ máy chủ.</p>
                <button
                  type="button"
                  className="acr-btn"
                  onClick={() => void loadPayouts()}
                >
                  Thử lại
                </button>
              </div>
            )}

            {payouts && (
              <div>
                <p role="status">{payouts.count} yêu cầu được ghi nhận (Trang {payoutPage})</p>
                <table className="acr-table">
                  <thead>
                    <tr>
                      <th>Mã chi trả</th>
                      <th>Nơi nhận</th>
                      <th>Số tiền</th>
                      <th>Trạng thái</th>
                      <th>Khoản thu</th>
                      <th>Thời gian</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.items.map((item) => (
                      <tr key={item.payoutId}>
                        <td>{item.payoutId}</td>
                        <td>{item.destinationHint}</td>
                        <td><strong>{money(item.amountVnd)}</strong></td>
                        <td>
                          <span className={statusBadgeClass(item.status)}>
                            {item.status}
                          </span>
                        </td>
                        <td>{item.earningCount} khoản</td>
                        <td>{date(item.requestedAt)}</td>
                        <td>
                          <button
                            type="button"
                            className="acr-btn"
                            onClick={() => void viewPayoutDetail(item.payoutId)}
                          >
                            Chi tiết
                          </button>
                          <button
                            type="button"
                            className="acr-btn"
                            style={{ marginLeft: '6px' }}
                            onClick={() => void handleTrace('payoutId', item.payoutId)}
                          >
                            Truy vết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="acr-pagination">
                  <button
                    type="button"
                    className="acr-btn"
                    disabled={payoutPage <= 1 || loadingPayouts}
                    onClick={() => setPayoutPage((p) => Math.max(1, p - 1))}
                  >
                    Trang trước
                  </button>
                  <span style={{ fontSize: '0.875rem', color: '#475569' }}>
                    Trang {payoutPage} ({payouts.items.length} yêu cầu)
                  </span>
                  <button
                    type="button"
                    className="acr-btn"
                    disabled={payouts.items.length < 50 || loadingPayouts}
                    onClick={() => setPayoutPage((p) => p + 1)}
                  >
                    Trang sau
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* TAB 5: ACTIONS & SAFETY LIMITS */}
      {activeTab === 'actions' && (
        <section aria-label="Hành động & Giới hạn an toàn">
          <div className="acr-card">
            <h2>Hành động đối soát & Giới hạn tài chính</h2>
            <p>
              Chỉ cho phép các hành động đã được phê duyệt trong kiến trúc nền
              tảng nhằm đảm bảo an toàn tài chính.
            </p>

            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <article className="acr-stat-card">
                <div className="acr-item-row">
                  <strong>Xử lý khiếu nại phiên tư vấn (Dispute Resolution)</strong>
                  <span className="acr-badge acr-badge-success">Có sẵn</span>
                </div>
                <p>
                  Thực hiện quyết định chấp thuận kết quả ghi nhận hoặc hoàn tín chỉ
                  dịch vụ cho người dùng qua luồng quản trị đã được phê duyệt.
                </p>
                <Link href="/admin/disputes" className="acr-btn acr-btn-primary" style={{ display: 'inline-block', marginTop: '8px' }}>
                  Đi tới Xem xét phiên tư vấn
                </Link>
              </article>

              <article className="acr-stat-card" style={{ opacity: 0.85 }}>
                <div className="acr-item-row">
                  <strong>Hoàn tiền trực tiếp (Direct User Refund)</strong>
                  <span className="acr-badge acr-badge-alert">Đang tắt (Read-only)</span>
                </div>
                <p>
                  Chưa có API hoàn tiền trực tiếp được phê duyệt. Việc hoàn tiền cần
                  tuân thủ hợp đồng tài chính và đối soát thủ công ngoài hệ thống.
                </p>
              </article>

              <article className="acr-stat-card" style={{ opacity: 0.85 }}>
                <div className="acr-item-row">
                  <strong>Điều chỉnh số dư thu nhập tùy tiện (Arbitrary Adjustment)</strong>
                  <span className="acr-badge acr-badge-alert">Đang tắt (Read-only)</span>
                </div>
                <p>
                  Số dư thu nhập chuyên gia được tính toán bất biến từ 70% giá trị
                  tín chỉ của lịch hẹn hoàn tất. Hệ thống không cho phép sửa đổi số
                  dư tự do.
                </p>
              </article>

              <article className="acr-stat-card" style={{ opacity: 0.85 }}>
                <div className="acr-item-row">
                  <strong>Chi tiền MoMo thật ngoài luồng (Direct MoMo Settlement)</strong>
                  <span className="acr-badge acr-badge-alert">Đang tắt (Read-only)</span>
                </div>
                <p>
                  Cơ chế giải ngân tiền thật đang tắt mặc định cho đến khi hoàn thành
                  onboarding MoMo production và nhận được phê duyệt vận hành độc lập.
                </p>
              </article>
            </div>
          </div>
        </section>
      )}

      {/* Modal / Detail for Payout */}
      {selectedPayoutDetail && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chi tiết chi trả"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            className="acr-card"
            style={{ maxWidth: '640px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}
          >
            <h2>Chi tiết chi trả: {selectedPayoutDetail.payout.payoutId}</h2>
            <p>
              Chuyên gia: {selectedPayoutDetail.payout.specialistAccountId} | Nơi nhận: {selectedPayoutDetail.payout.destinationHint}
            </p>
            <p>
              Số tiền: <strong>{money(selectedPayoutDetail.payout.amountVnd)}</strong> | Trạng thái: {selectedPayoutDetail.payout.status}
            </p>
            {selectedPayoutDetail.payout.failureCode && (
              <p style={{ color: '#b91c1c' }}>Mã lỗi: {selectedPayoutDetail.payout.failureCode}</p>
            )}

            <h3 style={{ marginTop: '16px' }}>Các lần thử (Attempts: {selectedPayoutDetail.attempts.length})</h3>
            {selectedPayoutDetail.attempts.map((att) => (
              <div key={att.attemptId} className="acr-stage-box" style={{ marginBottom: '6px' }}>
                <div className="acr-item-row">
                  <span>Lần #{att.attemptNumber} ({att.provider})</span>
                  <span className={statusBadgeClass(att.status)}>{att.status}</span>
                </div>
                <small>Tham chiếu: {att.providerReference || 'N/A'} | Mã lỗi: {att.failureCode || 'N/A'}</small>
              </div>
            ))}

            <h3 style={{ marginTop: '16px' }}>Khoản thu kèm theo (Earnings: {selectedPayoutDetail.earnings.length})</h3>
            {selectedPayoutDetail.earnings.map((e) => (
              <div key={e.earningId} className="acr-stage-box" style={{ marginBottom: '6px' }}>
                <div className="acr-item-row">
                  <span>Thu nhập: {e.earningId}</span>
                  <span>{money(e.amountVnd)}</span>
                </div>
                <small>Lịch hẹn: {e.appointmentId} | {date(e.earnedAt)}</small>
              </div>
            ))}

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button
                type="button"
                className="acr-btn"
                onClick={() => setSelectedPayoutDetail(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Detail for Subscription */}
      {selectedSubscriptionDetail && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chi tiết thuê bao"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            className="acr-card"
            style={{ maxWidth: '640px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}
          >
            <h2>Chi tiết thuê bao: {selectedSubscriptionDetail.subscriptionId}</h2>
            <p>
              Người dùng: {selectedSubscriptionDetail.userAccountId} | Gói: {selectedSubscriptionDetail.planCode} ({selectedSubscriptionDetail.pricingPolicyVersion})
            </p>
            <p>
              Trạng thái:{' '}
              <span className={statusBadgeClass(selectedSubscriptionDetail.status)}>
                {selectedSubscriptionDetail.status}
              </span>
            </p>

            <h3 style={{ marginTop: '16px' }}>Tín chỉ ({selectedSubscriptionDetail.credits.length})</h3>
            {selectedSubscriptionDetail.credits.map((c) => (
              <div key={c.creditId} className="acr-stage-box" style={{ marginBottom: '6px' }}>
                <div className="acr-item-row">
                  <span>Suất #{c.ordinal} ({c.creditId})</span>
                  <span className={statusBadgeClass(c.state)}>{c.state}</span>
                </div>
                <small>Định giá: {money(c.creditAllocationVnd)} | Lịch hẹn: {c.appointmentId || 'Chưa gán'}</small>
              </div>
            ))}

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button
                type="button"
                className="acr-btn"
                onClick={() => setSelectedSubscriptionDetail(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

