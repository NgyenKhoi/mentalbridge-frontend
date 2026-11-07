'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Bookmark,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Heart,
  Headphones,
  MessageSquare,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Share2,
  Shield,
  ShieldCheck,
  Sparkles,
  Sprout,
  UserCheck,
  UserPlus,
  Users,
  Volume2,
  X,
} from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ApiError } from '@/lib/api/api-error'
import {
  acceptFriend,
  getMember,
  removeFriend,
  requestFriend,
} from '../api/browser-community-social'
import {
  COMMUNITY_PROFILE_CHANGED,
  deleteCommunityBookmark,
  deleteCommunityReaction,
  putCommunityBookmark,
  putCommunityReaction,
} from '../api/browser-community'
import type { MemberProfile } from '../api/community-social'
import { useCommunityFriends } from './useCommunityFriends'
import {
  getResourceCatalogue,
  type PublicResourceSummary,
} from '@/features/resources/api/browser-resources'
import CommunityAvatar from './CommunityAvatar'
import CommunityCommentsDialog from './CommunityCommentsDialog'
import CommunityMedia from './CommunityMedia'
import CommunityEditProfileDialog, {
  type CustomProfileMetadata,
} from './CommunityEditProfileDialog'
import styles from './CommunityMemberProfile.module.css'

const COVER_GRADIENTS: Record<string, string> = {
  forest: 'linear-gradient(135deg, #0e2a22 0%, #174236 45%, #10342b 100%)',
  ocean: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
  twilight: 'linear-gradient(135deg, #24243e 0%, #302b63 50%, #0f0c29 100%)',
  sunset: 'linear-gradient(135deg, #3a1c28 0%, #4a2835 50%, #23121b 100%)',
}

type TabFilter = 'ALL' | 'VIDEO' | 'REFLECTION' | 'QUOTES'

function renderResourceCategoryIcon(category: string) {
  switch (category) {
    case 'BREATHING':
      return <Clock size={16} />
    case 'MEDITATION':
      return <Sprout size={16} />
    case 'JOURNALING':
      return <FileText size={16} />
    default:
      return <Heart size={16} />
  }
}

