'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  CalendarDays,
  CalendarCheck,
  CalendarX,
  CheckCheck,
  CircleCheck,
  CloudOff,
  Gauge,
  Hourglass,
  Inbox,
  Info,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Star,
  Undo2,
  UserRoundMinus,
  UsersRound,
  Wallet,
  X,
  XCircle,
} from 'lucide-react'

import { Dialog } from '@/components/ui/Dialog'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import { Skeleton } from '@/components/ui/Skeleton'
import { ApiError } from '@/lib/api/api-error'
import type { SpecialistOperationalAnalytics as Analytics } from '@/lib/consultation/consultation-validation'
import {
  specialistAnalyticsBrowserClient,
  type AnalyticsPeriodDays,
} from '../api/browser-client'
import styles from './SpecialistOperationalAnalytics.module.css'

const periods: AnalyticsPeriodDays[] = [7, 30, 90]
const nodes = [
  {
    key: 'requestedCount',
    label: 'Yêu cầu mới',
    hint: 'Yêu cầu được gửi',
    icon: Inbox,
    description:
      'Số lần khách hàng gửi yêu cầu đặt lịch trong kỳ. Đây không phải số yêu cầu hiện đang chờ phản hồi.',
  },
  {
    key: 'acceptedCount',
    label: 'Đã chấp nhận',
    hint: 'Lịch được xác nhận',
    icon: CalendarCheck,
    description:
      'Số lần lịch hẹn được chuyên gia xác nhận trong kỳ, kể cả những lịch sau đó đã hoàn thành hoặc thay đổi.',
  },
  {
    key: 'completedCount',
    label: 'Đã hoàn thành',
    hint: 'Phiên đã kết thúc',
    icon: CircleCheck,
    description: 'Số lần lịch hẹn được ghi nhận hoàn thành trong kỳ.',
  },
  {
    key: 'rejectedCount',
    label: 'Từ chối',
    hint: 'Không tiếp nhận yêu cầu',
    icon: XCircle,
    description: 'Số lần chuyên gia từ chối yêu cầu lịch hẹn trong kỳ.',
  },
  {
    key: 'expiredCount',
    label: 'Hết hạn',
    hint: 'Quá hạn phản hồi',
    icon: Hourglass,
    description: 'Số yêu cầu hết hạn phản hồi được ghi nhận trong kỳ.',
  },
  {
    key: 'cancelledCount',
    label: 'Đã hủy',
    hint: 'Lịch hẹn bị hủy',
    icon: CalendarX,
    description:
      'Số lần lịch hẹn bị hủy trong kỳ, không bao gồm các lần hủy để đổi lịch.',
  },
  {
    key: 'rescheduledCount',
    label: 'Đổi lịch',
    hint: 'Thay đổi khung giờ',
    icon: Undo2,
    description:
      'Số lần lịch cũ được hủy để khách hàng đổi sang khung giờ khác trong kỳ.',
  },
  {
    key: 'userNoShowCount',
    label: 'Khách hàng vắng',
    hint: 'Khách hàng không tham dự',
    icon: UserRoundMinus,
    description: 'Số phiên được xác lập kết quả khách hàng vắng mặt trong kỳ.',
  },
  {
    key: 'specialistNoShowCount',
    label: 'Chuyên gia vắng',
    hint: 'Chuyên gia không tham dự',
    icon: UserRoundMinus,
    description: 'Số phiên được xác lập kết quả chuyên gia vắng mặt trong kỳ.',
  },
  {
    key: 'bothNoShowCount',
    label: 'Cả hai vắng',
    hint: 'Cả hai không tham dự',
    icon: UsersRound,
    description:
      'Số phiên được xác lập kết quả cả khách hàng và chuyên gia vắng mặt trong kỳ.',
  },
] as const
type NodeKey = (typeof nodes)[number]['key']
type Inspector =
  NodeKey | 'capacity' | 'privacy' | 'help' | 'earned' | 'paid' | null
type Failure = {
  title: string
  description: string
  access: 'login' | 'denied' | null
}

