'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { specialistDashboardBrowserClient } from '@/features/specialist-dashboard/api/browser-client'
import { ApiError } from '@/lib/api/api-error'
import type { SpecialistDashboard } from '@/lib/consultation/consultation-validation'

type DashboardAppointment =
  SpecialistDashboard['todayConfirmedSessions']['items'][number]

const OPERATIONAL_COPY: Record<
  Exclude<SpecialistDashboard['operationalStatus'], 'READY'>,
  { title: string; detail: string }
> = {
  PROFILE_REQUIRED: {
    title: 'Cần hoàn thiện hồ sơ',
    detail: 'Hoàn thiện hồ sơ chuyên gia để bắt đầu quản lý lịch tư vấn.',
  },
  PENDING_APPROVAL: {
    title: 'Hồ sơ đang được xét duyệt',
    detail: 'Lịch làm việc sẽ mở sau khi hồ sơ của bạn được phê duyệt.',
  },
  PROFILE_REJECTED: {
    title: 'Hồ sơ cần được cập nhật',
    detail: 'Xem phản hồi, điều chỉnh thông tin và gửi lại hồ sơ để xét duyệt.',
  },
  SUSPENDED: {
    title: 'Quyền vận hành đang tạm ngưng',
    detail: 'Xem trạng thái hồ sơ và liên hệ quản trị viên nếu bạn cần hỗ trợ.',
  },
}

function friendlyError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'UNAUTHENTICATED')
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    if (error.code === 'CONSULTATION_ROLE_REQUIRED')
      return 'Tài khoản hiện tại không có quyền xem dashboard chuyên gia.'
  }
  return 'Chưa thể tải thông tin hôm nay. Vui lòng thử lại.'
}

function timeRange(item: DashboardAppointment) {
  const time = new Intl.DateTimeFormat('vi-VN', {
    timeZone: item.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return `${time.format(new Date(item.scheduledStartAt))}–${time.format(new Date(item.scheduledEndAt))}`
}

function localDate(item: DashboardAppointment) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: item.timezone,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(item.scheduledStartAt))
}

function durationMinutes(item: DashboardAppointment) {
  return Math.round(
    (Date.parse(item.scheduledEndAt) - Date.parse(item.scheduledStartAt)) /
      60_000,
  )
}

function modalityLabel(modality: DashboardAppointment['modality']) {
  return modality === 'IN_APP_VIDEO'
    ? 'Video trong ứng dụng'
    : 'Chat trong ứng dụng'
}

function statusLabel(status: DashboardAppointment['status']) {
  if (status === 'REQUESTED') return 'Đang chờ'
  if (status === 'CONFIRMED') return 'Đã xác nhận'
  if (status === 'IN_PROGRESS') return 'Đang diễn ra'
  return status
}

function sourceTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value))
}

