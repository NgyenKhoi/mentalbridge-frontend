'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'

import { Dialog } from '@/components/ui/Dialog'

import {
  getResourceProgress,
  saveResourceProgress,
  type ResourceProgressItem,
} from '../api/browser-resource-progress'
import {
  getResourceCatalogue,
  getResourceDetail,
  ResourceBrowserError,
  type PublicResourceDetail,
  type PublicResourceSummary,
} from '../api/browser-resources'
import {
  difficultyLabels,
  formatLabels,
  localDate,
  resourcePresentation,
} from '../model/resource-experience'
import { vietnameseVideoCues } from '../model/vietnamese-video-cues'
import { resourceInteraction } from '../model/resource-interactions'
import { structuredResourceContent } from '../model/structured-resource-content'
import { AnimatedResourceSticker } from './AnimatedResourceSticker'
import { PurposeShapedActions } from './PurposeShapedActions'
import { VietnameseCaptionedVideo } from './VietnameseCaptionedVideo'
import styles from './resource-detail.module.css'

function safeHttpUrl(value: string | null | undefined) {
  if (!value) return null
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.toString()
      : null
  } catch {
    return null
  }
}

function videoEmbedUrl(value: string | null | undefined) {
  const safeUrl = safeHttpUrl(value)
  if (!safeUrl) return null
  const url = new URL(safeUrl)
  const host = url.hostname.replace(/^www\./, '')
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0]
    return id
      ? `https://www.youtube-nocookie.com/embed/${id}?cc_load_policy=0&rel=0&modestbranding=1&enablejsapi=1`
      : null
  }
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const id = url.pathname.startsWith('/embed/')
      ? url.pathname.split('/')[2]
      : url.searchParams.get('v')
    return id
      ? `https://www.youtube-nocookie.com/embed/${id}?cc_load_policy=0&rel=0&modestbranding=1&enablejsapi=1`
      : null
  }
  if (host === 'vimeo.com') {
    const id = url.pathname.split('/').filter(Boolean)[0]
    return id ? `https://player.vimeo.com/video/${id}` : null
  }
  return null
}

function isVideoResource(resource: PublicResourceDetail) {
  return (
    resource.interactionType === 'VIDEO_TRANSCRIPT' ||
    (!resource.interactionType && resource.category === 'VIDEO')
  )
}

function contentParagraphs(resource: PublicResourceDetail) {
  const structured = structuredResourceContent(resource)
  const reviewedParagraphs = [structured.overview].filter(
    (paragraph): paragraph is string => Boolean(paragraph),
  )
  if (reviewedParagraphs.length > 0) return reviewedParagraphs
  const paragraphs = resource.contentBody
    ?.split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  return paragraphs?.length ? paragraphs : [resource.summary]
}

type PracticeCue = Readonly<{
  id: string
  label: string
  seconds: number
  start: number
  end: number
}>

type PracticeSessionDraft = Readonly<{
  practiceSessionId: string
  practiceStartedAt: string
}>

function newPracticeSession(): PracticeSessionDraft {
  return {
    practiceSessionId: crypto.randomUUID(),
    practiceStartedAt: new Date().toISOString(),
  }
}

function practiceTimeline(
  phases: readonly { id: string; label: string; seconds?: number }[],
  totalSeconds: number,
) {
  if (phases.length === 0 || totalSeconds <= 0) return []
  const explicitSeconds = phases.reduce(
    (total, phase) => total + (phase.seconds ?? 0),
    0,
  )
  const missingCount = phases.filter((phase) => !phase.seconds).length
  const sharedSeconds =
    missingCount > 0
      ? Math.max(1, (totalSeconds - explicitSeconds) / missingCount)
      : 0
  let boundary = 0
  return phases.map((phase) => {
    const seconds = phase.seconds ?? sharedSeconds
    const start = boundary
    boundary += seconds
    return { ...phase, seconds, start, end: boundary } as PracticeCue
  })
}

function practiceCueForElapsed(
  timeline: readonly PracticeCue[],
  elapsed: number,
) {
  const cycleSeconds = timeline.at(-1)?.end ?? 0
  if (cycleSeconds <= 0) return null
  const cycleElapsed = elapsed % cycleSeconds
  const index = timeline.findIndex(
    (cue) => cycleElapsed >= cue.start && cycleElapsed < cue.end,
  )
  const resolvedIndex = index >= 0 ? index : timeline.length - 1
  const cue = timeline[resolvedIndex]
  return {
    cue,
    index: resolvedIndex,
    cycle: Math.floor(elapsed / cycleSeconds) + 1,
    remainingSeconds: Math.max(1, Math.ceil(cue.end - cycleElapsed)),
  }
}