const blockedCopy = {
  PROFILE_REQUIRED: {
    title: 'Hoàn thiện hồ sơ để bắt đầu',
    description:
      'Bạn cần gửi hồ sơ chuyên gia và được phê duyệt trước khi xem số liệu vận hành.',
    badge: 'Chưa có hồ sơ',
    action: 'Hoàn thiện hồ sơ',
  },
  PENDING_APPROVAL: {
    title: 'Hồ sơ của bạn đang chờ duyệt',
    description:
      'Số liệu sẽ khả dụng khi hồ sơ chuyên gia được phê duyệt. Bạn có thể xem lại tình trạng hồ sơ ngay lúc này.',
    badge: 'Chờ phê duyệt',
    action: 'Xem hồ sơ',
  },
  PROFILE_REJECTED: {
    title: 'Hồ sơ cần được cập nhật',
    description:
      'Hồ sơ chưa được phê duyệt. Hãy xem phản hồi và bổ sung thông tin trước khi tiếp tục.',
    badge: 'Cần cập nhật hồ sơ',
    action: 'Cập nhật hồ sơ',
  },
} as const

function failureFor(error: unknown): Failure {
  if (
    error instanceof ApiError &&
    (error.status === 401 || error.code === 'UNAUTHENTICATED')
  ) {
    return {
      title: 'Phiên đăng nhập đã hết hạn',
      description: 'Đăng nhập lại để tiếp tục xem số liệu của bạn.',
      access: 'login',
    }
  }
  if (
    error instanceof ApiError &&
    (error.status === 403 || error.code === 'CONSULTATION_ROLE_REQUIRED')
  ) {
    return {
      title: 'Bạn chưa có quyền xem phân tích chuyên gia',
      description: 'Vui lòng kiểm tra tài khoản và quyền truy cập của bạn.',
      access: 'denied',
    }
  }
  return {
    title: 'Chưa thể tải số liệu vận hành',
    description:
      'Kết nối dữ liệu đang gián đoạn. Hãy thử tải lại; dữ liệu của bạn không bị thay đổi.',
    access: null,
  }
}

function formatDate(instant: string, timezone: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(instant))
}
function updatedAt(instant: string, timezone: string) {
  const time = new Intl.DateTimeFormat('vi-VN', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(instant))
  return `${time} ${formatDate(instant, timezone)}`
}
function count(value: number | null | undefined) {
  return value == null
    ? '—'
    : value.toLocaleString('vi-VN', { minimumIntegerDigits: 2 })
}
function money(
  value: number | null | undefined,
  currency: string | null | undefined,
) {
  if (value == null || currency == null) return '—'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function CardHeading({
  icon,
  eyebrow,
  title,
  children,
}: {
  icon: ReactNode
  eyebrow?: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className={styles.cardHeading}>
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <div>
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  )
}

function MissingData({
  loading,
  children,
}: {
  loading: boolean
  children: ReactNode
}) {
  return (
    <div className={styles.missing} data-loading={loading}>
      {loading ? (
        <>
          <Skeleton width="65%" height={20} />
          <Skeleton width="85%" height={80} />
          <Skeleton width="50%" height={16} />
        </>
      ) : (
        <>
          <CloudOff size={28} aria-hidden="true" />
          <strong>{children}</strong>
          <span>Số liệu chưa khả dụng, không phải bằng 0.</span>
        </>
      )}
    </div>
  )
}

function CapacityGauge({ rate }: { rate: number | null }) {
  const reducedMotion = useReducedMotion()
  const length = Math.PI * 80
  return (
    <div className={styles.gauge}>
      <svg viewBox="0 0 200 115" aria-hidden="true">
        <path
          className={styles.gaugeTrack}
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          strokeWidth="20"
          strokeLinecap="round"
        />
        <motion.path
          className={styles.gaugeProgress}
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          strokeWidth="20"
          strokeLinecap="round"
          strokeDasharray={length}
          initial={
            reducedMotion ? false : { strokeDashoffset: length, opacity: 0 }
          }
          animate={{
            strokeDashoffset: length * (1 - (rate ?? 0) / 100),
            opacity: rate === null || rate === 0 ? 0 : 1,
          }}
          transition={{
            duration: reducedMotion ? 0 : 0.3,
            ease: [0.16, 1, 0.3, 1],
          }}
        />
      </svg>
      <div className={styles.gaugeValue}>
        <strong>
          {rate === null
            ? '—'
            : `${rate.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`}
        </strong>
        <span>Tỷ lệ sử dụng lịch</span>
      </div>
      <div className={styles.gaugeAxis} aria-hidden="true">
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  )
}

function RatingStars({ average }: { average: number | null }) {
  return (
    <div className={styles.stars} aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index}>
          <Star size={24} />
          <span
            style={{
              width: `${Math.min(1, Math.max(0, (average ?? 0) - index)) * 100}%`,
            }}
          >
            <Star size={24} />
          </span>
        </span>
      ))}
    </div>
  )
}

