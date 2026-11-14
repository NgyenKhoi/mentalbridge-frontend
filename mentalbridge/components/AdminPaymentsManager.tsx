'use client'

import { useEffect, useState } from 'react'
import {
  ChevronDown,
  Clock,
  FileDown,
  Filter,
  RefreshCw,
  Sparkles,
  Wallet,
  Zap,
} from 'lucide-react'
import { browserSubscription } from '@/features/subscription/api/browser-client'
import type { AdminPaymentList } from '@/lib/consultation/billing-validation'
import { Disclosure } from './ui/Disclosure'
import './admin-payments-manager.css'

type Payment = AdminPaymentList['items'][number]
type Provider = Payment['provider']
type PaymentStatus = Payment['status']

const labels = {
  PENDING: 'Chờ xác nhận',
  SUCCEEDED: 'Đã xác nhận thành công',
  FAILED: 'Chưa hoàn tất',
  CHARGEBACK: 'Cần đối soát lại',
} satisfies Record<PaymentStatus, string>

const providers = {
  PAYOS: 'PayOS',
  MOMO: 'MoMo',
  FAKE: 'Cổng mô phỏng',
} satisfies Record<Provider, string>

const providerCodes: Provider[] = ['PAYOS', 'MOMO', 'FAKE']
const statusCodes: PaymentStatus[] = [
  'SUCCEEDED',
  'PENDING',
  'FAILED',
  'CHARGEBACK',
]
const pageSize = 6

const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})
const percent = new Intl.NumberFormat('vi-VN', {
  style: 'percent',
  maximumFractionDigits: 1,
})
const dateTime = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'Asia/Ho_Chi_Minh',
})

function isSandbox(payment: Payment) {
  return (
    payment.provider === 'FAKE' ||
    payment.pricingPolicyVersion === 'sandbox-full-price-v1'
  )
}

