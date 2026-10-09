'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import type { ProductJourneyMetrics } from '@/features/auth/api/identity-contract'

import './admin-dashboard-manager.css'

type RangeDays = 7 | 30 | 90

const LABELS: Record<string, string> = {
  USER_ACCOUNTS_REGISTERED: 'Tài khoản người dùng đăng ký',
  USER_ACCOUNTS_ACTIVATED: 'Tài khoản người dùng được kích hoạt',
  COMPLETED_SCREENING_EPISODES: 'Lượt hoàn thành sàng lọc',
  SUPPORT_GUIDES_GENERATED: 'Gợi ý hỗ trợ đã tạo',
  SUPPORT_GUIDES_OPENED: 'Gợi ý hỗ trợ đã mở',
  PAID_SUPPORT_PLANS_ACTIVATED: 'Kế hoạch hỗ trợ trả phí đã kích hoạt',
  CONSULTATIONS_REQUESTED: 'Lịch tư vấn đã yêu cầu',
  CONSULTATIONS_CONFIRMED: 'Lịch tư vấn đã xác nhận',
  CONSULTATIONS_COMPLETED: 'Lịch tư vấn đã hoàn thành',
}

function windowFor(days: RangeDays) {
  const to = new Date()
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - days)
  return { from: from.toISOString(), to: to.toISOString() }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value)
}

function formatInstant(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

async function fetchMetrics(days: RangeDays) {
  const query = new URLSearchParams(windowFor(days))
  const response = await fetch(
    `/api/admin/product-journey-metrics?${query.toString()}`,
    { cache: 'no-store' },
  )
  if (!response.ok) throw new Error('Unable to load product journey metrics')
  return (await response.json()) as ProductJourneyMetrics
}

export function ProductJourneyMetricsPanel({
  onNotice,
}: {
  onNotice?: (message: string) => void
}) {
  const [range, setRange] = useState<RangeDays>(30)
  const [metrics, setMetrics] = useState<ProductJourneyMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(
    async (days: RangeDays, announce = false) => {
      setLoading(true)
      setError(false)
      try {
        const next = await fetchMetrics(days)
        setMetrics(next)
        if (announce) onNotice?.('Đã cập nhật số liệu hành trình sản phẩm.')
      } catch {
        setError(true)
        setMetrics(null)
      } finally {
        setLoading(false)
      }
    },
    [onNotice],
  )

  useEffect(() => {
    let cancelled = false
    void fetchMetrics(range)
      .then((next) => {
        if (cancelled) return
        setMetrics(next)
        setError(false)
      })
      .catch(() => {
        if (cancelled) return
        setError(true)
        setMetrics(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [range])

  const unavailableCount = useMemo(
    () =>
      metrics?.sources.filter((source) => source.status === 'UNAVAILABLE')
        .length ?? 0,
    [metrics],
  )

  return (
    <div className="admin-dashboard-manager">
      <div className="role-heading adm-heading">
        <div>
          <span className="eyebrow">Vận hành sản phẩm</span>
          <h1>Hành trình trên MentalBridge</h1>
          <p>
            Theo dõi hoạt động tổng hợp mà không mở hồ sơ sức khỏe của từng
            người.
          </p>
        </div>
        <div className="adm-heading-actions">
          <label>
            <span>Khoảng thời gian</span>
            <select
              aria-label="Khoảng thời gian thống kê"
              value={range}
              onChange={(event) => {
                setLoading(true)
                setError(false)
                setRange(Number(event.target.value) as RangeDays)
              }}
              disabled={loading}
            >
              <option value={7}>7 ngày</option>
              <option value={30}>30 ngày</option>
              <option value={90}>90 ngày</option>
            </select>
          </label>
          <button
            className="btn-primary"
            onClick={() => void load(range, true)}
            disabled={loading}
          >
            {loading ? 'Đang cập nhật…' : 'Làm mới số liệu'}
          </button>
        </div>
      </div>

      <section
        className="adm-journey-panel"
        aria-labelledby="journey-title"
        aria-busy={loading}
      >
        <header>
          <div>
            <span>TỔNG HỢP TOÀN NỀN TẢNG</span>
            <h2 id="journey-title">Các mốc hoạt động</h2>
            <p>
              Mỗi con số là một sự kiện được nguồn thẩm quyền ghi nhận trong cửa
              sổ nửa mở [từ, đến). Các mốc là tổng độc lập, không phải một
              cohort chuyển đổi và không chứng minh hiệu quả lâm sàng hay quan
              hệ nguyên nhân–kết quả.
            </p>
          </div>
          {metrics ? (
            <div className="adm-window-provenance">
              <small>
                Khoảng dữ liệu: {formatInstant(metrics.window.from)} –{' '}
                {formatInstant(metrics.window.to)} (không gồm thời điểm kết
                thúc)
              </small>
              <small>Chốt dữ liệu: {formatInstant(metrics.asOf)}</small>
            </div>
          ) : null}
        </header>

        {loading ? (
          <div className="adm-journey-state" role="status">
            Đang tổng hợp số liệu…
          </div>
        ) : error ? (
          <div className="adm-journey-state adm-journey-error" role="alert">
            <strong>Chưa thể tải số liệu.</strong>
            <span>Dữ liệu cũ không được giữ lại. Hãy thử lại sau ít phút.</span>
            <button onClick={() => void load(range)}>Thử lại</button>
          </div>
        ) : metrics ? (
          <>
            {unavailableCount > 0 ? (
              <p className="adm-partial-notice" role="status">
                {unavailableCount} nguồn đang tạm thời không phản hồi. Các mục
                liên quan được đánh dấu chưa có dữ liệu thay vì ước đoán.
              </p>
            ) : null}
            <div className="adm-journey-flow">
              {metrics.stages.map((stage, index) => (
                <article
                  key={stage.stage}
                  className={
                    stage.status === 'UNAVAILABLE' ? 'unavailable' : ''
                  }
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>
                    {stage.count == null ? '—' : formatNumber(stage.count)}
                  </strong>
                  <h3>{LABELS[stage.stage] ?? stage.stage}</h3>
                  {stage.status === 'UNAVAILABLE' ? (
                    <p>
                      {stage.unavailableReason ===
                      'AUTHORITATIVE_USAGE_FACT_UNAVAILABLE'
                        ? 'Chưa có nguồn sử dụng đáng tin cậy'
                        : 'Nguồn dữ liệu đang không khả dụng'}
                    </p>
                  ) : stage.rate ? (
                    <p>
                      {stage.rate.percentage.toLocaleString('vi-VN')}% so với
                      mốc tham chiếu
                    </p>
                  ) : (
                    <p>Số lượng trong khoảng đã chọn</p>
                  )}
                </article>
              ))}
            </div>
            <details className="adm-source-details">
              <summary>Thông tin kỹ thuật</summary>
              <dl>
                {metrics.sources.map((source) => (
                  <div key={source.source}>
                    <dt>{source.source}</dt>
                    <dd>
                      {source.status === 'AVAILABLE'
                        ? `${source.sourceVersion} · ${source.asOf ? formatInstant(source.asOf) : ''}`
                        : 'Không khả dụng'}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          </>
        ) : null}
      </section>
    </div>
  )
}

export default ProductJourneyMetricsPanel
