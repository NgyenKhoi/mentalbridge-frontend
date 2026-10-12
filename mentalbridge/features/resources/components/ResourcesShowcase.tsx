'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { TodayEmotionSummary } from '@/features/emotion-check-in/TodayEmotionSummary'
import { ApiError } from '@/lib/api/api-error'

import {
  getResourceBingo,
  setResourceBingoSelfConfirmation,
  type ResourceBingoBoard,
} from '../api/browser-resource-engagement'
import {
  getResourceJourney,
  ResourceJourneyBrowserError,
  type ResourceJourney,
} from '../api/browser-resource-journey'
import {
  getResourceProgress,
  saveResourceProgress,
  type ResourceProgressItem,
} from '../api/browser-resource-progress'
import {
  getResourceCatalogue,
  type PublicResourceSummary,
} from '../api/browser-resources'
import {
  localDate,
  recentDates,
  resourcePresentation,
  shiftDate,
} from '../model/resource-experience'
import { useResourceBookmarks } from '../hooks/useResourceBookmarks'
import { AnimatedResourceSticker } from './AnimatedResourceSticker'
import { ResourceBingoPanel } from './ResourceBingoPanel'
import styles from './resources-showcase.module.css'

type Filter = 'all' | 'short' | 'medium' | 'challenge'
type JourneyState =
  | 'loading'
  | 'ready'
  | 'partial'
  | 'missing'
  | 'plan-required'
  | 'error'
  | 'reconciling'
  | 'stale-current'
type JourneyDateState =
  'ready' | 'missing' | 'plan-required' | 'error' | 'stale'
type BingoState = 'idle' | 'loading' | 'ready' | 'missing' | 'error' | 'stale'

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

function currentJourneyState(
  today: string,
  states: Record<string, JourneyDateState>,
): JourneyState {
  const todayState = states[today]
  if (todayState === 'missing') return 'missing'
  if (todayState === 'plan-required') return 'plan-required'
  if (todayState === 'stale') return 'stale-current'
  if (todayState === 'error' || !todayState) return 'error'
  return Object.values(states).some((state) => state !== 'ready')
    ? 'partial'
    : 'ready'
}

function journeyStateCopy(state: JourneyState) {
  if (state === 'loading') return 'Đang tải tiến độ đã lưu…'
  if (state === 'reconciling')
    return 'Đã lưu hoàn thành. Đang đối soát lại tổng ngày, chuỗi thực hành và bingo…'
  if (state === 'stale-current')
    return 'Hoàn thành đã được lưu, nhưng chưa thể đối soát hành trình hôm nay. Tổng ngày, chuỗi thực hành và bingo đang được ẩn cho đến khi xác minh lại.'
  if (state === 'missing') return 'Chưa có dữ liệu hành trình cho ngày hôm nay.'
  if (state === 'plan-required')
    return 'Bạn cần một kế hoạch hỗ trợ đang hoạt động để xem nhịp thực hành.'
  return 'Chưa tải được tiến độ từ dịch vụ nội dung.'
}

