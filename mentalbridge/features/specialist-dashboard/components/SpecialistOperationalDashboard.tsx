'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { ApiError } from '@/lib/api/api-error'
import type { SpecialistDashboard } from '@/lib/consultation/consultation-validation'
import { specialistDashboardBrowserClient } from '../api/browser-client'
import styles from './SpecialistOperationalDashboard.module.css'

type ActionType = SpecialistDashboard['actionRequired'][number]['type']

const ACTION_COPY: Record<
  ActionType,
  { label: string; detail: string; href: string }
> = {
  COMPLETE_PROFILE: {
    label: 'Hoàn thiện hồ sơ chuyên gia',
    detail: 'Tạo hồ sơ để bắt đầu quy trình xét duyệt.',
    href: '/specialist/profile',
  },
  AWAIT_PROFILE_APPROVAL: {
    label: 'Hồ sơ đang chờ xét duyệt',
    detail: 'Dữ liệu vận hành sẽ mở sau khi hồ sơ được phê duyệt.',
    href: '/specialist/profile',
  },
  UPDATE_REJECTED_PROFILE: {
    label: 'Cập nhật hồ sơ theo phản hồi',
    detail: 'Xem lý do và gửi lại hồ sơ đã điều chỉnh.',
    href: '/specialist/profile',
  },
  CONTACT_SUPPORT: {
    label: 'Tài khoản đang tạm ngưng',
    detail: 'Xem trạng thái hồ sơ và liên hệ quản trị viên nếu cần.',
    href: '/specialist/profile',
  },
  REVIEW_APPOINTMENT_REQUESTS: {
    label: 'Phản hồi yêu cầu đặt lịch',
    detail: 'Chỉ các yêu cầu còn thời hạn phản hồi được tính.',
    href: '/specialist/appointments',
  },
  PUBLISH_AVAILABILITY: {
    label: 'Bổ sung lịch khả dụng',
    detail: 'Hiện chưa có khung giờ tương lai có thể đặt.',
    href: '/specialist/availability',
  },
}

const OPERATIONAL_COPY: Record<
  Exclude<SpecialistDashboard['operationalStatus'], 'READY'>,
  { title: string; detail: string }
> = {
  PROFILE_REQUIRED: {
    title: 'Cần hoàn thiện hồ sơ',
    detail: 'Dashboard vận hành chưa mở vì tài khoản chưa có hồ sơ chuyên gia.',
  },
  PENDING_APPROVAL: {
    title: 'Hồ sơ đang được xét duyệt',
    detail:
      'Lịch hẹn và lịch khả dụng được giữ kín cho đến khi hồ sơ được phê duyệt.',
  },
  PROFILE_REJECTED: {
    title: 'Hồ sơ cần được cập nhật',
    detail:
      'Hãy xem phản hồi, điều chỉnh thông tin và gửi lại hồ sơ để xét duyệt.',
  },
  SUSPENDED: {
    title: 'Quyền vận hành đang tạm ngưng',
    detail:
      'Dashboard không hiển thị workload trong thời gian hồ sơ bị tạm ngưng.',
  },
}

function sourceTime(asOf: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(asOf))
}

function appointmentRange(
  item: SpecialistDashboard['nextAppointment']['item'],
) {
  if (!item) return ''
  const start = new Intl.DateTimeFormat('vi-VN', {
    timeZone: item.timezone,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const end = new Intl.DateTimeFormat('vi-VN', {
    timeZone: item.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return `${start.format(new Date(item.scheduledStartAt))}–${end.format(new Date(item.scheduledEndAt))}`
}

function modalityLabel(modality: 'IN_APP_CHAT' | 'IN_APP_VIDEO') {
  return modality === 'IN_APP_VIDEO'
    ? 'Video trong ứng dụng'
    : 'Chat trong ứng dụng'
}

function friendlyError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'UNAUTHENTICATED')
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    if (error.code === 'CONSULTATION_ROLE_REQUIRED')
      return 'Tài khoản hiện tại không có quyền xem dashboard chuyên gia.'
  }
  return 'Chưa thể tải dữ liệu vận hành. Vui lòng thử lại.'
}

function LoadingDashboard() {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <span className={styles.skeletonWide} />
      <div className={styles.loadingGrid}>
        <span />
        <span />
        <span />
      </div>
      <span className={styles.skeletonPanel} />
      <span className={styles.srOnly}>Đang tải dashboard chuyên gia.</span>
    </div>
  )
}

