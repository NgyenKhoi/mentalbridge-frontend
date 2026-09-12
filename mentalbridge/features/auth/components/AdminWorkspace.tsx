import Link from 'next/link'

import SessionActions from './SessionActions'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import AdminContentSection from './AdminContentSection'
import styles from './AdminWorkspace.module.css'
import type { Workspace } from '../model/workspace'

const SECTIONS = {
  dashboard: {
    label: 'Tổng quan',
    description:
      'Điểm bắt đầu cho các công cụ vận hành sẽ được tích hợp ở những story sau.',
  },
  accounts: {
    label: 'Tài khoản',
    description:
      'Khu vực quản lý vòng đời tài khoản. Chưa tải dữ liệu cho đến khi API quản trị được phê duyệt.',
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
        {section === 'content' ? (
          <AdminContentSection />
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
