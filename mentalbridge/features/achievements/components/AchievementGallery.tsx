'use client'

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import {
  Award,
  BookOpenText,
  Calendar,
  Check,
  Compass,
  Flower2,
  Heart,
  HeartHandshake,
  Leaf,
  LockKeyhole,
  PartyPopper,
  PenTool,
  RefreshCw,
  Route,
  Smile,
  Sparkles,
  Sprout,
  Sun,
  X,
} from 'lucide-react'

import { useMamPageTarget } from '@/features/mam/use-mam-target'
import { ApiError } from '@/lib/api/api-error'
import {
  getAchievements,
  type AchievementCollection,
  type AchievementItem,
} from '../api/browser-achievements'

import styles from './AchievementGallery.module.css'

// --------------------------------------------------------------------------
// Constants & Domain Configurations
// --------------------------------------------------------------------------

const domainMeta = {
  JOURNAL: {
    title: 'Viết Nhật ký',
    note: 'Nội dung trang viết không rời khỏi Nhật ký.',
    icon: BookOpenText,
    color: '#D9822B',
    bg: '#fef7ee',
  },
  EMOTION_CHECK_IN: {
    title: 'Check-in cảm xúc',
    note: 'Chỉ ngày đã lưu được dùng, không dùng cảm xúc hay ghi chú.',
    icon: HeartHandshake,
    color: '#D4577A',
    bg: '#fff2f6',
  },
  RESOURCE: {
    title: 'Tài nguyên đã duyệt',
    note: 'Hoàn thành và ngày thực hành được Content xác minh.',
    icon: Leaf,
    color: '#2A9466',
    bg: '#eef9f3',
  },
  JOURNEY: {
    title: 'Hành trình do bạn xác nhận',
    note: 'Không suy diễn từ thời gian vắng mặt hoặc quay lại.',
    icon: Route,
    color: '#7A64C8',
    bg: '#f5f2fd',
  },
} as const

const definitionIconMap: Record<string, typeof Sparkles> = {
  'journal.first-entry': PenTool,
  'journal.streak-3-days': Flower2,
  'journal.streak-7-days': Sun,
  'emotion.first-check-in': Smile,
  'emotion.streak-3-days': Heart,
  'emotion.streak-7-days': Sparkles,
  'resource.first-completion': Leaf,
  'resource.variety-3': Compass,
  'resource.practice-3-days': Flower2,
  'resource.practice-7-days': Award,
  'journey.new-chapter': Route,
}

const statusLabel = {
  EARNED: 'Đã ghi nhận',
  UNEARNED: 'Chưa ghi nhận',
  SOURCE_UNAVAILABLE: 'Chưa thể xác minh',
  GRANDFATHERED: 'Được giữ theo quy tắc trước',
  DEFERRED: 'Chưa mở trong phiên bản này',
} as const

const unitLabel = {
  EVENT: 'lần đã lưu',
  CONSECUTIVE_DAY: 'ngày liền nhau từng ghi nhận',
  DISTINCT_RESOURCE: 'tài nguyên khác nhau',
  PRACTICE_DAY: 'ngày thực hành khác nhau',
} as const

const LOCAL_STORAGE_SEEN_KEY = 'mentalbridge_seen_achievements'

type AchievementFilter = 'ALL' | 'EARNED' | 'UNEARNED'

function isEarned(item: AchievementItem) {
  return item.status === 'EARNED' || item.status === 'GRANDFATHERED'
}

function localDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 401)
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  return 'Bộ sưu tập chưa tải được. Dữ liệu cũ không được hiển thị như thông tin hiện tại.'
}

// --------------------------------------------------------------------------
// Petal Definition for Falling Petal Effects
// --------------------------------------------------------------------------

interface FallingPetal {
  id: number
  leftPercent: number
  size: number
  color: string
  duration: number
  delay: number
  swayDistance: number
  rotation: number
  isPollen: boolean
}

