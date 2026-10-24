import Link from 'next/link'

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
import AdminRetentionGovernance from '@/features/retention/components/AdminRetentionGovernance'
import { ProductJourneyMetricsPanel } from '@/components/AdminDashboardManager'
import styles from './AdminWorkspace.module.css'
import type { Workspace } from '../model/workspace'

const SECTIONS = {
  dashboard: {
    label: 'Tổng quan',
  },
  retention: {
    label: 'Bảo lưu & xóa dữ liệu',
    description:
      'Quản trị chính sách bảo lưu và theo dõi thực thi xóa dữ liệu với bằng chứng kiểm toán.',
  },
  accounts: {
    label: 'Tài khoản',
  },
  specialists: {
    label: 'Chuyên gia',
  },
  content: {
    label: 'Tài nguyên tự chăm sóc',
  },
  moderation: {
    label: 'Kiểm duyệt Community',
  },
  appointments: {
    label: 'Lịch hẹn',
  },
  disputes: {
    label: 'Xem xét phiên tư vấn',
  },
  audit: {
    label: 'Nhật ký kiểm toán',
  },
  reports: {
    label: 'Báo cáo',
  },
  payments: {
    label: 'Thanh toán gói',
  },
  payouts: {
    label: 'Chi trả chuyên gia',
  },
} as const

export type AdminSection = keyof typeof SECTIONS

export function isAdminSection(value: string): value is AdminSection {
  return Object.prototype.hasOwnProperty.call(SECTIONS, value)
}

function AdminSectionContent({ section }: Readonly<{ section: AdminSection }>) {
  switch (section) {
    case 'dashboard':
      return (
        <>
          <AdminOperationsDashboard />
          <ProductJourneyMetricsPanel />
        </>
      )
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
  }
}

export default function AdminWorkspace({
  section,
  workspaces,
}: Readonly<{
  section: AdminSection
  workspaces: readonly Workspace[]
}>) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/admin/dashboard" className={styles.brand}>
          <span>M</span>
          <strong>MentalBridge Admin</strong>
        </Link>

        <nav aria-label="Điều hướng quản trị">
          {Object.entries(SECTIONS).map(([key, item]) => (
            <Link
              key={key}
              href={`/admin/${key}`}
              aria-current={key === section ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.session}>
          <WorkspaceSwitcher workspaces={workspaces} currentRole="ADMIN" />
          <SessionActions />
        </div>
      </aside>

      <main
        className={`${styles.main} ${section === 'specialists' || section === 'reports' || section === 'payments' || section === 'payouts' || section === 'retention' ? styles.reviewMain : ''}`}
      >
        <AdminSectionContent section={section} />
      </main>
    </div>
  )
}
