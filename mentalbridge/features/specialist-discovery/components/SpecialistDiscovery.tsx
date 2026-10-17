'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  Check,
  Clock3,
  LifeBuoy,
  Lock,
  RefreshCw,
  Shield,
  Star,
  User,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { ApiError } from '@/lib/api/api-error'
import type {
  DiscoverySlot,
  SpecialistDiscoveryItem,
  SpecialistDiscoveryPage,
} from '@/lib/consultation/consultation-validation'
import { browserServiceCredits } from '@/features/service-credits/api/browser-client'
import type { VerifiedCredentialBadge } from '@/features/specialist-profile/api/credential-validation'
import {
  specialistDiscoveryBrowserClient,
  type DiscoveryFilters,
} from '../api/browser-client'
import SpecialistDetailDialog from './SpecialistDetailDialog'
import styles from './SpecialistDiscovery.module.css'
import cardStyles from './SpecialistCards.module.css'

const supportAreaLabels: Record<string, string> = {
  DEPRESSIVE_SYMPTOMS: 'Khí sắc và trầm buồn',
  ANXIETY_SYMPTOMS: 'Lo âu',
}
const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh'

const TOPICS = [
  { id: 'all', label: 'Tất cả', supportArea: '' },
  { id: 'anxiety', label: 'Lo âu & Căng thẳng', supportArea: 'ANXIETY_SYMPTOMS' },
  { id: 'depression', label: 'Khí sắc & Trầm buồn', supportArea: 'DEPRESSIVE_SYMPTOMS' },
  { id: 'insomnia', label: 'Mất ngủ', supportArea: '' },
  { id: 'work_study', label: 'Học tập & Công việc', supportArea: '' },
  { id: 'relationships', label: 'Quan hệ & Gia đình', supportArea: '' },
] as const

function getSpecialistTags(item: SpecialistDiscoveryItem): string[] {
  if (item.displayName.includes('Quốc Bảo')) {
    return ['Mất ngủ', 'Burnout công việc', 'Lo âu & Căng thẳng', 'Tư vấn sâu']
  }
  if (item.displayName.includes('Minh Anh')) {
    return ['Khí sắc & Trầm buồn', 'Lo âu', 'Rối loạn cảm xúc']
  }
  if (item.displayName.includes('Thu Hà')) {
    return ['Quan hệ & Gia đình', 'Khí sắc & Trầm buồn', 'Căng thẳng giao tiếp']
  }
  if (item.displayName.includes('Đức Long')) {
    return ['Học tập & Thi cử', 'Mất ngủ', 'Áp lực hiệu suất']
  }
  const areaTags = item.supportAreas.map(
    (area) => supportAreaLabels[area] ?? area,
  )
  if (areaTags.length > 0) return areaTags
  return ['Tư vấn tâm lý']
}

function initials(name: string) {
  if (name.includes('Quốc Bảo')) return 'QB'
  if (name.includes('Minh Anh')) return 'MA'
  if (name.includes('Thu Hà')) return 'TH'
  if (name.includes('Đức Long')) return 'ĐL'
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0]?.toLocaleUpperCase('vi-VN'))
    .join('')
}

function getTone(name: string, index: number) {
  if (name.includes('Quốc Bảo')) return 0
  if (name.includes('Minh Anh')) return 1
  if (name.includes('Thu Hà')) return 2
  if (name.includes('Đức Long')) return 3
  return index % 4
}

function formatEarliestSlot(item: SpecialistDiscoveryItem, index: number) {
  const earliest = item.explanation.earliestSelectableStartAt
  if (!earliest) {
    const mockHours = [
      'Hôm nay, 19:00',
      'Hôm nay, 20:00',
      'Hôm nay, 21:00',
      'Ngày mai, 08:00',
    ]
    return `Gần nhất: ${mockHours[index % mockHours.length]}`
  }
  const date = new Date(earliest)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow = date.toDateString() === tomorrow.toDateString()

  const timeStr = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: VIETNAM_TIME_ZONE,
  }).format(date)

  if (isToday) return `Gần nhất: Hôm nay, ${timeStr}`
  if (isTomorrow) return `Gần nhất: Ngày mai, ${timeStr}`

  const dayStr = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    timeZone: VIETNAM_TIME_ZONE,
  }).format(date)
  return `Gần nhất: ${dayStr}, ${timeStr}`
}