function generatePetals(count = 42): FallingPetal[] {
  const petalColors = [
    'rgba(255, 181, 152, 0.85)', // peach
    'rgba(255, 219, 206, 0.9)', // soft blossom
    'rgba(183, 238, 216, 0.75)', // mint
    'rgba(250, 155, 115, 0.8)', // warm apricot
    'rgba(255, 223, 100, 0.95)', // sparkling gold pollen
  ]

  return Array.from({ length: count }, (_, i) => {
    const isPollen = i % 4 === 0
    const size = isPollen ? (i % 3) + 4 : (i % 8) + 12
    const leftPercent = (i * 2.37) % 100
    const duration = 4.5 + ((i * 0.17) % 3.5)
    const delay = (i * 0.12) % 3.5
    const swayDistance = ((i * 13) % 80) - 40
    const rotation = (i * 47) % 360
    const color = petalColors[i % petalColors.length]
    return {
      id: i,
      leftPercent,
      size,
      color,
      duration,
      delay,
      swayDistance,
      rotation,
      isPollen,
    }
  })
}

// --------------------------------------------------------------------------
// Individual Milestone Card Component
// --------------------------------------------------------------------------

function AchievementCard({
  item,
  isNew,
  isHighlighted,
  onCardClick,
}: {
  item: AchievementItem
  isNew: boolean
  isHighlighted: boolean
  onCardClick: (item: AchievementItem) => void
}) {
  const meta = domainMeta[item.domain]
  const IconComponent = definitionIconMap[item.definitionId] ?? Sparkles
  const progress = item.progress
  const earned = isEarned(item)

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onCardClick(item)
    }
  }

  return (
    <article
      id={`achievement-card-${item.definitionId}`}
      className={`${styles.card} ${isHighlighted ? styles.cardHighlighted : ''}`}
      data-status={item.status}
      tabIndex={0}
      role="button"
      aria-label={`${item.title} - ${statusLabel[item.status]}`}
      onClick={() => onCardClick(item)}
      onKeyDown={handleKeyDown}
      style={
        {
          '--domain-color': meta.color,
          '--domain-bg': meta.bg,
        } as React.CSSProperties
      }
    >
      <div className={styles.cardTop}>
        <span className={styles.seal} aria-hidden="true">
          {earned ? <Check /> : <IconComponent />}
        </span>
        <div className={styles.statusPillGroup}>
          {isNew && <span className={styles.newBadgeInline}>Mới</span>}
          <span className={styles.status}>{statusLabel[item.status]}</span>
        </div>
      </div>

      <h3>{item.title}</h3>
      <p>{item.description}</p>

      {item.status === 'UNEARNED' && progress ? (
        <div
          className={styles.progressDotsRow}
          aria-label={`Tiến độ ${progress.current} trên ${progress.target}`}
        >
          {Array.from({ length: Math.min(progress.target, 12) }, (_, idx) => (
            <span
              key={idx}
              className={`${styles.progressDot} ${
                idx < progress.current ? styles.progressDotFilled : ''
              }`}
            />
          ))}
        </div>
      ) : null}

      {earned && item.unlockedAt ? (
        <small>Đã ghi nhận ngày {localDate(item.unlockedAt)}</small>
      ) : item.status === 'UNEARNED' && progress ? (
        <small>
          {progress.current}/{progress.target} {unitLabel[progress.unit]}
        </small>
      ) : item.status === 'DEFERRED' ? (
        <small>Mở khi bạn sẵn sàng</small>
      ) : item.status === 'SOURCE_UNAVAILABLE' ? (
        <small>
          Nguồn dữ liệu tạm thời chưa khả dụng. Không dùng tiến độ đã cũ để ước
          đoán.
        </small>
      ) : (
        <small>Theo nhịp điệu của bạn</small>
      )}
    </article>
  )
}

// --------------------------------------------------------------------------
// Celebration Modal Dialog Component
// --------------------------------------------------------------------------

