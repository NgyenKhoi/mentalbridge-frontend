'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Filter, ArrowDown, RefreshCw } from 'lucide-react'

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

const STEP_SHORT_CODES: Record<string, string> = {
  USER_ACCOUNTS_REGISTERED: '01 • ĐĂNG KÝ MỚI',
  USER_ACCOUNTS_ACTIVATED: '02 • KÍCH HOẠT EMAIL',
  COMPLETED_SCREENING_EPISODES: '03 • SÀNG LỌC PHQ-9',
  SUPPORT_GUIDES_GENERATED: '04 • GỢI Ý HỖ TRỢ',
  SUPPORT_GUIDES_OPENED: '05 • MỞ XEM BÀI',
  PAID_SUPPORT_PLANS_ACTIVATED: '06 • ĐỔI GÓI/TRẢ PHÍ',
  CONSULTATIONS_REQUESTED: '07 • YÊU CẦU TƯ VẤN',
  CONSULTATIONS_CONFIRMED: '08 • BÁC SĨ NHẬN CA',
  CONSULTATIONS_COMPLETED: '09 • CA HOÀN TẤT',
}

const STEP_SUBTEXTS: Record<string, string> = {
  USER_ACCOUNTS_REGISTERED: 'Tài khoản người dùng đăng ký',
  USER_ACCOUNTS_ACTIVATED: 'Tài khoản đã kích hoạt',
  COMPLETED_SCREENING_EPISODES: 'Lượt đánh giá tâm lý hoàn tất',
  SUPPORT_GUIDES_GENERATED: 'Lộ trình hỗ trợ được khởi tạo',
  SUPPORT_GUIDES_OPENED: 'Lộ trình được người dùng mở xem',
  PAID_SUPPORT_PLANS_ACTIVATED: 'Kế hoạch chăm sóc được kích hoạt',
  CONSULTATIONS_REQUESTED: 'Yêu cầu tham vấn chuyên gia',
  CONSULTATIONS_CONFIRMED: 'Lịch tham vấn được xác nhận',
  CONSULTATIONS_COMPLETED: 'Phiên tham vấn đã hoàn thành',
}

