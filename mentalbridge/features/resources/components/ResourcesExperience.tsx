'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'

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
  completedDailyCount,
  currentStreak,
  dailyResources,
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
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>(
    'loading',
  )
  const [pendingId, setPendingId] = useState('')
  const [message, setMessage] = useState('')
  const [reward, setReward] = useState<Reward>(null)

  const dates = useMemo(() => recentDates(today), [today])

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      getResourceCatalogue(controller.signal),
      getResourceProgress(shiftDate(today, -14), today),
    ])
      .then(([catalogue, history]) => {
        if (catalogue.unavailable) throw new Error('unavailable')
        setResources(catalogue.items)
        setProgress([...history])
        setState(catalogue.items.length === 0 ? 'empty' : 'ready')
        window.requestAnimationFrame(() => window.scrollTo(0, initial.scrollY))
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        setState('error')
      })
    return () => controller.abort()
  }, [initial.scrollY, today])

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

  const selected = useMemo(
    () => dailyResources(resources, selectedDate),
    [resources, selectedDate],
  )
  const selectedCompleted = completedDailyCount(
    resources,
    progress,
    selectedDate,
  )
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
  const streak = currentStreak(resources, progress, today)
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
      window.dispatchEvent(new CustomEvent('mb:resource-progress-updated'))
      if (completed) {
        const completedCount = completedDailyCount(
          resources,
          next,
          selectedDate,
        )
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
    <div className="resource-journey">
      <header className="resource-welcome">
        <div>
          <span className="resource-eyebrow">Góc chữa lành mỗi ngày</span>
          <h1>{greeting(new Date().getHours())}, mình cùng bắt đầu nhé</h1>
          <p>
            {new Intl.DateTimeFormat('vi-VN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }).format(new Date())}
          </p>
          <div className="resource-streak-pill">
            <span aria-hidden="true">🔥</span>
            <strong>{streak} ngày</strong> liên tiếp chăm sóc bản thân
          </div>
        </div>
        <div
          className="resource-mascot"
          aria-label="Một chậu cây nhỏ đang mỉm cười"
        >
          <div className="resource-mascot-visual">
            <AnimatedResourceSticker variant="garden" size="large" />
          </div>
          <b>Mỗi bước nhỏ đều đáng quý</b>
          <small>Không cần hoàn hảo, chỉ cần dịu dàng với mình.</small>
        </div>
      </header>

      <section
        className="resource-date-section"
        aria-labelledby="resource-date-title"
      >
        <div className="resource-section-heading compact">
          <div>
            <span>01</span>
            <h2 id="resource-date-title">Nhịp điệu 7 ngày</h2>
          </div>
          <p>Chọn một ngày để xem lại hành trình.</p>
        </div>
        <div className="resource-date-strip">
          {dates.map((date) => {
            const count = completedDailyCount(resources, progress, date)
            const total = dailyResources(resources, date).length
            const complete = total > 0 && count === total
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

      <section className="resource-daily-card" aria-labelledby="daily-title">
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
              {selectedCompleted}/{selected.length}
            </strong>
            <span>đã xong</span>
          </div>
        </div>
        <div className="resource-daily-copy">
          <span>
            {selectedDate === today
              ? 'Thử thách hôm nay'
              : 'Hành trình ngày đã chọn'}
          </span>
          <h2 id="daily-title">Một chút bình yên cho {selectedDateLabel}</h2>
          <p>Chọn nhịp độ phù hợp với bạn. Bỏ lỡ một ngày cũng không sao.</p>
          <ul>
            {selected.map((resource) => {
              const item = progressFor(progress, resource.id, selectedDate)
              const complete = item?.status === 'COMPLETED'
              return (
                <li key={resource.id} className={complete ? 'is-complete' : ''}>
                  <label>
                    <input
                      type="checkbox"
                      checked={complete}
                      disabled={pendingId !== '' || complete}
                      onChange={(event) =>
                        void toggleDaily(resource, event.target.checked)
                      }
                    />
                    <span aria-hidden="true">{complete ? '✓' : ''}</span>
                    <b>{resource.title}</b>
                  </label>
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
              className="resource-start-button"
              href={`/resources/${nextResource.id}?from=resources&date=${selectedDate}`}
            >
              Bắt đầu việc kế tiếp <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <div className="resource-day-complete">
              <span aria-hidden="true">🌟</span>
              Bạn đã dành trọn một khoảng nhỏ cho mình.
            </div>
          )}
        </div>
      </section>

      <section className="resource-catalogue" aria-labelledby="catalogue-title">
        <div className="resource-section-heading">
          <div>
            <span>02</span>
            <h2 id="catalogue-title">Chọn điều bạn cần lúc này</h2>
          </div>
          <p>{filtered.length} hoạt động phù hợp với bộ lọc.</p>
        </div>
        <div className="resource-filter-group" aria-label="Lọc theo mức độ">
          {(['ALL', 'GENTLE', 'BALANCED', 'CHALLENGE'] as const).map(
            (value) => (
              <button
                type="button"
                key={value}
                className={`difficulty-${value.toLowerCase()} ${difficulty === value ? 'is-active' : ''}`}
                aria-pressed={difficulty === value}
                onClick={() => setDifficulty(value)}
              >
                <span aria-hidden="true">
                  {value === 'GENTLE'
                    ? '☁'
                    : value === 'BALANCED'
                      ? '🌿'
                      : value === 'CHALLENGE'
                        ? '✦'
                        : '◌'}
                </span>
                {value === 'ALL' ? 'Tất cả mức độ' : difficultyLabels[value]}
              </button>
            ),
          )}
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
            {filtered.map((resource) => {
              const meta = resourcePresentation(resource)
              const item = progressFor(progress, resource.id, selectedDate)
              return (
                <article
                  key={resource.id}
                  className={`resource-experience-card accent-${meta.accent}`}
                >
                  <div className="resource-cover" aria-hidden="true">
                    <AnimatedResourceSticker
                      variant={meta.sticker}
                      size="large"
                    />
                    <i>✦</i>
                  </div>
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
                        {statusLabel(item)}
                      </span>
                    </div>
                    <Link
                      href={`/resources/${resource.id}?from=resources&date=${selectedDate}`}
                    >
                      {item?.status === 'IN_PROGRESS'
                        ? 'Tiếp tục'
                        : item?.status === 'COMPLETED'
                          ? 'Xem lại'
                          : 'Khám phá'}
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <div className="resource-lower-grid">
        <section className="resource-bingo" aria-labelledby="bingo-title">
          <div className="resource-section-heading compact">
            <div>
              <span>03</span>
              <h2 id="bingo-title">Bingo tuần này</h2>
            </div>
          </div>
          <p>Những ô đã hoàn thành sẽ nhận một con dấu nhỏ.</p>
          <div className="resource-bingo-grid">
            {resources.slice(0, 9).map((resource) => {
              const stamped = progress.some(
                (entry) =>
                  entry.resourceId === resource.id &&
                  dates.includes(entry.localDate) &&
                  entry.status === 'COMPLETED',
              )
              return (
                <div
                  key={resource.id}
                  className={stamped ? 'is-stamped' : ''}
                  title={resource.title}
                >
                  <AnimatedResourceSticker
                    variant={resourcePresentation(resource).sticker}
                    size="small"
                  />
                  <small>{resource.title}</small>
                  {stamped && <b aria-label="Đã hoàn thành">✓</b>}
                </div>
              )
            })}
          </div>
        </section>

        <section className="resource-recent" aria-labelledby="recent-title">
          <div className="resource-section-heading compact">
            <div>
              <span>04</span>
              <h2 id="recent-title">Vừa hoàn thành</h2>
            </div>
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