export default function SpecialistOperationalAnalytics() {
  const [period, setPeriod] = useState<AnalyticsPeriodDays>(30)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{
    days: AnalyticsPeriodDays
    data: Analytics
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [inspector, setInspector] = useState<Inspector>(null)
  const announceRefresh = useRef(false)
  const { showActionToast } = useFeedback()
  const dialogId = useId()

  useEffect(() => {
    let active = true
    void specialistAnalyticsBrowserClient
      .get(period)
      .then((data) => {
        if (!active) return
        setResult({ days: period, data })
        setFailure(null)
        setLoading(false)
        if (announceRefresh.current) {
          announceRefresh.current = false
          showActionToast({ title: 'Đã cập nhật số liệu vận hành.' })
        }
      })
      .catch((error: unknown) => {
        if (!active) return
        const nextFailure = failureFor(error)
        announceRefresh.current = false
        if (nextFailure.access) {
          setResult(null)
          setInspector(null)
        }
        setFailure(nextFailure)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [period, revision, showActionToast])

  const analytics = result?.days === period ? result.data : null
  const blocked =
    analytics && analytics.operationalStatus in blockedCopy
      ? blockedCopy[analytics.operationalStatus as keyof typeof blockedCopy]
      : null
  const suspended = analytics?.operationalStatus === 'SUSPENDED'
  const stale =
    analytics &&
    [
      analytics.availability,
      analytics.appointments,
      analytics.rating,
      analytics.financials,
    ].some((section) => section.state === 'STALE')
  const emptyCapacity = analytics?.availability.state === 'EMPTY'
  const dateRange = analytics
    ? `${formatDate(analytics.period.from, analytics.period.timezone)} – ${formatDate(analytics.period.to, analytics.period.timezone)}`
    : null
  const available = Boolean(analytics && !blocked)
  const sectionLoading = loading && !analytics
  const financialAvailable =
    available && analytics?.financials.state !== 'UNAVAILABLE'
  const selectedNode = nodes.find((node) => node.key === inspector)
  const refresh = () => {
    announceRefresh.current = true
    setLoading(true)
    setFailure(null)
    setRevision((value) => value + 1)
  }
  const selectPeriod = (days: AnalyticsPeriodDays) => {
    if (days === period) return
    announceRefresh.current = false
    setPeriod(days)
    setLoading(true)
    setFailure(null)
    setInspector(null)
  }
  const title =
    selectedNode?.label ??
    (inspector === 'capacity'
      ? 'Hiểu tỷ lệ sử dụng lịch'
      : inspector === 'privacy'
        ? 'Phạm vi dữ liệu trên trang phân tích'
        : inspector === 'help'
          ? 'Khi số liệu chưa tải được'
          : inspector === 'earned'
            ? 'Thu nhập ghi nhận'
            : 'Đã thanh toán')

  return (
    <div className={styles.analytics}>
      <div className={styles.contextBar}>
        <nav aria-label="Đường dẫn">
          <Link href="/specialist/dashboard">Chuyên gia</Link>
          <span aria-hidden="true">/</span>
          <span>Phân tích vận hành</span>
        </nav>
        <button
          type="button"
          className={`btn-ghost ${styles.privacyControl}`}
          onClick={() => setInspector('privacy')}
        >
          <ShieldCheck size={17} aria-hidden="true" />
          <span>Phạm vi dữ liệu</span>
        </button>
      </div>
      <div className={styles.body}>
        <header className={styles.header}>
          <div>
            <span
              className={styles.accountBadge}
              data-warning={Boolean(blocked || suspended || failure)}
            >
              <span aria-hidden="true" />
              {blocked?.badge ??
                (suspended
                  ? 'Hồ sơ tạm ngưng'
                  : available
                    ? 'Hồ sơ đã được duyệt'
                    : failure
                      ? 'Chưa tải được dữ liệu'
                      : 'Đang tải số liệu')}
            </span>
            <h1>Phân tích vận hành chuyên gia</h1>
            <p>
              Lịch tư vấn, các mốc lịch hẹn và thu nhập của bạn trong một góc
              nhìn.
            </p>
          </div>
          <div className={styles.controls}>
            <div
              className={styles.presets}
              role="group"
              aria-label="Khoảng thời gian"
            >
              {periods.map((days) => (
                <button
                  type="button"
                  className={`btn-ghost ${styles.preset}`}
                  aria-pressed={period === days}
                  disabled={Boolean(blocked || failure?.access)}
                  key={days}
                  onClick={() => selectPeriod(days)}
                >
                  {days} ngày
                </button>
              ))}
            </div>
            <div className={styles.dateRange}>
              <CalendarDays size={17} aria-hidden="true" />
              <span>{dateRange ?? `${period} ngày gần nhất`}</span>
            </div>
            <button
              type="button"
              className={`btn-primary ${styles.refresh}`}
              disabled={loading || Boolean(failure?.access)}
              aria-label="Làm mới số liệu"
              title="Làm mới số liệu"
              onClick={refresh}
            >
              <RefreshCw
                size={18}
                className={loading ? styles.spinner : undefined}
                aria-hidden="true"
              />
            </button>
          </div>
        </header>
        <div className={styles.updateStatus} role="status">
          {loading
            ? analytics
              ? 'Đang làm mới, số liệu hiện tại vẫn được giữ để bạn xem.'
              : 'Đang tổng hợp số liệu vận hành…'
            : analytics
              ? `Cập nhật lúc ${updatedAt(analytics.generatedAt, analytics.period.timezone)}`
              : 'Chưa có số liệu để hiển thị.'}
        </div>

        {failure && (
          <section className={styles.notice} data-tone="warning" role="alert">
            <CloudOff size={25} aria-hidden="true" />
            <div>
              <h2>{failure.title}</h2>
              <p>
                {failure.description}{' '}
                {analytics && !failure.access
                  ? 'Bên dưới là số liệu của lần tải thành công gần nhất trong cùng khoảng thời gian.'
                  : ''}
              </p>
            </div>
            {failure.access ? (
              <Link
                className="btn-primary"
                href={
                  failure.access === 'login'
                    ? '/login'
                    : '/specialist/dashboard'
                }
              >
                {failure.access === 'login' ? 'Đăng nhập lại' : 'Về tổng quan'}
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={refresh}
                  disabled={loading}
                >
                  Thử tải lại
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setInspector('help')}
                >
                  Cách khắc phục
                </button>
              </>
            )}
          </section>
        )}
        {blocked && (
          <section className={styles.notice} data-tone="warning">
            <LockKeyhole size={25} aria-hidden="true" />
            <div>
              <h2>{blocked.title}</h2>
              <p>{blocked.description}</p>
            </div>
            <Link className="btn-primary" href="/specialist/profile">
              {blocked.action}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </section>
        )}
        {suspended && (
          <section className={styles.notice} data-tone="warning">
            <Info size={24} aria-hidden="true" />
            <div>
              <h2>Hồ sơ đang tạm ngưng</h2>
              <p>
                Bạn vẫn có thể xem số liệu lịch sử. Các hoạt động mới chỉ khả
                dụng khi hồ sơ được kích hoạt lại.
              </p>
            </div>
            <Link className="btn-outline" href="/specialist/profile">
              Xem hồ sơ
            </Link>
          </section>
        )}
        {stale && !failure && (
          <section className={styles.notice} data-tone="warning">
            <Info size={24} aria-hidden="true" />
            <div>
              <h2>Số liệu có thể đã cũ</h2>
              <p>
                Thời điểm cập nhật của từng phần được ghi trong chi tiết. Chọn
                làm mới để lấy số liệu mới nhất.
              </p>
            </div>
          </section>
        )}
        {emptyCapacity && !blocked && !suspended && (
          <section className={styles.notice} data-tone="welcome">
            <CalendarCheck size={28} aria-hidden="true" />
            <div>
              <h2>Chưa có lịch mở trong khoảng thời gian này</h2>
              <p>
                Bạn có thể chọn một khoảng thời gian khác, hoặc mở thêm lịch khả
                dụng để đón nhận các yêu cầu tư vấn tiếp theo.
              </p>
            </div>
            <Link className="btn-primary" href="/specialist/availability">
              Quản lý lịch khả dụng
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setInspector('capacity')}
            >
              Cách tính tỷ lệ
            </button>
          </section>
        )}

        <div className={styles.bento} aria-busy={loading}>
          <section className={`${styles.card} ${styles.capacity}`}>
            <CardHeading
              icon={<Gauge size={22} />}
              eyebrow="Lịch khả dụng"
              title="Hiệu suất khai thác lịch tư vấn"
            >
              <span className={styles.badge}>
                {blocked
                  ? 'Chưa mở quyền xem'
                  : emptyCapacity
                    ? 'Chưa có lịch mở'
                    : available
                      ? `${analytics?.availability.publishedSlotCount?.toLocaleString('vi-VN')} khung giờ`
                      : 'Chưa có số liệu'}
              </span>
            </CardHeading>
            {available && analytics ? (
              <>
                <p className={styles.cardDescription}>
                  Các khung giờ đã công bố có thời điểm bắt đầu trong kỳ đã
                  chọn.
                </p>
                <button
                  type="button"
                  className={`btn-ghost ${styles.gaugeButton}`}
                  aria-label="Xem cách tính tỷ lệ sử dụng lịch"
                  onClick={() => setInspector('capacity')}
                >
                  <CapacityGauge
                    rate={analytics.availability.utilizationRate}
                  />
                  <span className={styles.gaugeNote}>
                    <Info size={15} aria-hidden="true" />
                    {emptyCapacity
                      ? 'Chưa có lịch mở để tính tỷ lệ'
                      : `${count(analytics.availability.utilizedSlotCount)} / ${count(analytics.availability.publishedSlotCount)} khung giờ từng được xác nhận`}
                    <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </button>
                <div className={styles.breakdown}>
                  <div>
                    <span>
                      <i aria-hidden="true" />
                      Đã được sử dụng
                    </span>
                    <strong>
                      {count(analytics.availability.utilizedSlotCount)}
                      <small>khung giờ</small>
                    </strong>
                  </div>
                  <div>
                    <span>
                      <i aria-hidden="true" />
                      Chưa được sử dụng
                    </span>
                    <strong>
                      {count(analytics.availability.unusedSlotCount)}
                      <small>khung giờ trong kỳ</small>
                    </strong>
                  </div>
                </div>
              </>
            ) : (
              <MissingData loading={sectionLoading}>
                {blocked
                  ? 'Chỉ số đang khóa theo tình trạng hồ sơ'
                  : 'Dữ liệu lịch khả dụng chưa tải được'}
              </MissingData>
            )}
          </section>
          <section className={`${styles.card} ${styles.rating}`}>
            <CardHeading
              icon={<Star size={22} />}
              eyebrow="Phản hồi khách hàng"
              title="Đánh giá & tin cậy"
            >
              <span className={styles.badge}>
                {available ? 'Toàn bộ thời gian' : 'Chưa có số liệu'}
              </span>
            </CardHeading>
            {available && analytics ? (
              <>
                <div
                  className={styles.ratingHighlight}
                  data-empty={analytics.rating.averageRating === null}
                >
                  {analytics.rating.averageRating === null ? (
                    <>
                      <RatingStars average={null} />
                      <strong>Chưa có đánh giá</strong>
                      <p>
                        Điểm trung bình sẽ hiển thị khi có phản hồi từ khách
                        hàng sau phiên tư vấn.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className={styles.ratingNumber}>
                        <strong>
                          {analytics.rating.averageRating.toLocaleString(
                            'vi-VN',
                            {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 2,
                            },
                          )}
                        </strong>
                        <span>/ 5</span>
                      </div>
                      <div>
                        <RatingStars average={analytics.rating.averageRating} />
                        <p>
                          Từ{' '}
                          {analytics.rating.ratingCount?.toLocaleString(
                            'vi-VN',
                          )}{' '}
                          lượt đánh giá
                        </p>
                      </div>
                    </>
                  )}
                </div>
                <p className={styles.ratingScope}>
                  Điểm tổng hợp không thay đổi theo bộ lọc thời gian.
                </p>
                {analytics.rating.state === 'STALE' && (
                  <p className={styles.ratingScope}>
                    Đánh giá cập nhật lúc{' '}
                    {updatedAt(
                      analytics.rating.asOf,
                      analytics.period.timezone,
                    )}
                  </p>
                )}
                <div className={styles.breakdown}>
                  <div>
                    <span>
                      <CircleCheck size={16} aria-hidden="true" />
                      Phiên hoàn thành
                    </span>
                    <strong>
                      {count(analytics.appointments.completedCount)}
                      <small>trong kỳ</small>
                    </strong>
                  </div>
                  <div>
                    <span>
                      <UserRoundMinus size={16} aria-hidden="true" />
                      Khách hàng vắng
                    </span>
                    <strong>
                      {count(analytics.appointments.userNoShowCount)}
                      <small>trong kỳ</small>
                    </strong>
                  </div>
                </div>
              </>
            ) : (
              <MissingData loading={sectionLoading}>
                {blocked
                  ? 'Đánh giá đang khóa theo tình trạng hồ sơ'
                  : 'Dữ liệu đánh giá chưa tải được'}
              </MissingData>
            )}
          </section>

          <section className={`${styles.card} ${styles.lifecycle}`}>
            <CardHeading
              icon={<CheckCheck size={22} />}
              title="Vòng đời lịch hẹn"
            >
              <span className={styles.badge}>10 mốc hoạt động</span>
            </CardHeading>
            <p className={styles.cardDescription}>
              {available
                ? 'Chọn một mốc để xem số lần phát sinh và cách ghi nhận.'
                : 'Các mốc hoạt động sẽ hiển thị khi số liệu khả dụng.'}
            </p>
            {analytics?.appointments.state === 'EMPTY' && (
              <p className={styles.emptyLifecycle}>
                Chưa có hoạt động lịch hẹn trong kỳ. Bạn có thể thử khoảng thời
                gian dài hơn.
              </p>
            )}
            <div className={styles.keypads}>
              {nodes.map(({ key, label, hint, icon: Icon }) => {
                const value = available ? analytics?.appointments[key] : null
                return (
                  <button
                    type="button"
                    className={`btn-ghost ${styles.keypad}`}
                    data-active={Boolean(value && value > 0)}
                    key={key}
                    disabled={!available}
                    aria-label={`${label}: ${count(value)} lượt. Xem chi tiết`}
                    onClick={() => setInspector(key)}
                  >
                    <span className={styles.keypadTop}>
                      <span className={styles.keypadIcon}>
                        <Icon size={19} aria-hidden="true" />
                      </span>
                      <span className={styles.led} aria-hidden="true" />
                    </span>
                    {sectionLoading ? (
                      <Skeleton width={38} height={28} />
                    ) : (
                      <strong>{count(value)}</strong>
                    )}
                    <span className={styles.keypadLabel}>{label}</span>
                    <small>{hint}</small>
                    <ArrowRight
                      className={styles.keypadArrow}
                      size={15}
                      aria-hidden="true"
                    />
                  </button>
                )
              })}
            </div>
            <p className={styles.lifecycleFootnote}>
              <Info size={15} aria-hidden="true" />
              Số lượt phát sinh, không phải trạng thái hiện tại. Một lịch hẹn có
              thể được ghi nhận ở nhiều mốc.
            </p>
          </section>

          <section className={`${styles.card} ${styles.financial}`}>
            <div>
              <CardHeading
                icon={<Wallet size={23} />}
                title="Thu nhập & thanh toán"
              />
              <p className={styles.cardDescription}>
                Khoản ghi nhận và khoản đã thanh toán trong kỳ đã chọn.
              </p>
              <Link className={styles.textLink} href="/specialist/earnings">
                Xem thu nhập chi tiết
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <div className={styles.financialMetrics}>
              {(['earned', 'paid'] as const).map((kind) => (
                <button
                  type="button"
                  className={`btn-ghost ${styles.moneyCard}`}
                  key={kind}
                  disabled={!financialAvailable}
                  onClick={() => setInspector(kind)}
                >
                  <span>
                    {kind === 'earned' ? 'Thu nhập ghi nhận' : 'Đã thanh toán'}
                    <ArrowRight size={16} aria-hidden="true" />
                  </span>
                  {sectionLoading ? (
                    <Skeleton width="75%" height={28} />
                  ) : (
                    <strong>
                      {financialAvailable
                        ? money(
                            kind === 'earned'
                              ? analytics?.financials.earnedAmountMinor
                              : analytics?.financials.paidAmountMinor,
                            analytics?.financials.currency,
                          )
                        : '—'}
                    </strong>
                  )}
                </button>
              ))}
            </div>
            {!sectionLoading && !financialAvailable && (
              <p className={styles.financialMessage}>
                {blocked
                  ? 'Số liệu tài chính sẽ khả dụng sau khi hồ sơ được duyệt.'
                  : 'Dữ liệu tài chính chưa thể kết nối. Không thể xác định số tiền lúc này.'}
              </p>
            )}
            {analytics?.financials.state === 'EMPTY' && (
              <p className={styles.financialMessage}>
                Chưa phát sinh khoản thu nhập hoặc thanh toán trong kỳ.
              </p>
            )}
          </section>
        </div>
        <div className={styles.privacyBanner}>
          <ShieldCheck size={23} aria-hidden="true" />
          <div>
            <strong>Chỉ phân tích hoạt động tư vấn</strong>
            <p>
              Không sử dụng dữ liệu sức khỏe tinh thần, nhật ký hay nội dung trò
              chuyện để đánh giá hiệu suất.
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setInspector('privacy')}
          >
            Xem phạm vi
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      <Dialog
        open={inspector !== null}
        onOpenChange={(open) => {
          if (!open) setInspector(null)
        }}
        labelledBy={`${dialogId}-title`}
        describedBy={`${dialogId}-description`}
        className={styles.dialog}
      >
        <div className={styles.dialogContent}>
          <div className={styles.dialogHeading}>
            <span className={styles.icon} aria-hidden="true">
              {inspector === 'privacy' ? (
                <ShieldCheck size={23} />
              ) : selectedNode ? (
                <selectedNode.icon size={23} />
              ) : (
                <Info size={23} />
              )}
            </span>
            <h2 id={`${dialogId}-title`}>{title}</h2>
            <button
              type="button"
              className={`btn-ghost ${styles.close}`}
              aria-label="Đóng chi tiết"
              onClick={() => setInspector(null)}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div
            id={`${dialogId}-description`}
            className={styles.dialogDescription}
          >
            {selectedNode && analytics && (
              <>
                <p>{selectedNode.description}</p>
                <div className={styles.detailFact}>
                  <span>Số lượt trong kỳ</span>
                  <strong>
                    {count(analytics.appointments[selectedNode.key])}
                  </strong>
                  <span>{dateRange}</span>
                </div>
                {analytics.appointments[selectedNode.key] === 0 && (
                  <p>
                    Không có sự kiện ở mốc này trong khoảng thời gian đã chọn.
                  </p>
                )}
                <p>
                  Một lịch hẹn có thể trải qua nhiều mốc. Các số này không cộng
                  thành tổng số lịch hẹn hiện tại.
                </p>
                <p className={styles.asOf}>
                  Cập nhật lúc{' '}
                  {updatedAt(
                    analytics.appointments.asOf,
                    analytics.period.timezone,
                  )}
                </p>
              </>
            )}
            {inspector === 'capacity' && (
              <>
                <p>
                  Tỷ lệ sử dụng = số khung giờ từng có lịch được xác nhận ÷ số
                  khung giờ đã công bố × 100%.
                </p>
                {analytics && !blocked && (
                  <div className={styles.detailFact}>
                    <strong>
                      {analytics.availability.utilizationRate === null
                        ? 'Chưa có lịch mở để tính tỷ lệ'
                        : `${analytics.availability.utilizationRate.toLocaleString('vi-VN')}%`}
                    </strong>
                    <span>
                      {count(analytics.availability.utilizedSlotCount)} đã sử
                      dụng / {count(analytics.availability.publishedSlotCount)}{' '}
                      đã công bố
                    </span>
                    <span>{dateRange}</span>
                  </div>
                )}
                <p>
                  Chỉ tính các khung giờ có thời điểm bắt đầu trong kỳ. Lịch đã
                  từng được xác nhận vẫn tính là sử dụng, kể cả khi sau đó bị
                  hủy hoặc đổi lịch.
                </p>
                <p>
                  “Chưa được sử dụng” là số liệu lịch sử trong kỳ, không phải số
                  khung giờ trống còn có thể đặt ngay.
                </p>
                {analytics && !blocked && (
                  <p className={styles.asOf}>
                    Cập nhật lúc{' '}
                    {updatedAt(
                      analytics.availability.asOf,
                      analytics.period.timezone,
                    )}
                  </p>
                )}
              </>
            )}
            {(inspector === 'earned' || inspector === 'paid') && analytics && (
              <>
                <p>
                  {inspector === 'earned'
                    ? 'Tổng các khoản thu nhập được ghi nhận trong kỳ, không bao gồm khoản đã được đảo ngược.'
                    : 'Tổng các khoản thanh toán đã thành công, có thời điểm hoàn tất trong kỳ.'}
                </p>
                <div className={styles.detailFact}>
                  <strong>
                    {money(
                      inspector === 'earned'
                        ? analytics.financials.earnedAmountMinor
                        : analytics.financials.paidAmountMinor,
                      analytics.financials.currency,
                    )}
                  </strong>
                  <span>{dateRange}</span>
                </div>
                <p>
                  Hai khoản được tính theo thời điểm phát sinh riêng. Không lấy
                  chênh lệch này làm số dư hoặc số tiền đang chờ thanh toán.
                </p>
                <p className={styles.asOf}>
                  Cập nhật lúc{' '}
                  {updatedAt(
                    analytics.financials.asOf,
                    analytics.period.timezone,
                  )}
                </p>
              </>
            )}
            {inspector === 'privacy' && (
              <>
                <p>
                  Trang này tổng hợp lịch khả dụng, các sự kiện lịch hẹn, kết
                  quả tham dự, điểm đánh giá và các khoản thu nhập của chính
                  bạn.
                </p>
                <div className={styles.detailFact}>
                  <strong>Không bao gồm nội dung riêng tư</strong>
                  <span>
                    Không đọc điểm sàng lọc, nhật ký, ghi chú riêng hoặc nội
                    dung trò chuyện để tính các chỉ số vận hành.
                  </span>
                </div>
                <p>
                  Điểm đánh giá là trung bình của toàn bộ phản hồi đã ghi nhận;
                  các số liệu lịch và tài chính dùng khoảng thời gian bạn chọn.
                </p>
              </>
            )}
            {inspector === 'help' && (
              <>
                <p>
                  Kiểm tra kết nối mạng, sau đó đóng cửa sổ này và chọn “Thử tải
                  lại”. Bạn cũng có thể chọn khoảng thời gian khác.
                </p>
                <p>
                  Nếu phiên đăng nhập đã hết hạn, hãy đăng nhập lại. Không cần
                  tạo hồ sơ mới hoặc nhập lại dữ liệu để khắc phục lỗi tải số
                  liệu.
                </p>
                <p>
                  Dữ liệu thiếu được hiển thị bằng dấu “—”, không thay bằng số
                  0.
                </p>
              </>
            )}
          </div>
          <div className={styles.dialogActions}>
            {selectedNode && (
              <Link className="btn-outline" href="/specialist/appointments">
                Xem lịch hẹn
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
            {(inspector === 'earned' || inspector === 'paid') && (
              <Link className="btn-outline" href="/specialist/earnings">
                Xem thu nhập chi tiết
              </Link>
            )}
            <button
              type="button"
              className="btn-primary"
              onClick={() => setInspector(null)}
            >
              Đã hiểu
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
