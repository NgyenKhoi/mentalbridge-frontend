'use client'

import { useEffect, useState } from 'react'
import { browserSubscription } from '@/features/subscription/api/browser-client'
import type { AdminPaymentList } from '@/lib/consultation/billing-validation'
import { Disclosure } from './ui/Disclosure'
import './admin-payments-manager.css'

const labels: Record<AdminPaymentList['items'][number]['status'], string> = {
  PENDING: 'Chờ xác nhận',
  SUCCEEDED: 'Đã xác nhận thành công',
  FAILED: 'Chưa thành công',
  CHARGEBACK: 'Cần đối soát lại',
}
const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)

export default function AdminPaymentsManager({
  onNotice,
}: {
  onNotice?: (message: string) => void
}) {
  const [data, setData] = useState<AdminPaymentList | null>(null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')

  async function load() {
    setLoading(true)
    setFailed(false)
    try {
      setData(await browserSubscription.adminPayments())
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

  const items =
    data?.items.filter((item) => filter === 'ALL' || item.status === filter) ??
    []
  return (
    <div className="admin-payments-manager" aria-busy={loading}>
      <header className="role-heading apm-heading">
        <div>
          <span className="eyebrow">Quản trị nền tảng</span>
          <h1>Giao dịch gói dịch vụ</h1>
          <p>
            Tra cứu tối đa 200 giao dịch gần nhất. Chỉ đọc, không chỉnh sửa
            khoản thanh toán.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            void load()
            onNotice?.('Đang làm mới giao dịch.')
          }}
        >
          Làm mới
        </button>
      </header>
      {loading && !data && <p role="status">Đang tải giao dịch…</p>}
      {failed && (
        <div role="alert">
          <p>
            Chưa thể tải giao dịch. Thông tin đã tải trước đó, nếu có, chưa được
            cập nhật.
          </p>
          <button type="button" disabled={loading} onClick={() => void load()}>
            Thử lại
          </button>
        </div>
      )}
      {data && (
        <section className="apm-transactions">
          <header>
            <div>
              <h2>Giao dịch gần đây</h2>
              <p>
                Cập nhật {new Date(data.generatedAt).toLocaleString('vi-VN')}
              </p>
            </div>
            <label>
              Lọc trạng thái{' '}
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                <option value="ALL">Tất cả trạng thái</option>
                {Object.entries(labels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </header>
          <p role="status">{items.length} giao dịch đang hiển thị</p>
          {!items.length && (
            <p>
              Chưa có giao dịch phù hợp. Không có số liệu doanh thu để hiển thị
              từ danh sách này.
            </p>
          )}
          {items.map((item) => (
            <article className="apm-canonical-row" key={item.paymentId}>
              <h3>
                {item.planCode === 'PLUS' ? 'Plus' : 'Premium'} ·{' '}
                {item.purpose === 'UPGRADE' ? 'Nâng cấp' : 'Mua gói'}
              </h3>
              <p>
                {money(item.amountVnd)} · {labels[item.status]} ·{' '}
                {new Date(item.createdAt).toLocaleString('vi-VN')}
              </p>
              {(item.provider === 'FAKE' ||
                item.pricingPolicyVersion === 'sandbox-full-price-v1') && (
                <p>
                  Giao dịch thử nghiệm, không phải doanh thu thương mại.{' '}
                  {item.provider === 'FAKE' && 'Mô phỏng, không thu tiền thật.'}
                </p>
              )}
              <Disclosure
                summary="Thông tin kỹ thuật"
                summaryLabel={`Thông tin kỹ thuật giao dịch ${item.paymentId}`}
              >
                <p>Giao dịch: {item.paymentId}</p>
                <p>Thuê bao: {item.subscriptionId}</p>
                <p>Phiên bản gói: {item.planVersionId}</p>
                <p>Đơn vị xử lý: {item.provider}</p>
                <p>Quy tắc giá: {item.pricingPolicyVersion}</p>
              </Disclosure>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
