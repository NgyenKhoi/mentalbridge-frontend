'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  Calendar,
  Check,
  Clock3,
  FileText,
  HelpCircle,
  Lock,
  MessageSquare,
  Pause,
  Play,
  RotateCw,
  ShieldCheck,
  Sprout,
  Video,
  Wind,
} from 'lucide-react'

import { specialistDashboardBrowserClient } from '@/features/specialist-dashboard/api/browser-client'
import { ApiError } from '@/lib/api/api-error'
import type { SpecialistDashboard } from '@/lib/consultation/consultation-validation'
import './SpecialistClinicalDashboard.css'

type AppointmentItem = SpecialistDashboard['todayConfirmedSessions']['items'][number]

const operationalCopy: Record<
  Exclude<SpecialistDashboard['operationalStatus'], 'READY'>,
  { title: string; detail: string }
> = {
  PROFILE_REQUIRED: {
    title: 'Cần hoàn thiện hồ sơ',
    detail: 'Hoàn thiện hồ sơ chuyên gia để bắt đầu quản lý lịch tư vấn.',
  },
  PENDING_APPROVAL: {
    title: 'Hồ sơ đang được xét duyệt',
    detail: 'Lịch làm việc sẽ mở sau khi hồ sơ được phê duyệt.',
  },
  PROFILE_REJECTED: {
    title: 'Hồ sơ cần được cập nhật',
    detail: 'Xem phản hồi và gửi lại hồ sơ để xét duyệt.',
  },
  SUSPENDED: {
    title: 'Quyền vận hành đang tạm ngưng',
    detail: 'Xem trạng thái hồ sơ và liên hệ quản trị viên nếu cần hỗ trợ.',
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

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value))
}

function timeRange(item: AppointmentItem) {
  return `${formatTime(item.scheduledStartAt, item.timezone)} — ${formatTime(item.scheduledEndAt, item.timezone)}`
}

function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: timezone,
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

function appointmentHref(appointmentId: string) {
  return `/specialist/appointments?appointmentId=${encodeURIComponent(appointmentId)}`
}

function secondsUntil(value: string, now: number) {
  return Math.max(0, Math.floor((Date.parse(value) - now) / 1000))
}