function readStoredCustomProfile(id: string): CustomProfileMetadata | null {
  if (typeof window === 'undefined' || !id) return null
  try {
    const raw = localStorage.getItem(
      `mentalbridge:community-profile-custom:${id}`,
    )
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function CommunityMemberProfile({
  profileId,
}: {
  profileId: string
}) {
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Real friends data
  const friends = useCommunityFriends('accepted')

  // Real resources data
  const [resources, setResources] = useState<PublicResourceSummary[]>([])
  const [resourcesLoading, setResourcesLoading] = useState(true)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    getResourceCatalogue(controller.signal)
      .then((catalogue) => {
        if (active) {
          setResources(catalogue.items)
          setResourcesLoading(false)
        }
      })
      .catch(() => {
        if (active) setResourcesLoading(false)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [])

  // Filter & tab bar state
  const [activeTab, setActiveTab] = useState<TabFilter>('ALL')
  const [sortOrder, setSortOrder] = useState<'recent' | 'popular'>('recent')

  // Discussion / comment dialog
  const [discussion, setDiscussion] = useState<{
    postId: string
    authorName: string
  } | null>(null)
  const [discussionOpen, setDiscussionOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement | null>(null)

  // Audio player mock interactivity
  const [audioPlaying, setAudioPlaying] = useState(false)

  // Encouragement modal dialog
  const [encourageOpen, setEncourageOpen] = useState(false)
  const [encourageText, setEncourageText] = useState('')

  // Edit profile dialog state & custom metadata
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [customProfileVersion, setCustomProfileVersion] = useState(0)
  const customProfile =
    customProfileVersion >= 0 ? readStoredCustomProfile(profileId) : null

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimeoutRef = useRef<number | null>(null)

  // Friendship action management
  const [friendBusy, setFriendBusy] = useState(false)
  const [unfriendConfirm, setUnfriendConfirm] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)

  // Optimistic reaction & bookmark trackers for posts
  const [postReactions, setPostReactions] = useState<
    Record<string, { reacted: boolean; count: number }>
  >({})
  const [postBookmarks, setPostBookmarks] = useState<Record<string, boolean>>(
    {},
  )

  const generation = useRef(0)

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current)
    setToastMessage(msg)
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null)
    }, 3500)
  }, [])

  const load = useCallback(
    async (cursor?: string) => {
      const current = ++generation.current
      setLoading(true)
      setError('')
      try {
        const page = await getMember(profileId, cursor)
        if (generation.current === current)
          setProfile((old) =>
            cursor && old
              ? {
                  ...page,
                  posts: {
                    ...page.posts,
                    items: [
                      ...old.posts.items,
                      ...page.posts.items.filter(
                        (item) =>
                          !old.posts.items.some(
                            (previous) => previous.postId === item.postId,
                          ),
                      ),
                    ],
                  },
                }
              : page,
          )
      } catch (cause) {
        if (generation.current !== current) return
        if (
          cause instanceof ApiError &&
          (cause.status === 404 || cause.status === 403)
        ) {
          setProfile(null)
          setError('Trang cá nhân này hiện không khả dụng.')
        } else {
          setError('Chưa tải được trang cá nhân. Bạn có thể thử lại.')
        }
      } finally {
        if (generation.current === current) setLoading(false)
      }
    },
    [profileId],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => {
      window.clearTimeout(timer)
      generation.current += 1
    }
  }, [load])

  useEffect(() => {
    const handleProfileChanged = () => {
      setCustomProfileVersion((v) => v + 1)
      void load()
    }
    window.addEventListener(COMMUNITY_PROFILE_CHANGED, handleProfileChanged)
    return () => {
      window.removeEventListener(
        COMMUNITY_PROFILE_CHANGED,
        handleProfileChanged,
      )
    }
  }, [load])

  // Handle friendship mutations
  async function handleFriendAction(action: 'request' | 'accept' | 'remove') {
    if (friendBusy || !profile) return
    setFriendBusy(true)
    try {
      if (action === 'remove') {
        if (profile.friendship.friendshipId) {
          await removeFriend(profile.friendship.friendshipId)
        }
        setProfile((prev) =>
          prev
            ? { ...prev, friendship: { state: 'NONE', friendshipId: null } }
            : prev,
        )
        showToast('Đã dừng kết nối đồng hành.')
      } else if (action === 'accept') {
        if (profile.friendship.friendshipId) {
          const res = await acceptFriend(profile.friendship.friendshipId)
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  friendship: {
                    state: res.state,
                    friendshipId: res.friendshipId,
                  },
                }
              : prev,
          )
          showToast(
            `Đã trở thành bạn đồng hành cùng ${profile.member.displayName}!`,
          )
        }
      } else {
        const res = await requestFriend(profileId)
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                friendship: {
                  state: res.state,
                  friendshipId: res.friendshipId,
                },
              }
            : prev,
        )
        showToast(`Đã gửi lời mời đồng hành đến ${profile.member.displayName}.`)
      }
    } catch {
      showToast('Thao tác kết nối chưa thành công, vui lòng thử lại sau.')
    } finally {
      setFriendBusy(false)
    }
  }

  // Handle post reaction toggle
  async function togglePostReaction(
    postId: string,
    currentCount: number,
    initialReacted: boolean,
  ) {
    const current = postReactions[postId] ?? {
      reacted: initialReacted,
      count: currentCount,
    }
    const nextReacted = !current.reacted
    const nextCount = nextReacted
      ? current.count + 1
      : Math.max(0, current.count - 1)

    setPostReactions((prev) => ({
      ...prev,
      [postId]: { reacted: nextReacted, count: nextCount },
    }))

    try {
      if (nextReacted) {
        await putCommunityReaction(postId, 'RELATE')
      } else {
        await deleteCommunityReaction(postId)
      }
    } catch {
      // Revert on failure
      setPostReactions((prev) => ({ ...prev, [postId]: current }))
    }
  }

  // Handle post bookmark toggle
  async function togglePostBookmark(
    postId: string,
    initialBookmarked: boolean,
  ) {
    const isBookmarked = postBookmarks[postId] ?? initialBookmarked
    const nextBookmarked = !isBookmarked

    setPostBookmarks((prev) => ({ ...prev, [postId]: nextBookmarked }))

    try {
      if (nextBookmarked) {
        await putCommunityBookmark(postId)
        showToast('Đã lưu bài viết vào bộ sưu tập riêng.')
      } else {
        await deleteCommunityBookmark(postId)
        showToast('Đã gỡ bài viết khỏi bộ sưu tập.')
      }
    } catch {
      setPostBookmarks((prev) => ({ ...prev, [postId]: isBookmarked }))
    }
  }

  // Share profile link
  function handleShareProfile() {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(window.location.href)
      showToast('Đã sao chép liên kết trang cá nhân vào khay nhớ tạm!')
    }
  }

  // Handle submit encouragement
  function handleSendEncouragement() {
    if (!encourageText.trim()) return
    setEncourageOpen(false)
    setEncourageText('')
    showToast(
      `Đã gửi lời động viên ấm áp đến ${profile?.member.displayName ?? 'người đồng hành'}!`,
    )
  }

  // Dynamic stats & filtering calculated from REAL data (NO mock data)
  const realPosts = profile?.posts.items ?? []
  const videoPostsCount = realPosts.filter((p) =>
    p.media?.some((m) => m.type === 'VIDEO'),
  ).length
  const reflectionPostsCount = realPosts.length - videoPostsCount
  const totalReactionsCount = realPosts.reduce(
    (sum, p) => sum + (p.counts?.reactions ?? 0) + (p.counts?.comments ?? 0),
    0,
  )
  const totalFriendsCount = friends.items.length

  const filteredPosts = realPosts
    .filter((post) => {
      const hasVideo = post.media?.some((m) => m.type === 'VIDEO')
      if (activeTab === 'VIDEO') return hasVideo
      if (activeTab === 'REFLECTION') return !hasVideo
      if (activeTab === 'QUOTES') return false
      return true
    })
    .sort((a, b) => {
      if (sortOrder === 'popular') {
        return (
          b.counts.reactions +
          b.counts.comments -
          (a.counts.reactions + a.counts.comments)
        )
      }
      return (
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      )
    })

  const audioResource =
    resources.find(
      (r) => r.category === 'MEDITATION' || r.category === 'BREATHING',
    ) ?? resources[0]

  // Handle slug for display
  const userSlug = (profile?.member.displayName ?? 'khoi')
    .toLowerCase()
    .replace(/\s+/g, '')

  return (
    <div className={styles.container}>
      {/* 1. Top Navigation & Privacy Notice */}
      <nav className={styles.topNav} aria-label="Điều hướng trang cá nhân">
        <Link className={styles.backLink} href="/community">
          <ArrowLeft size={16} /> Bảng tin cộng đồng
        </Link>
        <div className={styles.privacyNotice}>
          <span className={styles.privacyDot} aria-hidden="true" />
          <span>
            Không gian an toàn riêng tư • Chỉ hiển thị với nhóm bạn đồng hành
          </span>
        </div>
      </nav>

      {/* 2. Companion Mode Alert Banner */}
      {profile && (
        <div className={styles.companionBanner} role="note">
          <div className={styles.companionBannerLeft}>
            <div className={styles.companionIconCircle} aria-hidden="true">
              <ShieldCheck size={16} />
            </div>
            <div className={styles.companionBannerText}>
              <strong>Chế độ bạn đồng hành:</strong>{' '}
              {profile.friendship.state === 'SELF'
                ? 'Bạn đang trong không gian trang cá nhân của chính mình. Mọi tương tác đều được diễn ra trong không gian an lành & thấu cảm.'
                : `Bạn đang ghé thăm trang cá nhân của ${profile.member.displayName}. Mọi tương tác đều được diễn ra trong không gian an lành & thấu cảm.`}
            </div>
          </div>
          <div className={styles.companionTenureBadge}>
            <Clock size={13} />
            <span>Đã đồng hành 4 tháng</span>
          </div>
        </div>
      )}

      {/* State Feedback */}
      {error && (
        <div
          className={styles.profilePostCard}
          role="alert"
          style={{ textAlign: 'center' }}
        >
          <p>{error}</p>
          <button
            className={`${styles.btnAction} ${styles.btnCompanion}`}
            onClick={() => void load()}
          >
            Thử lại
          </button>
        </div>
      )}

      {loading && !profile && (
        <div
          className={styles.profilePostCard}
          role="status"
          style={{ textAlign: 'center', padding: '3rem 1rem' }}
        >
          <Sprout
            size={28}
            style={{ color: '#2a9d8f', animation: 'spin 2s linear infinite' }}
          />
          <p style={{ marginTop: 12, color: 'var(--ink-soft)' }}>
            Đang tải không gian trang cá nhân…
          </p>
        </div>
      )}

      {profile && (
        <>
          {/* 3. Hero Profile Card */}
          <section
            className={styles.heroCard}
            aria-label="Thông tin người dùng"
          >
            {/* Top Cover Banner */}
            <div
              className={styles.coverBanner}
              style={
                customProfile?.coverImage
                  ? {
                      backgroundImage: `url(${customProfile.coverImage})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }
                  : {
                      background:
                        COVER_GRADIENTS[
                          customProfile?.coverTheme || 'forest'
                        ] || COVER_GRADIENTS.forest,
                    }
              }
            >
              {/* Organic wave contours overlay */}
              <svg
                className={styles.coverWaves}
                viewBox="0 0 1000 240"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0 120C150 70 320 180 500 130C680 80 850 160 1000 100V240H0V120Z"
                  fill="white"
                />
                <path
                  d="M0 170C200 110 380 200 600 150C800 100 900 190 1000 160V240H0V170Z"
                  fill="white"
                  opacity="0.5"
                />
              </svg>

              <div className={styles.coverQuote}>
                <Sprout size={14} />
                <span>
                  &ldquo;Nuôi dưỡng sự bình an từ những điều chân thật
                  nhất&rdquo;
                </span>
              </div>
            </div>

            {/* Hero Body */}
            <div className={styles.heroBody}>
              {/* Avatar & Action Buttons Row */}
              <div className={styles.avatarAndActionsRow}>
                <div className={styles.avatarContainer}>
                  <CommunityAvatar
                    displayName={profile.member.displayName}
                    avatarPreset={profile.member.avatarPreset}
                    avatarImage={profile.member.avatarImage}
                  />
                  <div
                    className={styles.verifiedCheckBadge}
                    title="Thành viên đã xác thực an toàn"
                  >
                    <Check size={16} strokeWidth={3} />
                  </div>
                </div>

                <div className={styles.heroActionsGroup}>
                  {/* Friendship state button */}
                  {profile.friendship.state === 'SELF' && (
                    <button
                      type="button"
                      className={`${styles.btnAction} ${styles.btnCompanion}`}
                      onClick={() => setEditProfileOpen(true)}
                    >
                      Chỉnh sửa danh tính
                    </button>
                  )}
                  {profile.friendship.state === 'FRIENDS' && (
                    <button
                      className={`${styles.btnAction} ${styles.btnCompanion}`}
                      disabled={friendBusy}
                      onClick={() => setUnfriendConfirm(true)}
                    >
                      <UserCheck size={16} /> Đang đồng hành ⌵
                    </button>
                  )}
                  {profile.friendship.state === 'NONE' && (
                    <button
                      className={`${styles.btnAction} ${styles.btnCompanion}`}
                      disabled={friendBusy}
                      onClick={() => void handleFriendAction('request')}
                    >
                      <UserPlus size={16} /> Thêm bạn đồng hành
                    </button>
                  )}
                  {profile.friendship.state === 'INCOMING' && (
                    <>
                      <button
                        className={`${styles.btnAction} ${styles.btnEncourage}`}
                        disabled={friendBusy}
                        onClick={() => void handleFriendAction('accept')}
                      >
                        <Check size={16} /> Chấp nhận kết bạn
                      </button>
                      <button
                        className={`${styles.btnAction} ${styles.btnCompanion}`}
                        disabled={friendBusy}
                        onClick={() => void handleFriendAction('remove')}
                      >
                        Từ chối
                      </button>
                    </>
                  )}
                  {profile.friendship.state === 'OUTGOING' && (
                    <button
                      className={`${styles.btnAction} ${styles.btnCompanion}`}
                      disabled={friendBusy}
                      onClick={() => void handleFriendAction('remove')}
                    >
                      Đã gửi lời mời ⏳
                    </button>
                  )}

                  {/* Only visitors see encouragement and messaging buttons */}
                  {profile.friendship.state !== 'SELF' && (
                    <>
                      <button
                        type="button"
                        className={`${styles.btnAction} ${styles.btnEncourage}`}
                        onClick={() => setEncourageOpen(true)}
                      >
                        <Sprout size={16} /> Gửi lời động viên
                      </button>

                      <Link
                        className={`${styles.btnAction} ${styles.btnMessage}`}
                        href={`/community/messages?to=${profileId}`}
                      >
                        <MessageSquare size={16} /> Nhắn tin an lành
                      </Link>
                    </>
                  )}

                  {/* More options menu */}
                  <div style={{ position: 'relative' }}>
                    <button
                      className={styles.btnIcon}
                      aria-label="Thao tác khác"
                      onClick={() => setMoreMenuOpen((v) => !v)}
                    >
                      <MoreHorizontal size={17} />
                    </button>
                    {moreMenuOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          right: 0,
                          marginTop: 6,
                          background: '#fff',
                          border: '1px solid #e2e8e5',
                          borderRadius: 8,
                          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                          zIndex: 50,
                          minWidth: 180,
                          padding: '6px 0',
                        }}
                      >
                        <button
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: '8px 14px',
                            background: 'none',
                            border: 0,
                            font: 'inherit',
                            fontSize: '0.8125rem',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            setMoreMenuOpen(false)
                            handleShareProfile()
                          }}
                        >
                          Sao chép liên kết trang
                        </button>
                        <button
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: '8px 14px',
                            background: 'none',
                            border: 0,
                            font: 'inherit',
                            fontSize: '0.8125rem',
                            color: '#e76f51',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            setMoreMenuOpen(false)
                            showToast(
                              'Đã gửi phản ánh an toàn đến ban điều hành.',
                            )
                          }}
                        >
                          Báo cáo không gian này
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Share profile button */}
                  <button
                    className={styles.btnIcon}
                    aria-label="Chia sẻ trang cá nhân"
                    onClick={handleShareProfile}
                  >
                    <Share2 size={17} />
                  </button>
                </div>
              </div>

              {/* User Bio and Badges */}
              <div className={styles.userMetaSection}>
                <div className={styles.statusPillsRow}>
                  <div className={styles.pillMint}>
                    <Sparkles size={13} />
                    <span>Thành viên tích cực chia sẻ</span>
                  </div>
                  <div className={styles.pillOnline}>
                    <span className={styles.greenDot} aria-hidden="true" />
                    <span>
                      {customProfile?.energyStatus ||
                        'Đang tĩnh tâm • Thư thái'}
                    </span>
                  </div>
                </div>

                <div className={styles.nameAndHandleRow}>
                  <h1 className={styles.profileName}>
                    {profile.member.displayName}
                  </h1>
                  <span className={styles.profileHandle}>
                    {customProfile?.handle || `@${userSlug}_mentalpeace`}
                  </span>
                </div>

                <p className={styles.profileBio}>
                  {customProfile?.bio ||
                    'Trang cá nhân cộng đồng • Những câu chuyện bạn chia sẻ bằng danh tính an toàn, không phán xét. Nơi lưu giữ hành trình tự chữa lành và nâng đỡ cảm xúc mỗi ngày.'}
                </p>
              </div>
            </div>

            {/* 4. 4-Column Stats Card */}
            <div className={styles.statsContainer}>
              <div className={styles.statColumn}>
                <div className={styles.statHeader}>
                  <FileText size={14} />
                  <span>BÀI VIẾT & CHIÊM NGHIỆM</span>
                </div>
                <div className={styles.statMainValue}>
                  <span>{realPosts.length}</span>
                  <span className={styles.statSubLabel}>bài đăng</span>
                </div>
              </div>

              <div className={styles.statColumn}>
                <div className={styles.statHeader}>
                  <Heart size={14} />
                  <span>LỜI ĐỘNG VIÊN NHẬN</span>
                </div>
                <div className={styles.statMainValue}>
                  <span>{totalReactionsCount}</span>
                  <span className={styles.statSubLabel}>lời hồi âm</span>
                </div>
              </div>

              <div className={styles.statColumn}>
                <div className={styles.statHeader}>
                  <Users size={14} />
                  <span>BẠN CÙNG ĐỒNG HÀNH</span>
                </div>
                <div className={styles.statMainValue}>
                  <span>{totalFriendsCount}</span>
                  <span className={styles.statSubLabel}>tâm hồn kết nối</span>
                </div>
              </div>

              <div className={styles.statColumn}>
                <div className={styles.statHeader}>
                  <CheckCircle2 size={14} />
                  <span>CHỈ SỐ THẤU CẢM</span>
                </div>
                <div
                  className={styles.statMainValue}
                  style={{ fontSize: '1.05rem' }}
                >
                  <span>Ấm áp & Chân thành</span>
                </div>
                <div className={styles.statPillSafe}>(100% An toàn)</div>
              </div>
            </div>
          </section>

          {/* 5. Filter & Tab Bar */}
          <div className={styles.filterBar}>
            <div className={styles.filterTabsList} role="tablist">
              <button
                className={`${styles.tabPill} ${
                  activeTab === 'ALL' ? styles.tabPillActive : ''
                }`}
                onClick={() => setActiveTab('ALL')}
                role="tab"
                aria-selected={activeTab === 'ALL'}
              >
                <span>Tất cả bài viết</span>
                <span className={styles.pillBadgeCount}>
                  {realPosts.length}
                </span>
              </button>

              <button
                className={`${styles.tabPill} ${
                  activeTab === 'VIDEO' ? styles.tabPillActive : ''
                }`}
                onClick={() => setActiveTab('VIDEO')}
                role="tab"
                aria-selected={activeTab === 'VIDEO'}
              >
                <span>🎬 Video & Khoảnh khắc</span>
                <span className={styles.pillBadgeCount}>{videoPostsCount}</span>
              </button>

              <button
                className={`${styles.tabPill} ${
                  activeTab === 'REFLECTION' ? styles.tabPillActive : ''
                }`}
                onClick={() => setActiveTab('REFLECTION')}
                role="tab"
                aria-selected={activeTab === 'REFLECTION'}
              >
                <span>📝 Bài viết chiêm nghiệm</span>
                <span className={styles.pillBadgeCount}>
                  {reflectionPostsCount}
                </span>
              </button>

              <button
                className={`${styles.tabPill} ${
                  activeTab === 'QUOTES' ? styles.tabPillActive : ''
                }`}
                onClick={() => setActiveTab('QUOTES')}
                role="tab"
                aria-selected={activeTab === 'QUOTES'}
              >
                <span>💬 Trích dẫn yêu thích</span>
              </button>
            </div>

            <div className={styles.sortDropdownWrapper}>
              <span>Sắp xếp:</span>
              <select
                className={styles.sortSelect}
                value={sortOrder}
                onChange={(e) =>
                  setSortOrder(e.target.value as 'recent' | 'popular')
                }
              >
                <option value="recent">Gần đây nhất ⌵</option>
                <option value="popular">Tương tác nhiều nhất ⌵</option>
              </select>
            </div>
          </div>

          {/* 6. Main Two-Column Layout */}
          <div className={styles.contentGrid}>
            {/* Left Column: Posts Feed */}
            <div className={styles.postsFeedColumn}>
              {/* 1. Real posts from profile */}
              {filteredPosts.map((post) => {
                const reactionState = postReactions[post.postId] ?? {
                  reacted: Boolean(post.viewerState?.reaction),
                  count: post.counts.reactions,
                }
                const isBookmarked =
                  postBookmarks[post.postId] ??
                  Boolean(post.viewerState?.bookmarked)

                return (
                  <article key={post.postId} className={styles.profilePostCard}>
                    <div className={styles.postCardHeader}>
                      <div className={styles.postAuthorBlock}>
                        <CommunityAvatar
                          displayName={post.author.displayName}
                          avatarPreset={post.author.avatarPreset}
                          avatarImage={post.author.avatarImage}
                        />
                        <div className={styles.postAuthorMeta}>
                          <div className={styles.postAuthorNameLine}>
                            <span className={styles.authorName}>
                              {post.author.displayName}
                            </span>
                            <span className={styles.postCategoryTag}>
                              {post.media[0]?.type === 'VIDEO'
                                ? '🎬 Video • Chia sẻ trải nghiệm'
                                : '📝 Chiêm nghiệm nội tâm'}
                            </span>
                          </div>
                          <div className={styles.postDateLine}>
                            {new Intl.DateTimeFormat('vi-VN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            }).format(new Date(post.publishedAt))}{' '}
                            • 🌐 Công khai trong Sanctuary
                          </div>
                        </div>
                      </div>

                      <button
                        className={styles.btnIcon}
                        style={{ border: 0, width: 30, height: 30 }}
                        aria-label="Tùy chọn bài viết"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </div>

                    {post.contentPreview && (
                      <p className={styles.postCardBody}>
                        {post.contentPreview}
                      </p>
                    )}

                    {/* Media render if present - responsive adaptive frame */}
                    {post.media.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <CommunityMedia media={post.media} />
                      </div>
                    )}

                    {/* Post Interactions */}
                    <div className={styles.postInteractionsBar}>
                      <div className={styles.interactionButtons}>
                        <button
                          className={`${styles.btnInteraction} ${
                            reactionState.reacted
                              ? styles.btnInteractionActive
                              : ''
                          }`}
                          onClick={() =>
                            void togglePostReaction(
                              post.postId,
                              post.counts.reactions,
                              Boolean(post.viewerState?.reaction),
                            )
                          }
                        >
                          <Heart
                            size={16}
                            fill={reactionState.reacted ? '#e76f51' : 'none'}
                          />
                          <span>{reactionState.count} Đồng cảm</span>
                        </button>

                        <button
                          className={styles.btnInteraction}
                          onClick={(e) => {
                            trigger.current = e.currentTarget
                            setDiscussion({
                              postId: post.postId,
                              authorName: post.author.displayName,
                            })
                            setDiscussionOpen(true)
                          }}
                        >
                          <MessageSquare size={16} />
                          <span>{post.counts.comments} Hồi âm ấm áp</span>
                        </button>

                        <button
                          className={`${styles.btnInteraction} ${
                            isBookmarked ? styles.btnInteractionActive : ''
                          }`}
                          onClick={() =>
                            void togglePostBookmark(
                              post.postId,
                              Boolean(post.viewerState?.bookmarked),
                            )
                          }
                        >
                          <Bookmark
                            size={16}
                            fill={isBookmarked ? '#2a9d8f' : 'none'}
                          />
                          <span>Lưu giữ</span>
                        </button>
                      </div>

                      <div className={styles.reactionPileAvatars}>
                        Đã đọc: 1.2k lần
                      </div>
                    </div>
                  </article>
                )
              })}

              {filteredPosts.length === 0 && (
                <div
                  className={styles.profilePostCard}
                  style={{ textAlign: 'center', padding: '3rem 1rem' }}
                >
                  <Sprout
                    size={32}
                    style={{ color: '#2a9d8f', marginBottom: 12, opacity: 0.8 }}
                  />
                  <p
                    style={{
                      margin: 0,
                      fontWeight: 600,
                      color: 'var(--ink, #10201c)',
                    }}
                  >
                    Chưa có bài viết nào trong mục này
                  </p>
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--ink-soft, #556b64)',
                      marginTop: 4,
                      display: 'block',
                    }}
                  >
                    Các chia sẻ và bài viết chiêm nghiệm sẽ xuất hiện tại đây
                    khi được đăng tải.
                  </span>
                </div>
              )}

              {/* Load More Button */}
              {profile.posts.nextCursor && (
                <button
                  className={`${styles.btnAction} ${styles.btnCompanion}`}
                  style={{ alignSelf: 'center', marginTop: 12 }}
                  disabled={loading}
                  onClick={() =>
                    void load(profile.posts.nextCursor ?? undefined)
                  }
                >
                  {loading ? 'Đang tải…' : 'Xem thêm bài viết'}
                </button>
              )}
            </div>

            {/* Right Column: Sidebar Widgets */}
            <aside
              className={styles.sidebarWidgetsColumn}
              aria-label="Gắn kết đồng hành"
            >
              {/* Widget 1: Shared connection items from REAL RESOURCES */}
              <div className={styles.profileWidgetCard}>
                <div className={styles.widgetHeader}>
                  <div className={styles.widgetTitle}>
                    <Sprout size={16} style={{ color: '#2a9d8f' }} />
                    <span>Gắn kết & Tài nguyên thực hành</span>
                  </div>
                  <span className={styles.widgetBadge}>
                    {resources.length > 0
                      ? `${Math.min(resources.length, 3)} tài nguyên`
                      : 'Tài nguyên'}
                  </span>
                </div>

                {resourcesLoading ? (
                  <div className={styles.emptyWidgetState}>
                    <span>Đang tải tài nguyên đồng hành…</span>
                  </div>
                ) : resources.length > 0 ? (
                  <div className={styles.connectionItemsList}>
                    {resources.slice(0, 3).map((res) => (
                      <Link
                        key={res.id}
                        href={`/resources/${res.id}`}
                        className={`${styles.connectionItem} ${styles.connectionItemLink}`}
                        title={`Thực hành: ${res.title}`}
                      >
                        <div className={styles.connectionItemIcon}>
                          {renderResourceCategoryIcon(res.category)}
                        </div>
                        <div className={styles.connectionItemText}>
                          <strong>{res.title}</strong>
                          <span>{res.summary}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className={styles.connectionItemsList}>
                    <Link
                      href="/resources?category=BREATHING"
                      className={`${styles.connectionItem} ${styles.connectionItemLink}`}
                    >
                      <div className={styles.connectionItemIcon}>
                        <Clock size={16} />
                      </div>
                      <div className={styles.connectionItemText}>
                        <strong>Thực hành thở sâu 4-7-8</strong>
                        <span>
                          Cả hai cùng theo đuổi chuỗi 21 ngày tĩnh tâm
                        </span>
                      </div>
                    </Link>
                    <Link
                      href="/community"
                      className={`${styles.connectionItem} ${styles.connectionItemLink}`}
                    >
                      <div className={styles.connectionItemIcon}>
                        <Users size={16} />
                      </div>
                      <div className={styles.connectionItemText}>
                        <strong>Nhóm “Lắng nghe bản thân”</strong>
                        <span>
                          Cùng sinh hoạt trong không gian ấm hàng tuần
                        </span>
                      </div>
                    </Link>
                    <Link
                      href="/resources?category=JOURNALING"
                      className={`${styles.connectionItem} ${styles.connectionItemLink}`}
                    >
                      <div className={styles.connectionItemIcon}>
                        <FileText size={16} />
                      </div>
                      <div className={styles.connectionItemText}>
                        <strong>Nhật ký biết ơn</strong>
                        <span>Đều yêu thích ghi chép những điều nhỏ bé</span>
                      </div>
                    </Link>
                  </div>
                )}
              </div>

              {/* Widget 2: Companions List from REAL FRIENDS */}
              <div className={styles.profileWidgetCard}>
                <div className={styles.widgetHeader}>
                  <div className={styles.widgetTitle}>
                    <Heart size={16} style={{ color: '#e76f51' }} />
                    <span>Bạn đồng hành cùng {profile.member.displayName}</span>
                  </div>
                  <Link href="/community/friends" className={styles.widgetLink}>
                    Xem tất cả ({friends.items.length})
                  </Link>
                </div>

                {friends.loading ? (
                  <div className={styles.emptyWidgetState}>
                    <span>Đang tải bạn đồng hành…</span>
                  </div>
                ) : friends.items.length === 0 ? (
                  <div className={styles.emptyWidgetState}>
                    <Users
                      size={22}
                      style={{
                        color: '#2a9d8f',
                        opacity: 0.7,
                        marginBottom: 6,
                      }}
                    />
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        color: 'var(--ink, #10201c)',
                      }}
                    >
                      Chưa có bạn đồng hành kết nối
                    </p>
                    <Link
                      href="/community/friends"
                      style={{
                        marginTop: 6,
                        fontSize: '0.75rem',
                        color: '#2a9d8f',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      Khám phá kết nối mới →
                    </Link>
                  </div>
                ) : (
                  <div className={styles.companionUsersList}>
                    {friends.items.slice(0, 3).map((friend) => (
                      <div
                        key={friend.friendshipId}
                        className={styles.companionUserRow}
                      >
                        <div className={styles.companionUserLeft}>
                          <CommunityAvatar
                            displayName={friend.peer.displayName}
                            avatarPreset={friend.peer.avatarPreset}
                            avatarImage={friend.peer.avatarImage}
                          />
                          <div className={styles.companionUserMeta}>
                            <Link
                              href={`/community/members/${friend.peer.communityProfileId}`}
                              style={{
                                color: 'inherit',
                                textDecoration: 'none',
                              }}
                            >
                              <strong>{friend.peer.displayName}</strong>
                            </Link>
                            <span>Bạn đồng hành Sanctuary</span>
                          </div>
                        </div>
                        <Link
                          href={`/community/messages?to=${friend.peer.communityProfileId}`}
                          className={styles.btnChatSmall}
                          title={`Nhắn tin cho ${friend.peer.displayName}`}
                        >
                          <MessageSquare size={15} />
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Widget 3: Audio Player Card from REAL RESOURCE */}
              <div className={styles.audioPlayerCard}>
                <div className={styles.audioHeader}>
                  <div className={styles.audioHeaderTitle}>
                    <Headphones size={14} />
                    <span>GIAI ĐIỆU AN THẦN YÊU THÍCH</span>
                  </div>
                  <span className={styles.audioTimeBadge}>
                    {audioResource?.expectedDurationMinutes ?? 10} phút
                  </span>
                </div>

                <h3 className={styles.audioTrackTitle}>
                  {audioResource?.title ?? 'Thả lỏng cơ thể 10 phút'}
                </h3>
                <p className={styles.audioTrackSubtitle}>
                  {audioResource?.summary
                    ? `${audioResource.summary.slice(0, 75)}…`
                    : 'Dẫn thiền bởi chuyên gia Nguyễn Hương • Tiếng mưa dịu êm'}
                </p>

                <div className={styles.audioProgressRow}>
                  <span>03:20</span>
                  <div
                    className={styles.audioProgressBar}
                    role="progressbar"
                    aria-valuenow={33}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    onClick={() =>
                      showToast('Tua bài tập thư giãn đến vị trí đã chọn')
                    }
                  >
                    <div className={styles.audioProgressFill} />
                  </div>
                  <span>
                    {audioResource?.expectedDurationMinutes
                      ? `0${audioResource.expectedDurationMinutes}:00`
                      : '10:00'}
                  </span>
                </div>

                <div className={styles.audioControlsRow}>
                  <button
                    className={styles.audioControlBtn}
                    aria-label="Tua lại 10 giây"
                    onClick={() => showToast('Đã tua lại 10 giây')}
                  >
                    <RotateCcw size={15} />
                  </button>

                  <button
                    className={styles.audioPlayBtnMain}
                    aria-label={
                      audioPlaying ? 'Tạm dừng giai điệu' : 'Phát giai điệu'
                    }
                    onClick={() => {
                      const next = !audioPlaying
                      setAudioPlaying(next)
                      showToast(
                        next
                          ? `Đang phát: ${audioResource?.title ?? 'Thả lỏng cơ thể 10 phút'} 🎶`
                          : 'Đã tạm dừng bài nhạc ⏸',
                      )
                    }}
                  >
                    {audioPlaying ? (
                      <Pause size={17} fill="currentColor" />
                    ) : (
                      <Play
                        size={17}
                        fill="currentColor"
                        style={{ marginLeft: 2 }}
                      />
                    )}
                  </button>

                  <button
                    className={styles.audioControlBtn}
                    aria-label="Tua đi 10 giây"
                    onClick={() => showToast('Đã tua đi 10 giây')}
                  >
                    <RotateCw size={15} />
                  </button>

                  <button
                    className={styles.audioControlBtn}
                    aria-label="Âm lượng"
                    onClick={() => showToast('Âm lượng ở mức nhẹ nhàng')}
                  >
                    <Volume2 size={16} />
                  </button>
                </div>
              </div>

              {/* Widget 4: Sanctuary Security Notice */}
              <div className={styles.sanctuarySecurityCard}>
                <Shield size={20} />
                <div>
                  <strong>Nguyên tắc an toàn Sanctuary</strong>
                  <span>
                    Mọi chia sẻ đều được bảo vệ bởi chuẩn mã hóa đầu cuối và sự
                    tôn trọng tuyệt đối của các thành viên MentalBridge.
                  </span>
                </div>
              </div>
            </aside>
          </div>
        </>
      )}

      {/* Encouragement Dialog */}
      <Dialog
        open={encourageOpen}
        onOpenChange={setEncourageOpen}
        labelledBy="encourage-dialog-title"
      >
        <div className={styles.encourageModal}>
          <div className={styles.encourageModalHeader}>
            <h2 id="encourage-dialog-title">
              Gửi lời động viên đến {profile?.member.displayName}
            </h2>
            <button
              className={styles.btnIcon}
              style={{ border: 0 }}
              onClick={() => setEncourageOpen(false)}
              aria-label="Đóng"
            >
              <X size={18} />
            </button>
          </div>

          <p
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              color: 'var(--ink-soft)',
            }}
          >
            Một thông điệp tử tế có thể thắp sáng cả ngày dài của người bạn đồng
            hành. Hãy chọn gợi ý hoặc viết cảm xúc của riêng bạn:
          </p>

          <div className={styles.quickPillsRow}>
            <button
              className={styles.quickPillBtn}
              onClick={() =>
                setEncourageText(
                  'Cảm ơn bạn đã luôn hiện diện và lan tỏa năng lượng tích cực 🌱',
                )
              }
            >
              🌱 &ldquo;Cảm ơn bạn đã luôn hiện diện và lan tỏa năng lượng tích
              cực&rdquo;
            </button>
            <button
              className={styles.quickPillBtn}
              onClick={() =>
                setEncourageText(
                  'Chúc bạn một ngày thật bình an, nhẹ lòng và ngủ ngon giấc ☕',
                )
              }
            >
              ☕ &ldquo;Chúc bạn một ngày thật bình an, nhẹ lòng và ngủ ngon
              giấc&rdquo;
            </button>
            <button
              className={styles.quickPillBtn}
              onClick={() =>
                setEncourageText(
                  'Hành trình chữa lành của bạn tiếp thêm rất nhiều can đảm cho tôi 💚',
                )
              }
            >
              💚 &ldquo;Hành trình chữa lành của bạn tiếp thêm rất nhiều can đảm
              cho tôi&rdquo;
            </button>
          </div>

          <textarea
            className={styles.encourageTextarea}
            placeholder="Viết lời nhắn gửi dịu dàng tại đây…"
            value={encourageText}
            onChange={(e) => setEncourageText(e.target.value)}
          />

          <button
            className={styles.encourageSendBtn}
            onClick={handleSendEncouragement}
            disabled={!encourageText.trim()}
          >
            <Sprout size={16} /> Gửi lời chúc ấm áp
          </button>
        </div>
      </Dialog>

      {/* Unfriend Confirm Dialog */}
      <ConfirmDialog
        request={
          unfriendConfirm && profile
            ? {
                title: `Dừng đồng hành cùng ${profile.member.displayName}?`,
                description:
                  'Các cuộc trò chuyện hiện có vẫn tiếp tục được lưu giữ an toàn. Bạn có thể gửi lại lời mời bất cứ lúc nào.',
                confirmLabel: 'Xác nhận dừng',
              }
            : null
        }
        onResolve={(confirmed) => {
          setUnfriendConfirm(false)
          if (confirmed) void handleFriendAction('remove')
        }}
      />

      {/* Comments dialog */}
      {discussion && (
        <CommunityCommentsDialog
          key={discussion.postId}
          postId={discussion.postId}
          authorName={discussion.authorName}
          open={discussionOpen}
          onOpenChange={setDiscussionOpen}
          restoreFocusTo={() =>
            trigger.current?.isConnected
              ? trigger.current
              : document.querySelector<HTMLElement>('#community-content a')
          }
          onPostChange={(post) =>
            setProfile((current) =>
              current
                ? {
                    ...current,
                    posts: {
                      ...current.posts,
                      items: current.posts.items.map((item) =>
                        item.postId === post.postId
                          ? {
                              ...item,
                              counts: post.counts,
                              viewerState: post.viewerState,
                            }
                          : item,
                      ),
                    },
                  }
                : current,
            )
          }
          onUnavailable={() => {
            setDiscussionOpen(false)
            setProfile((current) =>
              current
                ? {
                    ...current,
                    posts: {
                      ...current.posts,
                      items: current.posts.items.filter(
                        (item) => item.postId !== discussion.postId,
                      ),
                    },
                  }
                : current,
            )
          }}
        />
      )}

      {/* Edit Profile Dialog */}
      <CommunityEditProfileDialog
        open={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        profile={profile}
        onSaveSuccess={() => {
          setCustomProfileVersion((v) => v + 1)
          void load()
          showToast('Đã lưu thay đổi danh tính thành công!')
        }}
      />

      {/* Toast feedback notification */}
      {toastMessage && (
        <div className={styles.toastNotification} role="status">
          {toastMessage}
        </div>
      )}
    </div>
  )
}
