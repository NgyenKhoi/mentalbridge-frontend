'use client'

import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  Clock3,
  FileText,
  MessageSquare,
  RefreshCw,
  Star,
  Video,
} from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { specialistDashboardBrowserClient } from '@/features/specialist-dashboard/api/browser-client'
import { ApiError } from '@/lib/api/api-error'
import { useReactiveReducedMotion } from '@/lib/animations/use-reduced-motion'
import type { SpecialistDashboard } from '@/lib/consultation/consultation-validation'
import { Skeleton } from './ui/Skeleton'
import SpecialistOverviewArtwork from '@/features/specialist-dashboard/components/SpecialistOverviewArtwork'
import styles from './SpecialistDashboardManager.module.css'

type DashboardAppointment =
  SpecialistDashboard['todayConfirmedSessions']['items'][number]
type DataState = SpecialistDashboard['nextAppointment']['state']

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
    if (error.status === 401 || error.code === 'UNAUTHENTICATED')
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    if (error.status === 403 || error.code === 'CONSULTATION_ROLE_REQUIRED')
      return 'Tài khoản hiện tại không có quyền xem tổng quan chuyên gia.'
  }
  return 'Chưa thể cập nhật thông tin hôm nay. Vui lòng thử lại.'
}
function denied(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.status === 401 ||
      error.status === 403 ||
      error.code === 'UNAUTHENTICATED' ||
      error.code === 'CONSULTATION_ROLE_REQUIRED')
  )
}
function timeRange(item: DashboardAppointment) {
  const time = new Intl.DateTimeFormat('vi-VN', {
    timeZone: item.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return (
    time.format(new Date(item.scheduledStartAt)) +
    '–' +
    time.format(new Date(item.scheduledEndAt))
  )
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
function sourceTime(value: string, timezone?: string | null) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: timezone ?? 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value))
}
function calendarDate(value: string) {
  // A projection's local date is a calendar day, not an instant in browser time.
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value + 'T12:00:00Z'))
}
function modalityLabel(modality: DashboardAppointment['modality']) {
  return modality === 'IN_APP_VIDEO'
    ? 'Video trong ứng dụng'
    : 'Chat trong ứng dụng'
}
function statusLabel(status: DashboardAppointment['status']) {
  return {
    REQUESTED: 'Chờ phản hồi',
    CONFIRMED: 'Đã xác nhận',
    IN_PROGRESS: 'Đang diễn ra',
  }[status]
}
function missing(state: DataState) {
  return state === 'BLOCKED' || state === 'UNAVAILABLE'
}
function missingCopy(state: DataState) {
  return state === 'BLOCKED' ? 'Chưa thể xem mục này' : 'Chưa tải được dữ liệu'
}
function appointmentHref(section: string, appointment: DashboardAppointment) {
  return (
    '/specialist/' +
    section +
    '?appointmentId=' +
    encodeURIComponent(appointment.appointmentId)
  )
}
function SessionIcon({ item }: { item: DashboardAppointment }) {
  return item.modality === 'IN_APP_VIDEO' ? (
    <Video size={20} aria-hidden="true" />
  ) : (
    <MessageSquare size={20} aria-hidden="true" />
  )
}

