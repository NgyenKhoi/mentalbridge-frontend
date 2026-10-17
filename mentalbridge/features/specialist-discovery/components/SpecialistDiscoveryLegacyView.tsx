import Link from 'next/link'
import { Check, Clock3, RefreshCw, Shield, Star, User } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import type {
  SpecialistDiscoveryItem,
  SpecialistDiscoveryPage,
} from '@/lib/consultation/consultation-validation'
import type { DiscoveryFilters } from '../api/browser-client'
import legacy from './SpecialistDiscoveryLegacy.module.css'
import cards from './SpecialistCards.module.css'

const supportAreaLabels = {
  DEPRESSIVE_SYMPTOMS: 'Khí sắc và trầm buồn',
  ANXIETY_SYMPTOMS: 'Lo âu',
} as const

type Props = Readonly<{
  returnSupportGuideId?: string
  page: SpecialistDiscoveryPage | null
  items: SpecialistDiscoveryItem[]
  loading: boolean
  loadingMore: boolean
  error: string
  supportArea: DiscoveryFilters['supportArea'] | ''
  language: DiscoveryFilters['language'] | ''
  modality: DiscoveryFilters['modality'] | ''
  onSupportAreaChange: (value: DiscoveryFilters['supportArea'] | '') => void
  onLanguageChange: (value: DiscoveryFilters['language'] | '') => void
  onModalityChange: (value: DiscoveryFilters['modality'] | '') => void
  onReload: () => void
  onReset: () => void
  onLoadMore: () => void
  onOpenDetail: (id: string) => void
}>

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toLocaleUpperCase('vi-VN'))
    .join('')
}

function earliestSlot(item: SpecialistDiscoveryItem) {
  const value = item.explanation.earliestSelectableStartAt
  if (!value) return 'Chưa có lịch trống'
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value))
}

