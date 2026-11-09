'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  ShieldAlert,
  Users,
  UserCheck,
  BookOpen,
  ShieldCheck,
  Calendar,
  Scale,
  FileText,
  BarChart3,
  CreditCard,
  Coins,
  ArrowLeftRight,
  Search,
  Bell,
  Headphones,
  User,
} from 'lucide-react'

import SessionActions from './SessionActions'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import AdminContentSection from './AdminContentSection'
import AdminSpecialistReviewSection from '@/features/specialist-profile/components/AdminSpecialistReviewSection'
import AdminAccountManager from './AdminAccountManager'
import AdminCommunityModerationSection from '@/features/community/components/AdminCommunityModerationSection'
import AdminAuditLog from '@/features/audit/components/AdminAuditLog'
import AdminOperationsDashboard from '@/features/dashboard/components/AdminOperationsDashboard'
import AdminAppointmentMonitor from '@/features/appointments/components/AdminAppointmentMonitor'
import AdminAppointmentDisputes from '@/features/appointments/components/AdminAppointmentDisputes'
import AdminReportsSection from '@/features/reports/components/AdminReportsSection'
import AdminPaymentsManager from '@/components/AdminPaymentsManager'
import AdminPayoutsManager from '@/components/AdminPayoutsManager'
import AdminCommercialReconciliationManager from '@/features/reconciliation/components/AdminCommercialReconciliationManager'
import AdminRetentionGovernance from '@/features/retention/components/AdminRetentionGovernance'
import { ProductJourneyMetricsPanel } from '@/components/AdminDashboardManager'
import type { Workspace } from '../model/workspace'

import '@/components/SpecialistClinicalDashboard.css'
import '@/components/role-workspace.css'

export const SECTIONS = {
  dashboard: {
    label: 'Tổng quan',
    icon: LayoutDashboard,
  },
  retention: {
    label: 'Bảo lưu & xóa dữ liệu',
    description:
      'Quản trị chính sách bảo lưu và theo dõi thực thi xóa dữ liệu với bằng chứng kiểm toán.',
    icon: ShieldAlert,
  },
  accounts: {
    label: 'Tài khoản',
    icon: Users,
  },
  specialists: {
    label: 'Chuyên gia',
    icon: UserCheck,
  },
  content: {
    label: 'Tài nguyên tự chăm sóc',
    icon: BookOpen,
  },
  moderation: {
    label: 'Kiểm duyệt Community',
    icon: ShieldCheck,
  },
  appointments: {
    label: 'Lịch hẹn',
    icon: Calendar,
  },
  disputes: {
    label: 'Xem xét phiên tư vấn',
    icon: Scale,
  },
  audit: {
    label: 'Nhật ký kiểm toán',
    icon: FileText,
  },
  reports: {
    label: 'Báo cáo',
    icon: BarChart3,
  },
  payments: {
    label: 'Thanh toán gói',
    icon: CreditCard,
  },
  payouts: {
    label: 'Chi trả chuyên gia',
    icon: Coins,
  },
  reconciliation: {
    label: 'Đối soát thương mại',
    description:
      'Đối soát vòng đời thương mại, phát hiện sai lệch và truy vết dòng tiền.',
    icon: ArrowLeftRight,
  },
} as const

import {
  ADMIN_SECTIONS,
  isAdminSection,
  type AdminSection,
} from '../model/admin-sections'
export { ADMIN_SECTIONS, isAdminSection, type AdminSection }

function AdminSectionContent({ section }: Readonly<{ section: AdminSection }>) {
  switch (section) {
    case 'dashboard':
      return (
        <>
          <AdminOperationsDashboard />
          <ProductJourneyMetricsPanel />
        </>
      )
    case 'retention':
      return <AdminRetentionGovernance />
    case 'accounts':
      return <AdminAccountManager />
    case 'specialists':
      return <AdminSpecialistReviewSection />
    case 'content':
      return <AdminContentSection />
    case 'moderation':
      return <AdminCommunityModerationSection />
    case 'appointments':
      return <AdminAppointmentMonitor />
    case 'disputes':
      return <AdminAppointmentDisputes />
    case 'audit':
      return <AdminAuditLog />
    case 'reports':
      return <AdminReportsSection />
    case 'payments':
      return <AdminPaymentsManager />
    case 'payouts':
      return <AdminPayoutsManager />
    case 'reconciliation':
      return <AdminCommercialReconciliationManager />
  }
}