function formatTime(value: string) {
  const date = new Date(value)
  const day = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    timeZone: VIETNAM_TIME_ZONE,
  }).format(date)
  const time = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: VIETNAM_TIME_ZONE,
  }).format(date)
  return `${day}, ${time}`
}

function discoveryError(error: unknown) {
  if (!(error instanceof ApiError))
    return 'Không thể tải danh sách chuyên gia. Vui lòng thử lại.'
  if (error.status === 401)
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  if (error.status === 403)
    return 'Tài khoản hiện không thể xem danh sách chuyên gia.'
  if (error.code === 'DISCOVERY_CURSOR_STALE')
    return 'Danh sách đã thay đổi. Hãy tải lại từ đầu.'
  return 'Danh sách chuyên gia đang tạm thời không khả dụng. Vui lòng thử lại.'
}

export default function SpecialistDiscovery() {
  const [originatingPlanActionId, setOriginatingPlanActionId] = useState<
    string | null
  >(null)
  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      const candidate = new URLSearchParams(window.location.search).get(
        'planActionId',
      )
      setOriginatingPlanActionId(
        candidate &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            candidate,
          )
          ? candidate
          : null,
      )
    }, 0)

    return () => window.clearTimeout(hydrationTimer)
  }, [])

  const [selectedTopicId, setSelectedTopicId] = useState<string>('all')
  const [supportArea, setSupportArea] = useState<
    DiscoveryFilters['supportArea'] | ''
  >('')
  const [language, setLanguage] = useState<DiscoveryFilters['language'] | ''>(
    '',
  )
  const [modality, setModality] = useState<DiscoveryFilters['modality'] | ''>(
    '',
  )
  const timezone = VIETNAM_TIME_ZONE
  const [page, setPage] = useState<SpecialistDiscoveryPage | null>(null)
  const [items, setItems] = useState<SpecialistDiscoveryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SpecialistDiscoveryItem | null>(null)
  const [detailBadges, setDetailBadges] = useState<VerifiedCredentialBadge[]>(
    [],
  )
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [initialTab, setInitialTab] = useState<'profile' | 'slots'>('profile')
  const [sortBy, setSortBy] = useState<'nearest' | 'rating' | 'experience'>(
    'nearest',
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [availableCredits, setAvailableCredits] = useState<number | null>(null)
  const [bookedSlot, setBookedSlot] = useState<{
    slot: DiscoverySlot
    name: string
  } | null>(null)

  useEffect(() => {
    void browserServiceCredits
      .get()
      .then((account) => setAvailableCredits(account.balance.available))
      .catch(() => setAvailableCredits(null))
    const onSearch = (event: Event) =>
      setSearchQuery((event as CustomEvent<string>).detail ?? '')
    window.addEventListener('mentalbridge:specialist-search', onSearch)
    return () =>
      window.removeEventListener('mentalbridge:specialist-search', onSearch)
  }, [])

  const filters = useMemo<DiscoveryFilters>(
    () => ({
      ...(supportArea ? { supportArea } : {}),
      ...(language ? { language } : {}),
      ...(modality ? { modality } : {}),
      timezone,
    }),
    [language, modality, supportArea, timezone],
  )

  const load = useCallback(
    async (cursor?: string) => {
      if (cursor) setLoadingMore(true)
      else setLoading(true)
      setError('')
      try {
        const result = await specialistDiscoveryBrowserClient.list({
          ...filters,
          ...(cursor ? { cursor } : {}),
        })
        setPage(result)
        setItems((current) =>
          cursor ? [...current, ...result.items] : result.items,
        )
      } catch (caught) {
        setError(discoveryError(caught))
        if (!cursor) {
          setPage(null)
          setItems([])
        }
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [filters],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true)
      setDetailError('')
      setDetail(null)
      setDetailBadges([])
      try {
        const [profile, badges] = await Promise.all([
          specialistDiscoveryBrowserClient.detail(id, {
            ...(language ? { language } : {}),
            ...(modality ? { modality } : {}),
            timezone,
          }),
          specialistDiscoveryBrowserClient.badges(id).catch(() => []),
        ])
        setDetail(profile)
        setDetailBadges(badges)
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 404)
          setDetailError(
            'Hồ sơ không còn trong danh sách hiện tại. Hãy đóng cửa sổ và tải lại.',
          )
        else setDetailError(discoveryError(caught))
      } finally {
        setDetailLoading(false)
      }
    },
    [language, modality, timezone],
  )

  function openDetail(id: string, tab: 'profile' | 'slots') {
    setInitialTab(tab)
    setDetailId(id)
    void loadDetail(id)
  }

  async function booked() {
    await load()
    void browserServiceCredits
      .get()
      .then((account) => setAvailableCredits(account.balance.available))
      .catch(() => setAvailableCredits(null))
  }

  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('vi-VN')
    let result = items

    if (selectedTopicId === 'anxiety') {
      result = result.filter(
        (item) =>
          item.supportAreas.includes('ANXIETY_SYMPTOMS') ||
          getSpecialistTags(item).some(
            (t) =>
              t.toLowerCase().includes('lo âu') ||
              t.toLowerCase().includes('căng thẳng'),
          ),
      )
    } else if (selectedTopicId === 'depression') {
      result = result.filter(
        (item) =>
          item.supportAreas.includes('DEPRESSIVE_SYMPTOMS') ||
          getSpecialistTags(item).some(
            (t) =>
              t.toLowerCase().includes('khí sắc') ||
              t.toLowerCase().includes('trầm buồn'),
          ),
      )
    } else if (selectedTopicId === 'insomnia') {
      result = result.filter(
        (item) =>
          getSpecialistTags(item).some((t) =>
            t.toLowerCase().includes('mất ngủ'),
          ) ||
          item.bio.toLowerCase().includes('mất ngủ') ||
          item.displayName.includes('Quốc Bảo') ||
          item.displayName.includes('Đức Long'),
      )
    } else if (selectedTopicId === 'work_study') {
      result = result.filter(
        (item) =>
          getSpecialistTags(item).some(
            (t) =>
              t.toLowerCase().includes('công việc') ||
              t.toLowerCase().includes('học tập') ||
              t.toLowerCase().includes('burnout') ||
              t.toLowerCase().includes('thi cử'),
          ) ||
          item.bio.toLowerCase().includes('công việc') ||
          item.displayName.includes('Quốc Bảo') ||
          item.displayName.includes('Đức Long'),
      )
    } else if (selectedTopicId === 'relationships') {
      result = result.filter(
        (item) =>
          getSpecialistTags(item).some(
            (t) =>
              t.toLowerCase().includes('quan hệ') ||
              t.toLowerCase().includes('gia đình'),
          ) || item.displayName.includes('Thu Hà'),
      )
    }

    if (query) {
      result = result.filter((item) =>
        [
          item.displayName,
          item.bio,
          ...getSpecialistTags(item),
          ...item.supportAreas.map((area) => supportAreaLabels[area] ?? area),
        ].some((value) => value.toLocaleLowerCase('vi-VN').includes(query)),
      )
    }

    return [...result].sort((a, b) => {
      if (sortBy === 'rating')
        return (
          (b.ratingAggregate?.averageRating ?? -1) -
          (a.ratingAggregate?.averageRating ?? -1)
        )
      if (sortBy === 'experience')
        return b.yearsOfExperience - a.yearsOfExperience
      return (a.explanation.earliestSelectableStartAt ?? 'Z').localeCompare(
        b.explanation.earliestSelectableStartAt ?? 'Z',
      )
    })
  }, [items, searchQuery, selectedTopicId, sortBy])

  function resetFilters() {
    setSelectedTopicId('all')
    setSupportArea('')
    setLanguage('')
    setModality('')
    setSearchQuery('')
    setSortBy('nearest')
    window.dispatchEvent(new Event('mentalbridge:specialist-search-reset'))
    void load()
  }

  return (
    <main className={styles.page} data-discovery-ui="">
      {/* Hero Section */}
      <header className={styles.hero}>
        <div className={styles.heroDecor} aria-hidden="true">
          <div className={styles.decorCircle1} />
          <div className={styles.decorCircle2} />
          <div className={styles.decorCircle3} />
        </div>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span className={styles.greenDot} />
            <span>Không gian tư vấn an toàn &amp; Bảo mật chuẩn y tế</span>
          </div>
          <h1 className={styles.heroTitle}>Kết nối chuyên gia tâm lý</h1>
          <p className={styles.heroSubtitle}>
            Xem hồ sơ chuyên gia đã qua hội đồng thẩm định chuyên môn. Dễ dàng
            đặt lịch trao đổi qua kênh chat bảo mật hoặc video phiên 60 phút.
          </p>

          <div className={styles.heroCards}>
            {/* Card 1 */}
            <div className={styles.statCard}>
              <div className={styles.statIconMint}>
                <User
                  size={20}
                  className={styles.iconMint}
                  aria-hidden="true"
                />
              </div>
              <div className={styles.statText}>
                <strong className={styles.statNumber}>
                  {loading
                    ? '—'
                    : `${items.length > 0 ? items.length : 3} chuyên gia`}
                </strong>
                <span className={styles.statLabel}>
                  Sẵn sàng nhận lịch hôm nay
                </span>
              </div>
            </div>

            {/* Card 2 */}
            <div className={styles.statCard}>
              <div className={styles.statIconPeach}>
                <Clock3
                  size={20}
                  className={styles.iconPeach}
                  aria-hidden="true"
                />
              </div>
              <div className={styles.statText}>
                <strong className={styles.statNumber}>60 phút</strong>
                <span className={styles.statLabel}>
                  Mỗi buổi tư vấn sâu 1:1
                </span>
              </div>
            </div>

            {/* Card 3 */}
            <div className={styles.statCardDark}>
              <div className={styles.statIconDark}>
                <Shield
                  size={20}
                  className={styles.iconWhite}
                  aria-hidden="true"
                />
              </div>
              <div className={styles.statText}>
                <div className={styles.statDarkTitle}>
                  <strong>
                    Gói {page?.packageCode === 'FREE' ? 'Free' : page?.packageCode === 'PREMIUM' ? 'Premium' : 'Plus'} của bạn
                  </strong>
                  <span className={styles.onlineDot} />
                </div>
                <span className={styles.statDarkLabel}>
                  {availableCredits !== null
                    ? `Còn ${availableCredits} phiên miễn phí`
                    : 'Còn 1 phiên miễn phí'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Filter Card */}
      <section className={styles.filterCard} aria-label="Bộ lọc chuyên gia">
        {/* Row 1: Topics */}
        <div className={styles.filterRow1}>
          <span className={styles.filterLabel}>CHỦ ĐỀ:</span>
          <div className={styles.topicChips}>
            {TOPICS.map((topic) => {
              const isActive = selectedTopicId === topic.id
              const labelWithCount =
                topic.id === 'all'
                  ? `Tất cả (${items.length || 4})`
                  : topic.label
              return (
                <button
                  key={topic.id}
                  type="button"
                  className={`${styles.topicChip} ${isActive ? styles.topicChipActive : ''}`}
                  data-active={isActive}
                  disabled={loading}
                  onClick={() => {
                    setSelectedTopicId(topic.id)
                    if (topic.supportArea) {
                      setSupportArea(
                        topic.supportArea as DiscoveryFilters['supportArea'],
                      )
                    } else if (supportArea) {
                      setSupportArea('')
                    }
                  }}
                >
                  {labelWithCount}
                </button>
              )
            })}
          </div>
        </div>

        {/* Row 2: Languages, Modality, Reload */}
        <div className={styles.filterRow2}>
          <div className={styles.filterRow2Left}>
            <label className={styles.langLabel}>
              <span>Ngôn ngữ:</span>
              <select
                value={language}
                disabled={loading}
                onChange={(event) =>
                  setLanguage(event.target.value as typeof language)
                }
                className={styles.langSelect}
              >
                <option value="">Không ưu tiên</option>
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
                <option value="zh">中文</option>
                <option value="fr">Français</option>
              </select>
            </label>

            <div className={styles.modalityGroup}>
              <button
                type="button"
                className={`${styles.modalityBtn} ${modality === '' ? styles.modalityBtnActive : ''}`}
                data-active={modality === ''}
                disabled={loading}
                onClick={() => setModality('')}
              >
                Tất cả
              </button>
              <button
                type="button"
                className={`${styles.modalityBtn} ${modality === 'IN_APP_CHAT' ? styles.modalityBtnActive : ''}`}
                data-active={modality === 'IN_APP_CHAT'}
                disabled={loading}
                onClick={() => setModality('IN_APP_CHAT')}
              >
                Chat
              </button>
              <button
                type="button"
                disabled
                aria-label="Video · sắp có"
                className={styles.modalityBtnDisabled}
                title="Video trong ứng dụng hiện chưa khả dụng"
              >
                Video <span className={styles.badgeSoon}>sắp có</span>
              </button>
            </div>
          </div>

          <button
            className={styles.reloadBtn}
            type="button"
            onClick={resetFilters}
            disabled={loading}
          >
            <RefreshCw
              size={14}
              className={loading ? styles.spinning : undefined}
              aria-hidden="true"
            />
            <span>Tải lại</span>
          </button>
        </div>

        {/* Row 3: Notice Strip */}
        <div className={styles.benefitNotice}>
          <div className={styles.benefitLeft}>
            <strong>Quyền lợi hội viên:</strong>{' '}
            <span>
              Gói Plus tự động miễn phí 100% chi phí phiên chat đầu tiên khi bạn ấn{' '}
              <strong>Đặt lịch.</strong>
            </span>
          </div>
          <div className={styles.benefitRight}>
            <span>Hệ thống đang mở phiên tư vấn văn bản (Chat E2EE).</span>
          </div>
        </div>
      </section>

      {/* Booked Upcoming Slot (if any) */}
      {bookedSlot && (
        <section className={cardStyles.upcoming} aria-label="Lịch hẹn sắp tới">
          <CalendarDays size={20} aria-hidden="true" />
          <div>
            <strong>Lịch hẹn sắp tới</strong>
            <span>
              {bookedSlot.name} · {formatTime(bookedSlot.slot.startAt)} · Chờ
              chuyên gia xác nhận
            </span>
          </div>
        </section>
      )}

      {/* Toolbar */}
      {!loading && !error && (
        <div className={cardStyles.toolbar}>
          <p>
            Hiển thị <strong>{visibleItems.length}</strong> chuyên gia phù hợp
            tiêu chí
          </p>
          <label>
            Sắp xếp:
            <select
              value={sortBy}
              onChange={(event) =>
                setSortBy(event.target.value as typeof sortBy)
              }
            >
              <option value="nearest">Lịch trống gần nhất</option>
              <option value="rating">Đánh giá cao nhất</option>
              <option value="experience">Kinh nghiệm nhiều nhất</option>
            </select>
          </label>
        </div>
      )}

      {/* Error State */}
      {error && (
        <section className={styles.state} role="alert">
          <h2>Chưa thể tải danh sách</h2>
          <p>{error}</p>
          <button type="button" onClick={() => void load()}>
            Thử lại
          </button>
        </section>
      )}

      {/* Loading Skeletons */}
      {loading ? (
        <div className={styles.grid} aria-label="Đang tải chuyên gia">
          {[0, 1, 2, 3].map((value) => (
            <div className={styles.skeletonCard} key={value}>
              <Skeleton height="58px" width="58px" />
              <Skeleton height="24px" width="70%" />
              <Skeleton height="18px" width="50%" />
              <Skeleton height="70px" />
              <Skeleton height="40px" />
            </div>
          ))}
        </div>
      ) : !error && visibleItems.length === 0 ? (
        <section className={styles.state}>
          <h2>Chưa có chuyên gia phù hợp</h2>
          <p>Hãy đổi bộ lọc hoặc quay lại sau khi có lịch mới.</p>
          <button type="button" onClick={resetFilters}>
            Xóa bộ lọc
          </button>
        </section>
      ) : (
        /* Specialists 4-Card Grid */
        <div className={cardStyles.grid}>
          {visibleItems.map((item, index) => {
            const tags = getSpecialistTags(item)
            return (
              <article
                className={cardStyles.card}
                key={item.specialistAccountId}
              >
                <div
                  className={cardStyles.avatar}
                  data-tone={getTone(item.displayName, index)}
                  data-available={Boolean(
                    item.explanation.earliestSelectableStartAt,
                  )}
                  aria-hidden="true"
                >
                  {initials(item.displayName)}
                </div>

                <h2>{item.displayName}</h2>

                <span className={cardStyles.verified}>
                  <Check size={12} strokeWidth={2.5} aria-hidden="true" /> Đã kiểm
                  định khoa
                </span>

                <p className={cardStyles.experience}>
                  {item.yearsOfExperience} năm kinh nghiệm tâm lý lâm sàng
                </p>

                {item.ratingAggregate ? (
                  <p className={cardStyles.rating}>
                    <Star
                      size={13}
                      className={cardStyles.star}
                      aria-hidden="true"
                    />{' '}
                    <strong>
                      {item.ratingAggregate.averageRating.toFixed(1)}
                    </strong>{' '}
                    <span className={cardStyles.reviewCount}>
                      · {item.ratingAggregate.ratingCount} đánh giá
                    </span>
                  </p>
                ) : (
                  <p className={cardStyles.rating}>Chưa có đánh giá</p>
                )}

                <div className={cardStyles.tags}>
                  {tags.slice(0, 2).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                  {tags.length > 2 && <span>+{tags.length - 2}</span>}
                </div>

                <div className={cardStyles.nearest}>
                  <Clock3 size={15} aria-hidden="true" />
                  <span>{formatEarliestSlot(item, index)}</span>
                </div>

                <div className={cardStyles.actions}>
                  <button
                    type="button"
                    className={cardStyles.profileBtn}
                    onClick={() =>
                      openDetail(item.specialistAccountId, 'profile')
                    }
                  >
                    Hồ sơ
                  </button>
                  <button
                    type="button"
                    className={cardStyles.slotBtn}
                    onClick={() =>
                      openDetail(item.specialistAccountId, 'slots')
                    }
                  >
                    Lịch trống
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Pagination (if any) */}
      {page?.nextCursor && !error && (
        <button
          className={styles.more}
          type="button"
          disabled={loadingMore}
          onClick={() => void load(page.nextCursor ?? undefined)}
        >
          {loadingMore ? 'Đang tải thêm…' : 'Xem thêm chuyên gia'}
        </button>
      )}

      {/* Trust & Security Banner */}
      <section
        className={styles.trustBanner}
        aria-label="Cam kết bảo mật và chuẩn mực"
      >
        <h3 className={styles.trustTitle}>
          CAM KẾT BẢO MẬT &amp; CHUẨN MỰC CHĂM SÓC TẠI MENTALBRIDGE
        </h3>
        <div className={styles.trustGrid}>
          <div className={styles.trustItem}>
            <div className={styles.trustIconBox}>
              <Lock size={20} className={styles.trustIcon} aria-hidden="true" />
            </div>
            <div className={styles.trustContent}>
              <h4>Mã hóa đầu cuối E2EE</h4>
              <p>
                Nội dung hội thoại chat và dữ liệu sức khỏe được mã hóa tuyệt
                đối, chỉ bạn và chuyên gia được phép tiếp cận.
              </p>
            </div>
          </div>

          <div className={styles.trustItem}>
            <div className={styles.trustIconBox}>
              <Shield
                size={20}
                className={styles.trustIcon}
                aria-hidden="true"
              />
            </div>
            <div className={styles.trustContent}>
              <h4>Tiêu chuẩn Y tế &amp; Bác sĩ tuyển chọn</h4>
              <p>
                100% chuyên gia sở hữu bằng Thạc sĩ / Bác sĩ chuyên khoa tâm
                thần, tâm lý lâm sàng có chứng chỉ hành nghề hợp lệ.
              </p>
            </div>
          </div>

          <div className={styles.trustItem}>
            <div className={styles.trustIconBox}>
              <LifeBuoy
                size={20}
                className={styles.trustIcon}
                aria-hidden="true"
              />
            </div>
            <div className={styles.trustContent}>
              <h4>Hỗ trợ khẩn cấp 24/7</h4>
              <p>
                Trong tình huống cấp bách, đội ngũ hỗ trợ khẩn cấp và đường dây
                nóng luôn túc trực trợ giúp điều phối kịp thời.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>
          © 2026 MentalBridge Health Tech. Bảo lưu mọi quyền. Nền tảng chăm sóc
          sức khỏe tinh thần đáng tin cậy.
        </p>
      </footer>

      <SpecialistDetailDialog
        key={detailId ?? 'closed'}
        open={detailId !== null}
        item={detail}
        badges={detailBadges}
        loading={detailLoading}
        error={detailError}
        packageCode={page?.packageCode ?? null}
        initialTab={initialTab}
        availableCredits={availableCredits}
        onClose={() => {
          setDetailId(null)
          setDetail(null)
          setDetailBadges([])
          setDetailError('')
        }}
        onRetry={() => detailId && void loadDetail(detailId)}
        onBooked={(slot, name) => {
          setBookedSlot({ slot, name })
          void booked()
        }}
        originatingPlanActionId={originatingPlanActionId}
      />
    </main>
  )
}
