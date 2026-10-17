'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const Icon = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)

const communityLinks = [
  {
    href: '/community',
    label: 'Bảng tin',
    mobileLabel: 'Bảng tin',
    description: 'Câu chuyện mới từ cộng đồng',
    icon: (
      <Icon>
        <path d="M4 5.5h16v13H4zM8 9h8M8 13h5" />
      </Icon>
    ),
  },
  {
    href: '/community/saved',
    label: 'Bài viết đã lưu',
    mobileLabel: 'Đã lưu',
    description: 'Bộ sưu tập riêng của bạn',
    icon: (
      <Icon>
        <path d="M6.5 4.5h11v15l-5.5-3.4-5.5 3.4z" />
      </Icon>
    ),
  },
  {
    href: '/community/profile',
    label: 'Danh tính cộng đồng',
    mobileLabel: 'Danh tính',
    description: 'Tên và hình đại diện riêng',
    icon: (
      <Icon>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5.5 20c.8-4.1 3-6.2 6.5-6.2s5.7 2.1 6.5 6.2" />
      </Icon>
    ),
  },
]

export default function CommunityShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/community'
      ? pathname === '/community' ||
        (/^\/community\/[^/]+$/.test(pathname) &&
          pathname !== '/community/profile' &&
          pathname !== '/community/saved')
      : pathname.startsWith(href)

  return (
    <div className="community-shell">
      <a className="community-skip-link" href="#community-content">
        Đi đến nội dung chính
      </a>
      <header className="community-shell-header">
        <Link
          className="community-brand"
          href="/community"
          aria-label="Cộng đồng MentalBridge"
        >
          <span className="community-brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>
            <strong>MentalBridge</strong>
            <small>Cộng đồng</small>
          </span>
        </Link>
        <nav className="community-header-tabs" aria-label="Khu vực cộng đồng">
          {communityLinks.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? 'is-active' : undefined}
                aria-current={active ? 'page' : undefined}
              >
                {item.icon}
                <span>
                  {item.mobileLabel === 'Danh tính' ? 'Danh tính' : item.label}
                </span>
              </Link>
            )
          })}
        </nav>
        <nav
          className="community-header-actions"
          aria-label="Lối tắt cộng đồng"
        >
          <Link className="community-help-link" href="/safety-directory">
            Cần hỗ trợ ngay
          </Link>
          <Link
            className="community-dashboard-link"
            href="/dashboard"
            aria-label="Về không gian của bạn"
          >
            <Icon>
              <path d="m10 6-6 6 6 6M4 12h16" />
            </Icon>
            <span>Trang cá nhân</span>
          </Link>
        </nav>
      </header>

      <main id="community-content" className="community-shell-main">
        {children}
      </main>

      <nav
        className="community-mobile-nav"
        aria-label="Điều hướng cộng đồng trên di động"
      >
        {communityLinks.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? 'is-active' : undefined}
              aria-current={active ? 'page' : undefined}
            >
              {item.icon}
              <span>{item.mobileLabel}</span>
            </Link>
          )
        })}
        <Link href="/safety-directory">
          <Icon>
            <path d="M12 3v11M12 19v.1M5 21h14L12 3 5 21Z" />
          </Icon>
          <span>Hỗ trợ</span>
        </Link>
      </nav>
    </div>
  )
}
