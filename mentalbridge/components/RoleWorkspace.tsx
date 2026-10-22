'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import SessionActions from '@/features/auth/components/SessionActions'
import WorkspaceSwitcher from '@/features/auth/components/WorkspaceSwitcher'
import type { Workspace } from '@/features/auth/model/workspace'
import { browserConsultation } from '@/features/specialist-profile/api/browser-client'
import SpecialistProfileWorkspace from '@/features/specialist-profile/components/SpecialistProfileWorkspace'
import SpecialistAvailabilityManager from '@/features/specialist-availability/components/SpecialistAvailabilityManager'
import SpecialistAppointmentDecisionPanel from '@/features/appointments/components/SpecialistAppointmentDecisionPanel'
import { VideoConsultationWorkspace } from '@/features/appointments/components/VideoConsultationWorkspace'
import AppointmentMessagesWorkspace from '@/features/appointments/components/AppointmentMessagesWorkspace'
import SpecialistContinuityManager from '@/features/appointments/components/SpecialistContinuityManager'
import SpecialistDashboardManager from './SpecialistDashboardManager'
import SpecialistClientsManager from './SpecialistClientsManager'
import SpecialistEarningsManager from './SpecialistEarningsManager'
import SpecialistOperationalAnalytics from '@/features/specialist-analytics/components/SpecialistOperationalAnalytics'
import SpecialistNotificationCenter from '@/features/notifications/components/SpecialistNotificationCenter'
import { Bell, Headphones, User, Search } from 'lucide-react'
import './SpecialistClinicalDashboard.css'
import './role-workspace.css'

const specialistSections = {
  dashboard: 'Tổng quan',
  analytics: 'Phân tích vận hành',
  appointments: 'Lịch hẹn',
  availability: 'Lịch khả dụng',
  clients: 'Khách hàng',
  messages: 'Tin nhắn',
  'follow-up': 'Theo dõi sau phiên',
  profile: 'Hồ sơ',
  earnings: 'Thu nhập & thanh toán',
  notifications: 'Thông báo',
} as const
const specialistNavigation = [
  ['dashboard', 'Tổng quan'],
  ['analytics', 'Phân tích vận hành'],
  ['appointments', 'Lịch hẹn'],
  ['availability', 'Lịch khả dụng'],
  ['clients', 'Khách hàng'],
  ['messages', 'Tin nhắn'],
  ['follow-up', 'Theo dõi sau phiên'],
  ['earnings', 'Thu nhập & thanh toán'],
  ['profile', 'Hồ sơ'],
] as const

const navIcons: Record<string, string> = {
  dashboard: '⌂',
  analytics: '⌁',
  appointments: '◷',
  availability: '▦',
  clients: '♙',
  messages: '◇',
  'follow-up': '✓',
  earnings: '◈',
  notifications: '♢',
  profile: '○',
}

