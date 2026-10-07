'use client'

import { useCallback, useEffect, useState } from 'react'

import { ApiError } from '@/lib/api/api-error'
import type { SpecialistOperationalAnalytics as Analytics } from '@/lib/consultation/consultation-validation'
import {
  specialistAnalyticsBrowserClient,
  type AnalyticsPeriodDays,
} from '../api/browser-client'
import styles from './SpecialistOperationalAnalytics.module.css'

const PERIODS: ReadonlyArray<{ days: AnalyticsPeriodDays; label: string }> = [
  { days: 7, label: '7 ngày' },
  { days: 30, label: '30 ngày' },
  { days: 90, label: '90 ngày' },
]

const BLOCKED_COPY: Record<
  'PROFILE_REQUIRED' | 'PENDING_APPROVAL' | 'PROFILE_REJECTED',
  { title: string; detail: string }
> = {
  PROFILE_REQUIRED: {
    title: 'Cần hoàn thiện hồ sơ chuyên gia',
    detail: 'Số liệu vận hành sẽ mở sau khi hồ sơ được tạo và phê duyệt.',
  },
  PENDING_APPROVAL: {
    title: 'Hồ sơ đang chờ xét duyệt',
    detail: 'Số liệu vận hành sẽ mở sau khi hồ sơ được phê duyệt.',
  },
  PROFILE_REJECTED: {
    title: 'Hồ sơ cần được cập nhật',
    detail: 'Hãy cập nhật hồ sơ theo phản hồi trước khi tiếp tục hoạt động.',
  },
}

function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value))
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function friendlyError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'UNAUTHENTICATED')
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    if (error.code === 'CONSULTATION_ROLE_REQUIRED')
      return 'Tài khoản hiện tại không có quyền xem số liệu chuyên gia.'
  }
  return 'Chưa thể tải số liệu vận hành. Vui lòng thử lại.'
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>{value.toLocaleString('vi-VN')}</strong>
    </div>
  )
}

