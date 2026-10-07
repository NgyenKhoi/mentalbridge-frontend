'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

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

const VIEW_STATE_KEY = 'mentalbridge:resources:view'

type ViewState = Readonly<{
  date: string
  difficulty: ResourceDifficulty | 'ALL'
  format: ResourceFormat | 'ALL'
  scrollY: number
}>

type Reward = 'resource' | 'day' | null

function greeting(hour: number) {
  if (hour < 11) return 'Chào buổi sáng'
  if (hour < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

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
  const [state, setState] = useState<
    'loading' | 'ready' | 'empty' | 'plan-required' | 'error'
  >('loading')
  const [pendingId, setPendingId] = useState('')
  const [message, setMessage] = useState('')
  const [reward, setReward] = useState<Reward>(null)

  const dates = useMemo(() => recentDates(today), [today])

  useEffect(() => {
    const controller = new AbortController()
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    Promise.all([
      getResourceCatalogue(controller.signal),
      getResourceProgress(shiftDate(today, -14), today),
      Promise.all(
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
      ),
    ])
      .then(([catalogue, history, dailyJourneys]) => {
        if (catalogue.unavailable) throw new Error('unavailable')
        const availableJourneys = dailyJourneys.filter(
          (journey): journey is ResourceJourney => journey !== null,
        )
        setResources(catalogue.items)
        setProgress([...history])
        setJourneys(
          Object.fromEntries(
            availableJourneys.map((journey) => [journey.localDate, journey]),
          ),
        )
        setState(
          availableJourneys.every((journey) => journey.items.length === 0)
            ? 'empty'
            : 'ready',
        )
        window.requestAnimationFrame(() => window.scrollTo(0, initial.scrollY))
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        if (
          error instanceof ResourceJourneyBrowserError &&
          error.status === 409
        ) {
          setState('plan-required')
          return
        }
        setState('error')
      })
    return () => controller.abort()
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
  const hasActiveFilters = difficulty !== 'ALL' || format !== 'ALL'
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

  if (state === 'plan-required') {
    return (
      <section className="resource-journey-state" role="status">
        <div className="resource-journey-state-sticker">
          <AnimatedResourceSticker variant="garden" size="large" />
        </div>
        <h1>Hãy chọn kế hoạch phù hợp với bạn trước nhé</h1>
        <p>
          Thử thách mỗi ngày được sắp xếp từ kế hoạch hỗ trợ đang hoạt động để
          các gợi ý luôn đúng với điều bạn đã chọn.
        </p>
        <Link href="/support-plan">Xem kế hoạch hỗ trợ</Link>
      </section>
    )
  }

  if (state === 'empty') {
    return (
      <section className="resource-journey-state" role="status">
        <div className="resource-journey-state-sticker">
          <AnimatedResourceSticker variant="garden" size="large" />
        </div>
        <h1>Chưa có hoạt động cho hôm nay</h1>
        <p>Khi tài nguyên mới sẵn sàng, chúng sẽ xuất hiện ở khu vườn này.</p>
      </section>
    )
  }

  const selectedDateLabel = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${selectedDate}T12:00:00`))

  return (
    <div className="resource-garden">
      <header className="resource-garden__welcome">
        <div className="resource-garden__intro">
          <span className="resource-garden__eyebrow">Góc tài nguyên</span>
          <h1>{greeting(new Date().getHours())}, mình chọn một bước nhỏ nhé</h1>
          <p>
            Chọn một ngày, tiếp tục hoạt động đang chờ bạn hoặc thong thả khám
            phá điều phù hợp với nhịp của mình.
          </p>
          <div className="resource-garden__meta">
            <span>
              {new Intl.DateTimeFormat('vi-VN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }).format(new Date())}
            </span>
            <span className="resource-garden__streak">
              <i aria-hidden="true">🌱</i>
              <strong>{streak} ngày</strong> bạn đã quay lại với mình
            </span>
          </div>
        </div>
        <div className="resource-garden__mascot" aria-hidden="true">
          <AnimatedResourceSticker variant="garden" size="large" />
          <span>Mỗi bước nhỏ đều đáng quý.</span>
        </div>
      </header>

      <section className="resource-path" aria-labelledby="resource-date-title">
        <div className="resource-section-intro">
          <div>
            <span className="resource-section-intro__eyebrow">
              Chọn nhịp hôm nay
            </span>
            <h2 id="resource-date-title">Đường mòn 7 ngày</h2>
          </div>
          <p>Chạm vào một ngày để xem hoạt động và tiến độ đã lưu.</p>
        </div>
        <div className="resource-dayrail-shell">
          <div
            className="resource-dayrail"
            role="group"
            aria-label="Chọn ngày trong 7 ngày gần đây"
          >
            {dates.map((date) => {
              const journey = journeys[date]
              const total = journey?.items.length ?? 0
              const count = (journey?.items ?? []).filter(
                (item) =>
                  progressFor(progress, item.resource.id, date)?.status ===
                  'COMPLETED',
              ).length
              const complete = total > 0 && count === total
              const instant = new Date(`${date}T12:00:00`)
              return (
                <button
                  type="button"
                  key={date}
                  className={`${date === selectedDate ? 'is-selected' : ''} ${date === today ? 'is-today' : ''} ${complete ? 'is-complete' : ''}`}
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
                  <i aria-hidden="true">{complete ? '✓' : '·'}</i>
                </button>
              )
            })}
          </div>
          <span className="resource-dayrail-hint" aria-hidden="true">
            Vuốt để xem đủ 7 ngày →
          </span>
        </div>

        <article className="resource-focus" aria-labelledby="daily-title">
          <aside
            className="resource-focus__progress"
            aria-label="Tiến độ ngày đã chọn"
          >
            <AnimatedResourceSticker
              variant={
                selected.length > 0 && selectedCompleted === selected.length
                  ? 'complete'
                  : 'garden'
              }
              size="large"
            />
            <span>Tiến độ ngày đã chọn</span>
            <strong>
              {selectedCompleted}
              <small>/{selected.length}</small>
            </strong>
            <progress
              value={selectedCompleted}
              max={Math.max(selected.length, 1)}
              aria-label={`${selectedCompleted} trên ${selected.length} hoạt động đã hoàn thành`}
            />
            <p>Không cần làm hết một lúc. Một bước vừa sức là đủ.</p>
          </aside>
          <div className="resource-focus__copy">
            <span className="resource-focus__eyebrow">
              {selectedDate === today
                ? 'Thử thách hôm nay'
                : 'Hành trình ngày đã chọn'}
            </span>
            <h2 id="daily-title">Một chút bình yên cho {selectedDateLabel}</h2>
            <p>
              Bắt đầu từ hoạt động tiếp theo, hoặc đánh dấu một việc nhỏ khi bạn
              đã hoàn thành. Bỏ lỡ một ngày cũng không sao.
            </p>
            <ul className="resource-focus__tasks">
              {selected.map((resource) => {
                const item = progressFor(progress, resource.id, selectedDate)
                const complete = item?.status === 'COMPLETED'
                return (
                  <li
                    key={resource.id}
                    className={complete ? 'is-complete' : ''}
                  >
                    {complete ? (
                      <span
                        className="resource-focus__task-done"
                        aria-label={`${resource.title}, đã hoàn thành`}
                      >
                        <i aria-hidden="true">✓</i>
                        <b>{resource.title}</b>
                      </span>
                    ) : (
                      <label>
                        <input
                          type="checkbox"
                          checked={false}
                          disabled={pendingId !== ''}
                          aria-label={`Đánh dấu ${resource.title} đã hoàn thành`}
                          onChange={(event) =>
                            void toggleDaily(resource, event.target.checked)
                          }
                        />
                        <span aria-hidden="true" />
                        <b>{resource.title}</b>
                      </label>
                    )}
                    <small>{resourcePresentation(resource).minutes} phút</small>
                  </li>
                )
              })}
            </ul>
            {message && (
              <p className="resource-inline-error" role="alert">
                {message}
              </p>
            )}
            {nextResource ? (
              <Link
                className="resource-focus__start"
                href={`/resources/${nextResource.id}?from=resources&date=${selectedDate}`}
              >
                <span>
                  <small>Bước tiếp theo</small>
                  Bắt đầu: {nextResource.title}
                </span>
                <i aria-hidden="true">→</i>
              </Link>
            ) : selected.length === 0 ? (
              <div className="resource-focus__complete" role="status">
                Ngày này chưa có hoạt động
              </div>
            ) : (
              <div className="resource-focus__complete">
                <span aria-hidden="true">🌟</span>
                Bạn đã dành trọn một khoảng nhỏ cho mình.
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="resource-library" aria-labelledby="catalogue-title">
        <div className="resource-section-intro resource-section-intro--library">
          <div>
            <span className="resource-section-intro__eyebrow">
              Khám phá thêm
            </span>
            <h2 id="catalogue-title">Chọn điều bạn cần lúc này</h2>
          </div>
          <p role="status" aria-live="polite">
            {filtered.length} hoạt động phù hợp
          </p>
        </div>
        <div className="resource-filters">
          <div
            className="resource-filter-row"
            role="group"
            aria-labelledby="resource-energy-filter"
          >
            <span id="resource-energy-filter">Mức năng lượng</span>
            <div>
              {(['ALL', 'GENTLE', 'BALANCED', 'CHALLENGE'] as const).map(
                (value) => (
                  <button
                    type="button"
                    key={value}
                    className={difficulty === value ? 'is-active' : ''}
                    aria-pressed={difficulty === value}
                    onClick={() => setDifficulty(value)}
                  >
                    <i aria-hidden="true">
                      {value === 'GENTLE'
                        ? '☁'
                        : value === 'BALANCED'
                          ? '🌿'
                          : value === 'CHALLENGE'
                            ? '✦'
                            : '◌'}
                    </i>
                    {value === 'ALL' ? 'Tất cả' : difficultyLabels[value]}
                  </button>
                ),
              )}
            </div>
          </div>
          <div
            className="resource-filter-row"
            role="group"
            aria-labelledby="resource-format-filter"
          >
            <span id="resource-format-filter">Hình thức</span>
            <div>
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
          </div>
          {hasActiveFilters && (
            <button
              className="resource-filters__reset"
              type="button"
              onClick={() => {
                setDifficulty('ALL')
                setFormat('ALL')
              }}
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="resource-library-empty" role="status">
            <span aria-hidden="true">🧺</span>
            <h3>Chưa có hoạt động khớp bộ lọc</h3>
            <p>Thử một mức độ hoặc loại nội dung khác nhé.</p>
            <button
              type="button"
              onClick={() => {
                setDifficulty('ALL')
                setFormat('ALL')
              }}
            >
              Xem tất cả hoạt động
            </button>
          </div>
        ) : (
          <div className="resource-shelf">
            {filtered.map((resource, index) => {
              const meta = resourcePresentation(resource)
              const item = progressFor(progress, resource.id, selectedDate)
              const action =
                item?.status === 'IN_PROGRESS'
                  ? 'Tiếp tục'
                  : item?.status === 'COMPLETED'
                    ? 'Xem lại'
                    : 'Khám phá'
              return (
                <article
                  key={resource.id}
                  className={`resource-tile resource-tile--${meta.accent} ${index === 0 ? 'resource-tile--featured' : ''}`}
                >
                  <div className="resource-tile__art" aria-hidden="true">
                    <AnimatedResourceSticker
                      variant={meta.sticker}
                      size={index === 0 ? 'large' : 'medium'}
                    />
                    <i>✦</i>
                  </div>
                  <div className="resource-tile__body">
                    {index === 0 && (
                      <span className="resource-tile__lead">Lối vào gợi ý</span>
                    )}
                    <div className="resource-tile__badges">
                      <span>{formatLabels[meta.format]}</span>
                      <span>{difficultyLabels[meta.difficulty]}</span>
                    </div>
                    <h3>{resource.title}</h3>
                    <p>{resource.summary}</p>
                    <div className="resource-tile__meta">
                      <span>◷ {meta.minutes} phút</span>
                      <span
                        className={`status-${item?.status?.toLowerCase() ?? 'new'}`}
                      >
                        {statusLabel(item)}
                      </span>
                    </div>
                    <Link
                      href={`/resources/${resource.id}?from=resources&date=${selectedDate}`}
                      aria-label={`${action}: ${resource.title}`}
                    >
                      {action}
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="resource-keepsakes" aria-labelledby="keepsakes-title">
        <div className="resource-section-intro resource-section-intro--keepsakes">
          <div>
            <span className="resource-section-intro__eyebrow">Nhìn lại</span>
            <h2 id="keepsakes-title">Góc nhỏ bạn đã vun bồi</h2>
          </div>
          <p>Những dấu mốc ở đây chỉ để ghi nhận, không phải để tạo áp lực.</p>
        </div>
        <div className="resource-keepsakes__grid">
          <section className="resource-bingo" aria-labelledby="bingo-title">
            <div className="resource-keepsakes__heading">
              <div>
                <span aria-hidden="true">✿</span>
                <h3 id="bingo-title">Bingo tuần này</h3>
              </div>
              <p>Mỗi hoạt động hoàn thành sẽ nhận một con dấu nhỏ.</p>
            </div>
            {(selectedJourney?.bingo ?? []).length === 0 ? (
              <p className="resource-keepsakes__empty">
                Những ô đầu tiên sẽ xuất hiện khi hành trình bắt đầu.
              </p>
            ) : (
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
            )}
          </section>

          <section className="resource-recent" aria-labelledby="recent-title">
            <div className="resource-keepsakes__heading">
              <div>
                <span aria-hidden="true">⌁</span>
                <h3 id="recent-title">Vừa hoàn thành</h3>
              </div>
              <p>Mở lại một hoạt động khi bạn muốn quay về nhịp quen.</p>
            </div>
            {completedRecent.length === 0 ? (
              <div className="resource-recent-empty">
                <AnimatedResourceSticker variant="complete" size="medium" />
                <p>Huy hiệu đầu tiên đang chờ bạn.</p>
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
      </section>

      {reward && (
        <div
          className={`resource-garden__reward ${reward === 'day' ? 'is-day' : ''}`}
          role="status"
        >
          <div className="resource-garden__confetti" aria-hidden="true">
            {Array.from({ length: reward === 'day' ? 18 : 8 }, (_, index) => (
              <i key={index} />
            ))}
          </div>
          <AnimatedResourceSticker
            variant={reward === 'day' ? 'garden' : 'complete'}
            size="medium"
          />
          <div className="resource-garden__reward-copy">
            <strong>
              {reward === 'day'
                ? 'Trọn vẹn một ngày dịu dàng!'
                : 'Một bước nhỏ đã hoàn thành!'}
            </strong>
            <small>
              {reward === 'day'
                ? 'Các hoạt động của ngày đã chọn đã được hoàn thành.'
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
