'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ShieldCheck,
  Video,
  FileText,
  Calendar,
  RotateCw,
  Clock,
  Wind,
  Play,
  Pause,
  Lock,
  Check,
  HelpCircle,
  MessageSquare,
  Sprout,
  Activity,
} from 'lucide-react'

import { specialistDashboardBrowserClient } from '@/features/specialist-dashboard/api/browser-client'
import { ApiError } from '@/lib/api/api-error'
import type { SpecialistDashboard } from '@/lib/consultation/consultation-validation'
import './SpecialistClinicalDashboard.css'

function friendlyError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'UNAUTHENTICATED')
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    if (error.code === 'CONSULTATION_ROLE_REQUIRED')
      return 'Tài khoản hiện tại không có quyền xem dashboard chuyên gia.'
  }
  return 'Chưa thể tải thông tin hôm nay. Vui lòng thử lại.'
}

export default function SpecialistDashboardManager() {
  const [dashboard, setDashboard] = useState<SpecialistDashboard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isOnline, setIsOnline] = useState(true)
  const [countdownSeconds, setCountdownSeconds] = useState(14 * 60 + 16) // 00:14:16
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [breathingActive, setBreathingActive] = useState(false)
  const [breathPhase, setBreathPhase] = useState<'Hít vào' | 'Giữ hơi' | 'Thở ra' | 'Nghỉ'>('Hít vào')
  const [breathTimer, setBreathTimer] = useState(4)

  const load = useCallback(async () => {
    setIsRefreshing(true)
    setError('')
    try {
      const data = await specialistDashboardBrowserClient.get()
      setDashboard(data)
    } catch (caught) {
      setError(friendlyError(caught))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
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

  // Ticking countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Breathing exercise loop
  useEffect(() => {
    if (!breathingActive) return
    const phases: Array<'Hít vào' | 'Giữ hơi' | 'Thở ra' | 'Nghỉ'> = [
      'Hít vào',
      'Giữ hơi',
      'Thở ra',
      'Nghỉ',
    ]
    let phaseIndex = 0
    let count = 4

    const interval = setInterval(() => {
      count -= 1
      if (count <= 0) {
        phaseIndex = (phaseIndex + 1) % phases.length
        setBreathPhase(phases[phaseIndex]!)
        count = 4
      }
      setBreathTimer(count)
    }, 1000)

    return () => clearInterval(interval)
  }, [breathingActive])

  // Format countdown HH:MM:SS
  const countdownFormatted = useMemo(() => {
    const hours = Math.floor(countdownSeconds / 3600)
    const minutes = Math.floor((countdownSeconds % 3600) / 60)
    const seconds = countdownSeconds % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }, [countdownSeconds])

  if (isLoading) {
    return (
      <div className="clinical-dashboard-wrapper" style={{ padding: '60px 0', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: '#1F5C3F', fontWeight: 600 }}>
          <RotateCw className="animate-spin" size={20} />
          <span>Đang kết nối không gian lâm sàng…</span>
        </div>
      </div>
    )
  }

  if (error && !dashboard) {
    return (
      <div className="clinical-dashboard-wrapper" style={{ padding: '40px 0' }}>
        <div className="clinical-session-hero-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <HelpCircle size={40} style={{ color: '#B3402F', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px' }}>Chưa thể tải dữ liệu không gian</h2>
          <p style={{ color: '#5B6470', fontSize: 14, margin: '0 0 20px' }}>{error}</p>
          <button type="button" className="clinical-btn-primary-pill" onClick={load}>
            Thử lại
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="clinical-dashboard-wrapper">
      {/* ====================================================================
          2) HERO BANNER (Gradient ngang #E6EFFA -> #DDF5EA)
          ==================================================================== */}
      <section className="clinical-hero-banner" aria-label="Chào mừng chuyên gia">
        <div className="clinical-hero-left">
          <div className="clinical-hero-tag">
            <span className="clinical-hero-tag-circle" aria-hidden="true">
              <Sprout size={13} strokeWidth={2.5} />
            </span>
            <span className="clinical-hero-tag-text">KHÔNG GIAN CHUYÊN GIA LÂM SÀNG</span>
          </div>

          <h1 className="clinical-hero-title">
            Chào bác sĩ Minh Anh, chúc bạn
            <br />
            một ngày làm việc an yên
          </h1>

          <p className="clinical-hero-desc">
            Không gian tập trung hỗ trợ thân chủ, tối giản hóa thủ tục và đồng bộ hóa lịch trình.
          </p>
        </div>

        <div className="clinical-hero-right">
          {/* Hàng 1: Pill trắng chứa toggle */}
          <div
            className="clinical-toggle-container"
            role="switch"
            aria-checked={isOnline}
            tabIndex={0}
            onClick={() => setIsOnline(!isOnline)}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault()
                setIsOnline(!isOnline)
              }
            }}
          >
            <div className={`clinical-toggle-switch ${isOnline ? '' : 'is-off'}`}>
              <div className="clinical-toggle-thumb" />
            </div>
            <span className="clinical-toggle-text">
              {isOnline ? 'Đang trực tuyến (Mở lịch hẹn)' : 'Tạm nghỉ tiếp nhận'}
            </span>
          </div>

          {/* Hàng 2: Pill rating & Nút xanh đậm đặt lịch */}
          <div className="clinical-hero-controls-row">
            <div className="clinical-rating-pill" title="Đánh giá từ thân chủ">
              <span className="clinical-star-red-orange" aria-hidden="true">★</span>
              <span className="clinical-rating-score">4.9</span>
              <span>(42 phản hồi)</span>
            </div>

            <Link href="/specialist/availability" className="clinical-btn-primary-pill">
              + Đặt lịch trống
            </Link>
          </div>
        </div>
      </section>

      {/* ====================================================================
          3) CARD "PHIÊN TIẾP THEO" (Thanh nhấn xanh đậm mép phải)
          ==================================================================== */}
      <section className="clinical-session-hero-card" aria-label="Phiên tiếp theo">
        {/* Hàng trên: Chip lavender, Chip mint, Đếm ngược */}
        <div className="clinical-session-top-strip">
          <div className="clinical-session-tags-group">
            <span className="clinical-chip-lavender">
              PHIÊN TIẾP THEO • BẮT ĐẦU LÚC 10:00
            </span>
            <span className="clinical-chip-mint">
              <ShieldCheck size={14} strokeWidth={2.2} />
              <span>Phòng Video chuẩn y tế HIPAA đã sẵn sàng</span>
            </span>
          </div>

          <div className="clinical-countdown-box" aria-live="polite">
            <Clock size={15} color="#5B6470" />
            <span>Đếm ngược : {countdownFormatted}</span>
          </div>
        </div>

        {/* Nội dung trung tâm: Cột giờ & Panel thân chủ */}
        <div className="clinical-session-columns-grid">
          {/* Cột trái: Thời gian */}
          <div className="clinical-session-time-col">
            <span className="clinical-section-kicker">THỜI GIAN PHIÊN KHÁM</span>
            <h2 className="clinical-session-clock-display">
              10:00 <span className="clinical-session-dash">—</span> 11:00
            </h2>
            <div className="clinical-session-subnote">
              <Video size={14} />
              <span>Tư vấn tâm lý cá nhân trực tuyến (60 phút)</span>
            </div>
          </div>

          {/* Cột phải: Panel lavender bo 28px */}
          <div className="clinical-client-panel-lavender">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=160&h=160&q=80"
              alt="Hoàng Lan"
              className="clinical-client-avatar-round"
              onError={(e) => {
                const target = e.currentTarget
                target.style.display = 'none'
                if (target.nextElementSibling) {
                  ;(target.nextElementSibling as HTMLElement).style.display = 'grid'
                }
              }}
            />
            <div className="clinical-client-avatar-round-fallback" style={{ display: 'none' }}>
              HL
            </div>

            <div className="clinical-client-content-wrap">
              <div className="clinical-client-title-line">
                <span className="clinical-client-name-bold">Hoàng Lan (28 tuổi)</span>
                <span className="clinical-client-round-badge">Buổi 3/5</span>
              </div>

              <div className="clinical-client-care-plan">
                Kế hoạch hỗ trợ 7 ngày: Giảm áp lực công việc &amp; rối loạn giấc ngủ
              </div>

              <div className="clinical-client-callout-white">
                <Activity size={15} />
                <div>
                  <strong>Mức lo âu GAD-7: 10/21 (Trung bình)</strong> • Cần rà soát bài tập thư
                  giãn cơ tiến triển (PMR) và đánh giá chu kỳ thức-ngủ tuần trước.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hàng nút dưới cùng (cách nội dung ~40px) */}
        <div className="clinical-session-bottom-actions">
          <Link href="/specialist/appointments" className="clinical-btn-video-hero">
            <Video size={16} />
            <span>Tham gia phiên video ngay</span>
          </Link>

          <Link href="/specialist/clients" className="clinical-btn-secondary-pill">
            <FileText size={15} />
            <span>Mở hồ sơ sức khỏe &amp; bài test</span>
          </Link>

          <Link href="/specialist/appointments" className="clinical-btn-ghost-pill">
            <Calendar size={15} />
            <span>Đổi lịch hẹn</span>
          </Link>
        </div>
      </section>

      {/* ====================================================================
          4) HÀNG 3 CARD (Grid 3 cột, cao bằng nhau ~300px, gap ~24px)
          ==================================================================== */}
      <section className="clinical-grid-three-cards" aria-label="Chỉ số vận hành">
        {/* Card a: Hàng chờ xử lý (1) */}
        <div className="clinical-card-panel">
          <div>
            <div className="clinical-card-top-head">
              <div className="clinical-card-title-group">
                <span className="clinical-dot-red-brown" aria-hidden="true" />
                <h3 className="clinical-card-serif-title">Hàng chờ xử lý (1)</h3>
              </div>
              <span className="clinical-badge-pink-peach">Yêu cầu mới</span>
            </div>

            <div className="clinical-queue-box-lavender">
              <div className="clinical-queue-row-header">
                <span className="clinical-queue-client-name">Nguyễn Văn Khang (32 tuổi)</span>
                <span className="clinical-queue-timestamp">15 phút trước</span>
              </div>
              <p className="clinical-queue-quote-text">
                &ldquo;Tôi đang gặp vấn đề kiệt sức (burnout) trong quản lý đội ngũ,...&rdquo;
              </p>
            </div>
          </div>

          <div className="clinical-queue-button-row">
            <Link href="/specialist/appointments" className="clinical-btn-pill-action-dark">
              Xác nhận hẹn
            </Link>
            <Link href="/specialist/messages" className="clinical-btn-pill-action-lavender">
              Trao đổi
            </Link>
          </div>
        </div>

        {/* Card b: Lịch trình tuần này */}
        <div className="clinical-card-panel">
          <div>
            <div className="clinical-card-top-head">
              <h3 className="clinical-card-serif-title">Lịch trình tuần này</h3>
              <span className="clinical-card-sub-metric">Tỷ lệ lấp đầy: 80%</span>
            </div>

            <div className="clinical-schedule-tiles-pair">
              <div className="clinical-tile-lavender-stat">
                <div className="clinical-stat-serif-number">08</div>
                <div className="clinical-stat-sub-label">Phiên đã xác nhận</div>
              </div>
              <div className="clinical-tile-lavender-stat">
                <div className="clinical-stat-serif-number">06</div>
                <div className="clinical-stat-sub-label">Khung giờ rảnh</div>
              </div>
            </div>

            <div className="clinical-bar-track-lavender">
              <div className="clinical-bar-fill-green" style={{ width: '80%' }} />
            </div>
          </div>

          <div className="clinical-card-bottom-footer">
            <span>Cập nhật tự động</span>
            <Link href="/specialist/appointments" className="clinical-link-green-bold">
              Xem biểu đồ tuần →
            </Link>
          </div>
        </div>

        {/* Card c: Năng lượng chuyên gia (nền lavender, không viền) */}
        <div className="clinical-card-panel is-lavender-surface">
          <div>
            <div className="clinical-card-top-head">
              <div className="clinical-card-title-group">
                <Sprout size={16} color="#1F5C3F" />
                <h3 className="clinical-card-serif-title">Năng lượng chuyên gia</h3>
              </div>
              <span className="clinical-badge-mint-pill">Cân bằng tốt</span>
            </div>

            <p className="clinical-energy-narrative">
              Bạn có <strong>3 phiên hôm nay</strong>, mỗi phiên cách nhau tối thiểu 30 phút nghỉ
              ngơi nhằm duy trì năng lượng lắng nghe tối ưu.
            </p>

            <div
              className="clinical-breath-white-box"
              onClick={() => setBreathingActive(!breathingActive)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  setBreathingActive(!breathingActive)
                }
              }}
              title="Nhấn để bắt đầu bài tập thở"
            >
              <div className="clinical-breath-left-group">
                <div className="clinical-breath-mint-circle" aria-hidden="true">
                  <Wind size={16} />
                </div>
                <div className="clinical-breath-text-group">
                  <span className="clinical-breath-main-title">Thở hộp 4-4-4-4</span>
                  <span className="clinical-breath-sub-status">
                    {breathingActive
                      ? `${breathPhase} (${breathTimer}s)`
                      : '3 phút phục hồi tinh thần'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="clinical-play-lavender-btn"
                aria-label={breathingActive ? 'Tạm dừng thở' : 'Bắt đầu thở'}
              >
                {breathingActive ? <Pause size={12} /> : <Play size={12} style={{ marginLeft: 2 }} />}
              </button>
            </div>
          </div>

          <div className="clinical-energy-footer-shield">
            <ShieldCheck size={14} />
            <span>Cam kết bảo vệ sức khỏe tâm lý chuyên viên</span>
          </div>
        </div>
      </section>

      {/* ====================================================================
          5) CARD "LỊCH TRÌNH SẮP TỚI HÔM NAY" (Card trắng lớn)
          ==================================================================== */}
      <section className="clinical-table-card-white" aria-label="Lịch trình sắp tới hôm nay">
        {/* Tiêu đề & Đồng bộ Google Calendar */}
        <div className="clinical-table-top-header">
          <div>
            <h2 className="clinical-table-title-serif">Lịch trình sắp tới hôm nay</h2>
            <p className="clinical-table-date-subtitle">
              Danh sách các phiên tư vấn đã lên lịch trong ngày 24 tháng 10, 2024
            </p>
          </div>

          <div className="clinical-sync-status-group">
            <div className="clinical-pill-calendar-sync">
              <span className="clinical-dot-calendar-green" aria-hidden="true" />
              <span>Google Calendar đã đồng bộ</span>
            </div>

            <button
              type="button"
              className="clinical-btn-icon-refresh"
              onClick={load}
              disabled={isRefreshing}
              aria-label="Đồng bộ lại"
              title="Đồng bộ lại"
            >
              <RotateCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Bảng 5 cột */}
        <div className="clinical-table-scroll-container">
          <table className="clinical-appointments-table">
            <thead>
              <tr>
                <th scope="col" style={{ width: '18%' }}>KHUNG GIỜ</th>
                <th scope="col" style={{ width: '18%' }}>KÊNH TIẾP CẬN</th>
                <th scope="col" style={{ width: '30%' }}>THÂN CHỦ</th>
                <th scope="col" style={{ width: '20%' }}>TRẠNG THÁI HỒ SƠ</th>
                <th scope="col" style={{ width: '14%', textAlign: 'right' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {/* Hàng 1 */}
              <tr>
                <td>
                  <span className="clinical-table-time-text">10:00 — 11:00</span>
                </td>
                <td>
                  <span className="clinical-channel-chip mint">
                    <Video size={13} />
                    <span>Video Call</span>
                  </span>
                </td>
                <td>
                  <div className="clinical-client-cell-wrap">
                    <span className="clinical-client-circle-lavender">HL</span>
                    <div className="clinical-client-meta-group">
                      <span className="clinical-client-cell-name">Hoàng Lan</span>
                      <span className="clinical-client-cell-sub">Buổi 3 • Rối loạn lo âu</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="clinical-status-pill-table">
                    <Check size={12} strokeWidth={2.8} />
                    <span>Đã làm GAD-7</span>
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <Link href="/specialist/appointments" className="clinical-table-action-pill primary">
                    Vào phòng
                  </Link>
                </td>
              </tr>

              {/* Hàng 2 */}
              <tr>
                <td>
                  <span className="clinical-table-time-text">14:00 — 14:45</span>
                </td>
                <td>
                  <span className="clinical-channel-chip lavender">
                    <MessageSquare size={13} />
                    <span>Tư vấn Chat</span>
                  </span>
                </td>
                <td>
                  <div className="clinical-client-cell-wrap">
                    <span className="clinical-client-circle-lavender">TA</span>
                    <div className="clinical-client-meta-group">
                      <span className="clinical-client-cell-name">Trần Tuấn Anh</span>
                      <span className="clinical-client-cell-sub">Đánh giá theo dõi tuần 2</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="clinical-status-pill-table pending">
                    <Clock size={12} />
                    <span>Chờ nhật ký tâm trạng</span>
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <Link href="/specialist/clients" className="clinical-table-action-pill lavender">
                    Chi tiết
                  </Link>
                </td>
              </tr>

              {/* Hàng 3 */}
              <tr>
                <td>
                  <span className="clinical-table-time-text">16:30 — 17:30</span>
                </td>
                <td>
                  <span className="clinical-channel-chip mint">
                    <Video size={13} />
                    <span>Video Call</span>
                  </span>
                </td>
                <td>
                  <div className="clinical-client-cell-wrap">
                    <span className="clinical-client-circle-lavender">MQ</span>
                    <div className="clinical-client-meta-group">
                      <span className="clinical-client-cell-name">Mai Quỳnh Chi</span>
                      <span className="clinical-client-cell-sub">Buổi đầu tiên • Khảo sát sơ bộ</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="clinical-status-pill-table">
                    <Check size={12} strokeWidth={2.8} />
                    <span>Đã nộp form sàng lọc</span>
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <Link href="/specialist/clients" className="clinical-table-action-pill lavender">
                    Xem trước hồ sơ
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Chân card */}
        <div className="clinical-table-bottom-notice">
          <div className="clinical-notice-left-hipaa">
            <Lock size={14} color="#6B7280" />
            <span>
              Dữ liệu lâm sàng được mã hóa đầu-cuối theo tiêu chuẩn bảo mật y tế HIPAA &amp; GDPR.
            </span>
          </div>

          <div>Đồng bộ lần cuối lúc 09:45 hôm nay</div>
        </div>
      </section>
    </div>
  )
}
