'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError } from '@/lib/api/api-error'
import { TodayEmotionSummary } from '@/features/emotion-check-in/TodayEmotionSummary'

import {
  getResourceCatalogue,
  type PublicResourceSummary,
} from '../api/browser-resources'
import {
  getResourceProgress,
  saveResourceProgress,
  type ResourceProgressItem,
} from '../api/browser-resource-progress'
import {
  getResourceJourney,
  ResourceJourneyBrowserError,
  type ResourceJourney,
} from '../api/browser-resource-journey'
import {
  getResourceBingo,
  setResourceBingoSelfConfirmation,
  type ResourceBingoBoard,
} from '../api/browser-resource-engagement'
import { useResourceBookmarks } from '../hooks/useResourceBookmarks'
import {
  localDate,
  recentDates,
  resourcePresentation,
  shiftDate,
} from '../model/resource-experience'
import {
  getAchievements,
  type AchievementCollection,
} from '@/features/achievements/api/browser-achievements'
import { AnimatedResourceSticker } from './AnimatedResourceSticker'
import { ResourceBingoPanel } from './ResourceBingoPanel'
import styles from './resources-showcase.module.css'

type Filter = 'all' | 'short' | 'medium' | 'challenge'

const VIEW_STATE_KEY = 'mentalbridge:resources:view'

const ACHIEVEMENT_ICONS: Record<string, string> = {
  'journal.first-entry': '✍️',
  'journal.streak-3-days': '🔥',
  'journal.streak-7-days': '✨',
  'emotion.first-check-in': '❤️',
  'emotion.streak-3-days': '🌱',
  'emotion.streak-7-days': '🌸',
  'resource.first-completion': '🏆',
  'resource.variety-3': '🧭',
  'resource.practice-3-days': '⭐',
  'resource.practice-7-days': '🌟',
}

const resourceArtworks = [
  {
    title: 'thở chậm',
    src: '/images/resource-breathing.webp',
    alt: 'Ngồi thở chậm với tay đặt trên ngực và bụng',
  },
  {
    title: 'ba phút nhận biết hiện tại',
    src: '/images/resource-mindfulness.webp',
    alt: 'Chú ý quan sát chiếc lá, ánh sáng và những vật gần mình',
  },
  {
    title: 'giãn cơ và đổi tư thế',
    src: '/images/resource-stretch.webp',
    alt: 'Đứng vững và vươn tay để giãn nhẹ một bên thân',
  },
  {
    title: 'giải quyết một vấn đề theo từng bước',
    src: '/images/resource-problem-solving.webp',
    alt: 'Chia một vấn đề thành những bước nhỏ trên bàn làm việc',
  },
  {
    title: 'thư giãn cơ tiến triển',
    src: '/images/resource-pmr.webp',
    alt: 'Nằm thư giãn và nhẹ nhàng siết rồi thả lỏng từng nhóm cơ',
  },
  {
    title: 'thả lỏng cơ',
    src: '/images/resource-pmr.webp',
    alt: 'Nằm thư giãn và nhẹ nhàng siết rồi thả lỏng từng nhóm cơ',
  },
] as const
function resourceHref(resource: PublicResourceSummary, date: string) {
  return `/resources/${resource.id}?from=resources&date=${date}`
}

function ResourceArt({ resource }: { resource: PublicResourceSummary }) {
  const meta = resourcePresentation(resource)
  const artwork = resourceArtworks.find(({ title }) =>
    resource.title.toLocaleLowerCase('vi-VN').includes(title),
  )

  return (
    <div
      className={`${styles.art} ${styles[`art${resource.category}`]}`}
      data-resource-surface="dark"
    >
      {artwork ? (
        <Image
          src={artwork.src}
          alt={artwork.alt}
          fill
          sizes="(max-width: 600px) 100vw, (max-width: 900px) 90vw, 44vw"
          className={styles.artImage}
        />
      ) : (
        <AnimatedResourceSticker variant={meta.sticker} size="large" />
      )}
      <div className={styles.artBadges}>
        <span>
          {resource.category === 'VIDEO'
            ? 'XEM & NGHE'
            : resource.category === 'ARTICLE'
              ? 'BÀI ĐỌC'
              : resource.category === 'BREATHING'
                ? 'HƠI THỞ'
                : resource.category === 'COMMUNITY'
                  ? 'VẬN ĐỘNG NHẸ'
                  : 'THỰC HÀNH'}
        </span>
        <span>{meta.minutes} phút</span>
      </div>
    </div>
  )
}

