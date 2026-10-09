'use client'

import Link from 'next/link'
import {
  Bookmark,
  Check,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  Lightbulb,
  Maximize,
  Minimize,
  Pause,
  PenTool,
  Play,
  RotateCcw,
  Share2,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Subtitles,
  Volume2,
  VolumeX,
  Workflow,
  Sparkles,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'

import type { PublicResourceDetail } from '../api/browser-resources'
import {
  problemSolvingLessonConfig,
  type LessonStep,
} from '../data/problem-solving-lesson'
import styles from './problem-solving-resource-detail.module.css'

type Props = Readonly<{
  resource: PublicResourceDetail
  backHref: string
  backLabel: string
  status: 'IN_PROGRESS' | 'COMPLETED'
  progressLoadState: 'loading' | 'ready' | 'error'
  saving: boolean
  message: string
  onRetryProgress: () => void
  onRecord: (watchedSeconds: number, practiceNote?: string) => Promise<boolean>
}>

type WatchedInterval = [number, number]

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(whole / 60)
  const remaining = whole % 60
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
}

function formatDuration(seconds: number) {
  const whole = Math.max(0, Math.ceil(seconds))
  const minutes = Math.floor(whole / 60)
  const remaining = whole % 60
  if (remaining === 0) return `${minutes} phút`
  return `${minutes} phút ${remaining} giây`
}

function addWatchedInterval(
  intervals: WatchedInterval[],
  start: number,
  end: number,
) {
  if (end <= start) return intervals
  const merged: WatchedInterval[] = []
  let next: WatchedInterval = [start, end]
  let inserted = false

  for (const interval of intervals) {
    if (interval[1] < next[0] - 0.1) {
      merged.push(interval)
    } else if (next[1] < interval[0] - 0.1) {
      if (!inserted) merged.push(next)
      merged.push(interval)
      inserted = true
    } else {
      next = [Math.min(next[0], interval[0]), Math.max(next[1], interval[1])]
    }
  }

  if (!inserted) merged.push(next)
  return merged
}

const SPEED_OPTIONS = [1, 1.25, 1.5, 0.75] as const