function countdown(value: number) {
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const seconds = value % 60
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

export default function SpecialistDashboardManager() {
  const [dashboard, setDashboard] = useState<SpecialistDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(0)
  const [breathing, setBreathing] = useState(false)
  const [breathStep, setBreathStep] = useState(0)

  const load = useCallback(async () => {
    setRefreshing(true)
    setError('')
    try {
      setDashboard(await specialistDashboardBrowserClient.get())
    } catch (cause) {
      setError(friendlyError(cause))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!breathing) return
    const timer = window.setInterval(() => setBreathStep((step) => step + 1), 1000)
    return () => window.clearInterval(timer)
  }, [breathing])

  if (loading) {
    return <div className="clinical-dashboard-wrapper" aria-busy="true">Đang tải không gian làm việc…</div>
  }

  if (!dashboard) {
    return (
      <div className="clinical-dashboard-wrapper">
        <section className="clinical-session-hero-card">
          <HelpCircle size={32} aria-hidden="true" />
          <h1>Chưa thể tải tổng quan</h1>
          <p role="alert">{error}</p>
          <button type="button" className="clinical-btn-primary-pill" onClick={() => void load()}>Thử lại</button>
        </section>
      </div>
    )
  }

  const ready = dashboard.operationalStatus === 'READY'
  const operational = dashboard.operationalStatus === 'READY'
    ? null
    : operationalCopy[dashboard.operationalStatus]
  const next = dashboard.nextAppointment.state === 'AVAILABLE' ? dashboard.nextAppointment.item : null
  const pending = dashboard.pendingAppointmentRequests.state === 'AVAILABLE'
    ? dashboard.pendingAppointmentRequests.items[0]
    : null
  const today = dashboard.todayConfirmedSessions.state === 'AVAILABLE'
    ? dashboard.todayConfirmedSessions.items
    : []
  const slots = dashboard.availability.state === 'AVAILABLE' ? dashboard.availability.count : null
  const rating = dashboard.ratingAggregate
  const ratingAvailable = rating.state === 'AVAILABLE' && rating.averageRating !== null
  const nextSeconds = next && now ? secondsUntil(next.scheduledStartAt, now) : 0
  const displayName = dashboard.profile.state === 'AVAILABLE' && dashboard.profile.displayName
    ? dashboard.profile.displayName
    : 'bạn'
  const breathPhases = ['Hít vào', 'Giữ hơi', 'Thở ra', 'Nghỉ']

  return (
    <div className="clinical-dashboard-wrapper">
      <section className="clinical-hero-banner" aria-label="Chào mừng chuyên gia">
        <div className="clinical-hero-left">
          <div className="clinical-hero-tag">
            <span className="clinical-hero-tag-circle" aria-hidden="true"><Sprout size={13} /></span>
            <span className="clinical-hero-tag-text">KHÔNG GIAN CHUYÊN GIA LÂM SÀNG</span>
          </div>
          <h1 className="clinical-hero-title">Chào {displayName}, chúc bạn<br />một ngày làm việc an yên</h1>
          <p className="clinical-hero-desc">Không gian tập trung hỗ trợ khách hàng, tối giản hóa thủ tục và đồng bộ hóa lịch trình.</p>
        </div>
        <div className="clinical-hero-right">
          <div className="clinical-toggle-container" role="status">
            <div className={`clinical-toggle-switch ${ready && slots ? '' : 'is-off'}`} aria-hidden="true"><div className="clinical-toggle-thumb" /></div>
            <span className="clinical-toggle-text">{ready ? (slots ? 'Sẵn sàng nhận lịch hẹn' : 'Chưa mở khung giờ') : 'Chưa thể nhận lịch hẹn'}</span>
          </div>
          <div className="clinical-hero-controls-row">
            <div className="clinical-rating-pill" aria-label="Đánh giá từ khách hàng">
              <span className="clinical-star-red-orange" aria-hidden="true">★</span>
              <span className="clinical-rating-score">{ratingAvailable ? rating.averageRating!.toFixed(1) : '—'}</span>
              <span>{ratingAvailable ? `(${rating.ratingCount} phản hồi)` : 'Chưa có đánh giá'}</span>
            </div>
            <Link href={ready ? '/specialist/availability' : '/specialist/profile'} className="clinical-btn-primary-pill">
              {ready ? '+ Đặt lịch trống' : 'Xem hồ sơ'}
            </Link>
          </div>
        </div>
      </section>

      {operational ? (
        <section className="clinical-session-hero-card" aria-live="polite">
          <ShieldCheck size={24} aria-hidden="true" />
          <h2>{operational.title}</h2>
          <p>{operational.detail}</p>
          <Link href="/specialist/profile" className="clinical-btn-primary-pill">Mở hồ sơ chuyên gia</Link>
        </section>
      ) : (
        <section className="clinical-session-hero-card" aria-label="Phiên tiếp theo">
          <div className="clinical-session-top-strip">
            <div className="clinical-session-tags-group">
              <span className="clinical-chip-lavender">PHIÊN TIẾP THEO {next ? `• BẮT ĐẦU LÚC ${formatTime(next.scheduledStartAt, next.timezone)}` : ''}</span>
              {next?.modality === 'IN_APP_VIDEO' ? <span className="clinical-chip-mint"><ShieldCheck size={14} /> Phòng video trong ứng dụng</span> : null}
            </div>
            {next ? <div className="clinical-countdown-box"><Clock3 size={15} /><span>{nextSeconds > 0 ? `Bắt đầu sau: ${countdown(nextSeconds)}` : 'Đã đến giờ phiên tư vấn'}</span></div> : null}
          </div>
          {next ? (
            <>
              <div className="clinical-session-columns-grid">
                <div className="clinical-session-time-col">
                  <span className="clinical-section-kicker">THỜI GIAN PHIÊN TƯ VẤN</span>
                  <h2 className="clinical-session-clock-display">{timeRange(next)}</h2>
                  <div className="clinical-session-subnote">
                    {next.modality === 'IN_APP_VIDEO' ? <Video size={14} /> : <MessageSquare size={14} />}
                    <span>{next.modality === 'IN_APP_VIDEO' ? 'Video trong ứng dụng' : 'Chat trong ứng dụng'} · {formatDate(next.scheduledStartAt, next.timezone)}</span>
                  </div>
                </div>
                <div className="clinical-client-panel-lavender">
                  <div className="clinical-client-avatar-round-fallback">KH</div>
                  <div className="clinical-client-content-wrap">
                    <div className="clinical-client-title-line"><span className="clinical-client-name-bold">Khách hàng</span></div>
                    <div className="clinical-client-care-plan">Chi tiết được hiển thị trong lịch hẹn theo quyền truy cập của phiên.</div>
                    <div className="clinical-client-callout-white"><Activity size={15} /><span>Mã phiên: {next.appointmentId.slice(0, 8)}</span></div>
                  </div>
                </div>
              </div>
              <div className="clinical-session-bottom-actions">
                <Link href={appointmentHref(next.appointmentId)} className="clinical-btn-video-hero">
                  {next.modality === 'IN_APP_VIDEO' ? <Video size={16} /> : <MessageSquare size={16} />}
                  <span>{next.modality === 'IN_APP_VIDEO' ? 'Mở phiên video' : 'Mở phiên chat'}</span>
                </Link>
                <Link href={`/specialist/clients?appointmentId=${encodeURIComponent(next.appointmentId)}`} className="clinical-btn-secondary-pill"><FileText size={15} /><span>Xem hồ sơ khách hàng</span></Link>
                <Link href={appointmentHref(next.appointmentId)} className="clinical-btn-ghost-pill"><Calendar size={15} /><span>Chi tiết lịch hẹn</span></Link>
              </div>
            </>
          ) : <p className="clinical-session-subnote">Chưa có phiên tư vấn sắp tới.</p>}
        </section>
      )}

      <section className="clinical-grid-three-cards" aria-label="Chỉ số vận hành">
        <div className="clinical-card-panel">
          <div>
            <div className="clinical-card-top-head">
              <div className="clinical-card-title-group"><span className="clinical-dot-red-brown" aria-hidden="true" /><h3 className="clinical-card-serif-title">Hàng chờ xử lý ({dashboard.pendingAppointmentRequests.state === 'AVAILABLE' ? dashboard.pendingAppointmentRequests.count : 0})</h3></div>
              <span className="clinical-badge-pink-peach">Yêu cầu mới</span>
            </div>
            <div className="clinical-queue-box-lavender">
              {pending ? <><div className="clinical-queue-row-header"><span className="clinical-queue-client-name">Yêu cầu lịch hẹn</span><span className="clinical-queue-timestamp">{timeRange(pending)}</span></div><p className="clinical-queue-quote-text">Hạn phản hồi: {formatDate(pending.decisionDeadlineAt, pending.timezone)} lúc {formatTime(pending.decisionDeadlineAt, pending.timezone)}</p></> : <p>Không có yêu cầu cần phản hồi.</p>}
            </div>
          </div>
          <div className="clinical-queue-button-row"><Link href={pending ? appointmentHref(pending.appointmentId) : '/specialist/appointments'} className="clinical-btn-pill-action-dark">{pending ? 'Xem và phản hồi' : 'Xem lịch hẹn'}</Link></div>
        </div>

        <div className="clinical-card-panel">
          <div>
            <div className="clinical-card-top-head"><h3 className="clinical-card-serif-title">Lịch trình hiện tại</h3><span className="clinical-card-sub-metric">Dữ liệu từ lịch hẹn</span></div>
            <div className="clinical-schedule-tiles-pair">
              <div className="clinical-tile-lavender-stat"><div className="clinical-stat-serif-number">{dashboard.todayConfirmedSessions.state === 'AVAILABLE' ? dashboard.todayConfirmedSessions.count : '—'}</div><div className="clinical-stat-sub-label">Phiên hôm nay</div></div>
              <div className="clinical-tile-lavender-stat"><div className="clinical-stat-serif-number">{slots ?? '—'}</div><div className="clinical-stat-sub-label">Khung giờ đang mở</div></div>
            </div>
          </div>
          <div className="clinical-card-bottom-footer"><span>Cập nhật từ hệ thống</span><Link href="/specialist/availability" className="clinical-link-green-bold">Xem lịch khả dụng →</Link></div>
        </div>

        <div className="clinical-card-panel is-lavender-surface">
          <div>
            <div className="clinical-card-top-head"><div className="clinical-card-title-group"><Sprout size={16} /><h3 className="clinical-card-serif-title">Năng lượng chuyên gia</h3></div><span className="clinical-badge-mint-pill">Nghỉ ngơi hợp lý</span></div>
            <p className="clinical-energy-narrative">Bạn có <strong>{today.length} phiên hôm nay</strong>. Hãy dành thời gian nghỉ giữa các phiên để duy trì sự tập trung.</p>
            <button type="button" className="clinical-breath-white-box" onClick={() => setBreathing((value) => !value)} aria-label={breathing ? 'Tạm dừng bài tập thở' : 'Bắt đầu bài tập thở'}>
              <span className="clinical-breath-left-group"><span className="clinical-breath-mint-circle"><Wind size={16} /></span><span className="clinical-breath-text-group"><span className="clinical-breath-main-title">Thở hộp 4-4-4-4</span><span className="clinical-breath-sub-status">{breathing ? `${breathPhases[Math.floor(breathStep / 4) % 4]} (${4 - (breathStep % 4)}s)` : 'Bài tập nghỉ ngắn giữa các phiên'}</span></span></span>
              <span className="clinical-play-lavender-btn">{breathing ? <Pause size={12} /> : <Play size={12} />}</span>
            </button>
          </div>
          <div className="clinical-energy-footer-shield"><ShieldCheck size={14} /><span>Dành thời gian chăm sóc sức khỏe tinh thần của bạn</span></div>
        </div>
      </section>

      <section className="clinical-table-card-white" aria-label="Lịch trình sắp tới hôm nay">
        <div className="clinical-table-top-header">
          <div><h2 className="clinical-table-title-serif">Lịch trình sắp tới hôm nay</h2><p className="clinical-table-date-subtitle">{dashboard.todayConfirmedSessions.localDate ? formatDate(`${dashboard.todayConfirmedSessions.localDate}T12:00:00Z`, dashboard.todayConfirmedSessions.timezone ?? 'Asia/Ho_Chi_Minh') : 'Các phiên đã xác nhận trong ngày'}</p></div>
          <div className="clinical-sync-status-group"><div className="clinical-pill-calendar-sync"><span className="clinical-dot-calendar-green" aria-hidden="true" /><span>Cập nhật từ hệ thống</span></div><button type="button" className="clinical-btn-icon-refresh" onClick={() => void load()} disabled={refreshing} aria-label="Làm mới danh sách"><RotateCw size={14} className={refreshing ? 'animate-spin' : ''} /></button></div>
        </div>
        <div className="clinical-table-scroll-container">
          <table className="clinical-appointments-table">
            <thead><tr><th scope="col">KHUNG GIỜ</th><th scope="col">KÊNH TIẾP CẬN</th><th scope="col">KHÁCH HÀNG</th><th scope="col">TRẠNG THÁI</th><th scope="col">THAO TÁC</th></tr></thead>
            <tbody>
              {today.map((item) => (
                <tr key={item.appointmentId}>
                  <td><span className="clinical-table-time-text">{timeRange(item)}</span></td>
                  <td><span className={`clinical-channel-chip ${item.modality === 'IN_APP_VIDEO' ? 'mint' : 'lavender'}`}>{item.modality === 'IN_APP_VIDEO' ? <Video size={13} /> : <MessageSquare size={13} />}<span>{item.modality === 'IN_APP_VIDEO' ? 'Video' : 'Chat'}</span></span></td>
                  <td><div className="clinical-client-cell-wrap"><span className="clinical-client-circle-lavender">KH</span><span className="clinical-client-meta-group"><span className="clinical-client-cell-name">Khách hàng</span><span className="clinical-client-cell-sub">Phiên {item.appointmentId.slice(0, 8)}</span></span></div></td>
                  <td><span className="clinical-status-pill-table"><Check size={12} /><span>{item.status === 'IN_PROGRESS' ? 'Đang diễn ra' : 'Đã xác nhận'}</span></span></td>
                  <td><Link href={appointmentHref(item.appointmentId)} className="clinical-table-action-pill primary">{item.status === 'IN_PROGRESS' ? 'Mở phiên' : 'Chi tiết'}</Link></td>
                </tr>
              ))}
              {today.length === 0 ? <tr><td colSpan={5}>Chưa có phiên đã xác nhận hôm nay.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="clinical-table-bottom-notice"><div className="clinical-notice-left-hipaa"><Lock size={14} /><span>Chỉ mở thông tin của khách hàng theo quyền truy cập của từng phiên.</span></div><span>Cập nhật lúc {formatTime(dashboard.generatedAt, dashboard.profile.timezone ?? 'Asia/Ho_Chi_Minh')}</span></div>
      </section>
    </div>
  )
}
