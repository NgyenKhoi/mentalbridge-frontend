import Link from 'next/link'

import SessionActions from './SessionActions'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import AdminContentSection from './AdminContentSection'
import AdminSpecialistReviewSection from '@/features/specialist-profile/components/AdminSpecialistReviewSection'
import AdminAccountManager from './AdminAccountManager'
import AdminCommunityModerationSection from '@/features/community/components/AdminCommunityModerationSection'
import AdminOperationsDashboard from '@/features/dashboard/components/AdminOperationsDashboard'
import AdminAppointmentMonitor from '@/features/appointments/components/AdminAppointmentMonitor'
import AdminAppointmentDisputes from '@/features/appointments/components/AdminAppointmentDisputes'
import styles from './AdminWorkspace.module.css'
import type { Workspace } from '../model/workspace'

const SECTIONS = {
  dashboard: {
    label: 'Tổng quan',
    description:
      'Bảng điều khiển các chỉ số vận hành có thẩm quyền từ các dịch vụ nền tảng.',
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
      'Khu vực theo dõi hoạt động quản trị sau khi nguồn dữ liệu audit được tích hợp.',
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

      <main className={styles.main}>
        {section === 'dashboard' ? (
          <AdminOperationsDashboard />
        ) : section === 'content' ? (
          <AdminContentSection />
        ) : section === 'specialists' ? (
          <AdminSpecialistReviewSection />
        ) : section === 'accounts' ? (
          <AdminAccountManager />
        ) : section === 'moderation' ? (
          <AdminCommunityModerationSection />
        ) : section === 'appointments' ? (
          <AdminAppointmentMonitor />
        ) : section === 'disputes' ? (
          <AdminAppointmentDisputes />
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
