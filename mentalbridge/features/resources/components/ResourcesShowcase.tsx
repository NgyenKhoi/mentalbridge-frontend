'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'

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
  localDate,
  recentDates,
  resourcePresentation,
  shiftDate,
} from '../model/resource-experience'
import { AnimatedResourceSticker } from './AnimatedResourceSticker'
import styles from './resources-showcase.module.css'

type Filter = 'all' | 'short' | 'medium' | 'challenge'
type Mood = 'Bình an' | 'Hứng khởi' | 'Hơi mệt' | 'Quá tải'

const VIEW_STATE_KEY = 'mentalbridge:resources:view'
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
] as const
const moods: { label: Mood; symbol: string }[] = [
  { label: 'Bình an', symbol: '🌿' },
  { label: 'Hứng khởi', symbol: '☀️' },
  { label: 'Hơi mệt', symbol: '☁️' },
  { label: 'Quá tải', symbol: '☔' },
]
const bingoLines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]
const bingoTiles = [
  { id: 'water', label: 'Uống đủ 2L nước', symbol: '💧', xp: 15 },
  { id: 'breathing', label: 'Hít thở sâu 3 phút', symbol: '🌿', xp: 15 },
  { id: 'gratitude', label: 'Viết lời cảm ơn', symbol: '✍', xp: 15 },
  { id: 'walk', label: 'Đi bộ ngắm cây', symbol: '🚶', xp: 20 },
  { id: 'smile', label: 'Mỉm cười với bản thân', symbol: '✦', xp: 0 },
  { id: 'tea', label: 'Uống trà thảo mộc', symbol: '🍵', xp: 15 },
  { id: 'screen', label: 'Tắt màn hình 30p', symbol: '◫', xp: 25 },
  { id: 'music', label: 'Nghe nhạc êm dịu', symbol: '♫', xp: 15 },
  { id: 'sleep', label: 'Đi ngủ trước 23h', symbol: '☾', xp: 30 },
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
  const [resources, setResources] = useState<PublicResourceSummary[]>([])
  const [progress, setProgress] = useState<ResourceProgressItem[]>([])
  const [journeys, setJourneys] = useState<Record<string, ResourceJourney>>({})
  const [catalogueState, setCatalogueState] = useState<
    'loading' | 'ready' | 'empty' | 'error'
  >('loading')
  const [progressState, setProgressState] = useState<
    'loading' | 'ready' | 'error'
  >('loading')
  const [journeyState, setJourneyState] = useState<
    'loading' | 'ready' | 'plan-required' | 'error'
  >('loading')
  const [filter, setFilter] = useState<Filter>('all')
  const [mood, setMood] = useState<Mood>('Bình an')
  const [bingoMarks, setBingoMarks] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)
  const [pendingId, setPendingId] = useState('')
  const [progressMessage, setProgressMessage] = useState('')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      try {
        const saved = JSON.parse(
          sessionStorage.getItem(VIEW_STATE_KEY) ?? '{}',
        ) as {
          showcase?: {
            mood?: Mood
            filter?: Filter
            bingoMarks?: Record<string, boolean>
            bookmarked?: boolean
          }
        }
        const showcase = saved.showcase
        if (showcase) {
          if (moods.some((item) => item.label === showcase.mood))
            setMood(showcase.mood ?? 'Bình an')
          if (
            ['all', 'short', 'medium', 'challenge'].includes(
              showcase.filter ?? '',
            )
          )
            setFilter(showcase.filter ?? 'all')
          if (showcase.bingoMarks && typeof showcase.bingoMarks === 'object')
            setBingoMarks(showcase.bingoMarks)
          setBookmarked(Boolean(showcase.bookmarked))
        }
      } catch {
        setMood('Bình an')
        setFilter('all')
        setBingoMarks({})
        setBookmarked(false)
      }
      setHydrated(true)
    })
    return () => {
      active = false
    }
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
          showcase: { mood, filter, bingoMarks, bookmarked },
        }),
      )
    } catch {
      try {
        sessionStorage.setItem(
          VIEW_STATE_KEY,
          JSON.stringify({
            showcase: { mood, filter, bingoMarks, bookmarked },
          }),
        )
      } catch {}
    }
  }, [mood, filter, bingoMarks, bookmarked, hydrated])

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
    void Promise.all(
      dates.map(async (date) => {
        try {
          return await getResourceJourney(date, timeZone, controller.signal)
        } catch (error) {
          if (
            error instanceof ResourceJourneyBrowserError &&
            error.status === 404
          )
            return null
          throw error
        }
      }),
    )
      .then((items) => {
        if (!active) return
        setJourneys(
          Object.fromEntries(
            items
              .filter((item): item is ResourceJourney => item !== null)
              .map((item) => [item.localDate, item]),
          ),
        )
        setJourneyState('ready')
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
  }, [dates, today])

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
  const stamped = bingoTiles.map((item) => bingoMarks[item.id] ?? false)
  const stampedCount = stamped.filter(Boolean).length
  const lineComplete = bingoLines.some((line) =>
    line.every((index) => stamped[index]),
  )
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

  async function toggleDaily(resource: PublicResourceSummary) {
    if (pendingId) return
    setPendingId(resource.id)
    setProgressMessage('')
    try {
      const saved = await saveResourceProgress(resource.id, today, {
        status: 'COMPLETED',
        completedActionIds: ['overview-complete'],
      })
      setProgress((current) => [
        ...current.filter(
          (entry) =>
            !(entry.resourceId === resource.id && entry.localDate === today),
        ),
        saved,
      ])
      const refreshed = await getResourceJourney(
        today,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      )
      setJourneys((current) => ({ ...current, [today]: refreshed }))
      window.dispatchEvent(new CustomEvent('mb:resource-progress-updated'))
    } catch {
      setProgressMessage('Chưa thể lưu tiến độ. Hãy thử lại sau một chút.')
    } finally {
      setPendingId('')
    }
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
              ● Thử thách nổi bật hôm nay
            </span>
            <span className={styles.demoBadge}>+50 Điểm Nuôi Dưỡng</span>
            <button
              type="button"
              className={styles.bookmark}
              aria-label={
                bookmarked
                  ? 'Bỏ lưu hoạt động nổi bật'
                  : 'Lưu hoạt động nổi bật'
              }
              aria-pressed={bookmarked}
              onClick={() => setBookmarked((value) => !value)}
            >
              {bookmarked ? '◆' : '◇'}
            </button>
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
            <h2 id="energy-title">Thước đo năng lượng</h2>
            <span>{streak ?? 3} ngày duy trì</span>
          </div>
          <p>Bạn đang cảm thấy thế nào ngay lúc này?</p>
          <div
            className={styles.moods}
            role="group"
            aria-label="Cảm nhận hiện tại"
          >
            {moods.map((item) => (
              <button
                key={item.label}
                type="button"
                aria-pressed={mood === item.label}
                className={mood === item.label ? styles.activeMood : ''}
                onClick={() => setMood(item.label)}
              >
                <span aria-hidden="true">{item.symbol}</span>
                {item.label}
              </button>
            ))}
          </div>
          <div className={styles.energyProgress}>
            <small>Cấp độ 2</small>
            <strong>Người thực hành kiên nhẫn</strong>
            <div className={styles.xpLabel}>420 / 600 XP</div>
            <div className={styles.track}>
              <i style={{ width: '70%' }} />
            </div>
            <p>✨ Hoàn thành một bài tập hôm nay để nhận thêm +50 XP.</p>
          </div>
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
              {progressMessage && <p role="alert">{progressMessage}</p>}
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
              const sampleXp =
                [35, 25, 40, 30, 20][index] ??
                (meta.difficulty === 'CHALLENGE'
                  ? 40
                  : meta.difficulty === 'BALANCED'
                    ? 30
                    : 25)
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
                      <strong>+{sampleXp} XP</strong>
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
        <section className={styles.bingo} aria-labelledby="bingo-title">
          <div className={styles.panelHead}>
            <div>
              <h2 id="bingo-title">Bảng Bingo Thói Quen Lành Tuần Này</h2>
              <p>
                Hoàn thành 3 ô thẳng hàng để nhận Huy hiệu Hoa Sen Tươi Mới.
              </p>
            </div>
            <span>Đã mở: {stampedCount}/9 ô</span>
          </div>
          <div className={styles.bingoGrid}>
            {bingoTiles.map((item, index) => (
              <button
                type="button"
                key={item.id}
                className={`${stamped[index] ? styles.bingoStamped : ''} ${index === 4 ? styles.bingoLucky : ''}`}
                aria-pressed={Boolean(stamped[index])}
                aria-label={`${item.label}, ${stamped[index] ? 'đã đánh dấu' : 'chưa đánh dấu'}`}
                onClick={() =>
                  setBingoMarks((current) => ({
                    ...current,
                    [item.id]: !(current[item.id] ?? false),
                  }))
                }
              >
                <span aria-hidden="true">
                  {stamped[index] ? '✓' : item.symbol}
                </span>
                <strong>{item.label}</strong>
                <small>
                  {stamped[index]
                    ? 'Đã đóng dấu'
                    : index === 4
                      ? 'Ô may mắn'
                      : `+${item.xp} XP`}
                </small>
              </button>
            ))}
          </div>
          <p className={styles.bingoNote} role="status">
            {lineComplete
              ? 'Bạn đã hoàn thành 3 ô thẳng hàng và mở Huy hiệu Hoa Sen Tươi Mới.'
              : 'Chọn một ô sau khi hoàn thành thói quen để đóng dấu.'}
          </p>
        </section>
        <div className={styles.sideStack}>
          <section className={styles.badges} aria-labelledby="badges-title">
            <div className={styles.panelHead}>
              <h2 id="badges-title">Huy Hiệu Tinh Thần Của Bạn</h2>
              <span>Xem tất cả (6)</span>
            </div>
            <div className={styles.badgeGrid}>
              <div>
                <span aria-hidden="true">🔥</span>
                <strong>Giữ Lửa 3N</strong>
                <small>Đang kích hoạt</small>
              </div>
              <div>
                <span aria-hidden="true">🌱</span>
                <strong>Mầm Chữa Lành</strong>
                <small>Đã mở</small>
              </div>
              <div className={styles.lockedBadge}>
                <span aria-hidden="true">☾</span>
                <strong>Ngủ An Lành</strong>
                <small>Cần 2 bài nữa</small>
              </div>
            </div>
          </section>
          <section className={styles.recent} aria-labelledby="recent-title">
            <div className={styles.panelHead}>
              <h2 id="recent-title">Dấu Ấn Vừa Đạt Được</h2>
              <span>Hôm nay</span>
            </div>
            {progressState !== 'ready' ? (
              <p className={styles.panelEmpty} role="status">
                {progressState === 'loading'
                  ? 'Đang tải hoạt động đã hoàn thành…'
                  : 'Chưa tải được lịch sử hoạt động.'}
              </p>
            ) : completedRecent.length ? (
              <div className={styles.recentList}>
                {completedRecent.map(({ entry, resource }, index) => (
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
                      +{index === 0 ? 25 : 10} XP · +1{' '}
                      {index === 0 ? '🌸' : '🌿'}
                    </em>
                  </Link>
                ))}
              </div>
            ) : (
              <p className={styles.panelEmpty}>
                Hoàn thành một bài tập để nhận dấu ấn đầu tiên.
              </p>
            )}
            <div className={styles.recentBanner}>
              🎉 Bạn đã chăm sóc bản thân tốt hơn hôm qua!
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