export default function ResourcesShowcase() {
  const today = useMemo(() => localDate(), [])
  const dates = useMemo(() => recentDates(today), [today])
  const weekStart = useMemo(() => {
    const date = new Date(`${today}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
    return date.toISOString().slice(0, 10)
  }, [today])
  const bookmarks = useResourceBookmarks()
  const [resources, setResources] = useState<PublicResourceSummary[]>([])
  const [progress, setProgress] = useState<ResourceProgressItem[]>([])
  const [journeys, setJourneys] = useState<Record<string, ResourceJourney>>({})
  const [bingoBoard, setBingoBoard] = useState<ResourceBingoBoard | null>(null)
  const [bingoEtag, setBingoEtag] = useState('')
  const [bingoState, setBingoState] = useState<
    'loading' | 'ready' | 'missing' | 'error' | 'stale'
  >('loading')
  const [pendingPosition, setPendingPosition] = useState<number | null>(null)
  const [catalogueState, setCatalogueState] = useState<
    'loading' | 'ready' | 'empty' | 'error'
  >('loading')
  const [progressState, setProgressState] = useState<
    'loading' | 'ready' | 'error'
  >('loading')
  const [journeyState, setJourneyState] = useState<
    'loading' | 'ready' | 'plan-required' | 'missing' | 'error'
  >('loading')
  const [achievements, setAchievements] =
    useState<AchievementCollection | null>(null)
  const [achievementsState, setAchievementsState] = useState<
    'loading' | 'ready' | 'error'
  >('loading')
  const [partialHistory, setPartialHistory] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [expanded, setExpanded] = useState(false)
  const [pendingId, setPendingId] = useState('')
  const [progressMessage, setProgressMessage] = useState('')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const saved = JSON.parse(
          sessionStorage.getItem(VIEW_STATE_KEY) ?? '{}',
        ) as { showcase?: { filter?: Filter } }
        const next = saved.showcase?.filter
        if (next && ['all', 'short', 'medium', 'challenge'].includes(next))
          setFilter(next)
      } catch {
        setFilter('all')
      }
      setHydrated(true)
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      const current = JSON.parse(
        sessionStorage.getItem(VIEW_STATE_KEY) ?? '{}',
      ) as Record<string, unknown>
      sessionStorage.setItem(
        VIEW_STATE_KEY,
        JSON.stringify({
          ...current,
          showcase: { filter },
        }),
      )
    } catch {
      try {
        sessionStorage.setItem(
          VIEW_STATE_KEY,
          JSON.stringify({
            showcase: { filter },
          }),
        )
      } catch {}
    }
  }, [filter, hydrated])

  const loadBingo = useCallback(async () => {
    setBingoState('loading')
    try {
      const result = await getResourceBingo(weekStart)
      setBingoBoard(result.board)
      setBingoEtag(result.etag)
      setBingoState('ready')
    } catch (error) {
      setBingoBoard(null)
      setBingoEtag('')
      setBingoState(
        error instanceof ApiError && error.status === 404 ? 'missing' : 'error',
      )
    }
  }, [weekStart])

  useEffect(() => {
    void Promise.resolve().then(loadBingo)
  }, [loadBingo])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    void getResourceCatalogue(controller.signal, 'vi-VN')
      .then((catalogue) => {
        if (!active) return
        if (catalogue.unavailable) throw new Error('unavailable')
        setResources(catalogue.items)
        setCatalogueState(catalogue.items.length ? 'ready' : 'empty')
      })
      .catch((error: unknown) => {
        if (active && !(error instanceof Error && error.name === 'AbortError'))
          setCatalogueState('error')
      })
    void getResourceProgress(shiftDate(today, -14), today)
      .then((items) => {
        if (active) {
          setProgress([...items])
          setProgressState('ready')
        }
      })
      .catch(() => {
        if (active) setProgressState('error')
      })
    void getAchievements(timeZone)
      .then((result) => {
        if (active) {
          setAchievements(result.collection)
          setAchievementsState('ready')
        }
      })
      .catch(() => {
        if (active) setAchievementsState('error')
      })
    void Promise.all(
      dates.map(async (date) => {
        try {
          return {
            date,
            journey: await getResourceJourney(
              date,
              timeZone,
              controller.signal,
            ),
            error: null,
          }
        } catch (error) {
          return { date, journey: null, error }
        }
      }),
    )
      .then((items) => {
        if (!active) return
        const todayResult = items.find((item) => item.date === today)
        setJourneys(
          Object.fromEntries(
            items
              .filter(
                (item): item is typeof item & { journey: ResourceJourney } =>
                  item.journey !== null,
              )
              .map((item) => [item.journey.localDate, item.journey]),
          ),
        )
        setPartialHistory(
          items.some(
            (item) =>
              item.date !== today &&
              item.error !== null &&
              !(
                item.error instanceof ResourceJourneyBrowserError &&
                item.error.status === 404
              ),
          ),
        )
        if (todayResult?.journey) {
          setJourneyState('ready')
          void loadBingo()
        } else {
          setJourneyState(
            todayResult?.error instanceof ResourceJourneyBrowserError &&
              todayResult.error.status === 404
              ? 'missing'
              : todayResult?.error instanceof ResourceJourneyBrowserError &&
                  todayResult.error.status === 409
                ? 'plan-required'
                : 'error',
          )
        }
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof Error && error.name === 'AbortError'))
          return
        setJourneyState(
          error instanceof ResourceJourneyBrowserError && error.status === 409
            ? 'plan-required'
            : 'error',
        )
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [dates, loadBingo, today])

  const feature =
    resources.find((resource) =>
      resource.title
        .toLocaleLowerCase('vi-VN')
        .includes('ba phút nhận biết hiện tại'),
    ) ??
    resources.find((resource) => resource.resourceKind === 'PRACTICE') ??
    resources[0]
  const mediaResource = resources.find(
    (resource) => resource.category === 'VIDEO',
  )
  const filtered = resources.filter((resource) => {
    const meta = resourcePresentation(resource)
    if (filter === 'short') return meta.minutes < 5
    if (filter === 'medium') return meta.minutes >= 5 && meta.minutes <= 10
    if (filter === 'challenge') return meta.difficulty === 'CHALLENGE'
    return true
  })
  const curated = [
    ...filtered
      .filter((resource) => resource.category === 'BREATHING')
      .slice(0, 1),
    ...filtered
      .filter((resource) => resource.category === 'MEDITATION')
      .slice(0, 1),
    ...filtered
      .filter((resource) => resource.category === 'COMMUNITY')
      .slice(0, 1),
    ...filtered
      .filter((resource) => resource.category === 'ARTICLE')
      .slice(0, 1),
    ...filtered.filter((resource) => resource.category === 'VIDEO').slice(0, 1),
    ...filtered,
  ].filter(
    (resource, index, all) =>
      all.findIndex((candidate) => candidate.id === resource.id) === index,
  )
  const visible = expanded ? curated : curated.slice(0, 5)
  const journey = journeys[today]
  const streak = journey?.progress.practiceStreakDays
  const completedRecent = progress
    .filter((entry) => entry.status === 'COMPLETED')
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    .flatMap((entry) => {
      const resource = resources.find(
        (candidate) => candidate.id === entry.resourceId,
      )
      return resource ? [{ entry, resource }] : []
    })
    .slice(0, 2)
  const todayLabel = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${today}T12:00:00`))

  const earnedCount = useMemo(() => {
    if (!achievements?.items) return 0
    return achievements.items.filter(
      (item) => item.status === 'EARNED' || item.status === 'GRANDFATHERED',
    ).length
  }, [achievements])

  const displayBadges = useMemo(() => {
    if (!achievements?.items || achievements.items.length === 0) {
      return [
        {
          id: 'resource.first-completion',
          title: 'Tài nguyên đầu tiên',
          icon: '🏆',
          isEarned: false,
          statusText: 'Chưa đạt',
        },
        {
          id: 'resource.practice-3-days',
          title: 'Ba ngày thực hành',
          icon: '⭐',
          isEarned: false,
          statusText: 'Chưa đạt',
        },
        {
          id: 'journal.first-entry',
          title: 'Trang viết đầu tiên',
          icon: '✍️',
          isEarned: false,
          statusText: 'Chưa đạt',
        },
      ]
    }

    const items = achievements.items
    const earned = items.filter(
      (i) => i.status === 'EARNED' || i.status === 'GRANDFATHERED',
    )
    const unearned = items.filter(
      (i) => i.status !== 'EARNED' && i.status !== 'GRANDFATHERED',
    )

    let selected: typeof items = []
    if (earned.length >= 3) {
      selected = earned.slice(0, 3)
    } else if (earned.length > 0) {
      selected = [...earned, ...unearned.slice(0, 3 - earned.length)]
    } else {
      selected = unearned.slice(0, 3)
    }

    return selected.map((item) => {
      const isEarned =
        item.status === 'EARNED' || item.status === 'GRANDFATHERED'
      let statusText = 'Chưa đạt'
      if (isEarned) {
        statusText = 'Đã ghi nhận'
      } else if (item.progress) {
        const unit =
          item.progress.unit === 'CONSECUTIVE_DAY'
            ? 'ngày'
            : item.progress.unit === 'DISTINCT_RESOURCE'
              ? 'tài nguyên'
              : item.progress.unit === 'PRACTICE_DAY'
                ? 'ngày'
                : 'lần'
        statusText = `${item.progress.current}/${item.progress.target} ${unit}`
      }
      return {
        id: item.definitionId,
        title: item.title,
        icon: ACHIEVEMENT_ICONS[item.definitionId] ?? (isEarned ? '🏆' : '🌱'),
        isEarned,
        statusText,
      }
    })
  }, [achievements])

  async function toggleBingo(position: number, selfConfirmed: boolean) {
    if (!bingoEtag || pendingPosition !== null) return
    setPendingPosition(position)
    try {
      const result = await setResourceBingoSelfConfirmation(
        weekStart,
        position,
        selfConfirmed,
        bingoEtag,
      )
      setBingoBoard(result.board)
      setBingoEtag(result.etag)
      setBingoState('ready')
    } catch {
      setBingoBoard(null)
      setBingoEtag('')
      setBingoState('stale')
    } finally {
      setPendingPosition(null)
    }
  }

  async function toggleDaily(resource: PublicResourceSummary) {
    if (pendingId) return
    setPendingId(resource.id)
    setProgressMessage('')
    let saved: ResourceProgressItem
    try {
      saved = await saveResourceProgress(resource.id, today, {
        status: 'COMPLETED',
        completedActionIds: ['overview-complete'],
      })
    } catch {
      setProgressMessage('Chưa thể lưu tiến độ. Hãy thử lại sau một chút.')
      setPendingId('')
      return
    }
    setProgress((current) => [
      ...current.filter(
        (entry) =>
          !(entry.resourceId === resource.id && entry.localDate === today),
      ),
      saved,
    ])
    setProgressMessage(`Đã lưu hoàn thành “${resource.title}”.`)
    window.dispatchEvent(new CustomEvent('mb:resource-progress-updated'))
    try {
      const refreshed = await getResourceJourney(
        today,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      )
      setJourneys((current) => ({ ...current, [today]: refreshed }))
    } catch {
      setJourneys((current) => {
        const next = { ...current }
        delete next[today]
        return next
      })
      setJourneyState('error')
    }
    await loadBingo()
    setPendingId('')
  }

  if (catalogueState !== 'ready') {
    return (
      <section
        className={styles.pageState}
        role={catalogueState === 'error' ? 'alert' : 'status'}
      >
        <AnimatedResourceSticker
          variant={catalogueState === 'error' ? 'rest' : 'garden'}
          size="large"
        />
        <h1>
          {catalogueState === 'loading'
            ? 'Đang chuẩn bị góc tài nguyên…'
            : catalogueState === 'empty'
              ? 'Chưa có tài nguyên'
              : 'Góc tài nguyên đang nghỉ một chút'}
        </h1>
        <p>
          {catalogueState === 'error'
            ? 'Tiến độ đã lưu của bạn vẫn an toàn. Hãy thử tải lại sau ít phút.'
            : catalogueState === 'empty'
              ? 'Khi tài nguyên mới sẵn sàng, chúng sẽ xuất hiện ở đây.'
              : 'Một chút nữa, bạn có thể chọn hoạt động phù hợp với mình.'}
        </p>
        {catalogueState === 'error' && (
          <button type="button" onClick={() => window.location.reload()}>
            Thử tải lại
          </button>
        )}
      </section>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.heroRow}>
        <section
          className={styles.hero}
          data-resource-surface="dark"
          aria-labelledby="resource-hero-title"
        >
          <div className={styles.heroTop}>
            <span className={styles.heroBadge} data-resource-ink="dark">
              ● Hoạt động gợi ý hôm nay
            </span>
            {feature && bookmarks.state === 'ready' && (
              <button
                type="button"
                className={styles.bookmark}
                aria-label={
                  bookmarks.isBookmarked(feature.id)
                    ? 'Bỏ lưu hoạt động nổi bật'
                    : 'Lưu hoạt động nổi bật'
                }
                aria-pressed={bookmarks.isBookmarked(feature.id)}
                disabled={bookmarks.pendingResourceId !== null}
                onClick={() => void bookmarks.toggle(feature.id)}
              >
                {bookmarks.isBookmarked(feature.id) ? '◆' : '◇'}
              </button>
            )}
          </div>
          <div className={styles.heroContent}>
            <p className={styles.heroDate}>{todayLabel} · Nuôi dưỡng tâm trí</p>
            <h1 id="resource-hero-title">
              {feature?.title === 'Ba phút nhận biết hiện tại'
                ? 'Ba phút nhận biết hiện tại: Đón năng lượng an yên'
                : feature?.title}
            </h1>
            <p>{feature?.summary}</p>
            <div className={styles.heroActions}>
              {feature && (
                <Link
                  className={styles.mintButton}
                  href={resourceHref(feature, today)}
                >
                  ▶ Bắt đầu bài tập hôm nay ·{' '}
                  {resourcePresentation(feature).minutes} phút
                </Link>
              )}
              {mediaResource && (
                <Link
                  className={styles.glassButton}
                  href={resourceHref(mediaResource, today)}
                >
                  ♫ Xem nội dung nghe nhìn
                </Link>
              )}
            </div>
          </div>
        </section>

        <aside className={styles.energy} aria-labelledby="energy-title">
          <div className={styles.energyHead}>
            <h2 id="energy-title">Hoạt động đã ghi nhận</h2>
            {journeyState === 'ready' && journey && (
              <span>
                {streak ? `${streak} ngày đã lưu` : 'Chưa có chuỗi thực hành'}
              </span>
            )}
          </div>
          <TodayEmotionSummary />
          {partialHistory && (
            <p role="status">
              Một số ngày trước chưa tải được. Tiến độ hôm nay vẫn là dữ liệu đã
              lưu.
            </p>
          )}
          <div className={styles.energyProgress}>
            <small>Kế hoạch hôm nay</small>
            <strong>
              {journeyState === 'ready' && journey
                ? `${journey.progress.dailyCompleted}/${journey.progress.dailyTotal} hoạt động đã hoàn thành`
                : journeyState === 'plan-required'
                  ? 'Chưa có kế hoạch đang hoạt động'
                  : journeyState === 'missing'
                    ? 'Chưa có dữ liệu hành trình cho ngày hôm nay'
                    : 'Chưa tải được tiến độ hôm nay'}
            </strong>
            {journeyState === 'ready' &&
              journey &&
              journey.progress.dailyTotal > 0 && (
                <div className={styles.track}>
                  <i
                    style={{
                      width: `${Math.min(100, (journey.progress.dailyCompleted / journey.progress.dailyTotal) * 100)}%`,
                    }}
                  />
                </div>
              )}
            <p>
              <Link href="/support-plan">Xem kế hoạch hỗ trợ</Link> để chọn bước
              tiếp theo.
            </p>
          </div>
          {progressMessage && <p role="status">{progressMessage}</p>}
          <div className={styles.weekDots} aria-label="Bảy ngày gần đây">
            {dates.map((date) => (
              <span
                key={date}
                className={`${date === today ? styles.todayDot : ''} ${journeys[date]?.progress.dailyCompleted ? styles.dayDone : ''}`}
              >
                <small>
                  {date === today
                    ? 'Hôm nay'
                    : new Intl.DateTimeFormat('vi-VN', {
                        weekday: 'short',
                      }).format(new Date(`${date}T12:00:00`))}
                </small>
                <i />
              </span>
            ))}
          </div>
          {journeyState === 'ready' && journey && progressState === 'ready' && (
            <details className={styles.dailyDetails}>
              <summary>Hoạt động trong kế hoạch hôm nay</summary>
              <ul>
                {journey.items.map(({ resource }) => {
                  const complete = progress.some(
                    (entry) =>
                      entry.resourceId === resource.id &&
                      entry.localDate === today &&
                      entry.status === 'COMPLETED',
                  )
                  return (
                    <li key={resource.id}>
                      <button
                        type="button"
                        disabled={complete || pendingId !== ''}
                        aria-label={`${complete ? 'Đã hoàn thành' : 'Ghi nhận đã làm'}: ${resource.title}`}
                        onClick={() => void toggleDaily(resource)}
                      >
                        {complete ? '✓' : '○'}
                      </button>
                      <Link href={resourceHref(resource, today)}>
                        {resource.title}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </details>
          )}
        </aside>
      </div>

      <section className={styles.catalogue} aria-labelledby="catalogue-title">
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.titleLine}>
              <span className={styles.eyebrow} data-resource-ink="light">
                Kho tài nguyên
              </span>
              <h2 id="catalogue-title">Hộp Quà Nuôi Dưỡng Tâm Trí</h2>
            </div>
            <p>
              Chọn một hoạt động để nạp lại nguồn năng lượng tích cực cho cơ thể
              và tinh thần.
            </p>
          </div>
          <div
            className={styles.filters}
            role="group"
            aria-label="Lọc hoạt động"
          >
            {(
              [
                ['all', 'Tất cả kho báu'],
                ['short', 'Dễ chịu (<5p)'],
                ['medium', 'Vừa sức (5–10p)'],
                ['challenge', 'Thử thách nhẹ'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                className={filter === value ? styles.activeFilter : ''}
                onClick={() => {
                  setFilter(value)
                  setExpanded(false)
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {visible.length === 0 ? (
          <div className={styles.noResults} role="status">
            Nhóm này chưa có hoạt động. Hãy thử bộ lọc khác nhé.
          </div>
        ) : (
          <div className={styles.bento} role="list">
            {visible.map((resource, index) => {
              const meta = resourcePresentation(resource)
              const status =
                progressState === 'ready'
                  ? progress.find(
                      (entry) =>
                        entry.resourceId === resource.id &&
                        entry.localDate === today,
                    )?.status
                  : undefined
              return (
                <article
                  role="listitem"
                  key={resource.id}
                  className={`${styles.resourceCard} ${index === 0 && filter === 'all' ? styles.featureCard : ''} ${index === 4 && filter === 'all' ? styles.audioCard : ''}`}
                  data-resource-surface={
                    index === 4 && filter === 'all' ? 'dark' : undefined
                  }
                >
                  <ResourceArt resource={resource} />
                  <div className={styles.cardBody}>
                    <div className={styles.cardMeta}>
                      <span>
                        {index === 0 && filter === 'all' ? '◷ ' : ''}
                        {meta.minutes} phút ·{' '}
                        {index === 0 && filter === 'all'
                          ? 'Khám phá'
                          : resource.resourceKind === 'PRACTICE'
                            ? 'Thực hành'
                            : 'Khám phá'}
                      </span>
                      <strong>
                        {resource.sourceOrganization ?? 'Nguồn chưa cập nhật'}
                      </strong>
                    </div>
                    <h3>{resource.title}</h3>
                    <p>{resource.summary}</p>
                    {index === 4 && filter === 'all' && (
                      <div className={styles.wave} aria-hidden="true">
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                      </div>
                    )}
                    <div className={styles.cardFooter}>
                      <span
                        data-resource-ink={
                          index === 4 && filter === 'all' ? 'dark' : undefined
                        }
                        className={
                          meta.difficulty === 'GENTLE'
                            ? styles.gentle
                            : meta.difficulty === 'BALANCED'
                              ? styles.balanced
                              : styles.challenge
                        }
                      >
                        {status === 'COMPLETED'
                          ? 'Đã hoàn thành'
                          : status === 'IN_PROGRESS'
                            ? 'Đang làm'
                            : meta.difficulty === 'GENTLE'
                              ? 'Dễ chịu'
                              : meta.difficulty === 'BALANCED'
                                ? 'Vừa sức'
                                : 'Thử thách nhẹ'}
                      </span>
                      <Link
                        href={resourceHref(resource, today)}
                        aria-label={`Khám phá ${resource.title}`}
                      >
                        {index === 0 && filter === 'all'
                          ? 'Thực hành ngay'
                          : index === 4 && filter === 'all'
                            ? 'Bật xem'
                            : 'Khám phá'}{' '}
                        →
                      </Link>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
        {curated.length > 5 && (
          <button
            type="button"
            className={styles.showMore}
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded
              ? 'Thu gọn kho tài nguyên'
              : `Xem tất cả ${curated.length} tài nguyên`}{' '}
            <span aria-hidden="true">{expanded ? '↑' : '→'}</span>
          </button>
        )}
      </section>

      <div className={styles.lowerRow}>
        <ResourceBingoPanel
          board={bingoBoard}
          state={bingoState}
          pendingPosition={pendingPosition}
          onToggle={(position, selfConfirmed) =>
            void toggleBingo(position, selfConfirmed)
          }
          onRetry={() => void loadBingo()}
        />
        <div className={styles.sideStack}>
          <section className={styles.badges} aria-labelledby="badges-title">
            <div className={styles.panelHead}>
              <div>
                <h2 id="badges-title">Bộ sưu tập hành trình</h2>
                <p>Dấu mốc ghi nhận từ hoạt động của bạn</p>
              </div>
              <Link href="/achievements" className={styles.panelHeadLink}>
                {achievementsState === 'ready' && achievements
                  ? `${earnedCount}/${achievements.items.length} đã đạt`
                  : 'Xem tất cả'}{' '}
                →
              </Link>
            </div>
            {achievementsState === 'loading' ? (
              <div className={styles.badgeGrid}>
                <div className={styles.lockedBadge}>
                  <span aria-hidden="true">🌱</span>
                  <strong>Đang tải…</strong>
                  <small>Dấu mốc</small>
                </div>
                <div className={styles.lockedBadge}>
                  <span aria-hidden="true">✨</span>
                  <strong>Đang tải…</strong>
                  <small>Dấu mốc</small>
                </div>
                <div className={styles.lockedBadge}>
                  <span aria-hidden="true">🏆</span>
                  <strong>Đang tải…</strong>
                  <small>Dấu mốc</small>
                </div>
              </div>
            ) : (
              <div className={styles.badgeGrid}>
                {displayBadges.map((badge) => (
                  <Link
                    key={badge.id}
                    href="/achievements"
                    className={`${styles.badgeItemLink} ${badge.isEarned ? '' : styles.lockedBadge}`}
                  >
                    <span aria-hidden="true">{badge.icon}</span>
                    <strong>{badge.title}</strong>
                    <small>{badge.statusText}</small>
                  </Link>
                ))}
              </div>
            )}
            <Link href="/achievements" className={styles.badgeFooterLink}>
              Xem chi tiết bộ sưu tập thành tựu →
            </Link>
          </section>
          <section className={styles.recent} aria-labelledby="recent-title">
            <div className={styles.panelHead}>
              <h2 id="recent-title">Hoạt động đã lưu gần đây</h2>
              <span>14 ngày</span>
            </div>
            {progressState !== 'ready' ? (
              <p className={styles.panelEmpty} role="status">
                {progressState === 'loading'
                  ? 'Đang tải hoạt động đã hoàn thành…'
                  : 'Chưa tải được lịch sử hoạt động.'}
              </p>
            ) : completedRecent.length ? (
              <div className={styles.recentList}>
                {completedRecent.map(({ entry, resource }) => (
                  <Link
                    key={`${entry.localDate}:${resource.id}`}
                    href={resourceHref(resource, entry.localDate)}
                  >
                    <span aria-hidden="true">✓</span>
                    <strong>
                      {resource.title}
                      <small>
                        {entry.completedAt
                          ? new Intl.DateTimeFormat('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                            }).format(new Date(entry.completedAt))
                          : entry.localDate}
                      </small>
                    </strong>
                    <em className={styles.recentReward}>
                      Đã lưu · bản {entry.contentVersion}
                    </em>
                  </Link>
                ))}
              </div>
            ) : (
              <p className={styles.panelEmpty}>
                Chưa có hoạt động hoàn thành nào được lưu trong 14 ngày gần đây.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
