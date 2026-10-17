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
  const [collection, setCollection] = useState<AchievementCollection | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
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

  const earnedCount = collection.items.filter(
    ({ status }) => status === 'EARNED' || status === 'GRANDFATHERED',
  ).length
  const hasUnavailable = collection.sources.some(
    ({ availability }) => availability === 'UNAVAILABLE',
  )

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>
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

      <div className={styles.domains}>
        {(Object.keys(domainMeta) as Array<keyof typeof domainMeta>).map(
          (domain) => {
            const meta = domainMeta[domain]
            const Icon = meta.icon
            const items = collection.items.filter(
              (item) => item.domain === domain,
            )
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
