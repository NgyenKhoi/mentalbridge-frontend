'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { getCareProfile } from '@/features/assessment/api/browser-care'
import { appointmentBrowserClient } from '@/features/appointments/api/browser-client'
import SessionActions from '@/features/auth/components/SessionActions'
import WorkspaceSwitcher from '@/features/auth/components/WorkspaceSwitcher'
import type { Workspace } from '@/features/auth/model/workspace'

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

const CommunityIcon = () => (
  <Svg>
    <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
    <path d="M8 11h8M8 15h4" />
  </Svg>
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
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
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
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.7 3.5 6h7c2-1.3 3.5-3.5 3.5-6a7 7 0 0 0-7-7z" />
        </Svg>,
      ],
      [
        '/support-plan',
        'Kế hoạch hỗ trợ',
        <Svg key="sp">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <path d="m9 16 2 2 4-4" />
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
      ],
    ],
  },
  {
    title: 'Thông tin',
    items: [
      ['/community', 'Cộng đồng', <CommunityIcon key="community" />],
      [
        '/resources',
        'Tài nguyên',
        <Svg key="r">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 8v4l3 2" />
        </Svg>,
      ],
      [
        '/achievements',
        'Thành tựu',
        <Svg key="achievement">
          <path d="M12 3c1.2 3.2 3.4 5.2 6.5 6.2-3.1 1-5.3 3-6.5 6.2-1.2-3.2-3.4-5.2-6.5-6.2C8.6 8.2 10.8 6.2 12 3Z" />
          <path d="M6 15c.6 1.7 1.7 2.8 3.4 3.4C7.7 19 6.6 20.1 6 21.8c-.6-1.7-1.7-2.8-3.4-3.4C4.3 17.8 5.4 16.7 6 15Z" />
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
  '/specialists': 'Chuyên gia tư vấn',
  '/appointments': 'Lịch hẹn',
  '/messages': 'Tin nhắn',
  '/resources': 'Tài nguyên',
  '/achievements': 'Bộ sưu tập hành trình',
  '/analytics': 'Phân tích',
  '/subscription': 'Gói dịch vụ',
  '/notifications': 'Thông báo',
  '/profile': 'Hồ sơ và quyền riêng tư',
}

function resolveContextLabel(pathname: string) {
  if (pathname.startsWith('/assessments/results/')) {
    return 'Kết quả sàng lọc'
  }

  return labels[pathname] ?? 'MentalBridge'
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
  const [specialistSearch, setSpecialistSearch] = useState('')
  const [generalSearch, setGeneralSearch] = useState('')
  const [appointmentCount, setAppointmentCount] = useState<number | null>(null)

  // MB-744: the page entrance (globals.css) plays only while a route is fresh,
  // so dialogs, async rows and re-renders later never replay it.
  const [enteredPath, setEnteredPath] = useState<string | null>(null)
  const [shownPath, setShownPath] = useState(pathname)
  if (shownPath !== pathname) {
    // A route revisited within the window (A → B → A) enters again.
    setShownPath(pathname)
    setEnteredPath(null)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setEnteredPath(pathname), 1200)
    return () => window.clearTimeout(timer)
  }, [pathname])


  useEffect(() => {
    const resetSearch = () => setSpecialistSearch('')
    const refreshAppointments = () => {
      void appointmentBrowserClient
        .list()
        .then((result) => {
          setAppointmentCount(
            result.items.filter((item) =>
              ['REQUESTED', 'CONFIRMED'].includes(item.status),
            ).length,
          )
        })
        .catch(() => setAppointmentCount(null))
    }
    window.addEventListener('mentalbridge:specialist-search-reset', resetSearch)
    window.addEventListener(
      'mentalbridge:appointment-requested',
      refreshAppointments,
    )
    return () => {
      window.removeEventListener(
        'mentalbridge:specialist-search-reset',
        resetSearch,
      )
      window.removeEventListener(
        'mentalbridge:appointment-requested',
        refreshAppointments,
      )
    }
  }, [])

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
  const isScreeningJourney = [
    '/initial-check',
    '/assessments',
    '/support-guides',
  ].some((route) => pathname === route || pathname.startsWith(`${route}/`))
  const isProgressiveRelaxation =
    pathname === '/resources/00000000-0000-4000-8000-000000000215' ||
    pathname === '/resources/00000000-0000-4000-8000-000000000216'
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
          <div title="MentalBridge Health Tech">
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
        <nav id="user-main-navigation" aria-label="Điều hướng chính">
          {groups.map((g) => (
            <section key={g.title}>
              <h2>{g.title}</h2>
              {g.items.map((item) => (
                <Link
                  key={item[0] as string}
                  href={item[0] as string}
                  onClick={() => setMobile(false)}
                  className={`${pathname === item[0] ? 'active' : ''} ${item[0] === '/community' ? 'ref-community-nav' : ''}`}
                  aria-label={
                    item[0] === '/community' ? 'Cộng đồng' : undefined
                  }
                  title={collapsed ? (item[1] as string) : undefined}
                >
                  <i>{item[2]}</i>
                  <span>{item[1]}</span>
                  {item[3] && <b>{item[3]}</b>}
                  {item[0] === '/appointments' &&
                    appointmentCount !== null &&
                    appointmentCount > 0 && (
                      <b
                        aria-label={`${appointmentCount} lịch hẹn đang hoạt động`}
                      >
                        {appointmentCount}
                      </b>
                    )}
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
        <header
          className={`ref-topbar ${isProgressiveRelaxation ? 'pmr-topbar' : ''}`}
        >
          <button
            className="ref-mobile"
            onClick={() => setMobile(true)}
            aria-label="Mở menu"
            aria-expanded={mobile}
            aria-controls="user-main-navigation"
          >
            <Svg>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </Svg>
          </button>
          {isProgressiveRelaxation ? (
            <nav className="pmr-top-crumb" aria-label="Đường dẫn trên cùng">
              <Link href="/resources">Tài nguyên</Link>
              <span aria-hidden="true">›</span>
              <span aria-current="page">
                {pathname.endsWith('0216')
                  ? 'Thả lỏng cơ theo từng vùng'
                  : 'Thư giãn cơ tiến triển'}
              </span>

            </nav>
          ) : isScreeningJourney ? (
            <nav
              className="ref-screening-crumb"
              aria-label="Đường dẫn trên cùng"
            >
              <Link href="/dashboard">Không gian của bạn</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{resolveContextLabel(pathname)}</span>

            </nav>
          ) : (
            <div className="ref-context">
              <span>
                {pathname === '/appointments'
                  ? 'Không gian cá nhân / '
                  : 'Không gian của bạn'}
              </span>
              <strong>
                {pathname === '/appointments'
                  ? 'Lịch hẹn tư vấn'

                  : resolveContextLabel(pathname)}

              </strong>
            </div>
          )}
          <label>
            <Svg>
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </Svg>
            <input
              key={
                pathname === '/specialists'
                  ? 'specialist-search'
                  : 'general-search'
              }
              type="search"
              aria-label={
                pathname === '/specialists'
                  ? 'Tìm chuyên gia theo tên hoặc chuyên môn'
                  : 'Tìm kiếm'
              }
              value={
                pathname === '/specialists' ? specialistSearch : generalSearch
              }
              onChange={(event) => {
                if (pathname === '/specialists') {
                  setSpecialistSearch(event.target.value)
                  window.dispatchEvent(
                    new CustomEvent('mentalbridge:specialist-search', {
                      detail: event.target.value,
                    }),
                  )
                } else {
                  setGeneralSearch(event.target.value)
                }
              }}
              placeholder={
                pathname === '/specialists'
                  ? 'Tìm theo chuyên môn, tên bác sĩ...'
                  : pathname === '/appointments'
                    ? 'Tìm chuyên gia, nhật ký phiên...'
                    : isProgressiveRelaxation
                      ? 'Tìm kiếm chuyên gia, bài tập, nhật ký...'
                      : 'Tìm kiếm chuyên gia, nhật ký...'
              }
            />
            <kbd>⌘K</kbd>
          </label>
          <div className="ref-top-actions">
            {pathname === '/appointments' && (
              <button
                type="button"
                className="ref-new-booking-btn"
                onClick={() =>
                  window.dispatchEvent(
                    new Event('mentalbridge:open-appointment-booking'),
                  )
                }
              >
                <span>+ Đặt lịch mới</span>
              </button>
            )}

            {isProgressiveRelaxation && (
              <Link
                href="/support-guides"
                className="pmr-help"
                aria-label="Trợ giúp"
              >
                <Svg>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.7-2.5 2-2.5 4" />
                  <path d="M12 17h.01" />
                </Svg>
              </Link>
            )}

            {pathname !== '/appointments' && (
              <Link
                href="/community"
                className="ref-community-link"
                onClick={() => setMobile(false)}
              >
                <CommunityIcon />
                <span>Cộng đồng</span>
              </Link>
            )}
            {isProgressiveRelaxation && (
              <Link
                href="/support-guides"
                className="pmr-help"
                aria-label="Trợ giúp"
              >
                <Svg>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.7-2.5 2-2.5 4" />
                  <path d="M12 17h.01" />
                </Svg>
              </Link>
            )}
            <Link
              href="/notifications"
              className="ref-notify"
              aria-label="Thông báo"
            >
              <Svg>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              </Svg>
              {isProgressiveRelaxation && (
                <span className="pmr-notify-dot" aria-hidden="true" />
              )}
            </Link>
            <Link
              href="/profile"
              className="ref-avatar"
              aria-label={`Hồ sơ ${displayName}`}
            >
              {isProgressiveRelaxation ? (
                <Svg>
                  <circle cx="12" cy="8" r="3" />
                  <path d="M5 20c.5-4 3-6 7-6s6.5 2 7 6" />
                </Svg>
              ) : (
                initials
              )}
            </Link>
          </div>
        </header>
        <main

          className={`ref-content ${pathname === '/dashboard' ? 'ref-content-dashboard' : isScreeningJourney ? 'ref-content-screening' : 'ref-content-page'}`}
          data-entered={enteredPath === pathname ? '' : undefined}

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
