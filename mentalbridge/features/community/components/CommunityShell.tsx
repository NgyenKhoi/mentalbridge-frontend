'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Bell,
  Bookmark,
  Flower2,
  Home,
  MessageSquare,
  NotebookPen,
  PlaySquare,
  Search,
  ShieldCheck,
  Sprout,
  Wind,
  Users,
} from 'lucide-react'
import {
  getCommunityProfile,
  COMMUNITY_PROFILE_CHANGED,
  type CommunityProfile,
} from '../api/browser-community'
import CommunityAvatar from './CommunityAvatar'
import { CommunityResourceShortcut } from './CommunityDiscovery'
import styles from './CommunityShell.module.css'
import { useCommunityInbox } from '@/features/community-chat/components/CommunityInboxProvider'

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
    href: '/community/messages',
    label: 'Tin nhắn',
    mobileLabel: 'Tin nhắn',
    description: 'Trò chuyện riêng tư trong cộng đồng',
    icon: (
      <Icon>
        <path d="M4 5h16v12H8l-4 3V5Z" />
        <path d="M8 9h8M8 13h5" />
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
  {
    href: '/community/groups',
    label: 'Nhóm cộng đồng riêng',
    mobileLabel: 'Nhóm',
    description: 'Bảng tin trong nhóm bạn đã tham gia',
    icon: <Users size={18} />,
  },
]

