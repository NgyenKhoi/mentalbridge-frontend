'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { getCareProfile } from '@/features/assessment/api/browser-care'
import SessionActions from '@/features/auth/components/SessionActions'
import WorkspaceSwitcher from '@/features/auth/components/WorkspaceSwitcher'
import type { Workspace } from '@/features/auth/model/workspace'
import ResourceNavBadge from '@/features/resources/components/ResourceNavBadge'

const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)

const groups = [
  {
    title: 'Tổng quan',
    items: [
      [
        '/dashboard',
        'Tổng quan',
        <Svg key="h">
          <path d="M4 11 12 4l8 7M6 9.5V20h12V9.5" />
        </Svg>,
      ],
      [
        '/journal',
        'Nhật ký',
        <Svg key="j">
          <path d="M6 3h9l3 3v15H6V3Z" />
          <path d="M9 9h6M9 13h6M9 17h3" />
        </Svg>,
      ],
      [
        '/assessments',
        'Bài sàng lọc',
        <Svg key="a">
          <path d="m5 13 4 4L19 7" />
        </Svg>,
      ],
      [
        '/support-guides',
        'Gợi ý hỗ trợ',
        <Svg key="g">
          <path d="M6 4h12v16H6zM9 8h6M9 12h6M9 16h4" />
        </Svg>,
      ],
      [
        '/support-plan',
        'Kế hoạch hỗ trợ',
        <Svg key="sp">
          <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />
          <path d="m15.5 16 1.2 1.2 2.3-2.7" />
        </Svg>,
      ],
    ],
  },
  {
    title: 'Chăm sóc',
    items: [
      [
        '/specialists',
        'Chuyên gia',
        <Svg key="s">
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 20c1-3.5 3.3-5.3 5.5-5.3S14 16.5 15 20M17 6.2a2.3 2.3 0 1 1 0 4.6" />
        </Svg>,
      ],
      [
        '/appointments',
        'Lịch hẹn',
        <Svg key="c">
          <rect x="4" y="5" width="16" height="15" rx="2.5" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </Svg>,
      ],
      [
        '/messages',
        'Tin nhắn',
        <Svg key="m">
          <path d="M4 5h16v11H8l-4 4V5Z" />
        </Svg>,
        '3',
      ],
    ],
  },
  {
    title: 'Thông tin',
    items: [
      [
        '/resources',
        'Tài nguyên',
        <Svg key="r">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 8v4l3 2" />
        </Svg>,
      ],
      [
        '/analytics',
        'Phân tích',
        <Svg key="n">
          <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
        </Svg>,
      ],
      [
        '/subscription',
        'Gói dịch vụ',
        <Svg key="p">
          <rect x="3" y="6" width="18" height="12" rx="2.5" />
          <path d="M3 10h18" />
        </Svg>,
      ],
      [
        '/notifications',
        'Thông báo',
        <Svg key="b">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        </Svg>,
      ],
    ],
  },
]

const labels: Record<string, string> = {
  '/dashboard': 'Tổng quan',
  '/journal': 'Nhật ký',
  '/assessments': 'Bài sàng lọc',
  '/support-guides': 'Gợi ý hỗ trợ',
  '/safety-directory': 'Hỗ trợ an toàn theo khu vực',
  '/support-plan': 'Kế hoạch hỗ trợ',
  '/specialists': 'Chuyên gia',
  '/appointments': 'Lịch hẹn',
  '/messages': 'Tin nhắn',
  '/community': 'Cộng đồng',
  '/resources': 'Tài nguyên',
  '/analytics': 'Phân tích',
  '/subscription': 'Gói dịch vụ',
  '/notifications': 'Thông báo',
  '/profile': 'Hồ sơ và quyền riêng tư',
}

