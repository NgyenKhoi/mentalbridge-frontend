'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BookOpenText,
  Check,
  HeartHandshake,
  Leaf,
  LockKeyhole,
  RefreshCw,
  Route,
  Sparkles,
} from 'lucide-react'

import { useMamPageTarget } from '@/features/mam/use-mam-target'
import { ApiError } from '@/lib/api/api-error'
import {
  getAchievements,
  type AchievementCollection,
  type AchievementItem,
} from '../api/browser-achievements'

import styles from './AchievementGallery.module.css'

const domainMeta = {
  JOURNAL: {
    title: 'Viết Nhật ký',
    note: 'Nội dung trang viết không rời khỏi Nhật ký.',
    icon: BookOpenText,
  },
  EMOTION_CHECK_IN: {
    title: 'Check-in cảm xúc',
    note: 'Chỉ ngày đã lưu được dùng, không dùng cảm xúc hay ghi chú.',
    icon: HeartHandshake,
  },
  RESOURCE: {
    title: 'Tài nguyên đã duyệt',
    note: 'Hoàn thành và ngày thực hành được Content xác minh.',
    icon: Leaf,
  },
  JOURNEY: {
    title: 'Hành trình do bạn xác nhận',
    note: 'Không suy diễn từ thời gian vắng mặt hoặc quay lại.',
    icon: Route,
  },
} as const

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

function AchievementCard({ item }: { item: AchievementItem }) {
  const progress = item.progress
  return (
    <article className={styles.card} data-status={item.status}>
      <div className={styles.cardTop}>
        <span className={styles.seal} aria-hidden="true">
          {item.status === 'EARNED' || item.status === 'GRANDFATHERED' ? (
            <Check />
          ) : (
            <Sparkles />
          )}
        </span>
        <span className={styles.status}>{statusLabel[item.status]}</span>
      </div>
      <h3>{item.title}</h3>
      <p>{item.description}</p>
      {(item.status === 'EARNED' || item.status === 'GRANDFATHERED') &&
      item.unlockedAt ? (
        <small>Đã ghi nhận ngày {localDate(item.unlockedAt)}</small>
      ) : null}
      {item.status === 'UNEARNED' && progress ? (
        <small>
          {progress.current}/{progress.target} {unitLabel[progress.unit]}
        </small>
      ) : null}
      {item.status === 'SOURCE_UNAVAILABLE' ? (
        <small>
          Nguồn dữ liệu tạm thời chưa khả dụng. Không dùng tiến độ đã cũ để ước
          đoán.
        </small>
      ) : null}
    </article>
  )
}

export default function AchievementGallery() {
  useMamPageTarget({ kind: 'achievements.page' })
  const [collection, setCollection] = useState<AchievementCollection | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<AchievementFilter>('ALL')
  const timezone = useMemo(
    () =>
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh',
    [],
  )

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

  return (
    <main className={styles.page}>
      <header className={styles.hero} data-user-page-header>
        <div data-user-page-heading>
          <span className={styles.eyebrow} data-user-page-kicker>
            <LockKeyhole aria-hidden="true" /> Riêng tư cho bạn
          </span>
          <h1>Bộ sưu tập hành trình</h1>
          <p>
            Những bước đã được lưu từ hoạt động của bạn. Không có xếp hạng hay
            áp lực duy trì chuỗi.
          </p>
        </div>
        <div
          className={styles.summary}
          aria-label={`${earnedCount} dấu mốc đã ghi nhận`}
        >
          <strong>{earnedCount}</strong>
          <span>dấu mốc đã ghi nhận</span>
          <small>Cập nhật {localDate(collection.calculatedAt)}</small>
        </div>
      </header>

      <section className={styles.filterBar} aria-label="Lọc bộ sưu tập">
        <div
          className={styles.filterButtons}
          role="group"
          aria-label="Trạng thái thành tựu"
        >
          {filters.map((option) => (
            <button
              key={option.value}
              type="button"
              className={styles.filterButton}
              aria-pressed={filter === option.value}
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

      <div className={styles.domains}>
        {(Object.keys(domainMeta) as Array<keyof typeof domainMeta>).map(
          (domain) => {
            const meta = domainMeta[domain]
            const Icon = meta.icon
            const items = filteredItems.filter((item) => item.domain === domain)
            if (items.length === 0) return null
            return (
              <section
                className={styles.domain}
                key={domain}
                aria-labelledby={`domain-${domain}`}
              >
                <header>
                  <span aria-hidden="true">
                    <Icon />
                  </span>
                  <div>
                    <h2 id={`domain-${domain}`}>{meta.title}</h2>
                    <p>{meta.note}</p>
                  </div>
                </header>
                <div className={styles.cards}>
                  {items.map((item) => (
                    <AchievementCard key={item.definitionId} item={item} />
                  ))}
                </div>
                {items.some(({ status }) => status === 'SOURCE_UNAVAILABLE') ? (
                  <button
                    className={styles.retry}
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
    </main>
  )
}
