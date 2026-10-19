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
    description:
      'Bảng điều khiển các chỉ số vận hành có thẩm quyền từ các dịch vụ nền tảng.',
  },
  retention: {
    label: 'Bảo lưu & xóa dữ liệu',
    description:
      'Quản trị chính sách bảo lưu và theo dõi thực thi xóa dữ liệu với bằng chứng kiểm toán.',
  },
  accounts: {
    label: 'Tài khoản',
    description:
      'Tra cứu, tạm ngưng và khôi phục tài khoản với quyền quản trị được bảo vệ.',
  },
  specialists: {
    label: 'Chuyên gia',
    description:
      'Khu vực xét duyệt chuyên gia. Không hiển thị hồ sơ giả hoặc dữ liệu cá nhân.',
  },
  content: {
    label: 'Tài nguyên tự chăm sóc',
    description: 'Quản lý tài nguyên qua Content service được bảo vệ.',
  },
  moderation: {
    label: 'Kiểm duyệt Community',
    description:
      'Hàng đợi kiểm duyệt nội dung cộng đồng có nhật ký quyết định.',
  },
  appointments: {
    label: 'Lịch hẹn',
    description: 'Giám sát vận hành lịch hẹn từ nguồn Consultation.',
  },
  disputes: {
    label: 'Xem xét phiên tư vấn',
    description:
      'Xử lý yêu cầu xem xét bằng các kết quả vận hành đã được phê duyệt.',
  },
  audit: {
    label: 'Nhật ký kiểm toán',
    description:
      'Tra cứu và xuất dấu vết hoạt động quản trị đã được tối thiểu hóa.',
  },
  reports: {
    label: 'Báo cáo',
    description: 'Tạo, lên lịch và tải báo cáo tổng hợp hoạt động tài khoản.',
  },
  payments: {
    label: 'Thanh toán gói',
    description: 'Tra cứu giao dịch gói dịch vụ đã được ghi nhận.',
  },
  payouts: {
    label: 'Chi trả chuyên gia',
    description: 'Tra cứu yêu cầu chi trả và kết quả xử lý.',
  },
} as const

export type AdminSection = keyof typeof SECTIONS

export function isAdminSection(value: string): value is AdminSection {
  return Object.prototype.hasOwnProperty.call(SECTIONS, value)
}

export default function AdminWorkspace({
  section,
  workspaces,
}: Readonly<{
  section: AdminSection
  workspaces: readonly Workspace[]
}>) {
  const active = SECTIONS[section]

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
        {section === 'dashboard' ? (
          <>
            <AdminOperationsDashboard />
            <ProductJourneyMetricsPanel />
          </>
        ) : section === 'retention' ? (
          <AdminRetentionGovernance />
        ) : section === 'content' ? (
          <AdminContentSection />
        ) : section === 'specialists' ? (
          <AdminSpecialistReviewSection />
        ) : section === 'accounts' ? (
          <AdminAccountManager />
        ) : section === 'moderation' ? (
          <AdminCommunityModerationSection />
        ) : section === 'audit' ? (
          <AdminAuditLog />
        ) : section === 'appointments' ? (
          <AdminAppointmentMonitor />
        ) : section === 'disputes' ? (
          <AdminAppointmentDisputes />
        ) : section === 'reports' ? (
          <AdminReportsSection />
        ) : section === 'payments' ? (
          <AdminPaymentsManager />
        ) : section === 'payouts' ? (
          <AdminPayoutsManager />
        ) : (
          <>
            <span className={styles.eyebrow}>
              Không gian quản trị được bảo vệ
            </span>
            <h1>{active.label}</h1>
            <p>{active.description}</p>

            <section className={styles.empty} aria-label="Trạng thái tích hợp">
              <span aria-hidden="true">✓</span>
              <div>
                <h2>Quyền ADMIN đã được xác minh</h2>
                <p>
                  Trang khởi đầu không tải số liệu, tên, email hoặc nội dung
                  nhạy cảm giả. Chức năng quản trị chỉ xuất hiện khi có API và
                  quyền tương ứng.
                </p>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