function CelebrationModal({
  item,
  onClose,
  onViewGarden,
}: {
  item: AchievementItem
  onClose: () => void
  onViewGarden: (item: AchievementItem) => void
}) {
  const petals = useMemo(() => generatePetals(42), [])
  const meta = domainMeta[item.domain]
  const titleId = useId()
  const descId = useId()
  const primaryBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    primaryBtnRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div
        className={styles.modalBackdrop}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Floating Petals Canvas Layer */}
      <div className={styles.petalsContainer} aria-hidden="true">
        {petals.map((p) => (
          <div
            key={p.id}
            className={styles.petal}
            style={{
              left: `${p.leftPercent}vw`,
              width: `${p.size}px`,
              height: p.isPollen ? `${p.size}px` : `${p.size * 1.4}px`,
              backgroundColor: p.color,
              borderRadius: p.isPollen ? '50%' : '60% 0 60% 0',
              animation: `petalFall_${p.id} ${p.duration}s ease-in-out ${p.delay}s infinite`,
              boxShadow: p.isPollen
                ? '0 0 8px rgba(255,215,0,0.8)'
                : '0 2px 6px rgba(0,0,0,0.06)',
            }}
          />
        ))}
      </div>

      {/* Inline styles for keyframe trajectories */}
      <style>{`
        ${petals
          .map(
            (p) => `
          @keyframes petalFall_${p.id} {
            0% {
              transform: translateY(0) translateX(0) rotate(0deg);
              opacity: 0;
            }
            15% {
              opacity: 0.95;
            }
            85% {
              opacity: 0.85;
            }
            100% {
              transform: translateY(105vh) translateX(${p.swayDistance}px) rotate(${p.rotation}deg);
              opacity: 0;
            }
          }
        `,
          )
          .join('\n')}
      `}</style>

      {/* Modal Dialog Card */}
      <div className={styles.modalBox}>
        <button
          type="button"
          className={styles.closeModalBtn}
          onClick={onClose}
          aria-label="Đóng cửa sổ chúc mừng"
        >
          <X />
        </button>

        {/* Central Sacred Flower Badge (116px) */}
        <div className={styles.celebrationBadgeArea}>
          <div className={styles.auraPing} />
          <div className={styles.auraPulse} />
          <div className={styles.auraGradientRing} />
          <div className={styles.emblemBadge}>
            <div className={styles.emblemInnerRing}>
              <Flower2 className={styles.emblemIcon} />
            </div>
            <Sparkles className={styles.sparklePin} size={22} />
          </div>
        </div>

        <div className={styles.modalOverline}>
          <Sparkles size={14} />
          <span>Một Đóa Hoa Kiên Trì Đã Nở</span>
        </div>

        <h2 id={titleId} className={styles.modalTitle}>
          Một bông hoa vừa nở trong khu vườn của bạn
        </h2>

        <div className={styles.modalMilestoneTitle}>“{item.title}”</div>

        <p id={descId} className={styles.modalQuote}>
          Bạn đã làm được điều này hoàn toàn theo nhịp điệu của riêng mình.
          Không cần vội vã, mỗi khoảnh khắc lắng lại đều là một hạt mầm bình
          yên.
        </p>

        {item.unlockedAt && (
          <div className={styles.modalMetaBadge}>
            <Calendar size={14} />
            <span>
              Ghi nhận ngày {localDate(item.unlockedAt)} • Nhóm {meta.title}
            </span>
          </div>
        )}

        <div className={styles.modalActions}>
          <button
            ref={primaryBtnRef}
            type="button"
            className={styles.modalPrimaryBtn}
            onClick={onClose}
          >
            <span>Cảm ơn, mình đã nhận lấy</span>
            <Heart size={18} />
          </button>

          <button
            type="button"
            className={styles.modalSecondaryBtn}
            onClick={() => onViewGarden(item)}
          >
            <Flower2 size={16} />
            <span>Xem đóa hoa trong khu vườn</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------
// Main Achievement Gallery Page Component
// --------------------------------------------------------------------------