export default function SpecialistOperationalDashboard() {
  const [dashboard, setDashboard] = useState<SpecialistDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setDashboard(await specialistDashboardBrowserClient.get())
    } catch (caught) {
      setDashboard(null)
      setError(friendlyError(caught))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    specialistDashboardBrowserClient
      .get()
      .then((data) => {
        if (active) setDashboard(data)
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
  }, [])

  if (loading) return <LoadingDashboard />

  if (error || !dashboard) {
    return (
      <section className={styles.statePanel} role="alert">
        <span className={styles.stateIcon} aria-hidden="true">
          !
        </span>
        <div>
          <p className={styles.eyebrow}>Dữ liệu tạm thời không khả dụng</p>
          <h1>Không thể tải dashboard</h1>
          <p>{error}</p>
          <button type="button" onClick={load}>
            Thử tải lại
          </button>
        </div>
      </section>
    )
  }

  if (dashboard.operationalStatus !== 'READY') {
    const copy = OPERATIONAL_COPY[dashboard.operationalStatus]
    const action = dashboard.actionRequired[0]
    return (
      <div className={styles.dashboard}>
        <header className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>Không gian chuyên gia</p>
            <h1>{copy.title}</h1>
            <p>{copy.detail}</p>
          </div>
        </header>
        <section className={styles.statePanel} aria-labelledby="blocked-title">
          <span className={styles.stateIcon} aria-hidden="true">
            ◇
          </span>
          <div>
            <h2 id="blocked-title">Dữ liệu vận hành đang được bảo vệ</h2>
            <p>
              Hệ thống chưa hiển thị lịch hẹn, yêu cầu hay lịch khả dụng khi hồ
              sơ chưa đủ điều kiện vận hành.
            </p>
            {action ? (
              <Link href={ACTION_COPY[action.type].href}>
                {ACTION_COPY[action.type].label}
              </Link>
            ) : null}
          </div>
        </section>
        <p className={styles.sourceNote}>
          Nguồn: lịch tư vấn · Cập nhật lúc {sourceTime(dashboard.generatedAt)}
        </p>
      </div>
    )
  }

  const primaryAction =
    dashboard.actionRequired.find(
      (item) => item.type === 'REVIEW_APPOINTMENT_REQUESTS',
    ) ??
    dashboard.actionRequired.find(
      (item) => item.type === 'PUBLISH_AVAILABILITY',
    )
  const primary = primaryAction
    ? ACTION_COPY[primaryAction.type]
    : {
        label: 'Xem lịch hẹn',
        detail: '',
        href: '/specialist/appointments',
      }
  const next = dashboard.nextAppointment.item

  return (
    <div className={styles.dashboard}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Không gian chuyên gia</p>
          <h1>
            Chào bạn
            {dashboard.profile.displayName
              ? `, ${dashboard.profile.displayName}`
              : ''}
          </h1>
          <p>Thông tin vận hành hiện tại từ lịch tư vấn của bạn.</p>
        </div>
        <Link className={styles.primaryAction} href={primary.href}>
          {primary.label}
          <span aria-hidden="true">→</span>
        </Link>
      </header>

      <section className={styles.metrics} aria-label="Số liệu vận hành">
        <article>
          <span className={styles.metricIcon} aria-hidden="true">
            ◷
          </span>
          <div>
            <p>Phiên đã xác nhận hôm nay</p>
            <strong>{dashboard.todayConfirmedSessions.count}</strong>
            <small>
              {dashboard.todayConfirmedSessions.state === 'EMPTY'
                ? 'Chưa có phiên nào hôm nay'
                : 'Theo ngày tại múi giờ hồ sơ'}
            </small>
          </div>
        </article>
        <article>
          <span className={styles.metricIcon} aria-hidden="true">
            ↗
          </span>
          <div>
            <p>Yêu cầu đang chờ</p>
            <strong>{dashboard.pendingAppointmentRequests.count}</strong>
            <small>
              {dashboard.pendingAppointmentRequests.state === 'EMPTY'
                ? 'Không có yêu cầu cần phản hồi'
                : 'Còn trong thời hạn xử lý'}
            </small>
          </div>
        </article>
        <article>
          <span className={styles.metricIcon} aria-hidden="true">
            ▦
          </span>
          <div>
            <p>Khung giờ có thể đặt</p>
            <strong>{dashboard.availability.count}</strong>
            <small>
              {dashboard.availability.state === 'EMPTY'
                ? 'Cần bổ sung lịch tương lai'
                : 'Khung giờ trống trong tương lai'}
            </small>
          </div>
        </article>
      </section>

      <div className={styles.contentGrid}>
        <section className={styles.nextPanel} aria-labelledby="next-title">
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>Lịch sắp tới</p>
              <h2 id="next-title">Phiên tiếp theo</h2>
            </div>
            <Link href="/specialist/appointments">Xem lịch</Link>
          </div>
          {next ? (
            <div className={styles.nextAppointment}>
              <span className={styles.modality}>
                {modalityLabel(next.modality)}
              </span>
              <h3>{appointmentRange(next)}</h3>
              <p>
                Trạng thái:{' '}
                {next.status === 'IN_PROGRESS' ? 'Đang diễn ra' : 'Đã xác nhận'}
              </p>
              <Link href="/specialist/appointments">
                Mở quản lý lịch hẹn <span aria-hidden="true">→</span>
              </Link>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <span aria-hidden="true">○</span>
              <h3>Chưa có phiên đã xác nhận sắp tới</h3>
              <p>Các yêu cầu mới chỉ xuất hiện ở đây sau khi được xác nhận.</p>
            </div>
          )}
        </section>

        <section className={styles.actionPanel} aria-labelledby="action-title">
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>Ưu tiên hiện tại</p>
              <h2 id="action-title">Việc cần chú ý</h2>
            </div>
          </div>
          {dashboard.actionRequired.length ? (
            <ul className={styles.actionList}>
              {dashboard.actionRequired.map((item) => {
                const copy = ACTION_COPY[item.type]
                return (
                  <li key={item.type}>
                    <span aria-hidden="true">{item.count}</span>
                    <div>
                      <strong>{copy.label}</strong>
                      <p>{copy.detail}</p>
                    </div>
                    <Link href={copy.href} aria-label={copy.label}>
                      →
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className={styles.calmState}>
              <span aria-hidden="true">✓</span>
              <div>
                <strong>Không có việc khẩn cần xử lý</strong>
                <p>
                  Dashboard sẽ cập nhật khi có yêu cầu hoặc thiếu lịch trống.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      <footer className={styles.sourceNote}>
        <span>Nguồn: lịch tư vấn</span>
        <span>·</span>
        <span>Cập nhật lúc {sourceTime(dashboard.generatedAt)}</span>
        <button type="button" onClick={load} aria-label="Làm mới dashboard">
          Làm mới
        </button>
      </footer>
    </div>
  )
}