const RATE_DENOMINATOR_LABELS: Record<string, string> = {
  USER_ACCOUNTS_REGISTERED: 'trong số tài khoản đăng ký',
  CONSULTATIONS_REQUESTED: 'trong số lịch tư vấn đã yêu cầu',
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
}: Readonly<{
  onNotice?: (message: string) => void
}>) {
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

  const stageGroups = useMemo(() => {
    if (!metrics) return null
    return [
      {
        id: 1,
        title: 'GIAI ĐOẠN 1: TIẾP CẬN & ĐÁNH GIÁ BAN ĐẦU',
        stages: metrics.stages.slice(0, 3),
      },
      {
        id: 2,
        title: 'GIAI ĐOẠN 2: ĐỀ XUẤT LỘ TRÌNH & KÍCH HOẠT DỊCH VỤ',
        stages: metrics.stages.slice(3, 6),
      },
      {
        id: 3,
        title: 'GIAI ĐOẠN 3: CAN THIỆP CHUYÊN GIA & CA HOÀN TẤT',
        stages: metrics.stages.slice(6, 9),
      },
    ]
  }, [metrics])

  return (
    <div className="admin-dashboard-manager">
      {/* 2-Column Middle Grid: Left Funnel Pipeline (68%) / Right Task Panel (32%) */}
      <div className="adm-middle-layout">
        {/* Left Column: Clinical Flow Pipeline */}
        <section
          className="adm-funnel-card"
          aria-labelledby="journey-title"
          aria-busy={loading}
        >
          <header className="adm-funnel-header">
            <div className="adm-funnel-header-left">
              <div className="adm-funnel-icon-box" aria-hidden="true">
                <Filter size={18} strokeWidth={2.2} />
              </div>
              <div>
                <h2 id="journey-title" className="adm-funnel-title">
                  Biểu đồ Phễu Hành trình Lâm sàng (Clinical Flow Pipeline)
                </h2>
                <p className="adm-funnel-subtitle">
                  Trực quan hóa luồng chuyển hóa liên tục qua 9 mốc trải nghiệm
                  y tế, bảo mật tuyệt đối danh tính bệnh án.
                </p>
              </div>
            </div>

            <div className="adm-heading-actions">
              <label>
                <span className="sr-only">Khoảng thời gian</span>
                <select
                  aria-label="Khoảng thời gian thống kê"
                  value={range}
                  onChange={(event) => {
                    setLoading(true)
                    setError(false)
                    setRange(Number(event.target.value) as RangeDays)
                  }}
                  disabled={loading}
                  className="adm-range-select"
                >
                  <option value={7}>Khoảng: 7 ngày</option>
                  <option value={30}>Khoảng: 30 ngày • 9 Mốc liên hoàn</option>
                  <option value={90}>Khoảng: 90 ngày</option>
                </select>
              </label>
              <button
                className="btn-primary adm-refresh-btn"
                onClick={() => void load(range, true)}
                disabled={loading}
              >
                <RefreshCw
                  size={14}
                  className={loading ? 'adm-spin' : undefined}
                />
                <span>{loading ? 'Đang cập nhật…' : 'Làm mới số liệu'}</span>
              </button>
            </div>
          </header>

          {/* Window Provenance & Clinical Notice */}
          <div className="adm-window-provenance">
            {metrics ? (
              <div className="adm-provenance-tags">
                <small>
                  Khoảng dữ liệu: {formatInstant(metrics.window.from)} –{' '}
                  {formatInstant(metrics.window.to)} (không gồm thời điểm kết
                  thúc)
                </small>
                <small>Chốt dữ liệu: {formatInstant(metrics.asOf)}</small>
              </div>
            ) : null}
            <p className="adm-disclaimer">
              Các tỷ lệ cho biết mức tiến triển của cùng nhóm tài khoản đăng ký
              hoặc lịch tư vấn được yêu cầu trong khoảng đã chọn. Các số liệu
              chỉ mô tả hoạt động sản phẩm, không chứng minh hiệu quả lâm sàng
              hay quan hệ nguyên nhân–kết quả.
            </p>
          </div>

          {loading ? (
            <div className="adm-journey-state" role="status">
              <div className="adm-loading-spinner" aria-hidden="true" />
              <span>Đang tổng hợp số liệu…</span>
            </div>
          ) : error ? (
            <div className="adm-journey-state adm-journey-error" role="alert">
              <strong>Chưa thể tải số liệu.</strong>
              <span>
                Dữ liệu cũ không được giữ lại. Hãy thử lại sau ít phút.
              </span>
              <button onClick={() => void load(range)}>Thử lại</button>
            </div>
          ) : metrics && stageGroups ? (
            <>
              {unavailableCount > 0 ? (
                <p className="adm-partial-notice" role="status">
                  {unavailableCount} nguồn đang tạm thời không phản hồi. Các mục
                  liên quan được đánh dấu chưa có dữ liệu thay vì ước đoán.
                </p>
              ) : null}

              {/* 3 Stages Container */}
              <div className="adm-stages-vertical-flow">
                {stageGroups.map((group, groupIdx) => (
                  <div key={group.id} className="adm-stage-group-wrapper">
                    <div className="adm-stage-box">
                      <div className="adm-stage-box-header">
                        <span className="adm-stage-box-title">
                          {group.title}
                        </span>
                        {/* Group header rate omitted for unverified claims */}
                      </div>

                      <div className="adm-stage-cards-grid">
                        {group.stages.map((stage) => {
                          const shortCode =
                            STEP_SHORT_CODES[stage.stage] ?? stage.stage
                          const defaultBadge = stage.rate
                            ? `${stage.rate.percentage.toLocaleString('vi-VN')}%`
                            : 'Ghi nhận'
                          const defaultSubtext =
                            STEP_SUBTEXTS[stage.stage] ??
                            'Số lượng trong khoảng đã chọn'
                          const isUnavailable = stage.status === 'UNAVAILABLE'

                          return (
                            <article
                              key={stage.stage}
                              className={`adm-funnel-step-card ${isUnavailable ? 'unavailable' : ''}`}
                            >
                              <div className="adm-step-top">
                                <span className="adm-step-code">
                                  {shortCode}
                                </span>
                                <span
                                  className={`adm-step-badge ${isUnavailable ? 'badge-unavailable' : ''}`}
                                >
                                  {isUnavailable ? 'UNAVAILABLE' : defaultBadge}
                                </span>
                              </div>

                              <strong className="adm-step-count">
                                {stage.count == null
                                  ? '—'
                                  : formatNumber(stage.count)}
                              </strong>

                              <h3 className="adm-step-label">
                                {LABELS[stage.stage] ?? stage.stage}
                              </h3>

                              {isUnavailable ? (
                                <p className="adm-step-subtext">
                                  {stage.unavailableReason ===
                                  'AUTHORITATIVE_USAGE_FACT_UNAVAILABLE'
                                    ? 'Chưa có nguồn sử dụng đáng tin cậy'
                                    : 'Nguồn dữ liệu đang không khả dụng'}
                                </p>
                              ) : stage.rate ? (
                                <p className="adm-step-rate">
                                  {stage.rate.percentage.toLocaleString(
                                    'vi-VN',
                                  )}
                                  %{' '}
                                  {RATE_DENOMINATOR_LABELS[
                                    stage.rate.denominatorStage
                                  ] ?? 'trong nhóm tham chiếu'}
                                </p>
                              ) : (
                                <p className="adm-step-subtext">
                                  {defaultSubtext}
                                </p>
                              )}
                            </article>
                          )
                        })}
                      </div>
                    </div>

                    {/* Downward Arrow between stages */}
                    {groupIdx < stageGroups.length - 1 && (
                      <div className="adm-funnel-arrow-row" aria-hidden="true">
                        <ArrowDown size={18} strokeWidth={2} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Technical Sources details */}
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

        {/* Right Column: Task Control Board & E2E Video Channel */}
        <aside
          className="adm-task-sidebar"
          aria-label="Lối tắt quản trị hệ thống"
        >
          {/* Lối tắt quản trị hệ thống */}
          <div className="adm-task-card">
            <div className="adm-task-card-header">
              <h3 className="adm-task-card-title">Lối tắt quản trị</h3>
              <span className="adm-task-pill-info">Vận hành</span>
            </div>

            <div className="adm-task-list">
              <div className="adm-task-item">
                <h4 className="adm-task-headline">Hồ sơ chuyên gia</h4>
                <p className="adm-task-desc">
                  Quản lý danh sách, hồ sơ chuyên môn và xét duyệt tài khoản
                  chuyên gia.
                </p>
                <div className="adm-task-actions">
                  <Link
                    href="/admin/specialists"
                    className="adm-btn-outline-sm"
                  >
                    Mở quản lý chuyên gia →
                  </Link>
                </div>
              </div>

              <div className="adm-task-item">
                <h4 className="adm-task-headline">Lịch hẹn tư vấn</h4>
                <p className="adm-task-desc">
                  Theo dõi trạng thái lịch hẹn, phiên tham vấn và phân bổ điều
                  phối.
                </p>
                <div className="adm-task-actions">
                  <Link
                    href="/admin/appointments"
                    className="adm-btn-outline-sm"
                  >
                    Mở quản lý lịch hẹn →
                  </Link>
                </div>
              </div>

              <div className="adm-task-item">
                <h4 className="adm-task-headline">Đối soát chi trả</h4>
                <p className="adm-task-desc">
                  Kiểm tra đối soát tài chính gói dịch vụ và xử lý thanh toán
                  chuyên gia.
                </p>
                <div className="adm-task-actions">
                  <Link href="/admin/payouts" className="adm-btn-outline-sm">
                    Mở đối soát chi trả →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default ProductJourneyMetricsPanel