export default function ResourcesShowcase() {
  const today = useMemo(() => localDate(), [])
  const dates = useMemo(() => recentDates(today), [today])
  const [resources, setResources] = useState<PublicResourceSummary[]>([])
  const [progress, setProgress] = useState<ResourceProgressItem[]>([])
  const [journeys, setJourneys] = useState<Record<string, ResourceJourney>>({})
  const [journeyDateStates, setJourneyDateStates] = useState<
    Record<string, JourneyDateState>
  >({})
  const [catalogueState, setCatalogueState] = useState<
    'loading' | 'ready' | 'empty' | 'error'
  >('loading')
  const [progressState, setProgressState] = useState<
    'loading' | 'ready' | 'error'
  >('loading')
  const [journeyState, setJourneyState] = useState<JourneyState>('loading')
  const [filter, setFilter] = useState<Filter>('all')
  const [expanded, setExpanded] = useState(false)
  const [pendingId, setPendingId] = useState('')
  const [saveError, setSaveError] = useState('')
  const [completionMessage, setCompletionMessage] = useState('')
  const [journeyRetrying, setJourneyRetrying] = useState(false)
  const [bingoBoard, setBingoBoard] = useState<ResourceBingoBoard | null>(null)
  const [bingoWeekStart, setBingoWeekStart] = useState('')
  const [bingoEtag, setBingoEtag] = useState('')
  const [bingoState, setBingoState] = useState<BingoState>('idle')
  const [bingoPendingPosition, setBingoPendingPosition] = useState<
    number | null
  >(null)
  const bookmarks = useResourceBookmarks()
  const acknowledgedCompletions = useRef(new Set<string>())

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
        if (!active) return
        setProgress([...items])
        setProgressState('ready')
      })
      .catch(() => {
        if (active) setProgressState('error')
      })

    void Promise.allSettled(
      dates.map((date) =>
        getResourceJourney(date, timeZone, controller.signal),
      ),
    ).then((results) => {
      if (!active) return
      const nextJourneys: Record<string, ResourceJourney> = {}
      const nextStates: Record<string, JourneyDateState> = {}

      results.forEach((result, index) => {
        const date = dates[index]
        if (result.status === 'fulfilled') {
          nextJourneys[date] = result.value
          nextStates[date] = 'ready'
          return
        }
        const error = result.reason as unknown
        if (error instanceof Error && error.name === 'AbortError') return
        if (
          error instanceof ResourceJourneyBrowserError &&
          error.status === 404
        ) {
          nextStates[date] = 'missing'
        } else if (
          error instanceof ResourceJourneyBrowserError &&
          error.status === 409
        ) {
          nextStates[date] = 'plan-required'
        } else {
          nextStates[date] = 'error'
        }
      })

      setJourneys(nextJourneys)
      setJourneyDateStates(nextStates)
      setJourneyState(currentJourneyState(today, nextStates))
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
  const journey =
    journeyDateStates[today] === 'ready' ? journeys[today] : undefined

  async function fetchBingo(weekStart: string) {
    try {
      const result = await getResourceBingo(weekStart)
      setBingoBoard(result.board)
      setBingoEtag(result.etag)
      setBingoWeekStart(weekStart)
      setBingoState('ready')
    } catch (error) {
      setBingoBoard(null)
      setBingoEtag('')
      setBingoWeekStart(weekStart)
      setBingoState(
        error instanceof ApiError && error.status === 404 ? 'missing' : 'error',
      )
    }
  }

  async function loadBingo(weekStart: string) {
    setBingoState('loading')
    setBingoBoard(null)
    setBingoEtag('')
    setBingoWeekStart(weekStart)
    await fetchBingo(weekStart)
  }

  useEffect(() => {
    const weekStart = journey?.weekStart
    if (!weekStart) return
    let active = true
    void getResourceBingo(weekStart)
      .then((result) => {
        if (!active) return
        setBingoBoard(result.board)
        setBingoEtag(result.etag)
        setBingoWeekStart(weekStart)
        setBingoState('ready')
      })
      .catch((error: unknown) => {
        if (!active) return
        setBingoBoard(null)
        setBingoEtag('')
        setBingoWeekStart(weekStart)
        setBingoState(
          error instanceof ApiError && error.status === 404
            ? 'missing'
            : 'error',
        )
      })
    return () => {
      active = false
    }
  }, [journey?.weekStart])

  const currentBingoBoard =
    journey?.weekStart === bingoWeekStart ? bingoBoard : null
  const currentBingoState: BingoState = journey?.weekStart
    ? journey.weekStart === bingoWeekStart
      ? bingoState
      : 'loading'
    : 'idle'
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

  async function reconcileTodayJourney() {
    if (journeyRetrying) return
    setJourneyRetrying(true)
    setJourneyState('reconciling')

    try {
      const refreshed = await getResourceJourney(
        today,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      )
      const nextStates = { ...journeyDateStates, [today]: 'ready' as const }
      setJourneys((current) => ({ ...current, [today]: refreshed }))
      setJourneyDateStates(nextStates)
      setJourneyState(currentJourneyState(today, nextStates))
      await loadBingo(refreshed.weekStart)
    } catch {
      setJourneys((current) => {
        const next = { ...current }
        delete next[today]
        return next
      })
      setJourneyDateStates((current) => ({
        ...current,
        [today]: 'stale',
      }))
      setJourneyState('stale-current')
    } finally {
      setJourneyRetrying(false)
    }
  }

  async function toggleBingo(position: number, selfConfirmed: boolean) {
    if (!bingoBoard || bingoState !== 'ready' || bingoPendingPosition !== null)
      return
    setBingoPendingPosition(position)
    try {
      const result = await setResourceBingoSelfConfirmation(
        bingoBoard.weekStart,
        position,
        selfConfirmed,
        bingoEtag,
      )
      setBingoBoard(result.board)
      setBingoEtag(result.etag)
      setBingoState('ready')
    } catch {
      // The write may have committed or another device may have changed the
      // version. Never present the previous board as current after either case.
      setBingoBoard(null)
      setBingoEtag('')
      setBingoWeekStart(bingoBoard.weekStart)
      setBingoState('stale')
    } finally {
      setBingoPendingPosition(null)
    }
  }

  async function toggleDaily(resource: PublicResourceSummary) {
    if (pendingId) return
    const key = `${resource.id}:${today}`
    const wasCompleted = progress.some(
      (entry) =>
        entry.resourceId === resource.id &&
        entry.localDate === today &&
        entry.status === 'COMPLETED',
    )
    setPendingId(resource.id)
    setSaveError('')
    setCompletionMessage('')

    let saved: ResourceProgressItem
    try {
      saved = await saveResourceProgress(resource.id, today, {
        status: 'COMPLETED',
        completedActionIds: ['overview-complete'],
      })
    } catch {
      setSaveError('Chưa thể lưu tiến độ. Hãy thử lại sau một chút.')
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
    setProgressState('ready')
    if (
      saved.status === 'COMPLETED' &&
      !wasCompleted &&
      !acknowledgedCompletions.current.has(key)
    ) {
      acknowledgedCompletions.current.add(key)
      setCompletionMessage(`Đã lưu hoàn thành “${resource.title}”.`)
    }
    window.dispatchEvent(new CustomEvent('mb:resource-progress-updated'))
    setJourneys((current) => {
      const next = { ...current }
      delete next[today]
      return next
    })
    setJourneyDateStates((current) => ({ ...current, [today]: 'stale' }))

    await reconcileTodayJourney()
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
            ? 'Không thể xác nhận danh mục và tiến độ lúc này. Hãy thử tải lại sau ít phút.'
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
              ● Hoạt động nổi bật trong kho
            </span>
            {feature?.sourceOrganization && (
              <span className={styles.demoBadge}>
                Nguồn: {feature.sourceOrganization}
              </span>
            )}
            {feature && (
              <button
                type="button"
                className={styles.bookmark}
                aria-label={`${bookmarks.isBookmarked(feature.id) ? 'Bỏ lưu' : 'Lưu'}: ${feature.title}`}
                aria-pressed={
                  bookmarks.state === 'ready' &&
                  bookmarks.isBookmarked(feature.id)
                }
                disabled={
                  bookmarks.state !== 'ready' ||
                  bookmarks.pendingResourceId !== null
                }
                onClick={() => void bookmarks.toggle(feature.id)}
              >
                {bookmarks.pendingResourceId === feature.id
                  ? '…'
                  : bookmarks.isBookmarked(feature.id)
                    ? '★'
                    : '☆'}
              </button>
            )}
          </div>
          <div className={styles.heroContent}>
            <p className={styles.heroDate}>
              {todayLabel} · Tài nguyên đã xuất bản
            </p>
            <h1 id="resource-hero-title">{feature?.title}</h1>
            <p>{feature?.summary}</p>
            <div className={styles.heroActions}>
              {feature && (
                <Link
                  className={styles.mintButton}
                  href={resourceHref(feature, today)}
                >
                  ▶ Mở hoạt động · {resourcePresentation(feature).minutes} phút
                </Link>
              )}
              {mediaResource && mediaResource.id !== feature?.id && (
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
            <h2 id="energy-title">Nhịp thực hành</h2>
            {journey &&
              (journey.progress.practiceStreakDays > 0 ? (
                <span>{journey.progress.practiceStreakDays} ngày đã lưu</span>
              ) : (
                <span>Chưa có chuỗi thực hành</span>
              ))}
          </div>

          {journey ? (
            <>
              <div className={styles.energyProgress}>
                <small>TIẾN ĐỘ NGÀY {today}</small>
                <strong>
                  {journey.progress.dailyCompleted}/
                  {journey.progress.dailyTotal} hoạt động đã hoàn thành
                </strong>
                <div className={styles.actualProgress}>
                  Dữ liệu từ kế hoạch phiên bản {journey.planVersion}
                </div>
                <div
                  className={styles.track}
                  role="progressbar"
                  aria-label="Tiến độ hoạt động hôm nay"
                  aria-valuemin={0}
                  aria-valuemax={journey.progress.dailyTotal}
                  aria-valuenow={journey.progress.dailyCompleted}
                >
                  <i
                    style={{
                      width: `${journey.progress.dailyTotal > 0 ? (journey.progress.dailyCompleted / journey.progress.dailyTotal) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p>Chỉ những lần hoàn thành đã lưu mới được tính ở đây.</p>
              </div>
              {journeyState === 'partial' && (
                <p className={styles.stateNote} role="status">
                  Một số ngày trước chưa tải được. Tiến độ hôm nay vẫn là dữ
                  liệu đã lưu.
                </p>
              )}
            </>
          ) : (
            <div className={styles.journeyState} role="status">
              <p>{journeyStateCopy(journeyState)}</p>
              {journeyState === 'stale-current' ? (
                <button
                  type="button"
                  disabled={journeyRetrying}
                  onClick={() => void reconcileTodayJourney()}
                >
                  Đối soát lại
                </button>
              ) : (
                journeyState !== 'loading' &&
                journeyState !== 'reconciling' && (
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                  >
                    Tải lại tiến độ
                  </button>
                )
              )}
            </div>
          )}

          <div className={styles.weekDots} aria-label="Bảy ngày gần đây">
            {dates.map((date) => {
              const state = journeyDateStates[date]
              const dayJourney = state === 'ready' ? journeys[date] : undefined
              const done = Boolean(dayJourney?.progress.dailyCompleted)
              const label =
                date === today
                  ? 'Hôm nay'
                  : new Intl.DateTimeFormat('vi-VN', {
                      weekday: 'short',
                    }).format(new Date(`${date}T12:00:00`))
              return (
                <span
                  key={date}
                  aria-label={`${label}: ${state === 'ready' ? (done ? 'có hoạt động đã lưu' : 'chưa có hoạt động hoàn thành') : 'chưa tải được dữ liệu'}`}
                  className={`${date === today ? styles.todayDot : ''} ${done ? styles.dayDone : ''} ${state !== 'ready' ? styles.dayUnknown : ''}`}
                >
                  <small aria-hidden="true">{label}</small>
                  <i aria-hidden="true" />
                </span>
              )
            })}
          </div>

          {journey && progressState === 'ready' && (
            <details className={styles.dailyDetails} open>
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
                        aria-label={`${complete ? 'Đã lưu hoàn thành' : 'Ghi nhận hoàn thành và lưu'}: ${resource.title}`}
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
          {saveError && <p role="alert">{saveError}</p>}
          {completionMessage && (
            <p className={styles.completionNotice} role="status">
              ✓ {completionMessage}
            </p>
          )}
          {progressState === 'error' && (
            <p className={styles.stateNote} role="status">
              Chưa tải được danh sách tiến độ. Trang sẽ không suy đoán trạng
              thái hoàn thành.
            </p>
          )}
        </aside>
      </div>

      <section className={styles.catalogue} aria-labelledby="catalogue-title">
        {bookmarks.state !== 'ready' && (
          <div className={styles.bookmarkState} role="status">
            <p>
              {bookmarks.state === 'loading'
                ? 'Đang tải danh sách đã lưu…'
                : bookmarks.state === 'stale'
                  ? 'Thay đổi mục đã lưu chưa được đối soát. Trạng thái cũ đang được ẩn.'
                  : 'Chưa tải được danh sách đã lưu. Bạn vẫn có thể mở tài nguyên.'}
            </p>
            {bookmarks.state !== 'loading' && (
              <button type="button" onClick={() => void bookmarks.retry()}>
                Tải lại mục đã lưu
              </button>
            )}
          </div>
        )}
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.titleLine}>
              <span className={styles.eyebrow} data-resource-ink="light">
                Kho tài nguyên
              </span>
              <h2 id="catalogue-title">Hoạt động chăm sóc tinh thần</h2>
            </div>
            <p>
              Mở một hoạt động để xem nội dung. Trạng thái hoàn thành chỉ xuất
              hiện sau khi được lưu.
            </p>
          </div>
          <div
            className={styles.filters}
            role="group"
            aria-label="Lọc hoạt động"
          >
            {(
              [
                ['all', 'Tất cả'],
                ['short', 'Dưới 5 phút'],
                ['medium', '5–10 phút'],
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
              const savedProgress =
                progressState === 'ready'
                  ? progress.find(
                      (entry) =>
                        entry.resourceId === resource.id &&
                        entry.localDate === today,
                    )
                  : undefined
              const progressLabel =
                progressState === 'error'
                  ? 'Chưa tải được tiến độ'
                  : savedProgress?.status === 'COMPLETED'
                    ? `Đã lưu hoàn thành · bản ${savedProgress.contentVersion}`
                    : savedProgress?.status === 'IN_PROGRESS'
                      ? `Đang thực hiện · bản ${savedProgress.contentVersion}`
                      : meta.difficulty === 'GENTLE'
                        ? 'Dễ chịu'
                        : meta.difficulty === 'BALANCED'
                          ? 'Vừa sức'
                          : 'Thử thách nhẹ'
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
                        {meta.minutes} phút ·{' '}
                        {resource.resourceKind === 'PRACTICE'
                          ? 'Thực hành'
                          : 'Khám phá'}
                      </span>
                      <strong>
                        {resource.sourceOrganization
                          ? `Nguồn: ${resource.sourceOrganization}`
                          : 'Nguồn chưa công bố'}
                      </strong>
                    </div>
                    <h3>{resource.title}</h3>
                    <p>{resource.summary}</p>
                    {index === 4 && filter === 'all' && (
                      <div className={styles.wave} aria-hidden="true">
                        {Array.from({ length: 9 }, (_, waveIndex) => (
                          <i key={waveIndex} />
                        ))}
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
                        {progressLabel}
                      </span>
                      <button
                        type="button"
                        className={styles.cardBookmark}
                        aria-label={`${bookmarks.isBookmarked(resource.id) ? 'Bỏ lưu' : 'Lưu'}: ${resource.title}`}
                        aria-pressed={
                          bookmarks.state === 'ready' &&
                          bookmarks.isBookmarked(resource.id)
                        }
                        disabled={
                          bookmarks.state !== 'ready' ||
                          bookmarks.pendingResourceId !== null
                        }
                        onClick={() => void bookmarks.toggle(resource.id)}
                      >
                        {bookmarks.pendingResourceId === resource.id
                          ? '…'
                          : bookmarks.isBookmarked(resource.id)
                            ? '★ Đã lưu'
                            : '☆ Lưu'}
                      </button>
                      <Link
                        href={resourceHref(resource, today)}
                        aria-label={`Mở hoạt động: ${resource.title}`}
                      >
                        Mở hoạt động →
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
          board={currentBingoBoard}
          state={currentBingoState}
          pendingPosition={bingoPendingPosition}
          onToggle={(position, selfConfirmed) =>
            void toggleBingo(position, selfConfirmed)
          }
          onRetry={() => {
            if (journey?.weekStart) void loadBingo(journey.weekStart)
          }}
        />

        <div className={styles.sideStack}>
          <TodayEmotionSummary />
          <section className={styles.badges} aria-labelledby="truth-title">
            <div className={styles.panelHead}>
              <h2 id="truth-title">Tiến độ của bạn</h2>
            </div>
            <p className={styles.truthCopy}>
              Trang này chỉ hiển thị hoạt động và chuỗi thực hành đã được lưu.
              Việc mở nội dung không được tính là hoàn thành.
            </p>
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
                  : 'Chưa tải được lịch sử hoạt động. Không có dữ liệu nào được suy đoán.'}
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
