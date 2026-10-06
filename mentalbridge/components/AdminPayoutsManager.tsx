'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { adminPayoutsBrowserClient } from '@/features/specialist-earnings/api/browser-client'
import type { AdminPayoutList } from '@/lib/consultation/consultation-validation'
import { Skeleton } from './ui/Skeleton'
import './admin-payouts-manager.css'

const labels: Record<AdminPayoutList['items'][number]['status'], string> = {
  PENDING: 'Đang tiếp nhận',
  PROCESSING: 'Đang xử lý',
  SUCCEEDED: 'Đã thanh toán',
  FAILED: 'Chưa thành công',
  UNKNOWN: 'Cần đối soát',
}
function money(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}
function date(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function AdminPayoutsManager({
  onNotice,
}: {
  onNotice: (message: string) => void
}) {
  const [data, setData] = useState<AdminPayoutList | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [filter, setFilter] = useState<
    'ALL' | AdminPayoutList['items'][number]['status']
  >('ALL')
  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      setData(await adminPayoutsBrowserClient.get())
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    let active = true
    adminPayoutsBrowserClient.get().then(
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
  const items = useMemo(
    () =>
      data?.items.filter(
        (item) => filter === 'ALL' || item.status === filter,
      ) ?? [],
    [data, filter],
  )
  const total = data?.items.reduce((sum, item) => sum + item.amountVnd, 0) ?? 0
  const processing =
    data?.items
      .filter((item) =>
        ['PENDING', 'PROCESSING', 'UNKNOWN'].includes(item.status),
      )
      .reduce((sum, item) => sum + item.amountVnd, 0) ?? 0
  const paid =
    data?.items
      .filter((item) => item.status === 'SUCCEEDED')
      .reduce((sum, item) => sum + item.amountVnd, 0) ?? 0

  if (loading)
    return (
      <div className="admin-payouts-manager apo-loading" aria-busy="true">
        <Skeleton height={42} width="40%" />
        <Skeleton height={130} width="100%" />
        <Skeleton height={320} width="100%" />
      </div>
    )
  if (failed || !data)
    return (
      <div className="admin-payouts-manager">
        <section className="apo-state" role="alert">
          <span>↻</span>
          <h1>Chưa thể tải dữ liệu chi trả</h1>
          <p>Không có thao tác tài chính nào được thực hiện.</p>
          <button type="button" onClick={() => void load()}>
            Thử lại
          </button>
        </section>
      </div>
    )

  return (
    <div className="admin-payouts-manager">
      <header className="apo-heading">
        <div>
          <span>Quản trị nền tảng</span>
          <h1>Đối soát chuyên gia</h1>
          <p>
            Theo dõi các yêu cầu chi trả đã được hệ thống tạo từ khoản thu đủ
            điều kiện.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void load()
            onNotice('Đang làm mới dữ liệu chi trả.')
          }}
        >
          Làm mới
        </button>
      </header>
      <section className="apo-metrics" aria-label="Tổng quan chi trả">
        <article>
          <small>Tổng yêu cầu</small>
          <strong>{money(total)}</strong>
          <p>{data.count} yêu cầu</p>
        </article>
        <article>
          <small>Đang xử lý</small>
          <strong>{money(processing)}</strong>
          <p>Cần theo dõi kết quả nhà cung cấp</p>
        </article>
        <article>
          <small>Đã thanh toán</small>
          <strong>{money(paid)}</strong>
          <p>Đã ghi nhận hoàn tất</p>
        </article>
      </section>
      <section className="apo-ledger">
        <header>
          <div>
            <span>Sổ đối soát</span>
            <h2>Yêu cầu chi trả</h2>
          </div>
          <label>
            <span className="apo-sr-only">Lọc trạng thái</span>
            <select
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as typeof filter)
              }
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PENDING">Đang tiếp nhận</option>
              <option value="PROCESSING">Đang xử lý</option>
              <option value="SUCCEEDED">Đã thanh toán</option>
              <option value="FAILED">Chưa thành công</option>
              <option value="UNKNOWN">Cần đối soát</option>
            </select>
          </label>
        </header>
        {items.length ? (
          <div className="apo-table">
            <div className="apo-table-head">
              <span>Nơi nhận</span>
              <span>Khoản thu</span>
              <span>Yêu cầu lúc</span>
              <span>Trạng thái</span>
              <span>Số tiền</span>
            </div>
            {items.map((item) => (
              <article key={item.payoutId}>
                <div>
                  <strong>Chuyên gia</strong>
                  <small>{item.destinationHint}</small>
                </div>
                <span>{item.earningCount} khoản đủ điều kiện</span>
                <time>{date(item.requestedAt)}</time>
                <span className={`apo-status is-${item.status.toLowerCase()}`}>
                  {labels[item.status]}
                </span>
                <b>{money(item.amountVnd)}</b>
                {item.failureCode && (
                  <p role="status">
                    Yêu cầu cần được đối soát lại trước khi tiếp tục.
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="apo-empty">
            <span>◇</span>
            <h3>Không có yêu cầu phù hợp</h3>
            <p>Thử chọn trạng thái khác hoặc làm mới dữ liệu.</p>
          </div>
        )}
      </section>
      <p className="apo-footnote">
        Màn hình này chỉ theo dõi và đối soát. Việc chi tiền thật vẫn bị tắt cho
        tới khi có phê duyệt vận hành và thông tin kết nối production.
      </p>
    </div>
  )
}