export default function SpecialistDashboardManager() {
  const reduceMotion = useReactiveReducedMotion()
  const [dashboard, setDashboard] = useState<SpecialistDashboard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const sequence = useRef(0)
  const busy = useRef(false)

  const load = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    const request = ++sequence.current
    setIsLoading(true)
    setError('')
    try {
      const response = await specialistDashboardBrowserClient.get()
      if (sequence.current === request) setDashboard(response)
    } catch (caught) {
      if (sequence.current !== request) return
      if (denied(caught)) setDashboard(null)
      setError(friendlyError(caught))
    } finally {
      if (sequence.current === request) {
        busy.current = false
        setIsLoading(false)
      }
    }
  }, [])
  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void load()
    })
    return () => {
      active = false
      sequence.current += 1
      busy.current = false
    }
  }, [load])

  const header = (
    <header className={styles.heading}>
      <div>
        <span className={styles.eyebrow}>Không gian chuyên gia</span>
        <h1>
          {dashboard?.profile.displayName
            ? 'Chào bạn, ' + dashboard.profile.displayName
            : 'Tổng quan hôm nay'}
        </h1>
        <p>Lịch tư vấn, yêu cầu mới và những việc cần bạn theo dõi.</p>
      </div>
      <div className={styles.refresh}>
        {dashboard && (
          <small>
            Cập nhật lúc{' '}
            {sourceTime(dashboard.generatedAt, dashboard.profile.timezone)}
          </small>
        )}
        <button
          className={styles.secondary}
          type="button"
          onClick={() => void load()}
          disabled={isLoading}
          aria-label={isLoading ? 'Đang làm mới' : 'Làm mới'}
        >
          <RefreshCw
            size={17}
            aria-hidden="true"
            className={isLoading ? styles.spinning : undefined}
          />
          {isLoading ? 'Đang tải…' : 'Làm mới'}
        </button>
      </div>
    </header>
  )
  const notice = error && (
    <div className={styles.errorBanner} role="alert">
      <div>
        <strong>Chưa thể cập nhật tổng quan</strong>
        <p>
          {error}
          {dashboard
            ? ' Thông tin bên dưới là lần tải thành công gần nhất.'
            : ''}
        </p>
      </div>
      <button
        className={styles.secondary}
        type="button"
        onClick={() => void load()}
        disabled={isLoading}
      >
        Thử lại
      </button>
    </div>
  )
  if (!dashboard)
    return (
      <div className={styles.workspace} data-specialist-journey="overview">
        {header}
        {isLoading ? (
          <div
            role="status"
            aria-label="Đang tải thông tin hôm nay"
            className={styles.loading}
          >
            <Skeleton height={145} />
            <Skeleton height={300} />
          </div>
        ) : (
          <section className={styles.state} role="alert">
            <CalendarDays size={32} aria-hidden="true" />
            <h2>Chưa thể tải dashboard</h2>
            <p>{error}</p>
            <button
              className={styles.primary}
              type="button"
              onClick={() => void load()}
            >
              Thử lại
            </button>
          </section>
        )}
      </div>
    )
  if (dashboard.operationalStatus !== 'READY') {
    const copy = OPERATIONAL_COPY[dashboard.operationalStatus]
    return (
      <div className={styles.workspace} data-specialist-journey="overview">
        {header}
        {notice}
        <section className={styles.state}>
          <Clock3 size={32} aria-hidden="true" />
          <span className={styles.eyebrow}>Trạng thái hồ sơ</span>
          <h2>{copy.title}</h2>
          <p>{copy.detail}</p>
          <Link className={styles.primary} href="/specialist/profile">
            Xem hồ sơ <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </section>
      </div>
    )
  }

  const next = dashboard.nextAppointment.item
  const rating = dashboard.ratingAggregate
  const metrics = [
    {
      label: 'Khung giờ đang mở',
      value: missing(dashboard.availability.state)
        ? '—'
        : dashboard.availability.count.toString(),
      detail: missing(dashboard.availability.state)
        ? missingCopy(dashboard.availability.state)
        : 'Quản lý lịch khả dụng',
      href: '/specialist/availability',
      icon: <CalendarPlus size={20} aria-hidden="true" />,
    },
    {
      kind: 'rating',
      label: 'Đánh giá trung bình',
      value:
        rating.state === 'AVAILABLE' && rating.averageRating !== null
          ? rating.averageRating.toFixed(1)
          : '—',
      detail: missing(rating.state)
        ? missingCopy(rating.state)
        : rating.averageRating !== null && rating.state === 'AVAILABLE'
          ? rating.ratingCount + ' đánh giá · trên 5 điểm'
          : 'Chưa có đánh giá',
      href: '/specialist/profile',
      icon: <Star size={20} aria-hidden="true" />,
    },
    {
      label: 'Phiên hẹn trong ngày',
      value: missing(dashboard.todayConfirmedSessions.state)
        ? '—'
        : dashboard.todayConfirmedSessions.count.toString(),
      detail: missing(dashboard.todayConfirmedSessions.state)
        ? missingCopy(dashboard.todayConfirmedSessions.state)
        : 'Các phiên đã xác nhận',
      href: '/specialist/appointments',
      icon: <CalendarDays size={20} aria-hidden="true" />,
    },
  ]
  return (
    <div
      className={styles.workspace}
      data-specialist-journey="overview"
      aria-busy={isLoading}
    >
      {header}
      {notice}
      <div className={styles.focusGrid}>
        <section
          className={styles.card + ' ' + styles.nextCard}
          aria-labelledby="overview-next-title"
        >
          <header className={styles.cardHeader}>
            <h2 id="overview-next-title">
              <span className={styles.dot} />
              Phiên hẹn tiếp theo
            </h2>
            {next && !missing(dashboard.nextAppointment.state) && (
              <span className={styles.badge}>{statusLabel(next.status)}</span>
            )}
          </header>
          <div className={styles.heroBody}>
            {missing(dashboard.nextAppointment.state) ? (
              <div className={styles.empty}>
                <p>{missingCopy(dashboard.nextAppointment.state)}</p>
              </div>
            ) : next ? (
              <div className={styles.nextSession}>
                <div className={styles.sessionLine}>
                  <i className={styles.sessionIcon}>
                    <SessionIcon item={next} />
                  </i>
                  <div>
                    <Link
                      className={styles.sessionTime}
                      href={appointmentHref('appointments', next)}
                      aria-label={
                        'Mở phiên tiếp theo, ' +
                        localDate(next) +
                        ', ' +
                        timeRange(next)
                      }
                    >
                      {timeRange(next)}
                    </Link>
                    <p>{localDate(next)}</p>
                  </div>
                </div>
                <p>
                  {modalityLabel(next.modality)} ·{' '}
                  {Math.round(
                    (Date.parse(next.scheduledEndAt) -
                      Date.parse(next.scheduledStartAt)) /
                      60000,
                  )}{' '}
                  phút
                </p>
                <small>Múi giờ: {next.timezone}</small>
              </div>
            ) : (
              <div className={styles.empty}>
                <CalendarDays size={30} aria-hidden="true" />
                <h3>Chưa có phiên hẹn tiếp theo</h3>
                <p>
                  Khi một yêu cầu được xác nhận, phiên gần nhất sẽ xuất hiện tại
                  đây.
                </p>
                <Link
                  className={styles.secondary}
                  href="/specialist/availability"
                >
                  Mở lịch khả dụng
                </Link>
              </div>
            )}
            <SpecialistOverviewArtwork />
          </div>
          {next && !missing(dashboard.nextAppointment.state) && (
            <div className={styles.actions}>
              <Link
                className={styles.secondary}
                href={appointmentHref('clients', next)}
              >
                <FileText size={17} aria-hidden="true" />
                Chuẩn bị cho phiên
              </Link>
              {next.modality === 'IN_APP_CHAT' && (
                <Link
                  className={styles.primary}
                  href={appointmentHref('messages', next)}
                >
                  <MessageSquare size={17} aria-hidden="true" />
                  Mở tin nhắn
                </Link>
              )}
            </div>
          )}
        </section>
        <section
          className={styles.card + ' ' + styles.requestsCard}
          aria-labelledby="overview-requests-title"
        >
          <header className={styles.cardHeader}>
            <div>
              <h2 id="overview-requests-title">Yêu cầu cần phản hồi</h2>
              <p>Xem thời gian và hình thức trước khi phản hồi.</p>
            </div>
            {!missing(dashboard.pendingAppointmentRequests.state) && (
              <span className={styles.badge}>
                {dashboard.pendingAppointmentRequests.count}
              </span>
            )}
          </header>
          {missing(dashboard.pendingAppointmentRequests.state) ? (
            <div className={styles.empty}>
              <p>{missingCopy(dashboard.pendingAppointmentRequests.state)}</p>
            </div>
          ) : dashboard.pendingAppointmentRequests.items.length ? (
            <div
              className={styles.requests}
              role={
                dashboard.pendingAppointmentRequests.items.length > 1
                  ? 'region'
                  : undefined
              }
              aria-label={
                dashboard.pendingAppointmentRequests.items.length > 1
                  ? 'Các yêu cầu đang chờ phản hồi'
                  : undefined
              }
              tabIndex={
                dashboard.pendingAppointmentRequests.items.length > 1
                  ? 0
                  : undefined
              }
            >
              {dashboard.pendingAppointmentRequests.items.map((item) => (
                <article key={item.appointmentId} className={styles.request}>
                  <div>
                    <strong>{timeRange(item)}</strong>
                    <p>
                      {localDate(item)} · {modalityLabel(item.modality)}
                    </p>
                    <small className={styles.deadline}>
                      <Clock3 size={14} aria-hidden="true" />
                      Phản hồi trước{' '}
                      {sourceTime(
                        item.decisionDeadlineAt,
                        item.timezone,
                      )} · {item.timezone}
                    </small>
                  </div>
                  <Link
                    className={styles.secondary}
                    href={appointmentHref('appointments', item)}
                  >
                    Xem yêu cầu
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <p>Hiện không có yêu cầu đang chờ phản hồi.</p>
            </div>
          )}
        </section>
      </div>
      <section className={styles.metrics} aria-label="Tổng quan nhanh">
        {metrics.map((metric) => (
          <Link
            key={metric.label}
            className={styles.metric}
            href={metric.href}
            aria-label={
              metric.kind === 'rating'
                ? rating.state === 'AVAILABLE' && rating.averageRating !== null
                  ? rating.averageRating.toFixed(1) +
                    ' trên 5 từ ' +
                    rating.ratingCount +
                    ' đánh giá'
                  : missing(rating.state)
                    ? missingCopy(rating.state)
                    : 'Chưa có đánh giá từ người dùng'
                : undefined
            }
          >
            <div>
              <span>{metric.label}</span>
              <i>{metric.icon}</i>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.strong
                key={metric.value}
                initial={reduceMotion ? false : { opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}
                transition={{ duration: reduceMotion ? 0 : 0.15 }}
              >
                {metric.value}
              </motion.strong>
            </AnimatePresence>
            <footer>
              <span>{metric.detail}</span>
              <ArrowRight size={16} aria-hidden="true" />
            </footer>
          </Link>
        ))}
      </section>
      <div className={styles.lowerGrid}>
        <section className={styles.card} aria-labelledby="overview-today-title">
          <header className={styles.cardHeader}>
            <div>
              <h2 id="overview-today-title">Lịch hẹn trong ngày</h2>
              {dashboard.todayConfirmedSessions.localDate && (
                <p>
                  {calendarDate(dashboard.todayConfirmedSessions.localDate)} ·{' '}
                  {dashboard.todayConfirmedSessions.timezone}
                </p>
              )}
            </div>
            <Link
              className={styles.textLink}
              href="/specialist/appointments"
              aria-label="Xem toàn bộ lịch hẹn"
            >
              Toàn bộ lịch <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </header>
          {missing(dashboard.todayConfirmedSessions.state) ? (
            <div className={styles.empty}>
              <p>{missingCopy(dashboard.todayConfirmedSessions.state)}</p>
            </div>
          ) : dashboard.todayConfirmedSessions.items.length ? (
            <div className={styles.today}>
              {dashboard.todayConfirmedSessions.items.map((item, index) => (
                <Link
                  key={item.appointmentId}
                  className={styles.todayRow}
                  href={appointmentHref('appointments', item)}
                >
                  <span className={styles.order}>{index + 1}</span>
                  <SessionIcon item={item} />
                  <div>
                    <strong>{timeRange(item)}</strong>
                    <small>{modalityLabel(item.modality)}</small>
                  </div>
                  <span className={styles.badge}>
                    {statusLabel(item.status)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <CalendarDays size={28} aria-hidden="true" />
              <h3>Hôm nay chưa có lịch hẹn</h3>
              <p>Bạn có thể mở khung giờ để người dùng đặt lịch.</p>
              <Link
                className={styles.secondary}
                href="/specialist/availability"
              >
                Mở lịch khả dụng
              </Link>
            </div>
          )}
        </section>
        <section className={styles.followUp}>
          <span className={styles.followUpIcon}>
            <FileText size={24} aria-hidden="true" />
          </span>
          <div>
            <h2>Sau phiên tư vấn</h2>
            <p>
              Xem lại nội dung đã thống nhất và các bước tiếp theo cùng khách
              hàng.
            </p>
            <Link className={styles.textLink} href="/specialist/follow-up">
              Mở mục Sau tư vấn <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
