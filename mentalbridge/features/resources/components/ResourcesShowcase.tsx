'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { TodayEmotionSummary } from '@/features/emotion-check-in/TodayEmotionSummary'
import { publishMamResources } from '@/features/mam/mam-resources'
import { useMamPageTarget, useMamTarget } from '@/features/mam/use-mam-target'

import {
  getResourceCatalogue,
  type PublicResourceSummary,
} from '../api/browser-resources'
import {
  getResourceProgress,
  type ResourceProgressItem,
} from '../api/browser-resource-progress'
import type { PlanResourceActionsV1 } from '@/features/support-plan/api/support-plan-contract'
import {
  getResourceJourney,
  ResourceJourneyBrowserError,
  type ResourceJourney,
} from '../api/browser-resource-journey'
import { useResourceBookmarks } from '../hooks/useResourceBookmarks'
import {
  localDate,
  recentDates,
  resourcePresentation,
  shiftDate,
} from '../model/resource-experience'
import { AnimatedResourceSticker } from './AnimatedResourceSticker'
import { resourceArtwork } from '../model/resource-artwork'
import { PlanResourcesSection } from './PlanResourcesSection'
import styles from './resources-showcase.module.css'

type Filter = 'all' | 'short' | 'medium' | 'challenge'

const VIEW_STATE_KEY = 'mentalbridge:resources:view'

function resourceHref(resource: PublicResourceSummary, date: string) {
  return `/resources/${resource.id}?from=resources&date=${date}`
}

function ResourceArt({ resource }: { resource: PublicResourceSummary }) {
  const meta = resourcePresentation(resource)
  const artwork = resourceArtwork(resource)

  return (
    <div
      className={`${styles.art} ${styles[`art${resource.category}`]}`}
      data-resource-surface="dark"
    >
      <Image
        src={artwork.src}
        alt={artwork.alt}
        fill
        sizes="(max-width: 600px) 100vw, (max-width: 900px) 90vw, 44vw"
        className={styles.artImage}
        style={{ objectPosition: artwork.position }}
      />
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

/** Registers one catalogue card as a Mầm target by its ID only. */
function MamResourceTarget({
  resourceId,
  children,
}: Readonly<{
  resourceId: string
  children: (ref: (element: Element | null) => void) => ReactNode
}>) {
  return children(
    useMamTarget({ kind: 'resources.card', context: { resourceId } }),
  )
}

export default function ResourcesShowcase() {
  useMamPageTarget({ kind: 'resources.page' })
  const today = useMemo(() => localDate(), [])
  const dates = useMemo(() => recentDates(today), [today])
  const bookmarks = useResourceBookmarks()
  const [resources, setResources] = useState<PublicResourceSummary[]>([])
  const [progress, setProgress] = useState<ResourceProgressItem[]>([])
  const [journeys, setJourneys] = useState<Record<string, ResourceJourney>>({})
  const [planProjection, setPlanProjection] =
    useState<PlanResourceActionsV1 | null>(null)
  const [catalogueState, setCatalogueState] = useState<
    'loading' | 'ready' | 'empty' | 'error'
  >('loading')
  const [progressState, setProgressState] = useState<
    'loading' | 'ready' | 'error'
  >('loading')
  const [journeyState, setJourneyState] = useState<
    'loading' | 'ready' | 'plan-required' | 'missing' | 'error'
  >('loading')
  const [partialHistory, setPartialHistory] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [expanded, setExpanded] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  // The journey BFF answers 409 without an ACTIVE plan, so do not ask for it.
  const planActive = planProjection?.planState === 'ACTIVE'

  useEffect(
    () =>
      publishMamResources(resources, (resource) =>
        resourceHref(resource, today),
      ),
    [resources, today],
  )

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

  useEffect(() => {
    const controller = new AbortController()
    let active = true
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
    return () => {
      active = false
      controller.abort()
    }
  }, [today])

  useEffect(() => {
    if (!planActive) return
    const controller = new AbortController()
    let active = true
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
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
  }, [dates, today, planActive])

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
  const journey = planActive ? journeys[today] : undefined
  const todayPlanActions =
    planProjection?.actions.filter(
      (action) => action.today && action.today.displayState !== 'SKIPPED',
    ) ?? []
  const completedPlanActions = todayPlanActions.filter(
    (action) => action.today?.displayState === 'COMPLETED',
  ).length
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

        <div className={styles.planSlot}>
          <PlanResourcesSection onPlanChange={setPlanProjection} />
        </div>

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
          {planActive && (
            <>
              <div
                className={styles.energyProgress}
                data-testid="today-plan-progress"
              >
                <small>Kế hoạch hôm nay</small>
                <strong>
                  {completedPlanActions}/{todayPlanActions.length} hoạt động hôm
                  nay đã ghi nhận
                </strong>
                {todayPlanActions.length > 0 && (
                  <div className={styles.track}>
                    <i
                      style={{
                        width: `${(completedPlanActions / todayPlanActions.length) * 100}%`,
                      }}
                    />
                  </div>
                )}
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
            </>
          )}
          {planProjection && (
            <Link className={styles.planJump} href="#plan-resources">
              Hoạt động trong kế hoạch hôm nay
            </Link>
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
                <MamResourceTarget key={resource.id} resourceId={resource.id}>
                  {(mamRef) => (
                    <article
                      ref={mamRef}
                      role="listitem"
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
                          <strong
                            title={
                              resource.sourceOrganization ??
                              'Nguồn chưa cập nhật'
                            }
                          >
                            {resource.sourceOrganization ??
                              'Nguồn chưa cập nhật'}
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
                              index === 4 && filter === 'all'
                                ? 'dark'
                                : undefined
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
                  )}
                </MamResourceTarget>
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
  )
}