export default function CommunityShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname()
  const inbox = useCommunityInbox()
  const unreadCount = inbox?.unreadCount ?? 0
  const unreadLabel = unreadCount > 99 ? '99+' : unreadCount
  const [profile, setProfile] = useState<CommunityProfile | null>(null)
  useEffect(() => {
    let active = true
    let generation = 0
    const refreshProfile = () => {
      const current = ++generation
      void getCommunityProfile()
        .then(({ data }) => {
          if (active && generation === current) setProfile(data)
        })
        .catch(() => {
          if (active && generation === current && current === 1)
            setProfile(null)
        })
    }
    refreshProfile()
    window.addEventListener(COMMUNITY_PROFILE_CHANGED, refreshProfile)
    return () => {
      active = false
      window.removeEventListener(COMMUNITY_PROFILE_CHANGED, refreshProfile)
    }
  }, [])

  const isActive = (href: string) =>
    href === '/community'
      ? pathname === '/community' ||
        (/^\/community\/[^/]+$/.test(pathname) &&
          pathname !== '/community/profile' &&
          pathname !== '/community/saved' &&
          pathname !== '/community/reels' &&
          pathname !== '/community/friends' &&
          pathname !== '/community/groups' &&
          pathname !== '/community/messages')
      : pathname.startsWith(href)

  return (
    <div className={`community-shell ${styles.shell}`}>
      <a className="community-skip-link" href="#community-content">
        Đi đến nội dung chính
      </a>
      <header className={styles.header}>
        <Link
          className={styles.brand}
          href="/community"
          aria-label="Cộng đồng MentalBridge"
        >
          <span className={styles.brandMark}>
            <Flower2 size={24} strokeWidth={1.6} />
          </span>
          <span>
            <strong>MentalBridge</strong>
            <small>VÙNG AN YÊN</small>
          </span>
        </Link>
        <form className={styles.search} action="/community" role="search">
          <Search size={16} aria-hidden="true" />
          <input
            name="q"
            aria-label="Tìm câu chuyện trong bảng tin"
            placeholder="Tìm câu chuyện…"
            maxLength={120}
          />
        </form>
        <nav className={styles.topNav} aria-label="Khu vực cộng đồng">
          <Link
            href="/community"
            aria-label="Bảng tin"
            aria-current={pathname === '/community' ? 'page' : undefined}
          >
            <Home size={21} />
          </Link>
          <Link
            href="/community/reels"
            aria-label="Khoảnh khắc và Reels"
            aria-current={pathname === '/community/reels' ? 'page' : undefined}
          >
            <PlaySquare size={21} />
          </Link>
          <Link
            href="/community/messages"
            aria-label="Tin nhắn"
            aria-description={
              unreadCount ? `${unreadCount} tin nhắn chưa đọc` : undefined
            }
            aria-current={isActive('/community/messages') ? 'page' : undefined}
          >
            <MessageSquare size={21} />
            {unreadCount > 0 && (
              <span className={styles.navBadge} aria-hidden="true">
                {unreadLabel}
              </span>
            )}
          </Link>
          <Link href="/resources" aria-label="Kho tài nguyên">
            <Sprout size={21} />
          </Link>
        </nav>
        <div className={styles.headerActions}>
          <Link
            className={styles.dashboardReturn}
            href="/dashboard"
            aria-label="Về không gian của bạn"
          >
            <ArrowLeft size={16} />
            <span className={styles.dashboardReturnLabel}>Về Tổng quan</span>
          </Link>
          <Link className={styles.help} href="/safety-directory">
            <span /> Cần hỗ trợ ngay
          </Link>
          <Link
            className={styles.headerIcon}
            href="/notifications"
            aria-label="Thông báo"
          >
            <Bell size={19} />
          </Link>
          <Link
            className={styles.account}
            href="/community/profile"
            aria-label="Danh tính cộng đồng"
          >
            <CommunityAvatar
              displayName={profile?.displayName ?? '?'}
              avatarPreset={profile?.avatarPreset ?? 'SPROUT'}
              avatarImage={profile?.avatarImage}
            />
          </Link>
        </div>
      </header>
      <div className={styles.frame}>
        <aside className={styles.leftRail} aria-label="Không gian cộng đồng">
          <Link className={styles.sideDashboardLink} href="/dashboard">
            <ArrowLeft size={16} />
            <span>Về trang Tổng quan</span>
          </Link>
          <Link
            className={styles.identity}
            href={
              profile
                ? `/community/members/${profile.communityProfileId}`
                : '/community/profile'
            }
          >
            <CommunityAvatar
              displayName={profile?.displayName ?? '?'}
              avatarPreset={profile?.avatarPreset ?? 'SPROUT'}
              avatarImage={profile?.avatarImage}
            />
            <span>
              <strong>{profile?.displayName ?? 'Danh tính của bạn'}</strong>
              <small>Trang cá nhân cộng đồng</small>
            </span>
          </Link>
          <nav className={styles.sideNav} aria-label="Điều hướng cộng đồng">
            <Link
              href="/community"
              aria-current={isActive('/community') ? 'page' : undefined}
            >
              <Home size={18} /> Bảng tin chính
            </Link>
            <Link
              href="/community/reels"
              aria-current={
                pathname === '/community/reels' ? 'page' : undefined
              }
            >
              <PlaySquare size={18} /> Khoảnh khắc & Reels
            </Link>
            <Link
              href="/community/saved"
              aria-current={isActive('/community/saved') ? 'page' : undefined}
            >
              <Bookmark size={18} /> Bài viết đã lưu
            </Link>
            <Link
              href="/community/friends"
              aria-current={isActive('/community/friends') ? 'page' : undefined}
            >
              <Users size={18} /> Bạn bè
            </Link>
            <Link
              href="/community/messages"
              aria-current={
                isActive('/community/messages') ? 'page' : undefined
              }
            >
              <MessageSquare size={18} /> Tin nhắn
              {unreadCount > 0 && (
                <span
                  className={styles.sideBadge}
                  aria-label={`${unreadCount} tin nhắn chưa đọc`}
                >
                  {unreadLabel}
                </span>
              )}
            </Link>
            <Link
              href="/community/groups"
              aria-current={isActive('/community/groups') ? 'page' : undefined}
            >
              <Users size={18} /> Nhóm cộng đồng riêng
            </Link>
            <Link href="/resources">
              <Sprout size={18} /> Kho tài nguyên & Bài tập thở
            </Link>
            <Link
              href="/community/profile"
              aria-current={isActive('/community/profile') ? 'page' : undefined}
            >
              <ShieldCheck size={18} /> Danh tính & Quyền riêng tư
            </Link>
          </nav>
          <section
            className={styles.quietLinks}
            aria-labelledby="community-quiet-title"
          >
            <h2 id="community-quiet-title">Lối tắt không gian ấm</h2>
            <Link href="/journal">
              <span>
                <NotebookPen size={17} />
              </span>{' '}
              Góc ghi lại điều nhỏ bé
            </Link>
            <CommunityResourceShortcut category="BREATHING">
              <span>
                <Wind size={17} />
              </span>{' '}
              Một khoảng nghỉ với hơi thở
            </CommunityResourceShortcut>
            <CommunityResourceShortcut category="MEDITATION">
              <span>
                <Flower2 size={17} />
              </span>{' '}
              Thả lỏng & Lắng nghe mình
            </CommunityResourceShortcut>
          </section>
          <footer className={styles.footer}>
            <p>MentalBridge · Cộng đồng sẻ chia</p>
            <div>
              <Link href="/privacy">Quyền riêng tư</Link>
              <span>·</span>
              <Link href="/terms">Quy tắc cộng đồng</Link>
            </div>
            <Link className={styles.dashboard} href="/dashboard">
              <ArrowLeft size={15} /> Trang cá nhân
            </Link>
          </footer>
        </aside>
        <main
          id="community-content"
          className={`community-shell-main ${styles.main}`}
        >
          {children}
        </main>
      </div>

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
              {item.href === '/community/messages' && unreadCount > 0 && (
                <span
                  className={styles.mobileBadge}
                  aria-label={`${unreadCount} tin nhắn chưa đọc`}
                >
                  {unreadLabel}
                </span>
              )}
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