export function ProblemSolvingResourceDetail({
  resource,
  backHref,
  backLabel,
  status,
  progressLoadState,
  saving,
  message,
  onRetryProgress,
  onRecord,
}: Props) {
  const config = problemSolvingLessonConfig
  const steps = config.steps

  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const stepsRailRef = useRef<HTMLDivElement>(null)
  const stepCardRefs = useRef<Array<HTMLButtonElement | null>>([])
  const watchedIntervalsRef = useRef<WatchedInterval[]>([])
  const lastSampleRef = useRef<{ media: number; wall: number } | null>(null)
  const lastUiUpdateRef = useRef(0)
  const hideControlsTimerRef = useRef<number | null>(null)
  const recordingRef = useRef(false)

  const [mediaState, setMediaState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )
  const [duration, setDuration] = useState<number | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [watchedSeconds, setWatchedSeconds] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasPlayed, setHasPlayed] = useState(false)
  const [ended, setEnded] = useState(false)
  const [volume, setVolume] = useState(85)
  const [muted, setMuted] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [playbackSpeedIndex, setPlaybackSpeedIndex] = useState(0)
  const [captionsEnabled, setCaptionsEnabled] = useState(true)
  const [centerButtonVisible, setCenterButtonVisible] = useState(true)
  const [saved, setSaved] = useState(false)
  const [shareToast, setShareToast] = useState('')
  const [practiceNote, setPracticeNote] = useState('')
  const [recordState, setRecordState] = useState<
    'idle' | 'sending' | 'success' | 'error'
  >('idle')
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  // Load bookmark & draft practice note from localStorage
  useEffect(() => {
    try {
      setSaved(
        window.localStorage.getItem(`mb:resource-bookmark:${resource.id}`) ===
          'true',
      )
      const draft = window.localStorage.getItem(
        `mb:practice-draft:problem-solving:${resource.id}`,
      )
      if (draft) setPracticeNote(draft)
    } catch {
      // Ignored for restricted storage
    }
  }, [resource.id])

  // Save practice note draft on changes
  useEffect(() => {
    try {
      if (practiceNote.trim()) {
        window.localStorage.setItem(
          `mb:practice-draft:problem-solving:${resource.id}`,
          practiceNote,
        )
      }
    } catch {
      // Ignored
    }
  }, [practiceNote, resource.id])

  // Track Fullscreen state
  useEffect(() => {
    const handleFullscreen = () => {
      setFullscreen(document.fullscreenElement === playerRef.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreen)
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreen)
  }, [])

  // requestAnimationFrame synchronization when playing
  useEffect(() => {
    if (!isPlaying) return
    let frameId = 0

    const tick = (wall: number) => {
      const video = videoRef.current
      if (!video || video.paused || video.seeking) {
        lastSampleRef.current = null
        return
      }

      const media = video.currentTime
      const previous = lastSampleRef.current

      if (previous) {
        const mediaDelta = media - previous.media
        const wallDelta = (wall - previous.wall) / 1000
        if (
          mediaDelta > 0 &&
          mediaDelta <= wallDelta * video.playbackRate + 0.35
        ) {
          watchedIntervalsRef.current = addWatchedInterval(
            watchedIntervalsRef.current,
            previous.media,
            media,
          )
        }
      }

      lastSampleRef.current = { media, wall }

      if (wall - lastUiUpdateRef.current >= 80) {
        setCurrentTime(media)
        const totalWatched = watchedIntervalsRef.current.reduce(
          (sum, interval) => sum + (interval[1] - interval[0]),
          0,
        )
        setWatchedSeconds(totalWatched)
        lastUiUpdateRef.current = wall
      }

      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(frameId)
      lastSampleRef.current = null
    }
  }, [isPlaying])

  // Calculate active step: start <= currentTime < end (open interval on end)
  const activeIndex = useMemo(() => {
    if (ended) return steps.length - 1
    const found = steps.findIndex(
      (step) => currentTime >= step.start && currentTime < step.end,
    )
    return found >= 0 ? found : steps.length - 1
  }, [currentTime, ended, steps])

  const activeStep = steps[activeIndex]

  // Cumulative watched calculations
  const totalDuration = duration ?? steps[steps.length - 1].end
  const watchedPercent = totalDuration
    ? Math.min(100, (watchedSeconds / totalDuration) * 100)
    : 0
  const canRecord = Boolean(
    totalDuration && (watchedPercent >= 90 || ended || status === 'COMPLETED'),
  )
  const remainingPercent = Math.max(0, Math.ceil(90 - watchedPercent))
  const progressPercent = totalDuration
    ? Math.min(100, (currentTime / totalDuration) * 100)
    : 0

  // Mobile auto-scroll active step card into center of rail
  useEffect(() => {
    if (!hasPlayed) return
    const rail = stepsRailRef.current
    const card = stepCardRefs.current[activeIndex]
    if (!rail || !card || window.innerWidth > 767) return

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    rail.scrollTo({
      left:
        card.offsetLeft -
        rail.offsetLeft -
        (rail.clientWidth - card.clientWidth) / 2,
      behavior: reducedMotion ? 'instant' : 'smooth',
    })
  }, [activeIndex, hasPlayed])

  // Auto-hide center button when playing after 2.5 seconds
  const resetHideControlsTimer = useCallback(() => {
    setCenterButtonVisible(true)
    if (hideControlsTimerRef.current !== null) {
      window.clearTimeout(hideControlsTimerRef.current)
    }
    if (isPlaying) {
      hideControlsTimerRef.current = window.setTimeout(() => {
        setCenterButtonVisible(false)
      }, 2500)
    }
  }, [isPlaying])

  const handlePlayerPointerMove = () => {
    resetHideControlsTimer()
  }

  // Play / Pause methods
  async function playVideo() {
    const video = videoRef.current
    if (!video || mediaState !== 'ready') return
    try {
      if (ended) {
        video.currentTime = 0
        setCurrentTime(0)
        setEnded(false)
      }
      await video.play()
      setHasPlayed(true)
      setIsPlaying(true)
      resetHideControlsTimer()
    } catch {
      setMediaState('error')
    }
  }

  function pauseVideo() {
    const video = videoRef.current
    if (!video) return
    video.pause()
    setIsPlaying(false)
    setCenterButtonVisible(true)
  }

  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.paused || ended) void playVideo()
    else pauseVideo()
  }

  function seekTo(seconds: number, play = false) {
    const video = videoRef.current
    if (!video || mediaState !== 'ready') return
    const maxBound = duration ?? steps[steps.length - 1].end
    const target = Math.max(0, Math.min(maxBound, seconds))

    lastSampleRef.current = null
    video.currentTime = target
    setCurrentTime(target)
    setEnded(false)
    if (play) void playVideo()
  }

  function cyclePlaybackSpeed() {
    const nextIndex = (playbackSpeedIndex + 1) % SPEED_OPTIONS.length
    const nextRate = SPEED_OPTIONS[nextIndex]
    setPlaybackSpeedIndex(nextIndex)
    if (videoRef.current) {
      videoRef.current.playbackRate = nextRate
    }
  }

  function changeVolume(value: number) {
    const video = videoRef.current
    setVolume(value)
    setMuted(value === 0)
    if (video) {
      video.volume = value / 100
      video.muted = value === 0
    }
  }

  function toggleMute() {
    const video = videoRef.current
    if (!video) return
    const next = !video.muted
    video.muted = next
    setMuted(next)
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await playerRef.current?.requestFullscreen()
    }
  }

  function onPlayerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return
    }

    if (event.code === 'Space') {
      event.preventDefault()
      togglePlay()
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      seekTo((videoRef.current?.currentTime ?? 0) - 10)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      seekTo((videoRef.current?.currentTime ?? 0) + 10)
    } else if (event.key.toLowerCase() === 'm') {
      event.preventDefault()
      toggleMute()
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault()
      void toggleFullscreen()
    }
  }

  function toggleBookmark() {
    const next = !saved
    setSaved(next)
    try {
      window.localStorage.setItem(
        `mb:resource-bookmark:${resource.id}`,
        String(next),
      )
    } catch {
      setShareToast('Trình duyệt chưa cho phép lưu trên thiết bị.')
    }
  }

  async function shareLesson() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: resource.title,
          url: window.location.href,
        })
      } else {
        await navigator.clipboard.writeText(window.location.href)
        setShareToast('Đã sao chép liên kết bài học.')
        window.setTimeout(() => setShareToast(''), 3000)
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setShareToast('Chưa thể chia sẻ liên kết lúc này.')
      }
    }
  }

  async function handleRecordCompletion() {
    if (
      !canRecord ||
      progressLoadState !== 'ready' ||
      saving ||
      recordingRef.current
    ) {
      return
    }
    recordingRef.current = true
    setRecordState('sending')
    const success = await onRecord(watchedSeconds, practiceNote.trim())
    setRecordState(success ? 'success' : 'error')
    recordingRef.current = false
  }

  function downloadWorksheet() {
    // Generate an accessible printable A4 worksheet HTML popout for the 5 CBT steps
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>MentalBridge - Biểu Mẫu Giải Quyết Vấn Đề (CBT)</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1a3326; max-width: 800px; margin: 0 auto; line-height: 1.6; }
    h1 { color: #1f4f37; border-bottom: 2px solid #2f7351; padding-bottom: 10px; margin-bottom: 5px; }
    .subtitle { color: #5a7364; font-size: 14px; margin-bottom: 25px; }
    .step-box { border: 1px solid #c8ded1; border-radius: 8px; padding: 16px; margin-bottom: 18px; background: #fafdfb; page-break-inside: avoid; }
    .step-header { font-weight: bold; font-size: 16px; color: #1e5238; margin-bottom: 8px; }
    .prompt { font-size: 13px; color: #436350; font-style: italic; margin-bottom: 12px; }
    .write-area { border: 1px dashed #9bc3ac; height: 75px; border-radius: 6px; background: #fff; padding: 8px; }
    .footer { margin-top: 30px; font-size: 12px; color: #728c7d; border-top: 1px solid #d4e5db; padding-top: 10px; text-align: center; }
  </style>
</head>
<body>
  <h1>MentalBridge · Biểu Mẫu 5 Bước Giải Quyết Vấn Đề</h1>
  <div class="subtitle">Phương pháp tư duy có cấu trúc từ Liệu pháp Nhận thức Hành vi (CBT) · Tự điền & Thực hành</div>
  ${steps
    .map(
      (s) => `
    <div class="step-box">
      <div class="step-header">Bước ${s.stepNumber}: ${s.title}</div>
      <div class="prompt">${s.practicePrompt?.question ?? s.summary}</div>
      <div class="write-area"></div>
    </div>
  `,
    )
    .join('')}
  <div class="footer">MentalBridge Mental Health Platform · Biên soạn theo tài liệu Problem Solving - NHS Every Mind Matters</div>
  <script>window.print();</script>
</body>
</html>`

    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }

  // Active status text for video pill
  const pillStatusText = useMemo(() => {
    if (ended) {
      return 'Hoàn thành bài học | CBT Framework'
    }
    if (isPlaying) {
      return `Đang phát: Bước ${activeStep.stepNumber} – ${activeStep.title} | CBT Framework`
    }
    if (hasPlayed) {
      return `Tạm dừng: Bước ${activeStep.stepNumber} – ${activeStep.title} | CBT Framework`
    }
    return `Sẵn sàng: Bước 1 – ${steps[0].title} | CBT Framework`
  }, [activeStep.stepNumber, activeStep.title, ended, hasPlayed, isPlaying, steps])

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        {/* Top Header & Breadcrumb (single unified navigation) */}
        <div className={styles.topBar}>
          <nav className={styles.breadcrumb} aria-label="Đường dẫn trang">
            <Link href={backHref} className={styles.breadcrumbLink}>
              Tài nguyên
            </Link>
            <ChevronRight
              size={14}
              className={styles.breadcrumbSeparator}
              aria-hidden="true"
            />
            <span className={styles.breadcrumbCurrent} aria-current="page">
              {resource.title}
            </span>
          </nav>
        </div>

        {shareToast && (
          <div className={styles.shareToast} role="status">
            {shareToast}
          </div>
        )}

        {/* Informative Separated Chips */}
        <div className={styles.chips} aria-label="Thông tin bài học">
          <span className={styles.chip}>
            <span className={styles.chipDot} aria-hidden="true" />
            {config.categoryLabel}
          </span>
          <span className={`${styles.chip} ${styles.chipDuration}`}>
            <Clock3 size={14} aria-hidden="true" />
            {duration === null ? '06:00' : formatDuration(duration)}
          </span>
          <span className={styles.chip}>{config.difficultyLabel}</span>
          <span className={`${styles.chip} ${styles.chipFramework}`}>
            {config.frameworkTag}
          </span>
        </div>

        {/* Title & Actions Row */}
        <header className={styles.titleRow}>
          <div className={styles.titleCol}>
            <h1>{resource.title}</h1>
            <p>
              Phương pháp 5 bước có cấu trúc từ Liệu pháp Nhận thức Hành vi (CBT),
              giúp bạn chia nhỏ khó khăn quá tải thành các hành động cụ thể có thể
              kiểm soát.
            </p>
          </div>
          <div className={styles.titleActions}>
            <button
              type="button"
              className={styles.bookmarkBtn}
              onClick={toggleBookmark}
              aria-pressed={saved}
              aria-label={
                saved ? 'Bỏ lưu bài học trên thiết bị' : 'Lưu bài học trên thiết bị'
              }
            >
              <Bookmark
                size={18}
                fill={saved ? 'currentColor' : 'none'}
                aria-hidden="true"
              />
              <span>{saved ? 'Đã lưu' : 'Lưu bài học'}</span>
            </button>
            <button
              type="button"
              className={styles.shareBtn}
              onClick={() => void shareLesson()}
              aria-label="Chia sẻ bài học"
            >
              <Share2 size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Video Player Section */}
        <section
          className={styles.playerSection}
          aria-label="Trình phát video bài học"
        >
          <div
            className={styles.player}
            ref={playerRef}
            onKeyDown={onPlayerKeyDown}
            onPointerMove={handlePlayerPointerMove}
            tabIndex={0}
            aria-label="Trình phát video bài học CBT. Phím Space để phát/dừng, Mũi tên trái/phải để tua 10 giây, phím M tắt âm, phím F toàn màn hình."
          >
            <div className={styles.videoFrame}>
              <video
                ref={videoRef}
                src={config.videoSrc}
                poster={config.videoPoster}
                preload="metadata"
                playsInline
                onLoadedMetadata={(event) => {
                  const sec = event.currentTarget.duration
                  if (Number.isFinite(sec) && sec > 0) {
                    setDuration(sec)
                    setMediaState('ready')
                    event.currentTarget.volume = volume / 100
                  } else {
                    setMediaState('error')
                  }
                }}
                onError={() => setMediaState('error')}
                onPlay={() => {
                  setIsPlaying(true)
                  setHasPlayed(true)
                  setEnded(false)
                  resetHideControlsTimer()
                }}
                onPause={() => {
                  setIsPlaying(false)
                  lastSampleRef.current = null
                  setCurrentTime(videoRef.current?.currentTime ?? 0)
                  setCenterButtonVisible(true)
                }}
                onSeeking={() => {
                  lastSampleRef.current = null
                }}
                onSeeked={() => {
                  lastSampleRef.current = null
                  setCurrentTime(videoRef.current?.currentTime ?? 0)
                }}
                onTimeUpdate={() => {
                  if (!isPlaying) {
                    setCurrentTime(videoRef.current?.currentTime ?? 0)
                  }
                }}
                onEnded={() => {
                  setEnded(true)
                  setIsPlaying(false)
                  setCurrentTime(videoRef.current?.duration ?? totalDuration)
                  lastSampleRef.current = null
                  setCenterButtonVisible(true)
                }}
              >
                Trình duyệt của bạn không hỗ trợ thẻ video HTML5.
              </video>

              {/* Top-left Status Pill */}
              <div className={styles.statusPill}>
                <span
                  className={`${styles.statusDot} ${
                    ended
                      ? styles.statusDotEnded
                      : !isPlaying && hasPlayed
                        ? styles.statusDotPaused
                        : ''
                  }`}
                  aria-hidden="true"
                />
                <span>{pillStatusText}</span>
              </div>

              {/* Big Center Play/Pause Button */}
              {mediaState === 'ready' && (
                <button
                  type="button"
                  className={`${styles.centerButton} ${
                    !centerButtonVisible && isPlaying
                      ? styles.centerButtonHidden
                      : ''
                  }`}
                  onClick={togglePlay}
                  aria-label={
                    ended
                      ? 'Xem lại bài học từ đầu'
                      : isPlaying
                        ? 'Tạm dừng video'
                        : 'Phát video'
                  }
                >
                  {ended ? (
                    <RotateCcw size={28} />
                  ) : isPlaying ? (
                    <Pause size={28} fill="currentColor" />
                  ) : (
                    <Play size={28} fill="currentColor" style={{ marginLeft: 3 }} />
                  )}
                </button>
              )}

              {/* Subtitles Overlay */}
              {captionsEnabled && isPlaying && (
                <div className={styles.captionsOverlay} aria-live="polite">
                  Bước {activeStep.stepNumber}: {activeStep.title} — {activeStep.summary}
                </div>
              )}

              {/* Loading & Error Overlays */}
              {mediaState === 'loading' && (
                <div
                  className={styles.mediaLoading}
                  role="status"
                  aria-label="Đang nạp video"
                >
                  <span className={styles.mediaLoadingSpinner} />
                </div>
              )}
              {mediaState === 'error' && (
                <div className={styles.mediaError} role="alert">
                  <strong>Chưa nạp được video</strong>
                  <p>
                    Vui lòng kiểm tra đường dẫn video trong file cấu hình
                    problem-solving-lesson.ts.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMediaState('loading')
                      videoRef.current?.load()
                    }}
                  >
                    Thử lại
                  </button>
                </div>
              )}
            </div>

            {/* Custom Control Bar */}
            <div className={styles.playerControls}>
              {/* Progress Bar with Step Boundary Tick Markers */}
              <div className={styles.timeline}>
                <input
                  type="range"
                  className={styles.timelineSlider}
                  min={0}
                  max={totalDuration}
                  step={0.1}
                  value={Math.min(currentTime, totalDuration)}
                  disabled={mediaState !== 'ready'}
                  onChange={(e) => seekTo(Number(e.target.value))}
                  aria-label="Tua video"
                  aria-valuetext={`${formatTime(currentTime)} / ${formatTime(totalDuration)}`}
                  style={
                    {
                      '--played': `${progressPercent}%`,
                    } as CSSProperties
                  }
                />

                {/* Boundary tick markers */}
                {steps.slice(1).map((step) => {
                  const tickLeftPercent = (step.start / totalDuration) * 100
                  return (
                    <button
                      key={step.id}
                      type="button"
                      className={styles.timelineTick}
                      style={{ left: `${tickLeftPercent}%` }}
                      onClick={() => seekTo(step.start, true)}
                      aria-label={`Chuyển đến Bước ${step.stepNumber}: ${step.title}`}
                      title={`${formatTime(step.start)} · Bước ${step.stepNumber}: ${step.title}`}
                    />
                  )
                })}
              </div>

              {/* Bottom Control Icons */}
              <div className={styles.controlRow}>
                <button
                  type="button"
                  className={styles.controlBtn}
                  onClick={togglePlay}
                  disabled={mediaState !== 'ready'}
                  aria-label={
                    ended
                      ? 'Xem lại bài học'
                      : isPlaying
                        ? 'Tạm dừng'
                        : 'Phát video'
                  }
                >
                  {ended ? (
                    <RotateCcw size={18} />
                  ) : isPlaying ? (
                    <Pause size={18} fill="currentColor" />
                  ) : (
                    <Play size={18} fill="currentColor" />
                  )}
                </button>

                <button
                  type="button"
                  className={styles.controlBtn}
                  onClick={() =>
                    seekTo((videoRef.current?.currentTime ?? 0) - 10)
                  }
                  disabled={mediaState !== 'ready'}
                  aria-label="Lùi 10 giây"
                >
                  <SkipBack size={18} />
                </button>

                <button
                  type="button"
                  className={styles.controlBtn}
                  onClick={() =>
                    seekTo((videoRef.current?.currentTime ?? 0) + 10)
                  }
                  disabled={mediaState !== 'ready'}
                  aria-label="Tới 10 giây"
                >
                  <SkipForward size={18} />
                </button>

                <div className={styles.volumeGroup}>
                  <button
                    type="button"
                    className={styles.controlBtn}
                    onClick={toggleMute}
                    disabled={mediaState !== 'ready'}
                    aria-label={muted ? 'Bật tiếng' : 'Tắt tiếng'}
                  >
                    {muted || volume === 0 ? (
                      <VolumeX size={18} />
                    ) : (
                      <Volume2 size={18} />
                    )}
                  </button>
                  <input
                    type="range"
                    className={styles.volumeSlider}
                    min={0}
                    max={100}
                    value={muted ? 0 : volume}
                    onChange={(e) => changeVolume(Number(e.target.value))}
                    aria-label="Thanh trượt âm lượng"
                  />
                </div>

                <time className={styles.timeDisplay}>
                  {formatTime(currentTime)} / {formatTime(totalDuration)}
                </time>

                <div className={styles.controlsSpacer} />

                <span className={styles.qualityBadge} title="Chất lượng độ nét cao">
                  1080p HD
                </span>

                <button
                  type="button"
                  className={styles.speedBtn}
                  onClick={cyclePlaybackSpeed}
                  aria-label={`Tốc độ phát hiện tại: ${SPEED_OPTIONS[playbackSpeedIndex]}x. Bấm để đổi tốc độ.`}
                  title="Thay đổi tốc độ phát"
                >
                  {SPEED_OPTIONS[playbackSpeedIndex]}x
                </button>

                <button
                  type="button"
                  className={`${styles.controlBtn} ${
                    captionsEnabled ? styles.controlBtnActive : ''
                  }`}
                  onClick={() => setCaptionsEnabled((prev) => !prev)}
                  aria-label={
                    captionsEnabled ? 'Tắt phụ đề CC' : 'Bật phụ đề CC'
                  }
                  title="Phụ đề (CC)"
                >
                  <Subtitles size={18} />
                </button>

                <button
                  type="button"
                  className={styles.controlBtn}
                  onClick={() => void toggleFullscreen()}
                  disabled={mediaState !== 'ready'}
                  aria-label={
                    fullscreen ? 'Thoát toàn màn hình' : 'Xem toàn màn hình'
                  }
                >
                  {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Synchronized 5-Step Roadmap Section */}
        <section
          className={styles.roadmapSection}
          aria-labelledby="roadmap-heading"
        >
          <div className={styles.roadmapHeader}>
            <div className={styles.roadmapHeadingLeft}>
              <div className={styles.roadmapIcon} aria-hidden="true">
                <Workflow size={18} />
              </div>
              <h2 id="roadmap-heading">
                Lộ trình {steps.length} bước tư duy có hệ thống
              </h2>
            </div>
            <p className={styles.roadmapHint}>
              Bấm từng bước để chuyển nhanh đoạn video tương ứng
            </p>
          </div>

          <div className={styles.stepGrid} ref={stepsRailRef}>
            {steps.map((step, index) => {
              const isComplete = ended || currentTime >= step.end
              const isActive = !ended && index === activeIndex
              const isUpcoming = !isComplete && !isActive

              const stepDuration = step.end - step.start
              const stepElapsed = Math.max(
                0,
                Math.min(stepDuration, currentTime - step.start),
              )
              const stepPercent = isActive
                ? (stepElapsed / stepDuration) * 100
                : isComplete
                  ? 100
                  : 0

              return (
                <button
                  key={step.id}
                  type="button"
                  ref={(node) => {
                    stepCardRefs.current[index] = node
                  }}
                  className={`${styles.stepCard} ${
                    isActive
                      ? styles.stepCardActive
                      : isComplete
                        ? styles.stepCardComplete
                        : ''
                  }`}
                  onClick={() => seekTo(step.start, true)}
                  disabled={mediaState !== 'ready'}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <div className={styles.stepCardTop}>
                    <span className={styles.stepNumberBadge}>
                      {isActive ? (
                        <>
                          <span>{String(step.stepNumber).padStart(2, '0')}</span>
                          <span>· Đang phát</span>
                        </>
                      ) : isComplete ? (
                        <>
                          <Check size={14} aria-hidden="true" />
                          <span>{String(step.stepNumber).padStart(2, '0')}</span>
                        </>
                      ) : (
                        <span>{String(step.stepNumber).padStart(2, '0')}</span>
                      )}
                    </span>
                    <span className={styles.stepTimeBadge}>
                      {formatTime(step.start)}
                    </span>
                  </div>

                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepSummary}>{step.summary}</p>

                  <div className={styles.stepProgressBar} aria-hidden="true">
                    <span
                      className={styles.stepProgressFill}
                      style={{ width: `${stepPercent}%` }}
                    />
                  </div>

                  <div className={styles.stepCardFooter}>
                    <span className={styles.stepStatusText}>
                      {isActive ? (
                        <>
                          <Sparkles size={13} aria-hidden="true" />
                          <span>Đang theo dõi</span>
                        </>
                      ) : isComplete ? (
                        <>
                          <Check size={13} aria-hidden="true" />
                          <span>Đã xem xong</span>
                        </>
                      ) : (
                        <span>Chưa xem</span>
                      )}
                    </span>
                    <ChevronRight size={15} aria-hidden="true" />
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Bottom 2-Column Area: Quick Practice (Left) & CBT Advice + PDF (Right) */}
        <div className={styles.bottomGrid}>
          {/* Left Column: Quick Practice Card */}
          <section
            className={styles.practiceCard}
            aria-labelledby="practice-heading"
          >
            <div className={styles.practiceHeader}>
              <div className={styles.practiceTitleGroup}>
                <div className={styles.practiceIcon} aria-hidden="true">
                  <PenTool size={20} />
                </div>
                <div>
                  <h3 id="practice-heading">
                    Bảng thực hành nhanh: Hành động nhỏ hôm nay
                  </h3>
                  <p className={styles.practiceSubtitle}>
                    {activeStep.practicePrompt?.stepLabel ??
                      `Ứng dụng ngay Bước ${activeStep.stepNumber} vào thực tế cuộc sống`}
                  </p>
                </div>
              </div>
              <span className={styles.xpBadge}>+15 XP Tinh Thần</span>
            </div>

            <div className={styles.practicePrompt}>
              <strong>
                Vấn đề của bạn:{' '}
                {`"${
                  activeStep.practicePrompt?.question ??
                  'Hãy tóm gọn vấn đề của bạn thành một câu cụ thể:'
                }"`}
              </strong>
            </div>

            <div className={styles.textareaWrapper}>
              <textarea
                className={styles.practiceTextarea}
                maxLength={500}
                value={practiceNote}
                onChange={(e) => setPracticeNote(e.target.value)}
                placeholder={
                  activeStep.practicePrompt?.placeholder ??
                  'Ghi chép nhanh suy nghĩ hoặc phương án của bạn tại đây...'
                }
                aria-label="Nội dung thực hành giải quyết vấn đề"
              />
              <span className={styles.charCounter}>
                {practiceNote.length}/500
              </span>
            </div>

            <div className={styles.practiceFooter}>
              <div className={styles.securityNote}>
                <ShieldCheck size={16} aria-hidden="true" />
                <span>
                  Bảo mật cá nhân & chỉ lưu trong hành trình của bạn
                </span>
              </div>

              {!canRecord && (
                <p className={styles.recordGateHint}>
                  Xem thêm {remainingPercent}% video để ghi nhận. Tua qua đoạn
                  chưa xem không được tính.
                </p>
              )}

              {recordState === 'success' && (
                <p className={styles.recordSuccess} role="status">
                  ✓ Đã ghi nhận thành công vào Kế hoạch hỗ trợ!
                </p>
              )}

              {recordState === 'error' && (
                <p className={styles.recordError} role="alert">
                  {message || 'Chưa thể lưu tiến độ lúc này. Vui lòng thử lại.'}
                </p>
              )}

              <button
                type="button"
                className={styles.recordBtn}
                disabled={
                  !canRecord ||
                  progressLoadState !== 'ready' ||
                  saving ||
                  recordState === 'sending' ||
                  status === 'COMPLETED'
                }
                onClick={() => void handleRecordCompletion()}
              >
                <PenTool size={16} aria-hidden="true" />
                <span>
                  {status === 'COMPLETED'
                    ? 'Đã ghi nhận vào Kế hoạch hỗ trợ'
                    : saving || recordState === 'sending'
                      ? 'Đang ghi nhận…'
                      : 'Ghi nhận vào Kế hoạch hỗ trợ'}
                </span>
              </button>
            </div>
          </section>

          {/* Right Column: CBT Specialist Advice & PDF Worksheet Card */}
          <div className={styles.sideColumn}>
            {/* CBT Expert Tip Card */}
            <section
              className={styles.tipCard}
              aria-labelledby="cbt-tip-heading"
            >
              <div className={styles.tipHeader}>
                <div className={styles.tipIcon} aria-hidden="true">
                  <Lightbulb size={18} />
                </div>
                <h4 id="cbt-tip-heading">{activeStep.tip.heading}</h4>
              </div>

              <p className={styles.tipLead}>{activeStep.tip.lead}</p>

              <ul className={styles.tipBullets}>
                {activeStep.tip.bullets.map((bullet, idx) => (
                  <li key={idx}>{bullet}</li>
                ))}
              </ul>
            </section>

            {/* PDF Worksheet Download Card */}
            <section
              className={styles.pdfCard}
              aria-labelledby="pdf-sheet-heading"
            >
              <div className={styles.pdfLeft}>
                <div className={styles.pdfIcon} aria-hidden="true">
                  <FileText size={22} />
                </div>
                <div className={styles.pdfCopy}>
                  <strong id="pdf-sheet-heading">
                    {config.worksheetPdf.title}
                  </strong>
                  <span>{config.worksheetPdf.subtitle}</span>
                </div>
              </div>
              <button
                type="button"
                className={styles.pdfDownloadBtn}
                onClick={downloadWorksheet}
                aria-label="Tải hoặc in biểu mẫu 5 bước dạng PDF"
                title="Tải biểu mẫu (PDF)"
              >
                <Download size={18} />
              </button>
            </section>
          </div>
        </div>

        {/* Page Footer */}
        <footer className={styles.footer}>
          <div className={styles.footerLeft}>
            <span className={styles.footerSource}>
              Biên soạn theo tài liệu Problem Solving – NHS Every Mind Matters
              (Dịch vụ Y tế Quốc gia Anh).
            </span>
          </div>
          <div className={styles.footerRight}>
            <span>Cập nhật: Tháng 10, 2024</span>
            <button
              type="button"
              className={styles.feedbackBtn}
              onClick={() => {
                alert(
                  'Cảm ơn bạn đã đóng góp phản hồi! Ý kiến của bạn giúp MentalBridge hoàn thiện hơn.',
                )
              }}
            >
              Báo cáo phản hồi
            </button>
          </div>
        </footer>
      </div>
    </main>
  )
}