export default function AdminWorkspace({
  section,
  workspaces,
}: Readonly<{
  section: AdminSection
  workspaces: readonly Workspace[]
}>) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const wasMobileOpen = useRef(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSidebarCollapsed(
        localStorage.getItem('mentalbridge_admin_sidebar_collapsed') === 'true',
      )
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const toggleSidebar = () => {
    setSidebarCollapsed((value) => {
      const nextValue = !value
      localStorage.setItem(
        'mentalbridge_admin_sidebar_collapsed',
        String(nextValue),
      )
      return nextValue
    })
  }

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
    if (!mobileOpen) {
      if (wasMobileOpen.current) menuButtonRef.current?.focus()
      wasMobileOpen.current = false
      return
    }
    wasMobileOpen.current = true
    sidebarRef.current?.querySelector<HTMLElement>('nav a')?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented)
        setMobileOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [mobileOpen])

  const currentSectionLabel = SECTIONS[section]?.label ?? 'Tổng quan'

  return (
    <div
      className={`role-shell role-specialist role-admin ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
    >
      <motion.aside
        ref={sidebarRef}
        className={`role-sidebar ${mobileOpen ? 'open' : ''}`}
        layout
        initial={false}
        transition={{ layout: { type: 'spring', stiffness: 330, damping: 34 } }}
      >
        <Link href="/admin/dashboard" className="role-brand">
          <motion.span
            className="role-brand-mark"
            whileHover={{ rotate: -6, scale: 1.06 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
          >
            M
          </motion.span>
          <span className="role-brand-copy">
            <strong>MentalBridge Admin</strong>
            <small>Hệ thống Quản trị</small>
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
        <nav aria-label="Điều hướng quản trị">
          {Object.entries(SECTIONS).map(([key, item]) => {
            const Icon = item.icon
            const isActive = key === section
            return (
              <div key={key} className="role-nav-item">
                <Link
                  href={`/admin/${key}`}
                  className={isActive ? 'active' : ''}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setMobileOpen(false)}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  {isActive && (
                    <motion.span
                      layoutId="role-active-admin"
                      className="role-active-pill"
                      transition={{
                        type: 'spring',
                        stiffness: 380,
                        damping: 32,
                      }}
                    />
                  )}
                  <span className="role-nav-icon" aria-hidden="true">
                    <Icon size={16} strokeWidth={1.8} />
                  </span>
                  <span className="role-nav-label">{item.label}</span>
                </Link>
              </div>
            )
          })}
        </nav>
        <WorkspaceSwitcher workspaces={workspaces} currentRole="ADMIN" />
        <div className="role-sidebar-foot">
          <SessionActions
            compact={sidebarCollapsed}
            displayName="Quản trị viên"
            avatar="AD"
            accountKind="personal"
            description="Hệ thống Quản trị"
            accountLabel="Tài khoản Quản trị"
            profileHref="/admin/accounts"
            profileLabel="Hồ sơ quản trị"
            showSubscription={false}
          />
        </div>
      </motion.aside>

      <motion.main
        className="role-main"
        inert={mobileOpen}
        layout="position"
        transition={{ layout: { type: 'spring', stiffness: 330, damping: 34 } }}
      >
        <header className="role-topbar role-topbar-specialist role-topbar-admin">
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
                Không gian quản trị
              </span>
              <span className="clinical-breadcrumb-sep" aria-hidden="true">
                ›
              </span>
              <span className="clinical-breadcrumb-current">
                {currentSectionLabel}
              </span>
            </div>
            <div className="clinical-topbar-status-pill">
              <span className="clinical-topbar-status-dot" aria-hidden="true" />
              <span>Đặc quyền Quản trị viên</span>
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
                placeholder="Tìm kiếm tài khoản, hồ sơ, dữ liệu..."
                aria-label="Tìm kiếm trong hệ thống quản trị"
              />
              <kbd className="clinical-search-kbd">⌘K</kbd>
            </div>

            <Link
              href="/admin/audit"
              className="clinical-topbar-btn"
              aria-label="Nhật ký kiểm toán"
              title="Nhật ký kiểm toán"
            >
              <Bell size={17} strokeWidth={1.75} />
            </Link>
            <Link
              href="/admin/reports"
              className="clinical-topbar-btn"
              aria-label="Báo cáo hệ thống"
              title="Báo cáo hệ thống"
            >
              <Headphones size={17} strokeWidth={1.75} />
            </Link>
            <Link
              href="/admin/accounts"
              className="clinical-topbar-avatar"
              aria-label="Hồ sơ quản trị"
              title="Tài khoản quản trị"
            >
              <User size={18} strokeWidth={1.75} />
            </Link>
          </div>
        </header>

        <div className="role-content role-content-admin">
          <div className="clinical-dashboard-wrapper">
            <AdminSectionContent section={section} />
          </div>
        </div>
      </motion.main>
    </div>
  )
}