export default function AuthenticatedShell({
  children,
  workspaces,
}: {
  children: React.ReactNode
  workspaces: readonly Workspace[]
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [profile, setProfile] = useState<{ displayName: string } | null>(null)

  useEffect(() => {
    let active = true
    const loadProfile = async () => {
      try {
        const data = await getCareProfile()
        if (active && data?.displayName) {
          setProfile(data)
        }
      } catch {
        // Fallback to default name if profile not found
      }
    }

    void loadProfile()

    const handleProfileUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ displayName?: string }>
      if (customEvent.detail?.displayName) {
        setProfile({ displayName: customEvent.detail.displayName })
      } else {
        void loadProfile()
      }
    }

    window.addEventListener('mb:profile-updated', handleProfileUpdate)
    return () => {
      active = false
      window.removeEventListener('mb:profile-updated', handleProfileUpdate)
    }
  }, [])

  const displayName = profile?.displayName || 'Người dùng'
  const initials = useMemo(
    () =>
      (
        profile?.displayName
          ?.trim()
          .split(/\s+/)
          .slice(-2)
          .map((part) => part[0])
          .join('') || 'N'
      ).toUpperCase(),
    [profile?.displayName],
  )

  return (
    <div
      className={`ref-shell ${collapsed ? 'collapsed' : ''} ${mobile ? 'mobile-open' : ''}`}
    >
      <aside className="ref-sidebar">
        <div className="ref-brand">
          <Link href="/" aria-label="MentalBridge">
            <Svg>
              <path d="M12 2C7 2 3 5 3 9.5c0 3 2 5 4 6.2V21l3-1.6c.7.1 1.3.2 2 .2 5 0 9-3 9-7.6S17 2 12 2Z" />
            </Svg>
          </Link>
          <div>
            <b>MentalBridge</b>
            <span>Health Tech</span>
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
          >
            {collapsed ? '›' : '‹'}
          </button>
        </div>
        <nav aria-label="Điều hướng chính">
          {groups.map((g) => (
            <section key={g.title}>
              <h2>{g.title}</h2>
              {g.items.map((item) => (
                <Link
                  key={item[0] as string}
                  href={item[0] as string}
                  onClick={() => setMobile(false)}
                  className={
                    pathname === item[0] ||
                    pathname.startsWith(`${item[0] as string}/`)
                      ? 'active'
                      : ''
                  }
                  title={collapsed ? (item[1] as string) : undefined}
                >
                  <i>{item[2]}</i>
                  <span>{item[1]}</span>
                  {item[3] && <b>{item[3]}</b>}
                  {item[0] === '/resources' && <ResourceNavBadge />}
                </Link>
              ))}
            </section>
          ))}
        </nav>
        <div className="ref-sidebar-foot">
          <WorkspaceSwitcher workspaces={workspaces} currentRole="USER" />
          <SessionActions
            compact={collapsed && !mobile}
            displayName={displayName}
            avatar={initials}
          />
        </div>
      </aside>
      <div className="ref-main">
        <header className="ref-topbar">
          <button
            className="ref-mobile"
            onClick={() => setMobile(true)}
            aria-label="Mở menu"
          >
            <Svg>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </Svg>
          </button>
          <div className="ref-context">
            <span>Không gian của bạn</span>
            <strong>
              {labels[pathname] ??
                Object.entries(labels).find((entry) =>
                  pathname.startsWith(`${entry[0]}/`),
                )?.[1] ??
                'MentalBridge'}
            </strong>
          </div>
          <label>
            <Svg>
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </Svg>
            <input
              type="search"
              placeholder="Tìm kiếm chuyên gia, nhật ký..."
            />
            <kbd>⌘ K</kbd>
          </label>
          <div className="ref-top-actions">
            <Link className="ref-community-entry" href="/community">
              <Svg>
                <path d="M8.2 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM16.6 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                <path d="M2.8 20c.7-4.2 2.8-6.2 5.4-6.2s4.7 2 5.4 6.2M13.4 15.3c.9-.9 2-1.3 3.3-1.3 2.3 0 4 1.8 4.5 5.5" />
              </Svg>
              <span>Cộng đồng</span>
            </Link>
            <Link
              href="/notifications"
              className="ref-notify"
              aria-label="Thông báo"
            >
              <Svg>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              </Svg>
            </Link>
            <Link
              href="/profile"
              className="ref-avatar"
              aria-label={`Hồ sơ ${displayName}`}
            >
              {initials}
            </Link>
          </div>
        </header>
        <main
          className={`ref-content ${pathname === '/dashboard' ? 'ref-content-dashboard' : 'ref-content-page'}`}
        >
          {children}
        </main>
      </div>
      {mobile && (
        <button
          className="ref-overlay"
          onClick={() => setMobile(false)}
          aria-label="Đóng menu"
        />
      )}
    </div>
  )
}