export default function SpecialistDashboardManager() {
  const reduceMotion = useReducedMotion()
  const [dashboard, setDashboard] = useState<SpecialistDashboard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      setDashboard(await specialistDashboardBrowserClient.get())
    } catch (caught) {
      setDashboard(null)
      setError(friendlyError(caught))
    } finally {
      setIsLoading(false)
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
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const activity = useMemo(() => {
    if (!dashboard) return []
    return [
      ...dashboard.todayConfirmedSessions.items,
      ...dashboard.pendingAppointmentRequests.items,
    ].slice(0, 3)
  }, [dashboard])

  if (isLoading) {
    return (
      <div
        className="specialist-command specialist-dashboard-loading"
        role="status"
      >
        <span className="eyebrow">Không gian chuyên gia</span>
        <h1>Đang tải thông tin hôm nay…</h1>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <section className="specialist-dashboard-state" role="alert">
        <span aria-hidden="true">!</span>
        <div>
          <p className="eyebrow">Dữ liệu tạm thời chưa khả dụng</p>
          <h1>Chưa thể tải dashboard</h1>
          <p>{error}</p>
          <button type="button" className="btn-outline" onClick={load}>
            Thử lại
          </button>
        </div>
      </section>
    )
  }

  if (dashboard.operationalStatus !== 'READY') {
    const copy = OPERATIONAL_COPY[dashboard.operationalStatus]
    return (
      <div className="specialist-command">
        <div className="role-heading specialist-command-head">
          <div>
            <span className="eyebrow">Không gian chuyên gia</span>
            <h1>{copy.title}</h1>
            <p>{copy.detail}</p>
          </div>
          <Link className="btn-primary" href="/specialist/profile">
            Xem hồ sơ
          </Link>
        </div>
        <section className="specialist-dashboard-state">
          <span aria-hidden="true">◇</span>
          <div>
            <h2>Dữ liệu vận hành đang được bảo vệ</h2>
            <p>
              Lịch hẹn, yêu cầu và lịch khả dụng sẽ xuất hiện khi hồ sơ đủ điều
              kiện hoạt động.
            </p>
          </div>
        </section>
      </div>
    )
  }

  const nextAppointment = dashboard.nextAppointment.item
  const rating = dashboard.ratingAggregate
  const displayName = dashboard.profile.displayName
  const containerVariants = {
    hidden: { opacity: reduceMotion ? 1 : 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: reduceMotion ? 0 : 0.08 },
    },
  }
  const itemVariants = {
    hidden: { opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: reduceMotion ? 0 : 0.22 },
    },
  }

  return (
    <motion.div
      className="specialist-command"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div
        className="role-heading specialist-command-head"
        variants={itemVariants}
      >
        <div>
          <span className="eyebrow">Không gian chuyên gia</span>
          <h1>{displayName ? `Chào bạn, ${displayName}` : 'Chào bạn'}</h1>
          <p>
            Mọi thông tin quan trọng cho ngày làm việc của bạn được tổng hợp tại
            đây.
          </p>
        </div>
        <div className="specialist-command-actions">
          <Link
            className="specialist-rating-compact"
            href="/specialist/profile"
            aria-label={
              rating.state === 'AVAILABLE' && rating.averageRating !== null
                ? `${rating.averageRating.toFixed(1)} trên 5 từ ${rating.ratingCount} đánh giá`
                : 'Chưa có đánh giá từ người dùng'
            }
          >
            <span aria-hidden="true">
              {rating.state === 'AVAILABLE' ? '★' : '☆'}
            </span>
            <span>
              <strong>
                {rating.state === 'AVAILABLE' && rating.averageRating !== null
                  ? rating.averageRating.toFixed(1)
                  : 'Chưa có điểm'}
              </strong>
              <small>
                {rating.ratingCount > 0
                  ? `${rating.ratingCount} đánh giá`
                  : 'Đánh giá của bạn'}
              </small>
            </span>
          </Link>
          <Link className="btn-primary" href="/specialist/availability">
            + Tạo lịch trống
          </Link>
        </div>
      </motion.div>

      <motion.div className="specialist-command-grid" variants={itemVariants}>
        {nextAppointment ? (
          <Link
            className="specialist-pulse specialist-pulse-link"
            href="/specialist/appointments"
            aria-label={`Mở phiên tiếp theo, ${localDate(nextAppointment)}, ${timeRange(nextAppointment)}`}
          >
            <div className="specialist-card-kicker">
              <span>Phiên tiếp theo</span>
              <b>{statusLabel(nextAppointment.status)}</b>
            </div>
            <div className="specialist-session-copy">
              <small>{localDate(nextAppointment)}</small>
              <h2>{timeRange(nextAppointment)}</h2>
              <p>
                {modalityLabel(nextAppointment.modality)} ·{' '}
                {durationMinutes(nextAppointment)} phút
              </p>
            </div>
            <div className="specialist-session-route" aria-hidden="true">
              <span>Chuẩn bị cho phiên tư vấn</span>
              <strong>Quản lý lịch hẹn →</strong>
            </div>
          </Link>
        ) : (
          <div className="specialist-pulse specialist-pulse-empty">
            <span className="specialist-empty-symbol" aria-hidden="true">
              ◇
            </span>
            <h2>Không có lịch hẹn tiếp theo</h2>
            <p>
              Khi một yêu cầu được xác nhận, phiên gần nhất sẽ xuất hiện tại
              đây.
            </p>
            <Link href="/specialist/appointments">Xem lịch hẹn</Link>
          </div>
        )}

        <div className="specialist-command-stack">
          <Link
            className="specialist-mini-card is-amber"
            href="/specialist/appointments"
          >
            <span className="specialist-mini-icon" aria-hidden="true">
              ↗
            </span>
            <div>
              <small>CẦN BẠN XỬ LÝ</small>
              <strong>
                {dashboard.pendingAppointmentRequests.count} yêu cầu đặt lịch
              </strong>
              <p>Xem các yêu cầu còn chờ phản hồi</p>
            </div>
            <b aria-hidden="true">→</b>
          </Link>

          <Link
            className="specialist-mini-card is-teal"
            href="/specialist/availability"
          >
            <span className="specialist-mini-icon" aria-hidden="true">
              ✓
            </span>
            <div>
              <small>LỊCH KHẢ DỤNG</small>
              <strong>{dashboard.availability.count} khung giờ trống</strong>
              <p>Quản lý các khung giờ có thể đặt</p>
            </div>
            <b aria-hidden="true">→</b>
          </Link>

          <div className="specialist-calm-note">
            <span aria-hidden="true">✦</span>
            <p>
              <strong>Một ngày cân bằng</strong>
              Bạn có {dashboard.todayConfirmedSessions.count} phiên đã xác nhận
              hôm nay.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div className="specialist-activity-head" variants={itemVariants}>
        <div>
          <span className="eyebrow">Tổng quan nhanh</span>
          <h2>Lịch cần theo dõi</h2>
        </div>
        <Link className="btn-ghost" href="/specialist/appointments">
          Xem tất cả →
        </Link>
      </motion.div>

      <motion.section
        className="specialist-activity-panel"
        variants={itemVariants}
        aria-label="Lịch cần theo dõi"
      >
        <AnimatePresence initial={false}>
          {activity.map((appointment, index) => (
            <motion.div
              key={appointment.appointmentId}
              className="specialist-activity-row"
              initial={reduceMotion ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={{ delay: reduceMotion ? 0 : index * 0.06 }}
            >
              <span
                className={`specialist-activity-icon tone-${index % 3}`}
                aria-hidden="true"
              >
                ◷
              </span>
              <span className="specialist-activity-copy">
                <strong>{timeRange(appointment)}</strong>
                <small>
                  {localDate(appointment)} ·{' '}
                  {modalityLabel(appointment.modality)}
                </small>
              </span>
              <span
                className={`role-status ${appointment.status === 'REQUESTED' ? 'attention' : 'ok'}`}
              >
                {statusLabel(appointment.status)}
              </span>
              <Link
                className="role-arrow"
                href="/specialist/appointments"
                aria-label={`Mở lịch hẹn ${localDate(appointment)}, ${timeRange(appointment)}`}
              >
                →
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>
        {activity.length === 0 ? (
          <div className="role-empty specialist-activity-empty">
            <span aria-hidden="true">◇</span>
            <h3>Chưa có lịch cần theo dõi</h3>
            <p>Yêu cầu mới và lịch hôm nay sẽ xuất hiện tại đây.</p>
          </div>
        ) : null}
      </motion.section>

      <footer className="specialist-dashboard-source">
        <span>Cập nhật lúc {sourceTime(dashboard.generatedAt)}</span>
        <button type="button" onClick={load}>
          Làm mới
        </button>
      </footer>
    </motion.div>
  )
}