function practiceDurationLabel(seconds: number) {
  const rounded = Math.round(seconds)
  const minutes = Math.floor(rounded / 60)
  const remainingSeconds = rounded % 60
  if (minutes === 0) return `${remainingSeconds} giây`
  if (remainingSeconds === 0) return `${minutes} phút`
  return `${minutes} phút ${remainingSeconds} giây`
}

type Props = Readonly<{
  resourceId: string
  fromSupportPlan: boolean
  activityDate?: string
  contentVersion?: string
}>

type LoadResult = Readonly<{
  requestKey: string
  state: 'success' | 'not-found' | 'error'
  resource?: PublicResourceDetail
  catalogue?: PublicResourceSummary[]
  progress?: ResourceProgressItem
}>

export default function ResourceDetail({
  resourceId,
  fromSupportPlan,
  activityDate,
  contentVersion,
}: Props) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(activityDate ?? '')
    ? (activityDate as string)
    : localDate()
  const requestKey = `${resourceId}:${contentVersion ?? ''}:${date}`
  const [result, setResult] = useState<LoadResult>()
  const [completedActionIds, setCompletedActionIds] = useState<string[]>([])
  const [status, setStatus] = useState<'IN_PROGRESS' | 'COMPLETED'>(
    'IN_PROGRESS',
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [reward, setReward] = useState(false)
  const [quizOpen, setQuizOpen] = useState(false)
  const [completionConfirmation, setCompletionConfirmation] = useState<
    string[] | null
  >(null)
  const [quizAnswers, setQuizAnswers] = useState({ watched: '', next: '' })
  const [quizMessage, setQuizMessage] = useState('')
  const [activeSection, setActiveSection] = useState('summary')
  const [visitedSections, setVisitedSections] = useState<string[]>(['summary'])
  const [videoSeekRequest, setVideoSeekRequest] = useState<{
    seconds: number
    key: number
  } | null>(null)
  const [timer, setTimer] = useState<number | null>(null)
  const [timerRunning, setTimerRunning] = useState(false)
  const [recordingPracticeSession, setRecordingPracticeSession] =
    useState(false)
  const timerRef = useRef<number | null>(null)
  const practiceSessionRef = useRef<PracticeSessionDraft | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      getResourceDetail(resourceId, contentVersion, controller.signal),
      getResourceCatalogue(controller.signal),
      getResourceProgress(date, date),
    ])
      .then(([resource, catalogue, progress]) => {
        const saved = progress.find((entry) => entry.resourceId === resourceId)
        setResult({
          requestKey,
          state: 'success',
          resource,
          catalogue: catalogue.items,
          progress: saved,
        })
        setCompletedActionIds(saved?.completedActionIds ?? [])
        setStatus(saved?.status ?? 'IN_PROGRESS')
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        setResult({
          requestKey,
          state:
            error instanceof ResourceBrowserError && error.status === 404
              ? 'not-found'
              : 'error',
        })
      })
    return () => controller.abort()
  }, [contentVersion, date, requestKey, resourceId])

  const loadState = result?.requestKey === requestKey ? result.state : 'loading'
  const resource =
    result?.requestKey === requestKey ? result.resource : undefined
  const catalogue =
    result?.requestKey === requestKey ? (result.catalogue ?? []) : []
  const interaction = useMemo(
    () => (resource ? resourceInteraction(resource) : null),
    [resource],
  )
  const requiredActions = useMemo(
    () => interaction?.actions.map((action) => action.id) ?? [],
    [interaction],
  )
  const completionPercent =
    status === 'COMPLETED'
      ? 100
      : requiredActions.length === 0
        ? 0
        : Math.round(
            (completedActionIds.filter((id) => requiredActions.includes(id))
              .length /
              requiredActions.length) *
              100,
          )

  useEffect(() => {
    if (!resource || typeof IntersectionObserver === 'undefined') return
    const sectionIds = [
      'summary',
      interaction?.mode === 'video'
        ? 'watch'
        : interaction?.mode === 'breathing' || interaction?.mode === 'timed'
          ? 'practice'
          : 'content',
      'actions',
      'source',
    ]
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) => right.intersectionRatio - left.intersectionRatio,
          )[0]
        if (!visible?.target.id) return
        setActiveSection(visible.target.id)
        setVisitedSections((current) =>
          current.includes(visible.target.id)
            ? current
            : [...current, visible.target.id],
        )
      },
      { rootMargin: '-22% 0px -58% 0px', threshold: [0.08, 0.35, 0.6] },
    )
    for (const id of sectionIds) {
      const section = document.getElementById(id)
      if (section) observer.observe(section)
    }
    return () => observer.disconnect()
  }, [interaction?.mode, resource])

  const persistProgress = useCallback(
    async (
      nextActions: string[],
      nextStatus: 'IN_PROGRESS' | 'COMPLETED',
      practice?: PracticeSessionDraft & {
        practiceDurationSeconds?: number
      },
    ) => {
      if (!resource || saving) return false
      setSaving(true)
      setMessage('')
      try {
        const saved = await saveResourceProgress(resource.id, date, {
          status: nextStatus,
          completedActionIds: nextActions,
          ...practice,
        })
        setCompletedActionIds(saved.completedActionIds)
        setStatus(saved.status)
        window.dispatchEvent(new CustomEvent('mb:resource-progress-updated'))
        if (saved.status === 'COMPLETED') setReward(true)
        return true
      } catch {
        setMessage('Chưa thể lưu tiến độ. Bạn thử lại sau một chút nhé.')
        return false
      } finally {
        setSaving(false)
      }
    },
    [date, resource, saving],
  )

  useEffect(() => {
    if (timer === null || !timerRunning) return
    timerRef.current = window.setTimeout(() => {
      if (timer <= 1) {
        setTimer(null)
        setTimerRunning(false)
        const practice = practiceSessionRef.current
        practiceSessionRef.current = null
        void persistProgress(
          [...requiredActions],
          'COMPLETED',
          practice
            ? {
                ...practice,
                practiceDurationSeconds: interaction?.durationSeconds,
              }
            : undefined,
        )
        return
      }
      setTimer(timer - 1)
    }, 1000)
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [
    interaction?.durationSeconds,
    persistProgress,
    requiredActions,
    timer,
    timerRunning,
  ])

  const backHref = fromSupportPlan ? '/support-plan' : '/resources'
  const backLabel = fromSupportPlan
    ? 'Quay lại kế hoạch hỗ trợ'
    : 'Quay lại Resources'

  if (loadState === 'loading') {
    return (
      <main className={styles.page} aria-busy="true">
        <section className={styles.state} role="status">
          <span className={styles.loader} aria-hidden="true" />
          <h1>Đang chuẩn bị nội dung…</h1>
          <p>Một khoảng nhỏ dành cho bạn sắp sẵn sàng.</p>
        </section>
      </main>
    )
  }

  if (loadState !== 'success' || !resource) {
    const notFound = loadState === 'not-found'
    return (
      <main className={styles.page}>
        <section className={styles.state} role="alert">
          <span className={styles.stateIcon} aria-hidden="true">
            {notFound ? '☁' : '!'}
          </span>
          <h1>
            {notFound
              ? 'Không tìm thấy tài nguyên'
              : 'Tài nguyên này tạm thời chưa tải được'}
          </h1>
          <p>
            {notFound
              ? 'Nội dung có thể đã được lưu trữ hoặc không còn trong thời gian phát hành.'
              : 'Tiến độ đã lưu của bạn vẫn an toàn. Vui lòng thử lại sau.'}
          </p>
          <Link className={styles.backButton} href={backHref}>
            {backLabel}
          </Link>
        </section>
      </main>
    )
  }

  const loadedResource = resource
  const meta = resourcePresentation(resource)
  const paragraphs = contentParagraphs(resource)
  const structured = structuredResourceContent(resource)
  const midpoint = Math.max(1, Math.ceil(paragraphs.length / 2))
  const externalUrl = safeHttpUrl(resource.externalUrl)
  const sourceUrl = safeHttpUrl(resource.sourceUrl)
  const embedUrl = videoEmbedUrl(resource.externalUrl ?? resource.sourceUrl)
  const resourceIndex = catalogue.findIndex((item) => item.id === resource.id)
  const previous = resourceIndex > 0 ? catalogue[resourceIndex - 1] : undefined
  const next =
    resourceIndex >= 0 && resourceIndex < catalogue.length - 1
      ? catalogue[resourceIndex + 1]
      : undefined
  const isBreathing = interaction?.mode === 'breathing'
  const isTimed = interaction?.mode === 'timed'
  const isPractice = isBreathing || isTimed
  const configuredPhases = interaction?.actions ?? []
  const totalPracticeSeconds = interaction?.durationSeconds ?? 0
  const elapsed = timer === null ? 0 : totalPracticeSeconds - timer
  const practiceCues = practiceTimeline(configuredPhases, totalPracticeSeconds)
  const activePracticeCue =
    timer === null ? null : practiceCueForElapsed(practiceCues, elapsed)
  const practiceCycleSeconds = practiceCues.at(-1)?.end ?? 0
  const practiceCycles =
    practiceCycleSeconds > 0
      ? Math.max(1, Math.ceil(totalPracticeSeconds / practiceCycleSeconds))
      : 1
  const progressStyle = {
    '--resource-progress': `${completionPercent}%`,
  } as CSSProperties

  async function toggleAction(actionId: string) {
    if (
      loadedResource.repeatability === 'REPEATABLE' &&
      (status !== 'COMPLETED' || recordingPracticeSession) &&
      practiceSessionRef.current === null
    ) {
      practiceSessionRef.current = newPracticeSession()
    }
    const nextActions = completedActionIds.includes(actionId)
      ? completedActionIds.filter((id) => id !== actionId)
      : [...completedActionIds, actionId]
    if (status === 'COMPLETED' && !recordingPracticeSession) {
      await persistProgress(nextActions, 'COMPLETED')
      return
    }
    const complete = requiredActions.every((id) => nextActions.includes(id))
    if (complete) {
      setCompletionConfirmation(nextActions)
      return
    }
    await persistProgress(
      nextActions,
      status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS',
    )
  }

  async function markComplete() {
    if (interaction?.mode === 'video') {
      if (!completedActionIds.includes('video-viewed')) {
        const saved = await persistProgress(
          [...completedActionIds, 'video-viewed'],
          'IN_PROGRESS',
        )
        if (!saved) return
      }
      setQuizOpen(true)
      return
    }
    if (
      loadedResource.repeatability === 'REPEATABLE' &&
      practiceSessionRef.current === null
    ) {
      practiceSessionRef.current = newPracticeSession()
    }
    setCompletionConfirmation([...requiredActions])
  }

  async function confirmCompletion() {
    if (!completionConfirmation) return
    const practice =
      loadedResource.repeatability === 'REPEATABLE'
        ? (practiceSessionRef.current ?? newPracticeSession())
        : undefined
    const saved = await persistProgress(
      completionConfirmation,
      'COMPLETED',
      practice,
    )
    if (saved) {
      practiceSessionRef.current = null
      setRecordingPracticeSession(false)
      setCompletionConfirmation(null)
    }
  }

  function startAnotherPractice() {
    practiceSessionRef.current = newPracticeSession()
    setRecordingPracticeSession(true)
    setCompletedActionIds([])
  }

  async function submitQuiz() {
    if (quizAnswers.watched !== 'complete' || quizAnswers.next !== 'gentle') {
      setQuizMessage(
        'Mình chưa thể đánh dấu hoàn thành. Hãy xem lại phần chính rồi thử lại nhé.',
      )
      return
    }
    setQuizMessage('')
    await persistProgress([...requiredActions], 'COMPLETED')
    setQuizOpen(false)
  }

  function reviewVideoAt(seconds: number) {
    setQuizOpen(false)
    setVideoSeekRequest({ seconds, key: Date.now() })
    setActiveSection('watch')
    window.setTimeout(() => {
      const watchSection = document.getElementById('watch')
      if (typeof watchSection?.scrollIntoView !== 'function') return

      watchSection.scrollIntoView({
        block: 'start',
        behavior:
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'auto'
            : 'smooth',
      })
    }, 0)
  }

  const completedRequiredCount = requiredActions.filter((id) =>
    completedActionIds.includes(id),
  ).length
  const tocItems = [
    { id: 'summary', label: 'Tóm tắt' },
    interaction?.mode === 'video'
      ? { id: 'watch', label: 'Xem video' }
      : isPractice
        ? { id: 'practice', label: 'Thực hành' }
        : { id: 'content', label: 'Nội dung' },
    { id: 'actions', label: 'Các bước nhỏ' },
    { id: 'source', label: 'Nguồn tham khảo' },
  ]

  function sectionCompleted(sectionId: string) {
    if (status === 'COMPLETED') return true
    if (sectionId === 'watch') {
      return completedActionIds.includes('video-viewed')
    }
    if (sectionId === 'actions') {
      return (
        requiredActions.length > 0 &&
        requiredActions.every((id) => completedActionIds.includes(id))
      )
    }
    return visitedSections.includes(sectionId) && sectionId !== activeSection
  }

  return (
    <main className={styles.page}>
      <article
        className={`${styles.article} ${isVideoResource(resource) ? styles.videoArticle : ''}`}
      >
        <div
          className={
            isVideoResource(resource) ? styles.videoStickyHeader : undefined
          }
        >
          <nav className={styles.breadcrumb} aria-label="Đường dẫn">
            <Link href={backHref}>{backLabel}</Link>
            {isVideoResource(resource) && (
              <>
                <span aria-hidden="true">›</span>
                <span>Video</span>
              </>
            )}
            <span aria-hidden="true">›</span>
            <span aria-current="page">{resource.title}</span>
          </nav>

          <header
            className={`${styles.hero} ${styles[`accent${meta.accent}`]}`}
          >
            <div className={styles.cover} aria-hidden="true">
              <AnimatedResourceSticker variant={meta.sticker} size="large" />
              <i>✦</i>
            </div>
            <div className={styles.heroCopy}>
              <div className={styles.badges}>
                <span>{formatLabels[meta.format]}</span>
                <span>{difficultyLabels[meta.difficulty]}</span>
                <span>◷ {meta.minutes} phút</span>
              </div>
              <h1>{resource.title}</h1>
              <p>{resource.summary}</p>
              {!isVideoResource(resource) && (
                <button
                  type="button"
                  className={styles.completeButton}
                  disabled={saving || status === 'COMPLETED'}
                  onClick={() => void markComplete()}
                >
                  {status === 'COMPLETED'
                    ? '✓ Đã hoàn thành'
                    : saving
                      ? 'Đang lưu…'
                      : 'Đánh dấu hoàn thành'}
                </button>
              )}
              {isVideoResource(resource) && (
                <div
                  className={styles.progressOverview}
                  role="progressbar"
                  aria-label="Tiến độ resource"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={completionPercent}
                >
                  <span>
                    <i style={{ width: `${completionPercent}%` }} />
                  </span>
                  <small>
                    {completionPercent}% · {completedRequiredCount}/
                    {requiredActions.length} mục hoàn thành
                  </small>
                </div>
              )}
            </div>
            <div className={styles.progressCard} style={progressStyle}>
              <div>
                <strong>{completionPercent}%</strong>
                <span>tiến độ</span>
              </div>
            </div>
          </header>
        </div>

        <div className={styles.layout}>
          <aside className={styles.toc} aria-label="Mục lục">
            <strong>Mục lục</strong>
            {tocItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={activeSection === item.id ? styles.activeToc : ''}
                aria-current={
                  activeSection === item.id ? 'location' : undefined
                }
                onClick={() => {
                  setActiveSection(item.id)
                  setVisitedSections((current) =>
                    current.includes(item.id) ? current : [...current, item.id],
                  )
                }}
              >
                <span>{item.label}</span>
                {sectionCompleted(item.id) && (
                  <b aria-label="Đã hoàn thành">✓</b>
                )}
              </a>
            ))}
          </aside>

          <div className={styles.body}>
            <section id="summary" className={styles.contentSection}>
              <span className={styles.eyebrow}>Tóm tắt dịu dàng</span>
              <h2>Điều bạn cần biết</h2>
              {paragraphs.slice(0, midpoint).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {structured.whenUseful && (
                <aside className={styles.callout}>
                  <span aria-hidden="true">✦</span>
                  <div>
                    <strong>Khi nào nội dung này có thể hữu ích?</strong>
                    <p>{structured.whenUseful}</p>
                  </div>
                </aside>
              )}
              {structured.keyIdeas.length > 0 && (
                <div className={styles.keyIdeas}>
                  <strong>Những ý chính</strong>
                  <ul>
                    {structured.keyIdeas.map((idea) => (
                      <li key={idea}>{idea}</li>
                    ))}
                  </ul>
                </div>
              )}
              {structured.steps.length > 0 && (
                <div className={styles.structuredSteps}>
                  <strong>Hướng dẫn từng bước</strong>
                  <ol>
                    {structured.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
              {structured.cautions.length > 0 && (
                <aside className={styles.cautions}>
                  <strong>Lưu ý an toàn</strong>
                  <ul>
                    {structured.cautions.map((caution) => (
                      <li key={caution}>{caution}</li>
                    ))}
                  </ul>
                </aside>
              )}
              {structured.nextStep && (
                <p className={styles.nextStep}>
                  <strong>Bước tiếp theo:</strong> {structured.nextStep}
                </p>
              )}
              <aside className={styles.callout}>
                <span aria-hidden="true">🌱</span>
                <p>
                  Không cần làm mọi thứ cùng lúc. Một ý hữu ích hoặc một nhịp
                  thở chậm cũng đã là tiến bộ.
                </p>
              </aside>
            </section>

            {isVideoResource(resource) && (
              <section id="watch" className={styles.contentSection}>
                <span className={styles.eyebrow}>Xem và suy ngẫm</span>
                <h2>Dành vài phút cho nội dung này</h2>
                {embedUrl ? (
                  <VietnameseCaptionedVideo
                    embedUrl={embedUrl}
                    title={resource.title}
                    cues={vietnameseVideoCues(
                      resource.externalUrl ?? resource.sourceUrl,
                    )}
                    seekRequest={videoSeekRequest}
                  />
                ) : externalUrl ? (
                  <a
                    className={styles.externalButton}
                    href={externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Mở video từ nguồn đã duyệt <span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  <div className={styles.inlineEmpty}>
                    Video đang được cập nhật. Bạn vẫn có thể đọc phần tóm tắt.
                  </div>
                )}
              </section>
            )}

            {isPractice && (
              <section id="practice" className={styles.practiceSection}>
                <div>
                  <span className={styles.eyebrow}>Thực hành tương tác</span>
                  <h2>{interaction?.heading}</h2>
                  <p>
                    {isBreathing
                      ? 'Ngồi hoặc đứng ở tư thế dễ chịu. Không cần hít thật sâu; dừng lại nếu bạn thấy không thoải mái.'
                      : 'Chọn nhịp vừa sức. Bạn có thể tạm dừng, bỏ qua một bước hoặc kết thúc sớm.'}
                  </p>
                  <button
                    type="button"
                    disabled={saving || totalPracticeSeconds <= 0}
                    onClick={() => {
                      if (timer === null) {
                        setTimer(totalPracticeSeconds)
                        practiceSessionRef.current = newPracticeSession()
                      }
                      setTimerRunning((running) => !running)
                    }}
                  >
                    {timer === null
                      ? `Bắt đầu ${totalPracticeSeconds} giây`
                      : timerRunning
                        ? 'Tạm dừng'
                        : 'Tiếp tục'}
                  </button>
                </div>
                <div
                  className={`${styles.breathOrb} ${isBreathing && timerRunning ? styles.isBreathing : ''}`}
                  aria-live="polite"
                >
                  <span>{timer ?? totalPracticeSeconds}</span>
                  <strong>
                    {timer === null
                      ? 'Sẵn sàng'
                      : timerRunning
                        ? activePracticeCue?.cue.label
                        : 'Đã tạm dừng'}
                  </strong>
                  {activePracticeCue && (
                    <small>
                      Bước {activePracticeCue.index + 1}/{practiceCues.length}
                      {practiceCycles > 1
                        ? ` · vòng ${Math.min(activePracticeCue.cycle, practiceCycles)}/${practiceCycles}`
                        : ''}
                    </small>
                  )}
                </div>
                <ol>
                  {practiceCues.map((phase, index) => {
                    const complete = completedActionIds.includes(phase.id)
                    const active = activePracticeCue?.index === index
                    const passedInSession =
                      timer !== null &&
                      practiceCycles === 1 &&
                      activePracticeCue !== null &&
                      index < activePracticeCue.index
                    return (
                      <li
                        key={phase.id}
                        className={[
                          complete || passedInSession ? styles.done : '',
                          active ? styles.activePracticeCue : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        aria-current={active ? 'step' : undefined}
                      >
                        <span aria-hidden="true">
                          {complete || passedInSession
                            ? '✓'
                            : active
                              ? '●'
                              : '○'}
                        </span>
                        <b>{phase.label}</b>
                        <small>{practiceDurationLabel(phase.seconds)}</small>
                        {active && (
                          <em>
                            {timerRunning
                              ? `Đang thực hiện · còn ${activePracticeCue?.remainingSeconds ?? 0} giây`
                              : 'Đang tạm dừng ở bước này'}
                          </em>
                        )}
                      </li>
                    )
                  })}
                </ol>
              </section>
            )}

            {!isPractice && !isVideoResource(resource) && (
              <section id="content" className={styles.contentSection}>
                <span className={styles.eyebrow}>Nội dung hướng dẫn</span>
                <h2>Thử mang theo một điều nhỏ</h2>
                {paragraphs.slice(midpoint).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {externalUrl && (
                  <a
                    className={styles.externalButton}
                    href={externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Mở nội dung đầy đủ <span aria-hidden="true">↗</span>
                  </a>
                )}
              </section>
            )}

            <section id="actions" className={styles.actionsSection}>
              <span className={styles.eyebrow}>Các bước nhỏ</span>
              <h2>Theo dõi tiến độ của bạn</h2>
              {isVideoResource(resource) ? (
                <ul className={styles.videoSteps}>
                  <li>
                    <label>
                      <input
                        type="checkbox"
                        checked={completedActionIds.includes('video-viewed')}
                        disabled={saving}
                        onChange={() => void toggleAction('video-viewed')}
                      />
                      <span aria-hidden="true">
                        {completedActionIds.includes('video-viewed') ? '✓' : ''}
                      </span>
                      <span>
                        <b>Theo dõi phần chính của video</b>
                        <small>
                          Bạn có thể đánh dấu khi đã xem ở nhịp độ phù hợp.
                        </small>
                      </span>
                    </label>
                  </li>
                  <li>
                    <label>
                      <input
                        type="checkbox"
                        checked={completedActionIds.includes('video-reflected')}
                        disabled={saving}
                        onChange={() => {
                          if (completedActionIds.includes('video-reflected')) {
                            void toggleAction('video-reflected')
                          } else {
                            setQuizOpen(true)
                          }
                        }}
                      />
                      <span aria-hidden="true">
                        {completedActionIds.includes('video-reflected')
                          ? '✓'
                          : ''}
                      </span>
                      <span>
                        <b>Hoàn thành 2 câu kiểm tra</b>
                        <small>
                          Trả lời đúng đa số để xác nhận bạn đã nắm ý chính.
                        </small>
                      </span>
                    </label>
                  </li>
                </ul>
              ) : isPractice ? (
                <p>Bộ đếm sẽ ghi nhận từng nhịp khi bài thực hành kết thúc.</p>
              ) : (
                <PurposeShapedActions
                  interactionType={resource.interactionType}
                  actions={interaction?.actions ?? []}
                  selectedActionIds={
                    completionConfirmation ?? completedActionIds
                  }
                  disabled={saving}
                  onToggle={(actionId) => void toggleAction(actionId)}
                />
              )}
              {message && (
                <p className={styles.error} role="alert">
                  {message}
                </p>
              )}
              {status === 'COMPLETED' && (
                <p className={styles.completionRecorded} role="status">
                  Kết quả hoàn thành đã được ghi nhận. Bạn vẫn có thể điều chỉnh
                  các dấu tick mà không làm mất kết quả này.
                </p>
              )}
              {status === 'COMPLETED' &&
                resource.repeatability === 'REPEATABLE' &&
                !isPractice &&
                !recordingPracticeSession && (
                  <button
                    type="button"
                    className={styles.repeatPracticeButton}
                    disabled={saving}
                    onClick={startAnotherPractice}
                  >
                    Thực hành lại và ghi một lần mới
                  </button>
                )}
            </section>

            {isVideoResource(resource) && (
              <section className={styles.completionPanel}>
                <div>
                  <span className={styles.eyebrow}>Xác nhận hoàn thành</span>
                  <h2>
                    {status === 'COMPLETED'
                      ? 'Nội dung đã được ghi nhận'
                      : 'Bạn đã sẵn sàng khép lại video?'}
                  </h2>
                  <p>
                    {status === 'COMPLETED'
                      ? 'Bạn có thể xem lại video hoặc transcript bất cứ lúc nào.'
                      : 'Hai câu hỏi ngắn giúp bạn kiểm tra lại ý chính trước khi lưu kết quả.'}
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.reflectionButton}
                  disabled={saving || status === 'COMPLETED'}
                  onClick={() => void markComplete()}
                >
                  {status === 'COMPLETED'
                    ? '✓ Đã hoàn thành'
                    : saving
                      ? 'Đang lưu…'
                      : 'Đánh dấu đã xem xong · Trả lời 2 câu'}
                </button>
              </section>
            )}

            <aside id="source" className={styles.source}>
              <span className={styles.eyebrow}>Nguồn đã rà soát</span>
              <h2>
                {resource.sourceTitle ??
                  resource.sourceOrganization ??
                  'Thông tin tham khảo'}
              </h2>
              {resource.sourceOrganization && (
                <p>{resource.sourceOrganization}</p>
              )}
              {resource.sourceReviewNote && <p>{resource.sourceReviewNote}</p>}
              {sourceUrl && (
                <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                  Xem nguồn tham khảo <span aria-hidden="true">↗</span>
                </a>
              )}
            </aside>

            {(resource.safetyNotes ?? []).length > 0 && (
              <aside className={styles.callout} aria-label="Lưu ý an toàn">
                <span aria-hidden="true">ⓘ</span>
                <div>
                  {(resource.safetyNotes ?? []).map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              </aside>
            )}

            <p className={styles.boundary}>
              Nội dung này hỗ trợ tự chăm sóc, không dùng để chẩn đoán hoặc thay
              thế đánh giá và điều trị từ chuyên gia.
            </p>
          </div>
        </div>

        <nav className={styles.resourceNavigation} aria-label="Tài nguyên khác">
          {previous ? (
            <Link
              href={`/resources/${previous.id}?from=resources&date=${date}`}
            >
              <span>← Resource trước</span>
              <strong>{previous.title}</strong>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/resources/${next.id}?from=resources&date=${date}`}>
              <span>Resource tiếp theo →</span>
              <strong>{next.title}</strong>
            </Link>
          )}
        </nav>
      </article>

      <Dialog
        open={quizOpen}
        onOpenChange={setQuizOpen}
        labelledBy="resource-reflection-title"
        describedBy="resource-reflection-description"
        className={styles.quizDialog}
      >
        <div className={styles.quizContent}>
          <AnimatedResourceSticker variant="video" size="medium" />
          <h2 id="resource-reflection-title">
            Hai câu để giữ lại điều hữu ích
          </h2>
          <p id="resource-reflection-description">
            Chọn đáp án phù hợp với thông điệp an toàn trong video. Bạn cần trả
            lời đúng cả hai câu để lưu hoàn thành.
          </p>
          <fieldset>
            <legend>
              Khi một hướng dẫn khiến cơ thể không thoải mái, bạn nên làm gì?
            </legend>
            <label>
              <input
                type="radio"
                name="watched"
                value="complete"
                checked={quizAnswers.watched === 'complete'}
                onChange={(event) =>
                  setQuizAnswers((value) => ({
                    ...value,
                    watched: event.target.value,
                  }))
                }
              />
              Dừng lại hoặc giảm cường độ về mức dễ chịu
            </label>
            <label>
              <input
                type="radio"
                name="watched"
                value="partial"
                checked={quizAnswers.watched === 'partial'}
                onChange={(event) =>
                  setQuizAnswers((value) => ({
                    ...value,
                    watched: event.target.value,
                  }))
                }
              />
              Cố tiếp tục để hoàn thành đủ bài
            </label>
          </fieldset>
          <fieldset>
            <legend>Bước phù hợp nhất sau nội dung này là gì?</legend>
            <label>
              <input
                type="radio"
                name="next"
                value="gentle"
                checked={quizAnswers.next === 'gentle'}
                onChange={(event) =>
                  setQuizAnswers((value) => ({
                    ...value,
                    next: event.target.value,
                  }))
                }
              />
              Chọn một bước nhỏ, an toàn và vừa sức
            </label>
            <label>
              <input
                type="radio"
                name="next"
                value="all"
                checked={quizAnswers.next === 'all'}
                onChange={(event) =>
                  setQuizAnswers((value) => ({
                    ...value,
                    next: event.target.value,
                  }))
                }
              />
              Cố gắng làm tất cả ngay lập tức
            </label>
          </fieldset>
          {quizMessage && (
            <div className={styles.quizFeedback} role="alert">
              <p>{quizMessage}</p>
              <button type="button" onClick={() => reviewVideoAt(40)}>
                ↺ Xem lại từ 0:40
              </button>
            </div>
          )}
          <div className={styles.quizActions}>
            <button type="button" onClick={() => setQuizOpen(false)}>
              Để sau
            </button>
            <button
              type="button"
              disabled={!quizAnswers.watched || !quizAnswers.next || saving}
              onClick={() => void submitQuiz()}
            >
              {saving ? 'Đang lưu…' : 'Hoàn tất'}
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={completionConfirmation !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setCompletionConfirmation(null)
        }}
        labelledBy="resource-completion-title"
        describedBy="resource-completion-description"
        className={styles.confirmDialog}
      >
        <div className={styles.confirmContent}>
          <AnimatedResourceSticker variant="complete" size="large" />
          <span className={styles.eyebrow}>Ghi nhận một cột mốc nhỏ</span>
          <h2 id="resource-completion-title">
            Bạn muốn xác nhận đã hoàn thành?
          </h2>
          <p id="resource-completion-description">
            MentalBridge sẽ lưu kết quả hoàn thành cho ngày này. Sau đó bạn vẫn
            có thể tick hoặc untick từng bước để tự theo dõi, nhưng kết quả đã
            hoàn thành sẽ không bị mất.
          </p>
          <div className={styles.confirmActions}>
            <button
              type="button"
              disabled={saving}
              onClick={() => setCompletionConfirmation(null)}
            >
              Xem lại các bước
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void confirmCompletion()}
            >
              {saving ? 'Đang ghi nhận…' : 'Xác nhận hoàn thành'}
            </button>
          </div>
        </div>
      </Dialog>

      {reward && (
        <div className={styles.reward} role="status">
          <div aria-hidden="true">
            {Array.from({ length: 10 }, (_, index) => (
              <i key={index} />
            ))}
          </div>
          <AnimatedResourceSticker variant="complete" size="small" />
          <p>
            <strong>Một bước nhỏ đã hoàn thành!</strong>
            <small>Cảm ơn bạn đã dành thời gian cho chính mình.</small>
          </p>
          <button
            type="button"
            aria-label="Đóng lời chúc"
            onClick={() => setReward(false)}
          >
            ×
          </button>
        </div>
      )}
    </main>
  )
}
