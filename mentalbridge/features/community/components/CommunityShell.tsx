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
    label: 'Bảng tin đồng hành',
    description: 'Câu chuyện mới từ cộng đồng',
    icon: (
      <Icon>
        <path d="M4 5.5h16v13H4zM8 9h8M8 13h5" />
      </Icon>
    ),
  },
  {
    href: '/community/profile',
    label: 'Danh tính cộng đồng',
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
            <small>Cộng đồng đồng hành</small>
          </span>
        </Link>
        <nav aria-label="Lối tắt cộng đồng">
          <Link href="/community/profile">Danh tính của tôi</Link>
          <Link className="community-help-link" href="/safety-directory">
            Cần hỗ trợ ngay
          </Link>
          <Link className="community-dashboard-link" href="/dashboard">
            Không gian của bạn
          </Link>
        </nav>
      </header>

      <aside className="community-shell-sidebar">
        <div className="community-sidebar-intro">
          <span>Đồng hành cùng nhau</span>
          <h2>Một nơi để được lắng nghe</h2>
          <p>
            Chia sẻ trải nghiệm, nâng đỡ nhau và giữ quyền quyết định về danh
            tính của bạn trong từng bài viết.
          </p>
        </div>
        <nav aria-label="Điều hướng cộng đồng">
          {communityLinks.map((item) => {
            const active =
              item.href === '/community'
                ? pathname === '/community' ||
                  (/^\/community\/[^/]+$/.test(pathname) &&
                    pathname !== '/community/profile')
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? 'is-active' : undefined}
                aria-current={active ? 'page' : undefined}
              >
                {item.icon}
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </Link>
            )
          })}
        </nav>
        <div className="community-sidebar-principles">
          <strong>Ở đây, hỗ trợ không phải là phán xét</strong>
          <ul>
            <li>Không xếp hạng bằng dữ liệu sức khỏe riêng tư</li>
            <li>Không chẩn đoán hay thay thế hỗ trợ chuyên môn</li>
            <li>Không có lượt thích, không thích hay bảng thành tích</li>
          </ul>
        </div>
        <Link className="community-sidebar-exit" href="/dashboard">
          <span aria-hidden="true">←</span> Về không gian của bạn
        </Link>
      </aside>

      <main id="community-content" className="community-shell-main">
        {children}
      </main>

      <nav
        className="community-mobile-nav"
        aria-label="Điều hướng cộng đồng trên di động"
      >
        {communityLinks.map((item) => {
          const active =
            item.href === '/community'
              ? pathname !== '/community/profile'
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? 'is-active' : undefined}
              aria-current={active ? 'page' : undefined}
            >
              {item.icon}
              <span>
                {item.href === '/community' ? 'Bảng tin' : 'Danh tính'}
              </span>
            </Link>
          )
        })}
        <Link href="/safety-directory">
          <Icon>
            <path d="M12 3v11M12 19v.1M5 21h14L12 3 5 21Z" />
          </Icon>
          <span>Hỗ trợ ngay</span>
        </Link>
      </nav>
    </div>
  )
}