export default function AchievementGallery() {
  useMamPageTarget({ kind: 'achievements.page' })
  const [collection, setCollection] = useState<AchievementCollection | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<AchievementFilter>('ALL')

  // Seen achievements state
  const [seenKeys, setSeenKeys] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_SEEN_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) {
            return new Set(parsed)
          }
        }
      } catch {
        // Ignore localStorage errors
      }
    }
    return new Set()
  })
  const [activeCelebration, setActiveCelebration] =
    useState<AchievementItem | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const timezone = useMemo(
    () =>
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh',
    [],
  )

  const markSeen = useCallback((itemKey: string) => {
    setSeenKeys((prev) => {
      const next = new Set(prev)
      next.add(itemKey)
      try {
        localStorage.setItem(
          LOCAL_STORAGE_SEEN_KEY,
          JSON.stringify(Array.from(next)),
        )
      } catch {
        // Ignore localStorage write errors
      }
      return next
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getAchievements(timezone)
      setCollection(result.collection)
    } catch (requestError) {
      setCollection(null)
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [timezone])

  useEffect(() => {
    let active = true
    void getAchievements(timezone)
      .then((result) => {
        if (!active) return
        setCollection(result.collection)
      })
      .catch((requestError: unknown) => {
        if (!active) return
        setCollection(null)
        setError(errorMessage(requestError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [timezone])

  // Check for newly achieved milestones to trigger celebration popup
  useEffect(() => {
    if (!collection) return

    const isPreview =
      typeof window !== 'undefined' &&
      window.location.search.includes('previewCelebration=1')

    const earnedItems = collection.items.filter(
      (item) => isEarned(item) && item.unlockedAt,
    )

    const unacknowledged = earnedItems.filter(
      (item) => !seenKeys.has(`${item.definitionId}:${item.unlockedAt}`),
    )

    if (unacknowledged.length > 0) {
      const timer = setTimeout(() => {
        setActiveCelebration(unacknowledged[0])
      }, 900)
      return () => clearTimeout(timer)
    } else if (isPreview && earnedItems.length > 0 && !activeCelebration) {
      // Development preview mode
      const timer = setTimeout(() => {
        setActiveCelebration(earnedItems[0])
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [collection, seenKeys, activeCelebration])

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToastMessage(msg)
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null)
    }, 3200)
  }, [])

  const scrollToMilestone = useCallback((definitionId: string) => {
    setFilter('ALL')
    setTimeout(() => {
      const el = document.getElementById(`achievement-card-${definitionId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setHighlightedId(definitionId)
        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
        highlightTimerRef.current = setTimeout(() => {
          setHighlightedId(null)
        }, 2400)
      }
    }, 100)
  }, [])

  const handleCardClick = useCallback(
    (item: AchievementItem) => {
      if (isEarned(item)) {
        showToast(
          `Đóa hoa “${item.title}” đã nở rộ kiên cường trong khu vườn của bạn.`,
        )
      } else if (item.status === 'DEFERRED') {
        showToast('Dấu mốc này sẽ mở khi bạn sẵn sàng bước tiếp.')
      } else {
        showToast(
          'Không cần vội vã, mỗi khoảnh khắc lắng lại đều là một hạt mầm bình yên.',
        )
      }
    },
    [showToast],
  )

  const handleCloseCelebration = useCallback(() => {
    if (activeCelebration && activeCelebration.unlockedAt) {
      markSeen(
        `${activeCelebration.definitionId}:${activeCelebration.unlockedAt}`,
      )
    }
    setActiveCelebration(null)
  }, [activeCelebration, markSeen])

  const handleViewGardenFromModal = useCallback(
    (item: AchievementItem) => {
      handleCloseCelebration()
      scrollToMilestone(item.definitionId)
    },
    [handleCloseCelebration, scrollToMilestone],
  )

  if (loading) {
    return (
      <main
        className={styles.page}
        aria-busy="true"
        aria-label="Đang tải bộ sưu tập"
      >
        <div className={styles.loading}>
          <Leaf aria-hidden="true" />
          <p>Đang kiểm tra các dấu mốc đã lưu…</p>
        </div>
      </main>
    )
  }

  if (!collection) {
    return (
      <main className={styles.page}>
        <section className={styles.fullState} role="alert">
          <Leaf aria-hidden="true" />
          <h1>Chưa thể mở bộ sưu tập</h1>
          <p>{error}</p>
          <button type="button" onClick={() => void load()}>
            <RefreshCw aria-hidden="true" /> Thử lại
          </button>
        </section>
      </main>
    )
  }

  const earnedCount = collection.items.filter(isEarned).length
  const unearnedCount = collection.items.filter(
    ({ status }) => status === 'UNEARNED',
  ).length
  const filteredItems = collection.items.filter((item) =>
    filter === 'ALL'
      ? true
      : filter === 'EARNED'
        ? isEarned(item)
        : item.status === 'UNEARNED',
  )
  const filters: { value: AchievementFilter; label: string; count: number }[] =
    [
      { value: 'ALL', label: 'Tất cả', count: collection.items.length },
      { value: 'EARNED', label: 'Đã đạt', count: earnedCount },
      { value: 'UNEARNED', label: 'Chưa đạt', count: unearnedCount },
    ]
  const hasUnavailable = collection.sources.some(
    ({ availability }) => availability === 'UNAVAILABLE',
  )

  // Find latest earned milestone
  const earnedList = collection.items
    .filter((item) => isEarned(item) && item.unlockedAt)
    .sort(
      (a, b) =>
        new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime(),
    )
  const latestEarnedItem = earnedList.length > 0 ? earnedList[0] : null

  // Calculate garden level (1 to 5)
  const gardenLevel = Math.min(
    5,
    Math.max(
      1,
      Math.floor((earnedCount / Math.max(1, collection.items.length)) * 5) + 1,
    ),
  )

  // Progress ring dashoffset
  const ringCircumference = 251.32
  const progressRatio = earnedCount / Math.max(1, collection.items.length)
  const ringOffset = ringCircumference * (1 - progressRatio)

  return (
    <main className={styles.page}>
      {/* ------------------------------------------------------------------
          Hero Section
          ------------------------------------------------------------------ */}
      <header className={styles.hero} data-user-page-header>
        <div className={styles.heroAura1} aria-hidden="true" />
        <div className={styles.heroAura2} aria-hidden="true" />

        <div className={styles.heroContent}>
          <div className={styles.heroLeft} data-user-page-heading>
            <span className={styles.eyebrow} data-user-page-kicker>
              <LockKeyhole aria-hidden="true" /> Riêng tư cho bạn
            </span>
            <h1>Bộ sưu tập hành trình</h1>
            <p className={styles.heroDesc}>
              Những bước đã được lưu từ hoạt động của bạn. Không có xếp hạng hay
              áp lực duy trì chuỗi.
            </p>
            <p className={styles.heroQuote}>
              Mỗi hành động yêu thương bản thân, dù là một dòng nhật ký hay vài
              phút hít thở sâu, đều gieo xuống khu vườn tâm hồn bạn một mầm hoa
              kiên định.
            </p>

            {latestEarnedItem && (
              <div className={styles.latestCard}>
                <span className={styles.latestBadge}>
                  <Award size={15} /> Dấu mốc gần nhất:
                </span>
                <strong>{latestEarnedItem.title}</strong>
                <small>
                  Đã ghi nhận ngày {localDate(latestEarnedItem.unlockedAt!)}
                </small>
              </div>
            )}
          </div>

          {/* Garden Progress Ring Card */}
          <div
            className={styles.progressCard}
            aria-label={`${earnedCount} dấu mốc đã ghi nhận`}
          >
            <div className={styles.ringWrapper}>
              <svg className={styles.ringSvg} viewBox="0 0 100 100">
                <circle className={styles.ringBg} cx="50" cy="50" r="40" />
                <circle
                  className={styles.ringFill}
                  cx="50"
                  cy="50"
                  r="40"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                />
              </svg>
              <div className={styles.ringCenter}>
                <strong>
                  {earnedCount}/{collection.items.length}
                </strong>
                <span>Mốc đã nở</span>
              </div>
            </div>

            <div className={styles.progressInfo}>
              <div className={styles.levelText}>
                Mức độ đâm chồi: Cấp {gardenLevel}
              </div>
              <div className={styles.updateText}>
                Cập nhật {localDate(collection.calculatedAt)}
              </div>
              <button
                type="button"
                className={styles.celebrateBtn}
                onClick={() => {
                  if (latestEarnedItem) {
                    setActiveCelebration(latestEarnedItem)
                  } else if (collection.items.length > 0) {
                    setActiveCelebration(collection.items[0])
                  }
                }}
              >
                <PartyPopper size={14} />
                <span>Xem đóa hoa vừa nở</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------
          Interactive Blooming Garden Landscape Strip ("Dải Đất Đang Nở Hoa")
          ------------------------------------------------------------------ */}
      <section
        className={styles.gardenStrip}
        aria-label="Khu vườn đang nở hoa của bạn"
      >
        <div className={styles.gardenHeader}>
          <div>
            <div className={styles.gardenHeaderTitle}>Dải Đất Đang Nở Hoa</div>
            <p className={styles.gardenHeaderSubtitle}>
              Chạm vào từng đóa hoa để lắng nghe hành trình bạn đã kiên trì bước
              qua
            </p>
          </div>
          <div className={styles.gardenHeaderStatus}>
            <span className={styles.pulseDot} aria-hidden="true" />
            <span>Sinh thái đang phát triển</span>
          </div>
        </div>

        <div className={styles.gardenLandscape}>
          <div className={styles.groundLine} aria-hidden="true" />

          {collection.items.map((item) => {
            const meta = domainMeta[item.domain]
            const earned = isEarned(item)
            const isUnseen =
              earned &&
              item.unlockedAt &&
              !seenKeys.has(`${item.definitionId}:${item.unlockedAt}`)
            const IconComponent =
              definitionIconMap[item.definitionId] ?? Sparkles

            return (
              <button
                key={`flower-${item.definitionId}`}
                type="button"
                className={styles.flowerItem}
                data-status={item.status}
                title={`${item.title} (${statusLabel[item.status]})`}
                onClick={() => scrollToMilestone(item.definitionId)}
                style={
                  {
                    '--domain-color': meta.color,
                    '--domain-bg': meta.bg,
                  } as React.CSSProperties
                }
              >
                <div className={styles.flowerBadge} data-status={item.status}>
                  {isUnseen && <span className={styles.newBadgePill}>Mới</span>}
                  {earned ? (
                    <Flower2 />
                  ) : item.status === 'DEFERRED' ? (
                    <Sprout />
                  ) : (
                    <IconComponent />
                  )}
                </div>
                <div className={styles.flowerStem} data-status={item.status} />
                <span className={styles.flowerLabel}>{item.title}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ------------------------------------------------------------------
          Filter Tabs (Thanh tab dạng pill)
          ------------------------------------------------------------------ */}
      <section className={styles.filterBar} aria-label="Lọc bộ sưu tập">
        <div
          className={styles.filterButtons}
          role="tablist"
          aria-label="Trạng thái thành tựu"
        >
          {filters.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              id={`tab-${option.value}`}
              aria-controls={`panel-${option.value}`}
              aria-selected={filter === option.value}
              className={styles.filterButton}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
              <span className={styles.filterCount}>{option.count}</span>
            </button>
          ))}
        </div>
        <div className={styles.filterMeta}>
          <p role="status" aria-live="polite" aria-atomic="true">
            Hiển thị {filteredItems.length}/{collection.items.length} dấu mốc
          </p>
          {earnedCount + unearnedCount < collection.items.length && (
            <small>
              Các mục chưa xác minh hoặc chưa mở nằm trong “Tất cả”.
            </small>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------
          Filtered Empty State
          ------------------------------------------------------------------ */}
      {filteredItems.length === 0 && (
        <section className={styles.filteredEmpty}>
          <Leaf aria-hidden="true" />
          <h2>
            {filter === 'EARNED'
              ? 'Chưa có thành tựu đã đạt'
              : filter === 'UNEARNED'
                ? 'Không có thành tựu chưa đạt trong bộ lọc này'
                : 'Bộ sưu tập chưa có dấu mốc'}
          </h2>
          <p>
            {filter === 'EARNED'
              ? 'Những dấu mốc được ghi nhận sẽ xuất hiện ở đây, theo nhịp của bạn.'
              : filter === 'UNEARNED'
                ? 'Bạn có thể xem toàn bộ bộ sưu tập, gồm cả những mục chưa thể xác minh hoặc chưa mở.'
                : 'Những dấu mốc từ hoạt động của bạn sẽ xuất hiện ở đây khi được ghi nhận.'}
          </p>
          {filter !== 'ALL' && (
            <button type="button" onClick={() => setFilter('ALL')}>
              Xem tất cả thành tựu
            </button>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------------
          Categorized Domain Groups & Milestone Cards
          ------------------------------------------------------------------ */}
      <div className={styles.domains} id={`panel-${filter}`} role="tabpanel">
        {(Object.keys(domainMeta) as Array<keyof typeof domainMeta>).map(
          (domain) => {
            const meta = domainMeta[domain]
            const DomainIcon = meta.icon
            const items = filteredItems.filter((item) => item.domain === domain)
            if (items.length === 0) return null

            const allDomainItems = collection.items.filter(
              (i) => i.domain === domain,
            )
            const earnedInDomain = allDomainItems.filter(isEarned).length
            const eligibleTotalInDomain = allDomainItems.filter(
              (i) => i.status !== 'DEFERRED',
            ).length

            return (
              <section
                className={styles.domain}
                key={domain}
                aria-labelledby={`domain-${domain}`}
                style={
                  {
                    '--domain-color': meta.color,
                    '--domain-bg': meta.bg,
                  } as React.CSSProperties
                }
              >
                <header className={styles.domainHeader}>
                  <div className={styles.domainHeaderLeft}>
                    <div className={styles.domainIconBox} aria-hidden="true">
                      <DomainIcon />
                    </div>
                    <div className={styles.domainTitleGroup}>
                      <h2 id={`domain-${domain}`}>{meta.title}</h2>
                      <p>{meta.note}</p>
                    </div>
                  </div>
                  <span className={styles.domainCountBadge}>
                    {earnedInDomain} / {eligibleTotalInDomain} Đạt
                  </span>
                </header>

                <div className={styles.cards}>
                  {items.map((item) => {
                    const isNew =
                      isEarned(item) &&
                      Boolean(item.unlockedAt) &&
                      !seenKeys.has(`${item.definitionId}:${item.unlockedAt}`)

                    return (
                      <AchievementCard
                        key={item.definitionId}
                        item={item}
                        isNew={Boolean(isNew)}
                        isHighlighted={highlightedId === item.definitionId}
                        onCardClick={handleCardClick}
                      />
                    )
                  })}
                </div>

                {items.some(({ status }) => status === 'SOURCE_UNAVAILABLE') ? (
                  <button
                    className={styles.retryBtn}
                    type="button"
                    onClick={() => void load()}
                  >
                    <RefreshCw aria-hidden="true" /> Thử lại kết nối
                  </button>
                ) : null}
              </section>
            )
          },
        )}
      </div>

      {/* ------------------------------------------------------------------
          Privacy Disclosure Section
          ------------------------------------------------------------------ */}
      <aside className={styles.disclosure}>
        <LockKeyhole aria-hidden="true" />
        <div>
          <h2>Cách dữ liệu được ghi nhận</h2>
          <p>
            MentalBridge chỉ dùng sự kiện và ngày tối thiểu cần thiết. Nội dung
            Nhật ký, ghi chú cảm xúc, PHQ-9/GAD-7 và dữ liệu tham vấn không được
            dùng cho bộ sưu tập này.
          </p>
          {hasUnavailable ? (
            <strong>
              Một số nguồn chưa thể xác minh; tiến độ từ các nguồn đó đang được
              ẩn.
            </strong>
          ) : null}
        </div>
      </aside>

      {/* ------------------------------------------------------------------
          Achievement Celebration Modal
          ------------------------------------------------------------------ */}
      {activeCelebration && (
        <CelebrationModal
          item={activeCelebration}
          onClose={handleCloseCelebration}
          onViewGarden={handleViewGardenFromModal}
        />
      )}

      {/* ------------------------------------------------------------------
          Toast Feedback Notification
          ------------------------------------------------------------------ */}
      {toastMessage && (
        <div className={styles.toastContainer} role="status" aria-live="polite">
          <Sparkles size={16} />
          <span>{toastMessage}</span>
        </div>
      )}
    </main>
  )
}