function exportPayments(payments: Payment[]) {
  const rows = [
    [
      'Gói',
      'Thao tác',
      'Số tiền (VND)',
      'Trạng thái',
      'Cổng',
      'Loại giao dịch',
      'Thời gian (GMT+7)',
    ],
    ...payments.map((payment) => [
      payment.planCode === 'PLUS' ? 'Plus' : 'Premium',
      payment.purpose === 'UPGRADE' ? 'Nâng cấp' : 'Mua gói',
      String(payment.amountVnd),
      labels[payment.status],
      providers[payment.provider],
      isSandbox(payment) ? 'Thử nghiệm' : 'Thương mại',
      dateTime.format(new Date(payment.createdAt)),
    ]),
  ]
  const csv = rows
    .map((row) =>
      row.map((value) => `"${value.replaceAll('"', '""')}"`).join(','),
    )
    .join('\r\n')
  const url = URL.createObjectURL(
    new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = 'giao-dich-goi-dich-vu.csv'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function PaymentMetrics({
  items,
  providerCounts,
}: {
  items: Payment[]
  providerCounts: Record<Provider, number>
}) {
  const succeeded = items.filter((item) => item.status === 'SUCCEEDED')
  const totalPaid = succeeded.reduce((sum, item) => sum + item.amountVnd, 0)
  const totalVolume = items.reduce((sum, item) => sum + item.amountVnd, 0)
  const successRate = items.length ? succeeded.length / items.length : 0
  const plus = items.filter((item) => item.planCode === 'PLUS').length
  const premium = items.length - plus
  const plusShare = items.length ? plus / items.length : 0
  const usedProviders = providerCodes.filter((code) => providerCounts[code] > 0)
  const recent = items.slice(0, 6).reverse()
  const largest = Math.max(1, ...recent.map((item) => item.amountVnd))

  return (
    <section className="apm-metrics" aria-label="Tổng quan giao dịch">
      <article className="apm-metric apm-metric-revenue">
        <header>
          <h2>Tổng số tiền đã giao dịch</h2>
          <span className="apm-badge apm-badge-good">
            {succeeded.length > 0 ? 'Đã xác nhận' : 'Giao dịch'}
          </span>
        </header>
        <div className="apm-metric-main">
          <strong className="apm-value">
            {items.length ? money.format(totalPaid) : '—'}
          </strong>
          <p>
            Tổng số tiền từ các giao dịch gói dịch vụ đã hoàn tất thành công.
          </p>
        </div>
        <footer>
          {recent.length > 0 ? (
            <svg
              className="apm-recent-bars"
              viewBox="0 0 212 34"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {recent.map((item, index) => {
                const height = 6 + Math.round((item.amountVnd / largest) * 28)
                return (
                  <rect
                    key={item.paymentId}
                    className={
                      item.status === 'SUCCEEDED' ? 'is-confirmed' : undefined
                    }
                    x={index * 36}
                    y={34 - height}
                    width="31"
                    height={height}
                    rx="3"
                  />
                )
              })}
            </svg>
          ) : (
            <span>Chưa có giao dịch</span>
          )}
          {items.length > 0 && (
            <span>Tổng giá trị phát sinh: {money.format(totalVolume)}</span>
          )}
        </footer>
      </article>

      <article className="apm-metric">
        <header>
          <h2>Tỷ lệ thành công</h2>
          <span>
            {succeeded.length} / {items.length} giao dịch
          </span>
        </header>
        <div className="apm-metric-main apm-success">
          <div>
            <strong className="apm-value">
              {items.length ? percent.format(successRate) : '—'}
            </strong>
            <ul className="apm-legend">
              <li>
                <i className="apm-dot is-green" />
                {succeeded.length} Thành công
              </li>
              <li>
                <i className="apm-dot is-amber" />
                {items.length - succeeded.length} Chưa thành công
              </li>
            </ul>
          </div>
          <svg className="apm-ring" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="27" />
            {successRate > 0 && (
              <circle
                className="apm-ring-progress"
                cx="32"
                cy="32"
                r="27"
                pathLength="100"
                strokeDasharray={`${successRate * 100} 100`}
                transform="rotate(-90 32 32)"
              />
            )}
            <text x="32" y="32" textAnchor="middle" dominantBaseline="central">
              {succeeded.length}/{items.length}
            </text>
          </svg>
        </div>
        <footer>Trên các giao dịch gần nhất</footer>
      </article>

      <article className="apm-metric">
        <header>
          <h2>Phân bổ gói dịch vụ</h2>
          <span>{Number(plus > 0) + Number(premium > 0)} gói có giao dịch</span>
        </header>
        <div className="apm-metric-main apm-distribution">
          <ul className="apm-legend">
            <li>
              <i className="apm-dot is-blue" />
              <span>Plus ({plus})</span>
              <strong>{items.length ? percent.format(plusShare) : '—'}</strong>
            </li>
            <li>
              <i className="apm-dot is-amber" />
              <span>Premium ({premium})</span>
              <strong>
                {items.length ? percent.format(1 - plusShare) : '—'}
              </strong>
            </li>
          </ul>
          <svg
            viewBox="0 0 100 8"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <rect
              width="100"
              height="8"
              className={items.length ? 'apm-premium-bar' : 'apm-empty-bar'}
            />
            <rect width={plusShare * 100} height="8" className="apm-plus-bar" />
          </svg>
        </div>
        <footer>Phân bổ theo số lượng giao dịch</footer>
      </article>

      <article className="apm-metric">
        <header>
          <h2>Cổng thanh toán</h2>
          <Wallet size={17} className="apm-metric-icon" aria-hidden="true" />
        </header>
        <div className="apm-metric-main">
          <strong className="apm-value">{usedProviders.length} cổng</strong>
          <p>Có giao dịch trong danh sách gần nhất.</p>
        </div>
        <footer className="apm-provider-overview">
          {usedProviders.length ? (
            usedProviders.map((code) => (
              <span key={code}>
                <i className="apm-dot" data-provider={code} />
                {providers[code]} <b>{providerCounts[code]}</b>
              </span>
            ))
          ) : (
            <span>Chưa ghi nhận cổng thanh toán</span>
          )}
        </footer>
      </article>
    </section>
  )
}

function PaymentRow({ item }: { item: Payment }) {
  const plus = item.planCode === 'PLUS'
  const isFakeProvider = item.provider === 'FAKE'

  return (
    <article className="apm-transaction" data-status={item.status}>
      <div className="apm-transaction-main">
        <span
          className="apm-plan-icon"
          data-plan={item.planCode}
          aria-hidden="true"
        >
          {plus ? <Zap size={22} /> : <Sparkles size={22} />}
        </span>
        <div className="apm-entry">
          <div className="apm-entry-heading">
            <h3>
              {plus ? 'Plus' : 'Premium'} ·{' '}
              {item.purpose === 'UPGRADE' ? 'Nâng cấp' : 'Mua gói'}
            </h3>
            <span className="apm-status-badge" data-status={item.status}>
              <i className="apm-dot" />
              {labels[item.status]}
            </span>
            <span className="apm-badge">{providers[item.provider]}</span>
          </div>
          <p className="apm-entry-meta">
            <strong>{money.format(item.amountVnd)}</strong>
            <time dateTime={item.createdAt}>
              <Clock size={13} aria-hidden="true" />
              {dateTime.format(new Date(item.createdAt))}
            </time>
          </p>
          {isFakeProvider ? (
            <p className="apm-entry-note">
              Giao dịch qua cổng thử nghiệm, không phải doanh thu thương mại.
            </p>
          ) : (
            <p className="apm-entry-note">
              Giao dịch thanh toán gói {plus ? 'MentalBridge Plus' : 'MentalBridge Premium'} qua cổng {providers[item.provider]}.
            </p>
          )}
        </div>
      </div>
      <Disclosure
        className="apm-transaction-details"
        contentClassName="apm-detail-content"
        summary="Chi tiết kỹ thuật"
        summaryLabel={`Thông tin kỹ thuật giao dịch ${item.paymentId}`}
      >
        <dl className="apm-detail-grid">
          <div>
            <dt>Giao dịch</dt>
            <dd>{item.paymentId}</dd>
          </div>
          <div>
            <dt>Thuê bao</dt>
            <dd>{item.subscriptionId}</dd>
          </div>
          <div>
            <dt>Phiên bản gói</dt>
            <dd>{item.planVersionId}</dd>
          </div>
          <div>
            <dt>Đơn vị xử lý</dt>
            <dd>{providers[item.provider]}</dd>
          </div>
          <div>
            <dt>Quy tắc giá</dt>
            <dd>{item.pricingPolicyVersion}</dd>
          </div>
        </dl>
      </Disclosure>
    </article>
  )
}

export default function AdminPaymentsManager({
  onNotice,
}: {
  onNotice?: (message: string) => void
}) {
  const [data, setData] = useState<AdminPaymentList | null>(null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<PaymentStatus | 'ALL'>('ALL')
  const [provider, setProvider] = useState<Provider | 'ALL'>('ALL')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [page, setPage] = useState(1)

  async function load() {
    setLoading(true)
    setFailed(false)
    try {
      setData(await browserSubscription.adminPayments())
      setPage(1)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    browserSubscription.adminPayments().then(
      (response) => {
        if (active) {
          setData(response)
          setLoading(false)
        }
      },
      () => {
        if (active) {
          setFailed(true)
          setLoading(false)
        }
      },
    )
    return () => {
      active = false
    }
  }, [])

  const items = data?.items ?? []
  const providerCounts = { FAKE: 0, MOMO: 0, PAYOS: 0 }
  for (const item of items) providerCounts[item.provider] += 1
  const availableProviders = providerCodes.filter(
    (code) => providerCounts[code] > 0 || provider === code,
  )

  const gatewayItems = items.filter(
    (item) => provider === 'ALL' || item.provider === provider,
  )
  const statusCounts = { SUCCEEDED: 0, PENDING: 0, FAILED: 0, CHARGEBACK: 0 }
  for (const item of gatewayItems) statusCounts[item.status] += 1
  const filtered = gatewayItems.filter(
    (item) => status === 'ALL' || item.status === status,
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const start = (page - 1) * pageSize
  const displayed = filtered.slice(start, start + pageSize)

  function filterProvider(value: Provider | 'ALL') {
    setProvider(value)
    setPage(1)
  }

  function filterStatus(value: PaymentStatus | 'ALL') {
    setStatus(value)
    setPage(1)
  }

  return (
    <div className="admin-payments-manager" aria-busy={loading}>
      <header className="apm-heading">
        <div>
          <span className="apm-eyebrow">Quản trị nền tảng</span>
          <h1>Giao dịch gói dịch vụ</h1>
          <p>
            Tra cứu tối đa 200 giao dịch gần nhất. Trang chỉ dùng để xem và đối
            chiếu các giao dịch thanh toán.
          </p>
        </div>
        <div className="apm-actions">
          <button
            type="button"
            className="apm-button"
            disabled={loading}
            onClick={() => {
              void load()
              onNotice?.('Đang làm mới giao dịch.')
            }}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Làm mới
          </button>
          <button
            type="button"
            className="apm-button"
            disabled={!data}
            aria-expanded={advancedOpen}
            aria-controls="apm-advanced-filters"
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            <Filter size={16} aria-hidden="true" />
            {status === 'ALL' ? 'Lọc nâng cao' : 'Lọc nâng cao (1)'}
          </button>
          <button
            type="button"
            className="apm-button apm-button-primary"
            disabled={loading || failed || !filtered.length}
            onClick={() => exportPayments(filtered)}
          >
            <FileDown size={16} aria-hidden="true" />
            Xuất báo cáo
          </button>
        </div>
      </header>

      {loading && !data && (
        <p className="apm-notice" role="status">
          Đang tải giao dịch…
        </p>
      )}
      {failed && (
        <div className="apm-notice" role="alert">
          <p>
            Chưa thể tải giao dịch. Thông tin đã tải trước đó, nếu có, chưa được
            cập nhật.
          </p>
          <button
            type="button"
            className="apm-button"
            onClick={() => void load()}
          >
            Thử lại
          </button>
        </div>
      )}
      {data && (
        <>
          <PaymentMetrics items={items} providerCounts={providerCounts} />

          <div className="apm-filters">
            <div
              className="apm-status-tabs"
              role="group"
              aria-label="Trạng thái giao dịch"
            >
              <button
                type="button"
                aria-pressed={status === 'ALL'}
                onClick={() => filterStatus('ALL')}
              >
                Tất cả trạng thái <b>({gatewayItems.length})</b>
              </button>
              {statusCodes.map((code) => (
                <button
                  type="button"
                  key={code}
                  aria-pressed={status === code}
                  onClick={() => filterStatus(code)}
                >
                  <i className="apm-dot" data-status={code} />
                  {code === 'SUCCEEDED' ? 'Thành công' : labels[code]}{' '}
                  <b>({statusCounts[code]})</b>
                </button>
              ))}
            </div>
            <label className="apm-select">
              <span>Lọc cổng thanh toán</span>
              <span className="apm-select-control">
                <select
                  value={provider}
                  onChange={(event) =>
                    filterProvider(event.target.value as Provider | 'ALL')
                  }
                >
                  <option value="ALL">Tất cả cổng thanh toán</option>
                  {availableProviders.map((code) => (
                    <option key={code} value={code}>
                      {providers[code]}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} aria-hidden="true" />
              </span>
            </label>
            <div
              className="apm-advanced"
              id="apm-advanced-filters"
              hidden={!advancedOpen}
            >
              <label className="apm-select">
                <span>Lọc trạng thái</span>
                <span className="apm-select-control">
                  <select
                    value={status}
                    onChange={(event) =>
                      filterStatus(event.target.value as PaymentStatus | 'ALL')
                    }
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    {statusCodes.map((code) => (
                      <option key={code} value={code}>
                        {labels[code]}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={15} aria-hidden="true" />
                </span>
              </label>
            </div>
          </div>

          <section
            className="apm-timeline"
            aria-labelledby="apm-timeline-title"
          >
            <header>
              <div>
                <h2 id="apm-timeline-title">
                  <i className="apm-dot is-green" />
                  Dòng thời gian giao dịch gói
                </h2>
                <span className="apm-badge" role="status">
                  {filtered.length} giao dịch
                </span>
              </div>
              <p>
                Đồng bộ máy chủ
                <time dateTime={data.generatedAt}>
                  {dateTime.format(new Date(data.generatedAt))} GMT+7
                </time>
              </p>
            </header>
            {displayed.length ? (
              <div className="apm-transaction-list">
                {displayed.map((item) => (
                  <PaymentRow key={item.paymentId} item={item} />
                ))}
              </div>
            ) : (
              <p className="apm-notice">Chưa có giao dịch phù hợp.</p>
            )}
            <footer className="apm-pagination">
              <p>
                {filtered.length
                  ? `Hiển thị ${start + 1} đến ${start + displayed.length} trong tổng số ${filtered.length} bản ghi`
                  : 'Hiển thị 0 bản ghi'}
              </p>
              <nav aria-label="Phân trang giao dịch">
                <button
                  type="button"
                  className="apm-button"
                  disabled={page === 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Trang trước
                </button>
                <span
                  aria-current="page"
                  aria-label={`Trang ${page} trên ${pageCount}`}
                >
                  {page}
                </span>
                <button
                  type="button"
                  className="apm-button"
                  disabled={page === pageCount}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Trang sau
                </button>
              </nav>
            </footer>
          </section>
        </>
      )}
    </div>
  )
}