export default function SpecialistDiscoveryLegacyView({
  returnSupportGuideId,
  page,
  items,
  loading,
  loadingMore,
  error,
  supportArea,
  language,
  modality,
  onSupportAreaChange,
  onLanguageChange,
  onModalityChange,
  onReload,
  onReset,
  onLoadMore,
  onOpenDetail,
}: Props) {
  const availableCount = items.filter(
    (item) => item.explanation.hasSelectableSlot,
  ).length
  const packageName =
    page?.packageCode === 'FREE'
      ? 'Free'
      : page?.packageCode === 'PLUS'
        ? 'Plus'
        : page?.packageCode === 'PREMIUM'
          ? 'Premium'
          : 'của bạn'

  return (
    <>
      {returnSupportGuideId && (
        <Link
          className="btn btn-ghost"
          href={`/support-guides/${returnSupportGuideId}`}
        >
          Quay lại gợi ý hỗ trợ
        </Link>
      )}

      <header className={legacy.hero}>
        <div className={legacy.heroDecor} aria-hidden="true">
          <div className={legacy.decorCircle1} />
          <div className={legacy.decorCircle2} />
          <div className={legacy.decorCircle3} />
        </div>
        <div className={legacy.heroContent}>
          <div className={legacy.heroBadge}>
            <span className={legacy.greenDot} />
            <span>Kết nối chuyên gia trực tuyến</span>
          </div>
          <h1 className={legacy.heroTitle}>Kết nối chuyên gia tâm lý</h1>
          <p className={legacy.heroSubtitle}>
            Xem hồ sơ chuyên gia đã được phê duyệt và chọn khung giờ tư vấn 60
            phút đang khả dụng.
          </p>
          <div className={legacy.heroCards}>
            <div className={legacy.statCard}>
              <div className={legacy.statIconMint}>
                <User
                  size={20}
                  className={legacy.iconMint}
                  aria-hidden="true"
                />
              </div>
              <div className={legacy.statText}>
                <strong className={legacy.statNumber}>
                  {loading ? '—' : `${availableCount} chuyên gia`}
                </strong>
                <span className={legacy.statLabel}>Có lịch tư vấn</span>
              </div>
            </div>
            <div className={legacy.statCard}>
              <div className={legacy.statIconPeach}>
                <Clock3
                  size={20}
                  className={legacy.iconPeach}
                  aria-hidden="true"
                />
              </div>
              <div className={legacy.statText}>
                <strong className={legacy.statNumber}>60 phút</strong>
                <span className={legacy.statLabel}>Mỗi buổi tư vấn</span>
              </div>
            </div>
            <div className={legacy.statCardDark}>
              <div className={legacy.statIconDark}>
                <Shield
                  size={20}
                  className={legacy.iconWhite}
                  aria-hidden="true"
                />
              </div>
              <div className={legacy.statText}>
                <div className={legacy.statDarkTitle}>
                  <strong>Gói {packageName}</strong>
                  <span className={legacy.onlineDot} />
                </div>
                <span className={legacy.statDarkLabel}>
                  {page?.packageCode === 'FREE'
                    ? 'Xem hồ sơ và lịch trống'
                    : 'Quyền lợi được kiểm tra khi đặt lịch'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className={legacy.filterCard} aria-label="Bộ lọc chuyên gia">
        <div className={legacy.filterRow1}>
          <span className={legacy.filterLabel}>CHỦ ĐỀ:</span>
          <div className={legacy.topicChips}>
            {(
              [
                ['', 'Tất cả'],
                ['ANXIETY_SYMPTOMS', 'Lo âu'],
                ['DEPRESSIVE_SYMPTOMS', 'Khí sắc và trầm buồn'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value || 'all'}
                type="button"
                className={`${legacy.topicChip} ${supportArea === value ? legacy.topicChipActive : ''}`}
                data-active={supportArea === value}
                disabled={loading}
                onClick={() => onSupportAreaChange(value)}
              >
                {value === '' ? `Tất cả (${items.length})` : label}
              </button>
            ))}
          </div>
        </div>
        <div className={legacy.filterRow2}>
          <div className={legacy.filterRow2Left}>
            <label className={legacy.langLabel}>
              <span>Ngôn ngữ:</span>
              <select
                value={language}
                disabled={loading}
                onChange={(event) =>
                  onLanguageChange(event.target.value as typeof language)
                }
                className={legacy.langSelect}
              >
                <option value="">Không ưu tiên</option>
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </select>
            </label>
            <div className={legacy.modalityGroup}>
              <button
                type="button"
                className={`${legacy.modalityBtn} ${modality === '' ? legacy.modalityBtnActive : ''}`}
                data-active={modality === ''}
                disabled={loading}
                onClick={() => onModalityChange('')}
              >
                Tất cả
              </button>
              <button
                type="button"
                className={`${legacy.modalityBtn} ${modality === 'IN_APP_CHAT' ? legacy.modalityBtnActive : ''}`}
                data-active={modality === 'IN_APP_CHAT'}
                disabled={loading}
                onClick={() => onModalityChange('IN_APP_CHAT')}
              >
                Chat
              </button>
              <button
                type="button"
                disabled
                className={legacy.modalityBtnDisabled}
                title="Video trong ứng dụng hiện chưa khả dụng"
              >
                Video <span className={legacy.badgeSoon}>sắp có</span>
              </button>
            </div>
          </div>
          <button
            className={legacy.reloadBtn}
            type="button"
            onClick={onReload}
            disabled={loading}
          >
            <RefreshCw
              size={14}
              className={loading ? legacy.spinning : undefined}
              aria-hidden="true"
            />
            <span>Tải lại</span>
          </button>
        </div>
        {page && (
          <div className={legacy.benefitNotice}>
            <div className={legacy.benefitLeft}>
              {page.packageCode === 'FREE' ? (
                <span>
                  Gói Free: xem hồ sơ và lịch trống; đặt lịch cần gói Plus hoặc
                  Premium.
                </span>
              ) : (
                <span>
                  <strong>Gói {packageName}.</strong> Quyền lợi và lượt tư vấn
                  sẽ được kiểm tra lại khi gửi yêu cầu.
                </span>
              )}
            </div>
            {!page.videoEnabled && (
              <div className={legacy.benefitRight}>
                Video hiện chưa khả dụng.
              </div>
            )}
          </div>
        )}
      </section>

      {!loading && !error && (
        <div className={cards.toolbar}>
          <p>
            Hiển thị <strong>{items.length}</strong> chuyên gia phù hợp tiêu chí
          </p>
        </div>
      )}

      {error && (
        <section className={legacy.state} role="alert">
          <h2>Chưa thể tải danh sách</h2>
          <p>{error}</p>
          <button type="button" onClick={onReload}>
            Thử lại
          </button>
        </section>
      )}

      {loading ? (
        <div className={legacy.grid} aria-label="Đang tải chuyên gia">
          {[0, 1, 2, 3].map((value) => (
            <div className={legacy.skeletonCard} key={value}>
              <Skeleton height="58px" width="58px" />
              <Skeleton height="24px" width="70%" />
              <Skeleton height="18px" width="50%" />
              <Skeleton height="70px" />
              <Skeleton height="40px" />
            </div>
          ))}
        </div>
      ) : !error && items.length === 0 ? (
        <section className={legacy.state}>
          <h2>Chưa có chuyên gia phù hợp</h2>
          <p>Hãy đổi bộ lọc hoặc quay lại sau khi có lịch mới.</p>
          <button type="button" onClick={onReset}>
            Xóa bộ lọc
          </button>
        </section>
      ) : (
        <div className={cards.grid}>
          {items.map((item, index) => (
            <article className={cards.card} key={item.specialistAccountId}>
              <div
                className={cards.avatar}
                data-tone={index % 4}
                data-available={item.explanation.hasSelectableSlot}
                aria-hidden="true"
              >
                {initials(item.displayName)}
              </div>
              <h2>{item.displayName}</h2>
              <span className={cards.verified}>
                <Check size={12} strokeWidth={2.5} aria-hidden="true" /> Hồ sơ
                đã duyệt
              </span>
              <p className={cards.experience}>
                {item.yearsOfExperience} năm kinh nghiệm
              </p>
              {item.ratingAggregate ? (
                <p className={cards.rating}>
                  <Star size={13} className={cards.star} aria-hidden="true" />
                  <strong>
                    {item.ratingAggregate.averageRating.toFixed(1)}
                  </strong>
                  <span className={cards.reviewCount}>
                    · {item.ratingAggregate.ratingCount} đánh giá
                  </span>
                </p>
              ) : (
                <p className={cards.rating}>Chưa có đánh giá</p>
              )}
              <div className={cards.tags}>
                {item.supportAreas.map((area) => (
                  <span key={area}>{supportAreaLabels[area]}</span>
                ))}
              </div>
              <div className={cards.nearest}>
                <Clock3 size={15} aria-hidden="true" />
                <span>Lịch gần nhất: {earliestSlot(item)}</span>
              </div>
              <div className={cards.actions}>
                <button
                  type="button"
                  className={cards.profileBtn}
                  onClick={() => onOpenDetail(item.specialistAccountId)}
                >
                  Hồ sơ
                </button>
                <button
                  type="button"
                  className={cards.slotBtn}
                  onClick={() => onOpenDetail(item.specialistAccountId)}
                >
                  Lịch trống
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {page?.nextCursor && !error && (
        <button
          className={legacy.more}
          type="button"
          disabled={loadingMore}
          onClick={onLoadMore}
        >
          {loadingMore ? 'Đang tải thêm…' : 'Xem thêm chuyên gia'}
        </button>
      )}

      <section className={legacy.trustBanner} aria-label="Thông tin về tư vấn">
        <h3 className={legacy.trustTitle}>TƯ VẤN CÙNG MENTALBRIDGE</h3>
        <div className={legacy.trustGrid}>
          <div className={legacy.trustItem}>
            <div className={legacy.trustIconBox}>
              <Shield
                size={20}
                className={legacy.trustIcon}
                aria-hidden="true"
              />
            </div>
            <div className={legacy.trustContent}>
              <h4>Hồ sơ được phê duyệt</h4>
              <p>
                Xem thông tin chuyên gia và lĩnh vực hỗ trợ trước khi chọn lịch.
              </p>
            </div>
          </div>
          <div className={legacy.trustItem}>
            <div className={legacy.trustIconBox}>
              <Clock3
                size={20}
                className={legacy.trustIcon}
                aria-hidden="true"
              />
            </div>
            <div className={legacy.trustContent}>
              <h4>Buổi tư vấn 60 phút</h4>
              <p>Chọn khung giờ còn trống để gửi yêu cầu đặt lịch.</p>
            </div>
          </div>
          <div className={legacy.trustItem}>
            <div className={legacy.trustIconBox}>
              <Check
                size={20}
                className={legacy.trustIcon}
                aria-hidden="true"
              />
            </div>
            <div className={legacy.trustContent}>
              <h4>Quyền lợi theo gói</h4>
              <p>Quyền lợi và lượt tư vấn được kiểm tra khi gửi yêu cầu.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className={legacy.footer}>
        <p>© 2026 MentalBridge Health Tech.</p>
      </footer>
    </>
  )
}
