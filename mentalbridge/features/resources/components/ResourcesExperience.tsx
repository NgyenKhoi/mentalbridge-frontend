'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

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
  getResourceJourney,
  ResourceJourneyBrowserError,
  type ResourceJourney,
} from '../api/browser-resource-journey'
import {
  difficultyLabels,
  formatLabels,
  localDate,
  progressFor,
  recentDates,
  resourcePresentation,
  shiftDate,
  type ResourceDifficulty,
  type ResourceFormat,
} from '../model/resource-experience'
import { AnimatedResourceSticker } from './AnimatedResourceSticker'
import { ResourcePreview } from './ResourcePreview'

const VIEW_STATE_KEY = 'mentalbridge:resources:view'

type ViewState = Readonly<{
  date: string
  difficulty: ResourceDifficulty | 'ALL'
  format: ResourceFormat | 'ALL'
  scrollY: number
}>

type Reward = 'resource' | 'day' | null

function statusLabel(progress: ResourceProgressItem | undefined) {
  if (progress?.status === 'COMPLETED') return 'Đã hoàn thành'
  if (progress?.status === 'IN_PROGRESS') return 'Đang làm'
  return 'Chưa làm'
}

function readSavedView(today: string): ViewState {
  if (typeof window === 'undefined') {
    return { date: today, difficulty: 'ALL', format: 'ALL', scrollY: 0 }
  }
  try {
    const value = JSON.parse(
      sessionStorage.getItem(VIEW_STATE_KEY) ?? '',
    ) as Partial<ViewState>
    const dates = recentDates(today)
    return {
      date:
        typeof value.date === 'string' && dates.includes(value.date)
          ? value.date
          : today,
      difficulty: ['ALL', 'GENTLE', 'BALANCED', 'CHALLENGE'].includes(
        value.difficulty ?? '',
      )
        ? (value.difficulty as ViewState['difficulty'])
        : 'ALL',
      format: ['ALL', 'READ', 'VIDEO', 'PRACTICE'].includes(value.format ?? '')
        ? (value.format as ViewState['format'])
        : 'ALL',
      scrollY:
        typeof value.scrollY === 'number' && Number.isFinite(value.scrollY)
          ? value.scrollY
          : 0,
    }
  } catch {
    return { date: today, difficulty: 'ALL', format: 'ALL', scrollY: 0 }
  }
}

function persistView(value: ViewState) {
  sessionStorage.setItem(VIEW_STATE_KEY, JSON.stringify(value))
}