export default function RoleWorkspace({
  sectionKey,
  workspaces,
  selectedAppointmentId,
  videoAppointmentId,
}: {
  sectionKey: string
  workspaces: readonly Workspace[]
  selectedAppointmentId?: string
  videoAppointmentId?: string
}) {
  const sectionLabel =
    specialistSections[sectionKey as keyof typeof specialistSections] ??
    specialistSections.dashboard
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const wasMobileOpen = useRef(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Mobile slide-in menu keeps keyboard users inside it and returns focus on close.
  useEffect(() => {
    if (!mobileOpen) {
      if (wasMobileOpen.current) menuButtonRef.current?.focus()
      wasMobileOpen.current = false
      return
    }
    wasMobileOpen.current = true
    sidebarRef.current?.querySelector<HTMLElement>('nav a')?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      // Window listener runs after SessionActions closes its own menu on the same Escape.
      if (event.key === 'Escape' && !event.defaultPrevented)
        setMobileOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [mobileOpen])
  const [accountName, setAccountName] = useState<string | null>(null)
  const hasPersonalWorkspace = workspaces.some(
    (workspace) => workspace.role === 'USER',
  )

  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 980) setMobileOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSidebarCollapsed(
        localStorage.getItem('mentalbridge_sidebar_collapsed') === 'true',
      )
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    let active = true
    const loadAccountName = async () => {
      let name = ''
      try {
        name = (await browserConsultation.own()).data.displayName.trim()
      } catch {
        name = ''
      }
      if (active) setAccountName(name || null)
    }

    void loadAccountName()
    window.addEventListener('mb:profile-updated', loadAccountName)
    window.addEventListener('mb:specialist-profile-updated', loadAccountName)
    return () => {
      active = false
      window.removeEventListener('mb:profile-updated', loadAccountName)
      window.removeEventListener(
        'mb:specialist-profile-updated',
        loadAccountName,
      )
    }
  }, [sectionKey])

  const accountAvatar = accountName
    ? accountName
        .split(/\s+/)
        .slice(-2)
        .map((part) => Array.from(part)[0]?.toLocaleUpperCase('vi') ?? '')
        .join('')
    : '?'

  const toggleSidebar = () => {
    setSidebarCollapsed((value) => {
      const nextValue = !value
      localStorage.setItem('mentalbridge_sidebar_collapsed', String(nextValue))
      return nextValue
    })
  }

  return (
    <div
      className={`role-shell role-specialist ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
    >
      <motion.aside
        ref={sidebarRef}
        className={`role-sidebar ${mobileOpen ? 'open' : ''}`}
        layout
        initial={false}
        transition={{ layout: { type: 'spring', stiffness: 330, damping: 34 } }}
      >
        <Link href="/" className="role-brand">
          <motion.span
            className="role-brand-mark"
            whileHover={{ rotate: -6, scale: 1.06 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
          >
            M
          </motion.span>
          <span className="role-brand-copy">
            <strong>MentalBridge</strong>
            <small>
              Specialist Workspace
            </small>
          </span>
        </Link>
        <button
          className="role-collapse"
          onClick={toggleSidebar}
          aria-label={
            sidebarCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'
          }
          title={sidebarCollapsed ? 'Mở rộng' : 'Thu gọn'}
        >
          <motion.span animate={{ rotate: sidebarCollapsed ? 180 : 0 }}>
            ‹
          </motion.span>
        </button>
        <nav aria-label="Điều hướng specialist">
          {specialistNavigation.map(([key, label]) => (
            <div key={key} className="role-nav-item">
              <Link
                href={`/specialist/${key}`}
                className={key === sectionKey ? 'active' : ''}
                onClick={() => setMobileOpen(false)}
                title={sidebarCollapsed ? label : undefined}
              >
                {key === sectionKey && (
                  <motion.span
                    layoutId="role-active-specialist"
                    className="role-active-pill"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="role-nav-icon" aria-hidden="true">
                  {navIcons[key] || '·'}
                </span>
                <span className="role-nav-label">{label}</span>
              </Link>
            </div>
          ))}
        </nav>
        <WorkspaceSwitcher
          workspaces={workspaces}
          currentRole="SPECIALIST"
        />
        <div className="role-sidebar-foot">
          <SessionActions
            compact={sidebarCollapsed}
            displayName={accountName ?? 'Tài khoản của bạn'}
            avatar={accountAvatar}
            accountKind="specialist"
            description="Tài khoản chuyên gia"
            accountLabel={
              hasPersonalWorkspace
                ? 'Tài khoản cá nhân'
                : 'Tài khoản chuyên gia'
            }
            profileHref={
              hasPersonalWorkspace ? '/profile' : '/specialist/profile'
            }
            profileLabel={
              hasPersonalWorkspace ? 'Hồ sơ cá nhân' : 'Hồ sơ chuyên gia'
            }
            showSubscription={hasPersonalWorkspace}
          />
        </div>
      </motion.aside>
      <motion.main
        className="role-main"
        inert={mobileOpen}
        layout="position"
        transition={{ layout: { type: 'spring', stiffness: 330, damping: 34 } }}
      >
        <header className="role-topbar role-topbar-specialist">
            <div className="clinical-topbar-left">
              <button
                ref={menuButtonRef}
                className="role-menu"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Mở menu"
              >
                ☰
              </button>
              <div
                className="clinical-breadcrumb"
                aria-label="Đường dẫn điều hướng"
              >
                <span className="clinical-breadcrumb-parent">
                  Không gian chuyên gia
                </span>
                <span className="clinical-breadcrumb-sep" aria-hidden="true">
                  ›
                </span>
                <span className="clinical-breadcrumb-current">
                  {sectionKey === 'dashboard'
                    ? 'Không gian làm việc lâm sàng'
                    : sectionLabel}
                </span>
              </div>
              <div className="clinical-topbar-status-pill">
                <span
                  className="clinical-topbar-status-dot"
                  aria-hidden="true"
                />
                <span>Không gian chuyên gia</span>
              </div>
            </div>
            <div className="clinical-topbar-right">
              <div className="clinical-search-wrapper">
                <Search
                  size={15}
                  strokeWidth={1.75}
                  className="clinical-search-icon"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="clinical-search-input"
                  placeholder="Tìm kiếm hồ sơ, phiên hẹn..."
                  aria-label="Tìm kiếm hồ sơ, phiên hẹn"
                  disabled
                  title="Tìm kiếm chưa khả dụng"
                />
                <kbd className="clinical-search-kbd">⌘K</kbd>
              </div>

              <Link
                href="/specialist/notifications"
                className="clinical-topbar-btn"
                aria-label="Thông báo"
                title="Thông báo"
              >
                <Bell size={17} strokeWidth={1.75} />
              </Link>
              <button
                className="clinical-topbar-btn"
                aria-label="Cài đặt & Trợ giúp"
                disabled
                title="Trợ giúp trực tiếp chưa khả dụng"
              >
                <Headphones size={17} strokeWidth={1.75} />
              </button>
              <Link
                href="/specialist/profile"
                className="clinical-topbar-avatar"
                aria-label="Hồ sơ chuyên gia"
                title="Hồ sơ"
              >
                <User size={18} strokeWidth={1.75} />
              </Link>
            </div>
          </header>
        <div
          className={`role-content${sectionKey === 'messages' ? ' role-content-messages' : ''}`}
        >
          {sectionKey === 'dashboard' && (
            <SpecialistDashboardManager />
          )}
          {sectionKey === 'analytics' && (
            <SpecialistOperationalAnalytics />
          )}
          {sectionKey === 'profile' && (
            <SpecialistProfileWorkspace />
          )}
          {sectionKey === 'availability' && (
            <SpecialistAvailabilityManager />
          )}
          {sectionKey === 'appointments' &&
            (videoAppointmentId ? (
              <VideoConsultationWorkspace
                appointmentId={videoAppointmentId}
                role="SPECIALIST"
              />
            ) : (
              <SpecialistAppointmentDecisionPanel
                initialAppointmentId={selectedAppointmentId}
              />
            ))}
          {sectionKey === 'clients' && (
            <SpecialistClientsManager
              initialAppointmentId={selectedAppointmentId}
            />
          )}
          {sectionKey === 'messages' && (
            <AppointmentMessagesWorkspace
              viewerRole="SPECIALIST"
              initialAppointmentId={selectedAppointmentId}
            />
          )}
          {sectionKey === 'follow-up' && (
            <SpecialistContinuityManager
              initialAppointmentId={selectedAppointmentId}
            />
          )}
          {sectionKey === 'earnings' && (
            <SpecialistEarningsManager />
          )}
          {sectionKey === 'notifications' && (
            <SpecialistNotificationCenter />
          )}
        </div>
      </motion.main>
      {mobileOpen && (
        <button
          className="role-overlay"
          aria-label="Đóng menu"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </div>
  )
}