export default function SpecialistOperationalAnalytics() {
  const [periodDays, setPeriodDays] = useState<AnalyticsPeriodDays>(30)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (days: AnalyticsPeriodDays) => {
    setLoading(true)
    setError('')
    try {
      setAnalytics(await specialistAnalyticsBrowserClient.get(days))
    } catch (caught) {
      setAnalytics(null)
      setError(friendlyError(caught))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    specialistAnalyticsBrowserClient
      .get(periodDays)
      .then((data) => {
        if (active) setAnalytics(data)
      })
      .catch((caught: unknown) => {
        if (active) setError(friendlyError(caught))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [periodDays])

  function changePeriod(days: AnalyticsPeriodDays) {
    setPeriodDays(days)
    setLoading(true)
    setError('')
  }

  if (loading) {
    return (
      <div className={styles.loading} role="status" aria-live="polite">
        <span />
        <span />
        <span />
        <p>Đang tổng hợp số liệu vận hành.</p>
      </div>
    )
  }

  if (error || !analytics) {
    return (
      <section className={styles.statePanel} role="alert">
        <span aria-hidden="true">!</span>
        <div>
          <h1>Không thể tải số liệu vận hành</h1>
          <p>{error}</p>
          <button type="button" onClick={() => load(periodDays)}>
            Thử tải lại
          </button>
        </div>
      </section>
    )
  }

  if (
    analytics.operationalStatus === 'PROFILE_REQUIRED' ||
    analytics.operationalStatus === 'PENDING_APPROVAL' ||
    analytics.operationalStatus === 'PROFILE_REJECTED'
  ) {
    const copy = BLOCKED_COPY[analytics.operationalStatus]
    return (
      <section className={styles.statePanel}>
        <span aria-hidden="true">◇</span>
        <div>
          <p className={styles.eyebrow}>Phân tích vận hành</p>
          <h1>{copy.title}</h1>
          <p>{copy.detail}</p>
        </div>
      </section>
    )
  }

  const stale = [
    analytics.availability.state,
    analytics.appointments.state,
    analytics.rating.state,
    analytics.financials.state,
  ].includes('STALE')
  const availability = analytics.availability
  const appointments = analytics.appointments
  const financials = analytics.financials

  return (
    <div className={styles.analytics}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Phân tích vận hành</p>
          <h1>Hoạt động tư vấn của bạn</h1>
          <p>
            Theo dõi lịch đã mở và các mốc xử lý lịch hẹn, không sử dụng dữ liệu
            sức khỏe tinh thần của người dùng.
          </p>
        </div>
        <label className={styles.periodSelect}>
          <span>Khoảng thời gian</span>
          <select
            value={periodDays}
            onChange={(event) =>
              changePeriod(Number(event.target.value) as AnalyticsPeriodDays)
            }
          >
            {PERIODS.map((period) => (
              <option key={period.days} value={period.days}>
                {period.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      {analytics.operationalStatus === 'SUSPENDED' ? (
        <div className={styles.notice} role="status">
          Hồ sơ đang tạm ngưng. Các số liệu dưới đây là lịch sử hoạt động của
          bạn và không có nghĩa là tài khoản đang nhận lịch mới.
        </div>
      ) : null}
      {stale ? (
        <div className={styles.stale} role="status">
          Số liệu có thể đã cũ. Hãy làm mới trước khi dùng để đối chiếu.
        </div>
      ) : null}

      <section className={styles.summary} aria-label="Tóm tắt vận hành">
        <article>
          <span>Lịch đã mở</span>
          <strong>{availability.publishedSlotCount ?? 0}</strong>
          <p>
            {availability.utilizedSlotCount ?? 0} lịch đã được nhận ·{' '}
            {availability.unusedSlotCount ?? 0} lịch chưa được sử dụng
          </p>
        </article>
        <article>
          <span>Tỷ lệ sử dụng lịch</span>
          <strong>
            {availability.utilizationRate === null
              ? '—'
              : `${availability.utilizationRate.toLocaleString('vi-VN')}%`}
          </strong>
          <p>
            Tính theo lịch trong kỳ từng có yêu cầu được chuyên gia chấp nhận.
          </p>
        </article>
        <article>
          <span>Phiên hoàn thành</span>
          <strong>{appointments.completedCount ?? 0}</strong>
          <p>{appointments.userNoShowCount ?? 0} lượt người dùng vắng mặt</p>
        </article>
        <article>
          <span>Đánh giá hiện tại</span>
          <strong>
            {analytics.rating.averageRating === null
              ? '—'
              : `${analytics.rating.averageRating.toLocaleString('vi-VN')} / 5`}
          </strong>
          <p>{analytics.rating.ratingCount ?? 0} lượt đánh giá</p>
        </article>
      </section>

      <section className={styles.lifecycle} aria-labelledby="lifecycle-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Diễn biến lịch hẹn</p>
            <h2 id="lifecycle-title">Các mốc phát sinh trong kỳ</h2>
          </div>
          <span>
            {formatDate(analytics.period.from, analytics.period.timezone)} –{' '}
            {formatDate(analytics.period.to, analytics.period.timezone)}
          </span>
        </div>
        {appointments.state === 'EMPTY' ? (
          <div className={styles.empty}>
            <strong>Chưa có hoạt động trong khoảng này</strong>
            <p>Hãy chọn khoảng dài hơn để xem các mốc trước đó.</p>
          </div>
        ) : (
          <div className={styles.metricGrid}>
            <Metric
              label="Yêu cầu mới"
              value={appointments.requestedCount ?? 0}
            />
            <Metric
              label="Đã chấp nhận"
              value={appointments.acceptedCount ?? 0}
            />
            <Metric
              label="Đã từ chối"
              value={appointments.rejectedCount ?? 0}
            />
            <Metric label="Hết hạn" value={appointments.expiredCount ?? 0} />
            <Metric label="Đã hủy" value={appointments.cancelledCount ?? 0} />
            <Metric
              label="Đã đổi lịch"
              value={appointments.rescheduledCount ?? 0}
            />
            <Metric
              label="Đã hoàn thành"
              value={appointments.completedCount ?? 0}
            />
            <Metric
              label="Người dùng vắng"
              value={appointments.userNoShowCount ?? 0}
            />
            <Metric
              label="Chuyên gia vắng"
              value={appointments.specialistNoShowCount ?? 0}
            />
            <Metric
              label="Cả hai vắng"
              value={appointments.bothNoShowCount ?? 0}
            />
          </div>
        )}
        <p className={styles.historyNote}>
          Mỗi mốc được giữ theo thời điểm phát sinh. Một lần hủy hoặc đổi lịch
          sau đó không xóa yêu cầu hay lần chấp nhận trước đó.
        </p>
      </section>

      <section className={styles.financial} aria-labelledby="financial-title">
        <span aria-hidden="true">◈</span>
        <div>
          <p className={styles.eyebrow}>Thu nhập và thanh toán</p>
          {financials.state === 'UNAVAILABLE' ? (
            <>
              <h2 id="financial-title">Chưa thể tải dữ liệu tài chính</h2>
              <p>
                Nguồn thu nhập và thanh toán hiện không khả dụng. Hệ thống không
                ước tính hoặc thay thế bằng số mẫu.
              </p>
            </>
          ) : (
            <>
              <h2 id="financial-title">
                {financials.state === 'EMPTY'
                  ? 'Chưa phát sinh tài chính trong kỳ'
                  : 'Tài chính trong kỳ'}
              </h2>
              <div className={styles.financialFacts}>
                <span>
                  <small>Thu nhập ghi nhận</small>
                  <strong>
                    {formatMoney(
                      financials.earnedAmountMinor ?? 0,
                      financials.currency ?? 'VND',
                    )}
                  </strong>
                </span>
                <span>
                  <small>Đã thanh toán</small>
                  <strong>
                    {formatMoney(
                      financials.paidAmountMinor ?? 0,
                      financials.currency ?? 'VND',
                    )}
                  </strong>
                </span>
              </div>
              <p>
                Tổng hợp từ khoản thu MB-516 và các payout thành công phát sinh
                trong khoảng thời gian đã chọn.
              </p>
            </>
          )}
        </div>
      </section>

      <footer className={styles.footer}>
        <span>
          Cập nhật lúc{' '}
          {formatTime(analytics.generatedAt, analytics.period.timezone)}
        </span>
        <button type="button" onClick={() => load(periodDays)}>
          Làm mới
        </button>
      </footer>
    </div>
  )
}