export default function ResourcesExperience() {
  const today = useMemo(() => localDate(), [])
  const initial = useMemo(() => readSavedView(today), [today])
  const [selectedDate, setSelectedDate] = useState(initial.date)
  const [difficulty, setDifficulty] = useState<ViewState['difficulty']>(
    initial.difficulty,
  )
  const [format, setFormat] = useState<ViewState['format']>(initial.format)
  const [resources, setResources] = useState<PublicResourceSummary[]>([])
  const [progress, setProgress] = useState<ResourceProgressItem[]>([])
  const [journeys, setJourneys] = useState<Record<string, ResourceJourney>>({})
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>(
    'loading',
  )
  const [progressState, setProgressState] = useState<
    'loading' | 'ready' | 'error'
  >('loading')
  const [journeyState, setJourneyState] = useState<
    'loading' | 'ready' | 'plan-required' | 'error'
  >('loading')
  const [pendingId, setPendingId] = useState('')
  const [message, setMessage] = useState('')
  const [reward, setReward] = useState<Reward>(null)
  const heroVideoRef = useRef<HTMLVideoElement>(null)

  const dates = useMemo(() => recentDates(today), [today])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    void getResourceCatalogue(controller.signal, 'vi-VN')
      .then((catalogue) => {
        if (!active) return
        if (catalogue.unavailable) throw new Error('unavailable')
        setResources(catalogue.items)
        setState(catalogue.items.length === 0 ? 'empty' : 'ready')
        window.requestAnimationFrame(() => window.scrollTo(0, initial.scrollY))
      })
      .catch((error: unknown) => {
        if (
          !active ||
          (error instanceof Error && error.name === 'AbortError')
        ) {
          return
        }
        setState('error')
      })

    void getResourceProgress(shiftDate(today, -14), today)
      .then((history) => {
        if (!active) return
        setProgress([...history])
        setProgressState('ready')
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
          ) {
            return null
          }
          throw error
        }
      }),
    )
      .then((dailyJourneys) => {
        if (!active) return
        const availableJourneys = dailyJourneys.filter(
          (journey): journey is ResourceJourney => journey !== null,
        )
        setJourneys(
          Object.fromEntries(
            availableJourneys.map((journey) => [journey.localDate, journey]),
          ),
        )
        setJourneyState('ready')
      })
      .catch((error: unknown) => {
        if (
          !active ||
          (error instanceof Error && error.name === 'AbortError')
        ) {
          return
        }
        if (
          error instanceof ResourceJourneyBrowserError &&
          error.status === 409
        ) {
          setJourneyState('plan-required')
          return
        }
        setJourneyState('error')
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [dates, initial.scrollY, today])

  useEffect(() => {
    const save = () =>
      persistView({
        date: selectedDate,
        difficulty,
        format,
        scrollY: window.scrollY,
      })
    window.addEventListener('scroll', save, { passive: true })
    window.addEventListener('pagehide', save)
    return () => {
      save()
      window.removeEventListener('scroll', save)
      window.removeEventListener('pagehide', save)
    }
  }, [difficulty, format, selectedDate])

  const selectedJourney = journeys[selectedDate]
  const selected = useMemo(
    () => selectedJourney?.items.map((item) => item.resource) ?? [],
    [selectedJourney],
  )
  const selectedCompleted = selected.filter(
    (resource) =>
      progressFor(progress, resource.id, selectedDate)?.status === 'COMPLETED',
  ).length
  const nextResource = selected.find(
    (resource) =>
      progressFor(progress, resource.id, selectedDate)?.status !== 'COMPLETED',
  )
  const filtered = resources.filter((resource) => {
    const meta = resourcePresentation(resource)
    return (
      (difficulty === 'ALL' || meta.difficulty === difficulty) &&
      (format === 'ALL' || meta.format === format)
    )
  })
  const streak = journeys[today]?.progress.practiceStreakDays ?? 0
  const completedRecent = progress
    .filter((entry) => entry.status === 'COMPLETED')
    .sort((left, right) =>
      (right.completedAt ?? '').localeCompare(left.completedAt ?? ''),
    )
    .slice(0, 8)
    .flatMap((entry) => {
      const resource = resources.find(
        (candidate) => candidate.id === entry.resourceId,
      )
      return resource ? [{ entry, resource }] : []
    })
  const spotlight =
    (progressState === 'ready' ? nextResource : undefined) ??
    resources.find((resource) => resource.resourceKind === 'PRACTICE') ??
    resources[0]

  function playHeroPreview() {
    if (
      window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      const video = heroVideoRef.current
      if (video) void video.play().catch(() => video.pause())
    }
  }

  async function toggleDaily(
    resource: PublicResourceSummary,
    completed: boolean,
  ) {
    if (pendingId) return
    setPendingId(resource.id)
    setMessage('')
    try {
      const saved = await saveResourceProgress(resource.id, selectedDate, {
        status: completed ? 'COMPLETED' : 'IN_PROGRESS',
        completedActionIds: completed ? ['overview-complete'] : [],
      })
      const next = [
        ...progress.filter(
          (entry) =>
            !(
              entry.resourceId === resource.id &&
              entry.localDate === selectedDate
            ),
        ),
        saved,
      ]
      setProgress(next)
      const refreshedJourney = await getResourceJourney(
        selectedDate,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      )
      setJourneys((current) => ({
        ...current,
        [selectedDate]: refreshedJourney,
      }))
      window.dispatchEvent(new CustomEvent('mb:resource-progress-updated'))
      if (completed) {
        const completedCount = selected.filter(
          (candidate) =>
            progressFor(next, candidate.id, selectedDate)?.status ===
            'COMPLETED',
        ).length
        setReward(completedCount === selected.length ? 'day' : 'resource')
      }
    } catch {
      setMessage('Chưa thể lưu tiến độ. Thử lại sau một chút nhé.')
    } finally {
      setPendingId('')
    }
  }

  if (state === 'loading') {
    return (
      <section
        className="resource-journey-state"
        role="status"
        aria-busy="true"
      >
        <div className="resource-journey-state-sticker">
          <AnimatedResourceSticker variant="garden" size="large" />
        </div>
        <h1>Đang chuẩn bị góc nhỏ cho bạn…</h1>
        <p>Những hoạt động hôm nay đang được sắp xếp thật nhẹ nhàng.</p>
        <div className="resource-journey-skeleton" aria-hidden="true" />
      </section>
    )
  }

  if (state === 'error') {
    return (
      <section className="resource-journey-state" role="alert">
        <div className="resource-journey-state-sticker">
          <AnimatedResourceSticker variant="rest" size="large" />
        </div>
        <h1>Góc tài nguyên đang nghỉ một chút</h1>
        <p>
          Tiến độ đã lưu của bạn vẫn an toàn. Hãy tải lại trang sau ít phút.
        </p>
        <button type="button" onClick={() => window.location.reload()}>
          Thử tải lại
        </button>
      </section>
    )
  }

  if (state === 'empty') {
    return (
      <section className="resource-journey-state" role="status">
        <div className="resource-journey-state-sticker">
          <AnimatedResourceSticker variant="garden" size="large" />
        </div>
        <h1>Chưa có tài nguyên</h1>
        <p>Khi tài nguyên mới sẵn sàng, chúng sẽ xuất hiện ở đây.</p>
      </section>
    )
  }

  const selectedDateLabel = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${selectedDate}T12:00:00`))

  return (
    <div className="resource-journey resource-journey-v2">
      <header
        className="resource-welcome resource-hero"
        onMouseEnter={playHeroPreview}
        onMouseLeave={() => heroVideoRef.current?.pause()}
      >
        <video
          ref={heroVideoRef}
          className="resource-hero-video"
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        >
          <source
            src="/videos/openhero/cloud-forest-sanctuaries.mp4"
            type="video/mp4"
          />
        </video>
        <div className="resource-hero-copy">
          <span className="resource-eyebrow">Một khoảng dành cho bạn</span>
          <h1>Hôm nay, bạn muốn dành cho mình điều gì?</h1>
          <p>
            Chọn một nhịp vừa sức, xem trước nội dung và bắt đầu khi bạn sẵn
            sàng.
          </p>
          <div
            className="resource-hero-choices"
            role="group"
            aria-label="Chọn nhịp hoạt động"
          >
            {(['ALL', 'GENTLE', 'BALANCED', 'CHALLENGE'] as const).map(
              (value) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={difficulty === value}
                  className={difficulty === value ? 'is-active' : ''}
                  onClick={() => setDifficulty(value)}
                >
                  {value === 'ALL' ? 'Tất cả' : difficultyLabels[value]}
                </button>
              ),
            )}
          </div>
        </div>
        {spotlight && (
          <div className="resource-hero-spotlight">
            <span>Gợi ý để bắt đầu</span>
            <strong>{spotlight.title}</strong>
            <small>
              {resourcePresentation(spotlight).minutes} phút ·{' '}
              {formatLabels[resourcePresentation(spotlight).format]}
            </small>
            <Link
              href={`/resources/${spotlight.id}?from=resources&date=${selectedDate}`}
              aria-label={`Khám phá hoạt động: ${spotlight.title}`}
            >
              Khám phá hoạt động <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}
      </header>

      <div className="resource-workspace">
        <aside
          className="resource-companion"
          aria-label="Nhịp chăm sóc của bạn"
        >
          {journeyState === 'ready' ? (
            <>
              <section
                className="resource-date-section"
                aria-labelledby="resource-date-title"
              >
                <div className="resource-section-heading compact">
                  <div>
                    <span>01</span>
                    <h2 id="resource-date-title">Nhịp chăm sóc</h2>
                  </div>
                  <p>Chọn ngày để xem những bước nhỏ của bạn.</p>
                </div>
                <div className="resource-streak-pill">
                  <strong>{streak} ngày</strong> duy trì nhịp chăm sóc
                </div>
                <div className="resource-date-strip">
                  {dates.map((date) => {
                    const journey = journeys[date]
                    const total = journey?.items.length ?? 0
                    const count = (journey?.items ?? []).filter(
                      (item) =>
                        progressFor(progress, item.resource.id, date)
                          ?.status === 'COMPLETED',
                    ).length
                    const complete =
                      progressState === 'ready' && total > 0 && count === total
                    const instant = new Date(`${date}T12:00:00`)
                    return (
                      <button
                        type="button"
                        key={date}
                        className={`${date === selectedDate ? 'is-selected' : ''} ${date === today ? 'is-today' : ''}`}
                        aria-pressed={date === selectedDate}
                        aria-label={`${new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }).format(instant)}${complete ? ', đã hoàn thành' : ''}`}
                        onClick={() => setSelectedDate(date)}
                      >
                        <span>
                          {new Intl.DateTimeFormat('vi-VN', {
                            weekday: 'short',
                          }).format(instant)}
                        </span>
                        <strong>{instant.getDate()}</strong>
                        <i aria-hidden="true">
                          {complete ? '✓' : date === today ? '•' : ''}
                        </i>
                      </button>
                    )
                  })}
                </div>
              </section>

              <div className="resource-pattern-divider" aria-hidden="true">
                <span>☁</span>
                <i>✦</i>
                <span>❧</span>
                <i>✦</i>
                <span>☁</span>
              </div>

              <section
                className="resource-daily-card"
                aria-labelledby="daily-title"
              >
                <div
                  className="resource-progress-orb"
                  style={
                    {
                      '--progress': `${selected.length === 0 ? 0 : (selectedCompleted / selected.length) * 100}%`,
                    } as CSSProperties
                  }
                >
                  <div>
                    <strong>
                      {progressState === 'ready'
                        ? `${selectedCompleted}/${selected.length}`
                        : '—'}
                    </strong>
                    <span>
                      {progressState === 'ready' ? 'đã xong' : 'tiến độ'}
                    </span>
                  </div>
                </div>
                <div className="resource-daily-copy">
                  <span>
                    {selectedDate === today
                      ? 'Thử thách hôm nay'
                      : 'Hành trình ngày đã chọn'}
                  </span>
                  <h2 id="daily-title">
                    Một chút bình yên cho {selectedDateLabel}
                  </h2>
                  <p>
                    Chọn nhịp độ phù hợp với bạn. Bỏ lỡ một ngày cũng không sao.
                  </p>
                  {selected.length === 0 ? (
                    <p role="status">
                      Ngày này chưa có hoạt động được xếp lịch.
                    </p>
                  ) : progressState === 'ready' ? (
                    <ul>
                      {selected.map((resource) => {
                        const item = progressFor(
                          progress,
                          resource.id,
                          selectedDate,
                        )
                        const complete = item?.status === 'COMPLETED'
                        return (
                          <li
                            key={resource.id}
                            className={complete ? 'is-complete' : ''}
                          >
                            <label>
                              <input
                                type="checkbox"
                                checked={complete}
                                disabled={pendingId !== '' || complete}
                                onChange={(event) =>
                                  void toggleDaily(
                                    resource,
                                    event.target.checked,
                                  )
                                }
                              />
                              <span aria-hidden="true">
                                {complete ? '✓' : ''}
                              </span>
                              <b>{resource.title}</b>
                            </label>
                            <small>
                              {resourcePresentation(resource).minutes} phút
                            </small>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p role="status">
                      {progressState === 'loading'
                        ? 'Đang tải tiến độ của bạn…'
                        : 'Chưa tải được tiến độ. Bạn vẫn có thể xem tài nguyên bên dưới.'}
                    </p>
                  )}
                  {message && (
                    <p className="resource-inline-error" role="alert">
                      {message}
                    </p>
                  )}
                  {progressState === 'ready' && nextResource ? (
                    <Link
                      className="resource-start-button"
                      href={`/resources/${nextResource.id}?from=resources&date=${selectedDate}`}
                    >
                      Bắt đầu việc kế tiếp <span aria-hidden="true">→</span>
                    </Link>
                  ) : progressState === 'ready' && selected.length > 0 ? (
                    <div className="resource-day-complete">
                      <span aria-hidden="true">🌟</span>
                      Bạn đã dành trọn một khoảng nhỏ cho mình.
                    </div>
                  ) : null}
                </div>
              </section>
            </>
          ) : (
            <section
              className="resource-journey-state resource-journey-inline-state"
              role="status"
            >
              <h2>
                {journeyState === 'loading'
                  ? 'Đang tải hành trình 7 ngày'
                  : journeyState === 'plan-required'
                    ? 'Cần có kế hoạch hỗ trợ để xem hành trình'
                    : 'Chưa tải được hành trình 7 ngày'}
              </h2>
              <p>Danh mục tài nguyên vẫn có thể xem và sử dụng bên dưới.</p>
              {journeyState === 'plan-required' && (
                <Link href="/support-plan">Xem kế hoạch hỗ trợ</Link>
              )}
              {journeyState === 'error' && (
                <button type="button" onClick={() => window.location.reload()}>
                  Thử tải lại hành trình
                </button>
              )}
            </section>
          )}
        </aside>

        <section
          className="resource-catalogue"
          aria-labelledby="catalogue-title"
        >
          <div className="resource-section-heading">
            <div>
              <span>02</span>
              <h2 id="catalogue-title">Kho tài nguyên</h2>
            </div>
            <p role="status">{filtered.length} hoạt động để khám phá</p>
          </div>
          <div
            className="resource-filter-group secondary"
            aria-label="Lọc theo loại nội dung"
          >
            {(['ALL', 'READ', 'VIDEO', 'PRACTICE'] as const).map((value) => (
              <button
                type="button"
                key={value}
                className={format === value ? 'is-active' : ''}
                aria-pressed={format === value}
                onClick={() => setFormat(value)}
              >
                {value === 'ALL' ? 'Mọi loại' : formatLabels[value]}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="resource-filter-empty" role="status">
              <span aria-hidden="true">🧺</span>
              <h3>Chưa có hoạt động khớp bộ lọc</h3>
              <p>Thử một mức độ hoặc loại nội dung khác nhé.</p>
            </div>
          ) : (
            <div className="resource-experience-grid">
              {filtered.map((resource, index) => {
                const meta = resourcePresentation(resource)
                const item = progressFor(progress, resource.id, selectedDate)
                return (
                  <article
                    key={resource.id}
                    className={`resource-experience-card accent-${meta.accent}${index === 0 ? ' is-featured' : ''}`}
                  >
                    <ResourcePreview
                      resource={resource}
                      featured={index === 0}
                    />
                    <div className="resource-card-body">
                      <div className="resource-card-badges">
                        <span>{formatLabels[meta.format]}</span>
                        <span>{difficultyLabels[meta.difficulty]}</span>
                      </div>
                      <h3>{resource.title}</h3>
                      <p>{resource.summary}</p>
                      <div className="resource-card-meta">
                        <span>◷ {meta.minutes} phút</span>
                        <span
                          className={`status-${item?.status?.toLowerCase() ?? 'new'}`}
                        >
                          {progressState === 'ready'
                            ? statusLabel(item)
                            : progressState === 'loading'
                              ? 'Đang tải tiến độ'
                              : 'Chưa rõ tiến độ'}
                        </span>
                      </div>
                      <Link
                        href={`/resources/${resource.id}?from=resources&date=${selectedDate}`}
                        aria-label={`${item?.status === 'IN_PROGRESS' ? 'Tiếp tục' : item?.status === 'COMPLETED' ? 'Xem lại' : 'Khám phá hoạt động'}: ${resource.title}`}
                      >
                        {item?.status === 'IN_PROGRESS'
                          ? 'Tiếp tục'
                          : item?.status === 'COMPLETED'
                            ? 'Xem lại'
                            : 'Khám phá hoạt động'}
                        <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <div className="resource-lower-grid">
        <section className="resource-bingo" aria-labelledby="bingo-title">
          <div className="resource-section-heading compact">
            <div>
              <span>03</span>
              <h2 id="bingo-title">Bingo chăm sóc tuần này</h2>
            </div>
          </div>
          <p>Mỗi hoạt động hoàn thành được ghi dấu trong tuần của bạn.</p>
          {journeyState === 'ready' &&
          progressState === 'ready' &&
          (selectedJourney?.bingo.length ?? 0) === 0 ? (
            <p role="status">Tuần này chưa có ô bingo để ghi dấu.</p>
          ) : journeyState === 'ready' && progressState === 'ready' ? (
            <div className="resource-bingo-grid">
              {(selectedJourney?.bingo ?? []).map((bingoItem) => {
                const resource = resources.find(
                  (candidate) => candidate.id === bingoItem.resourceId,
                )
                const stamped =
                  bingoItem.stamped ||
                  progress.some(
                    (entry) =>
                      entry.resourceId === bingoItem.resourceId &&
                      dates.includes(entry.localDate) &&
                      entry.status === 'COMPLETED',
                  )
                return (
                  <div
                    key={bingoItem.resourceId}
                    className={stamped ? 'is-stamped' : ''}
                    title={bingoItem.label}
                  >
                    <AnimatedResourceSticker
                      variant={
                        resource
                          ? resourcePresentation(resource).sticker
                          : 'garden'
                      }
                      size="small"
                    />
                    <small>{bingoItem.label}</small>
                    {stamped && <b aria-label="Đã hoàn thành">✓</b>}
                  </div>
                )
              })}
            </div>
          ) : (
            <p role="status">
              {journeyState === 'loading' || progressState === 'loading'
                ? 'Đang tải bingo…'
                : 'Chưa tải được trạng thái bingo.'}
            </p>
          )}
        </section>

        <section className="resource-recent" aria-labelledby="recent-title">
          <div className="resource-section-heading compact">
            <div>
              <span>04</span>
              <h2 id="recent-title">Dấu ấn gần đây</h2>
            </div>
          </div>
          {progressState !== 'ready' ? (
            <p role="status">
              {progressState === 'loading'
                ? 'Đang tải lịch sử hoàn thành…'
                : 'Chưa tải được lịch sử hoàn thành.'}
            </p>
          ) : completedRecent.length === 0 ? (
            <div className="resource-recent-empty">
              <AnimatedResourceSticker variant="complete" size="medium" />
              <p>Hoạt động bạn hoàn thành sẽ hiện ở đây.</p>
            </div>
          ) : (
            <div className="resource-recent-strip">
              {completedRecent.map(({ entry, resource }) => (
                <Link
                  key={`${entry.localDate}:${resource.id}`}
                  href={`/resources/${resource.id}?from=resources&date=${entry.localDate}`}
                >
                  <AnimatedResourceSticker variant="complete" size="small" />
                  <b>{resource.title}</b>
                  <small>
                    {new Intl.DateTimeFormat('vi-VN', {
                      day: 'numeric',
                      month: 'short',
                    }).format(new Date(`${entry.localDate}T12:00:00`))}
                  </small>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {reward && (
        <div
          className={`resource-reward ${reward === 'day' ? 'is-day' : ''}`}
          role="status"
        >
          <div className="resource-confetti" aria-hidden="true">
            {Array.from({ length: reward === 'day' ? 18 : 8 }, (_, index) => (
              <i key={index} />
            ))}
          </div>
          <AnimatedResourceSticker
            variant={reward === 'day' ? 'garden' : 'complete'}
            size="medium"
          />
          <div>
            <strong>
              {reward === 'day'
                ? 'Trọn vẹn một ngày dịu dàng!'
                : 'Một bước nhỏ đã hoàn thành!'}
            </strong>
            <small>
              {reward === 'day'
                ? 'Streak của bạn vừa có thêm một nhịp.'
                : 'Cảm ơn bạn đã dành thời gian cho chính mình.'}
            </small>
          </div>
          <button
            type="button"
            onClick={() => setReward(null)}
            aria-label="Đóng lời chúc"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
