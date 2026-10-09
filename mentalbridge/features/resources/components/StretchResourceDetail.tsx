'use client'

import Link from 'next/link'
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  Lightbulb,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Share2,
  SkipBack,
  SkipForward,
  Target,
  Timer,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'

import type { PublicResourceDetail } from '../api/browser-resources'
import { stretchExerciseSteps } from '../model/stretch-exercise-steps'
import styles from './stretch-resource-detail.module.css'

type Props = Readonly<{
  resource: PublicResourceDetail
  backHref: string
  backLabel: string
  status: 'IN_PROGRESS' | 'COMPLETED'
  progressLoadState: 'loading' | 'ready' | 'error'
  saving: boolean
  message: string
  onRetryProgress: () => void
  onRecord: (watchedSeconds: number) => Promise<boolean>
}>

type WatchedInterval = [number, number]

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`
}

function formatDuration(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(whole / 60)
  const rest = whole % 60
  return rest === 0 ? `${minutes} phút` : `${minutes} phút ${rest} giây`
}

function addWatchedInterval(intervals: WatchedInterval[], start: number, end: number) {
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

export function StretchResourceDetail({
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
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const stepsRef = useRef<HTMLDivElement>(null)
  const stepRefs = useRef<Array<HTMLDivElement | null>>([])
  const watchedIntervalsRef = useRef<WatchedInterval[]>([])
  const lastSampleRef = useRef<{ media: number; wall: number } | null>(null)
  const lastUiUpdateRef = useRef(0)
  const recordingRef = useRef(false)
  const [mediaState, setMediaState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [duration, setDuration] = useState<number | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [watchedSeconds, setWatchedSeconds] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasPlayed, setHasPlayed] = useState(false)
  const [ended, setEnded] = useState(false)
  const [volume, setVolume] = useState(80)
  const [muted, setMuted] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [shareMessage, setShareMessage] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [recordState, setRecordState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [showCues, setShowCues] = useState(true)
  const [playbackRate, setPlaybackRate] = useState(1)

  useEffect(() => {
    try {
      setSaved(window.localStorage.getItem(`mb:resource-bookmark:${resource.id}`) === 'true')
    } catch {
      setSaved(false)
    }
  }, [resource.id])

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement === playerRef.current)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    if (!isPlaying) return
    let frame = 0
    const tick = (wall: number) => {
      const video = videoRef.current
      if (!video || video.paused) {
        lastSampleRef.current = null
        return
      }
      if (video.seeking) {
        lastSampleRef.current = null
        frame = window.requestAnimationFrame(tick)
        return
      }
      const media = video.currentTime
      const previous = lastSampleRef.current
      if (previous) {
        const mediaDelta = media - previous.media
        const wallDelta = (wall - previous.wall) / 1000
        if (mediaDelta > 0 && mediaDelta <= wallDelta * video.playbackRate + 0.25) {
          watchedIntervalsRef.current = addWatchedInterval(watchedIntervalsRef.current, previous.media, media)
        }
      }
      lastSampleRef.current = { media, wall }
      if (wall - lastUiUpdateRef.current >= 100) {
        setCurrentTime(media)
        setWatchedSeconds(watchedIntervalsRef.current.reduce((sum, interval) => sum + interval[1] - interval[0], 0))
        lastUiUpdateRef.current = wall
      }
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(frame)
      lastSampleRef.current = null
    }
  }, [isPlaying])

  const activeIndex = useMemo(() => {
    if (ended) return stretchExerciseSteps.length - 1
    const found = stretchExerciseSteps.findIndex((step) => currentTime >= step.start && currentTime < step.end)
    return found >= 0 ? found : stretchExerciseSteps.length - 1
  }, [currentTime, ended])
  const activeStep = stretchExerciseSteps[activeIndex]
  const watchedPercent = duration ? Math.min(100, (watchedSeconds / duration) * 100) : 0
  const canRecord = Boolean(duration && watchedPercent >= 90)
  const remainingPercent = Math.max(0, Math.ceil(90 - watchedPercent))
  const progressPercent = duration ? Math.min(100, (currentTime / duration) * 100) : 0
  const stepCount = ended ? stretchExerciseSteps.length : hasPlayed ? activeIndex + 1 : 0
  const stepCompletionPercent = Math.round((stepCount / stretchExerciseSteps.length) * 100)
  const sourceUrl = resource.sourceUrl?.startsWith('https://') ? resource.sourceUrl : null
  const videoHeight = videoRef.current?.videoHeight ?? 0

  useEffect(() => {
    if (!hasPlayed) return
    setAnnouncement(ended ? 'Bài tập đã hoàn thành' : `Động tác ${activeIndex + 1}: ${activeStep.title}`)
    const rail = stepsRef.current
    const card = stepRefs.current[activeIndex]
    if (!rail || !card) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const railBounds = rail.getBoundingClientRect()
    const cardBounds = card.getBoundingClientRect()
    if (cardBounds.top < railBounds.top || cardBounds.bottom > railBounds.bottom) {
      rail.scrollBy({
        top: cardBounds.top < railBounds.top ? cardBounds.top - railBounds.top - 12 : cardBounds.bottom - railBounds.bottom + 12,
        behavior: reducedMotion ? 'auto' : 'smooth',
      })
    }
  }, [activeIndex, activeStep.title, ended, hasPlayed])

  async function playVideo() {
    const video = videoRef.current
    if (!video || mediaState !== 'ready') return
    try {
      if (video.ended || (ended && duration !== null && video.currentTime >= duration - 0.2)) {
        video.currentTime = 0
        setCurrentTime(0)
        setEnded(false)
      }
      await video.play()
      setHasPlayed(true)
    } catch {
      setMediaState('error')
    }
  }

  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.paused || ended) void playVideo()
    else video.pause()
  }

  function seekTo(seconds: number, play = false) {
    const video = videoRef.current
    if (!video || mediaState !== 'ready' || !duration) return
    const target = Math.max(0, Math.min(duration, seconds))
    lastSampleRef.current = null
    video.currentTime = target
    setCurrentTime(target)
    setEnded(false)
    if (play) void playVideo()
  }

  function retryVideo() {
    const video = videoRef.current
    if (!video) return
    setMediaState('loading')
    video.load()
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
    video.muted = !video.muted
    setMuted(video.muted)
  }

  function changePlaybackRate(rate: number) {
    if (videoRef.current) videoRef.current.playbackRate = rate
    setPlaybackRate(rate)
  }

  function scrollToActiveStep() {
    const rail = stepsRef.current
    const card = stepRefs.current[activeIndex]
    if (!rail || !card) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    rail.scrollTo({
      top: rail.scrollTop + card.getBoundingClientRect().top - rail.getBoundingClientRect().top - 12,
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await playerRef.current?.requestFullscreen()
  }

  function onPlayerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    if (event.target instanceof HTMLInputElement && event.target.dataset.volume === 'true') return
    if (event.code === 'Space' && event.target === event.currentTarget) {
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
      window.localStorage.setItem(`mb:resource-bookmark:${resource.id}`, String(next))
    } catch {
      setShareMessage('Trình duyệt chưa cho phép lưu bài tập trên thiết bị này.')
    }
  }

  async function shareResource() {
    try {
      if (navigator.share) {
        await navigator.share({ title: resource.title, url: window.location.href })
      } else {
        await navigator.clipboard.writeText(window.location.href)
        setShareMessage('Đã sao chép liên kết bài tập.')
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') setShareMessage('Chưa thể chia sẻ liên kết lúc này.')
    }
  }

  async function recordCompletion() {
    if (!canRecord || progressLoadState !== 'ready' || saving || recordingRef.current) return
    recordingRef.current = true
    setRecordState('sending')
    try {
      const success = await onRecord(watchedSeconds)
      setRecordState(success ? 'success' : 'error')
    } catch {
      setRecordState('error')
    } finally {
      recordingRef.current = false
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.toolbar}>
          <nav className={styles.breadcrumb} aria-label="Đường dẫn">
            <Link href={backHref}><ArrowLeft size={17} aria-hidden="true" />{backLabel}</Link>
            <ChevronRight size={16} aria-hidden="true" />
            <span aria-current="page">{resource.title}</span>
          </nav>
          <div className={styles.toolbarActions}>
            <button type="button" onClick={toggleBookmark} aria-pressed={saved} aria-label={saved ? 'Bỏ lưu bài tập trên thiết bị' : 'Lưu bài tập trên thiết bị'}>
              <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
              <span>{saved ? 'Đã lưu' : 'Lưu bài tập'}</span>
            </button>
            <button type="button" onClick={() => void shareResource()} aria-label="Chia sẻ bài tập"><Share2 size={18} aria-hidden="true" /></button>
          </div>
        </div>
        {shareMessage && <p className={styles.shareMessage} role="status">{shareMessage}</p>}

        <header className={styles.intro}>
          <div className={styles.introCopy}>
            <div className={styles.chips}>
              <span><Play size={13} aria-hidden="true" />Video hướng dẫn</span>
              <span><Clock3 size={14} aria-hidden="true" />{duration === null ? 'Đang tải thời lượng' : formatDuration(duration)}</span>
              <span>Nhẹ nhàng theo sức</span>
              <span>Cần không gian để đứng</span>
            </div>
            <h1>{resource.title}</h1>
            <p>Đổi nhịp sau thời gian ngồi lâu với tám động tác kéo giãn dịu nhẹ trong {duration === null ? 'video này' : formatDuration(duration)}. Tập chậm, chọn biên độ dễ chịu và nghỉ bất cứ lúc nào bạn cần.</p>
          </div>
          <div className={styles.rewardCard}>
            <span className={styles.rewardIcon}><Zap size={23} fill="currentColor" aria-hidden="true" /></span>
            <div><span>PHẦN THƯỞNG HOÀN THÀNH</span><strong>+15 XP Sức khỏe · Cột mốc ngày</strong></div>
          </div>
        </header>

        <div className={styles.mediaLayout}>
        <div className={styles.primaryColumn}>
        <section className={styles.playerSection} aria-label="Video hướng dẫn giãn cơ">
          <div className={styles.player} ref={playerRef} onKeyDown={onPlayerKeyDown} tabIndex={0} aria-label="Trình phát bài tập. Nhấn Space để phát hoặc dừng, phím mũi tên để tua, M để tắt tiếng, F để toàn màn hình.">
            <div className={styles.videoFrame}>
              <video
                ref={videoRef}
                src="/videos/gian-co-7-phut.mp4"
                poster="/images/stretch-video-poster.png"
                preload="metadata"
                playsInline
                onLoadedMetadata={(event) => {
                  const seconds = event.currentTarget.duration
                  if (Number.isFinite(seconds) && seconds > 0) {
                    setDuration(seconds)
                    setMediaState('ready')
                    event.currentTarget.volume = volume / 100
                    event.currentTarget.playbackRate = playbackRate
                  } else setMediaState('error')
                }}
                onError={() => setMediaState('error')}
                onPlay={() => { setIsPlaying(true); setHasPlayed(true); setEnded(false) }}
                onPause={() => { setIsPlaying(false); lastSampleRef.current = null; setCurrentTime(videoRef.current?.currentTime ?? 0) }}
                onSeeking={() => { lastSampleRef.current = null }}
                onSeeked={() => { lastSampleRef.current = null; setCurrentTime(videoRef.current?.currentTime ?? 0) }}
                onTimeUpdate={() => { if (!isPlaying) setCurrentTime(videoRef.current?.currentTime ?? 0) }}
                onEnded={() => { setEnded(true); setIsPlaying(false); setCurrentTime(videoRef.current?.duration ?? 0); lastSampleRef.current = null }}
              >Trình duyệt của bạn không hỗ trợ phát video.</video>
              {mediaState === 'loading' && <div className={styles.mediaLoading} role="status" aria-label="Đang tải video"><span /><span /><span /></div>}
              {mediaState === 'error' && <div className={styles.mediaError} role="alert"><strong>Chưa tải được video</strong><p>Hãy thử tải lại để tiếp tục bài tập.</p><button type="button" onClick={retryVideo}><RotateCcw size={17} aria-hidden="true" />Thử lại</button></div>}
              {mediaState === 'ready' && (
                <>
                  <div className={styles.playerStatus}>
                    <span className={styles.statusDot} aria-hidden="true" />
                    {ended ? 'Hoàn thành' : isPlaying ? `Đang phát: Động tác ${activeIndex + 1} — ${activeStep.title}` : hasPlayed ? `Tạm dừng: Động tác ${activeIndex + 1} — ${activeStep.title}` : 'Sẵn sàng tập cùng video'}
                  </div>
                  <div className={styles.playerOptions}>
                    <span className={styles.qualityLabel}>{videoHeight ? `${videoHeight >= 720 ? 'HD ' : ''}${videoHeight}p` : 'Video'}</span>
                    <details className={styles.settingsMenu}>
                      <summary aria-label="Tốc độ phát"><Settings2 size={18} aria-hidden="true" /></summary>
                      <div>{[1, 1.25, 1.5].map((rate) => <button key={rate} type="button" onClick={() => changePlaybackRate(rate)} aria-pressed={playbackRate === rate}>{rate}×</button>)}</div>
                    </details>
                  </div>
                  {!hasPlayed && <button type="button" className={styles.startButton} onClick={() => void playVideo()}><Play size={20} fill="currentColor" aria-hidden="true" />Bắt đầu tập cùng Hướng dẫn viên</button>}
                  {hasPlayed && showCues && !ended && <p className={styles.videoCue}>{activeStep.description}</p>}
                </>
              )}
            </div>
            <div className={styles.playerControls}>
              <div className={styles.timeline}>
                <input type="range" min={0} max={duration ?? 1} step={0.1} value={Math.min(currentTime, duration ?? 1)} disabled={mediaState !== 'ready'} onChange={(event) => seekTo(Number(event.target.value))} aria-label="Tua video" aria-valuetext={`${formatTime(currentTime)} trên ${duration === null ? 'đang tải' : formatTime(duration)}`} style={{ '--played': `${progressPercent}%` } as CSSProperties} />
                {duration !== null && stretchExerciseSteps.slice(1).map((step, index) => <button key={step.id} type="button" className={`${styles.timelineMarker} ${currentTime >= step.start ? styles.markerPassed : ''}`} style={{ left: `${(step.start / duration) * 100}%` }} onClick={() => seekTo(step.start, true)} aria-label={`Chuyển đến động tác ${index + 2}: ${step.title}`} title={`${formatTime(step.start)} · ${step.title}`} />)}
              </div>
              <div className={styles.controlRow}>
                <button type="button" onClick={togglePlay} disabled={mediaState !== 'ready'} aria-label={ended ? 'Xem lại' : isPlaying ? 'Tạm dừng' : 'Phát video'}>{ended ? <RotateCcw size={20} /> : isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</button>
                <button type="button" onClick={() => seekTo((videoRef.current?.currentTime ?? 0) - 10)} disabled={mediaState !== 'ready'} aria-label="Lùi 10 giây"><SkipBack size={20} /></button>
                <button type="button" onClick={() => seekTo((videoRef.current?.currentTime ?? 0) + 10)} disabled={mediaState !== 'ready'} aria-label="Tới 10 giây"><SkipForward size={20} /></button>
                <time className={styles.timeLabel}>{formatTime(currentTime)} / {duration === null ? '--:--' : formatTime(duration)}</time>
                <div className={styles.volumeControls}>
                  <button type="button" onClick={toggleMute} disabled={mediaState !== 'ready'} aria-label={muted ? 'Bật tiếng' : 'Tắt tiếng'}>{muted || volume === 0 ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>
                  <input data-volume="true" type="range" min={0} max={100} value={muted ? 0 : volume} onChange={(event) => changeVolume(Number(event.target.value))} aria-label="Âm lượng video" />
                </div>
                <button type="button" className={styles.cuesButton} onClick={() => setShowCues((visible) => !visible)} aria-pressed={showCues} aria-label={showCues ? 'Ẩn lời nhắc động tác' : 'Hiện lời nhắc động tác'}>CC</button>
                <button type="button" onClick={() => void toggleFullscreen()} disabled={mediaState !== 'ready'} aria-label={fullscreen ? 'Thoát toàn màn hình' : 'Xem toàn màn hình'}>{fullscreen ? <Minimize size={19} /> : <Maximize size={19} />}</button>
              </div>
            </div>
          </div>
        </section>
        <section className={styles.safetyCard} aria-labelledby="stretch-safety-heading">
          <span className={styles.safetyIcon}><Lightbulb size={23} aria-hidden="true" /></span>
          <div>
            <div className={styles.safetyHeading}><h2 id="stretch-safety-heading">Lời dặn an toàn từ huấn luyện viên</h2><span>LƯU Ý QUAN TRỌNG</span></div>
            <p>Video có các tư thế đứng, chùng chân và giữ thăng bằng. Hãy chuẩn bị khoảng trống và một điểm tựa (thành ghế hoặc tường chắc chắn). Hãy bỏ qua động tác gây đau buốt hoặc chóng mặt, lắng nghe nhịp thở của chính bạn.</p>
          </div>
        </section>

        <footer className={styles.sourceCard}>
          <span className={styles.sourceIcon}><BookOpen size={20} aria-hidden="true" /></span>
          <div><span className={styles.eyebrow}>NGUỒN THAM KHẢO CHUYÊN KHOA</span><strong>{resource.sourceTitle ?? resource.sourceOrganization ?? 'Thông tin tham khảo'}{resource.sourceTitle && resource.sourceOrganization && !resource.sourceTitle.includes(resource.sourceOrganization) ? ` — ${resource.sourceOrganization}` : ''}</strong></div>
          {sourceUrl && <a href={sourceUrl} target="_blank" rel="noopener noreferrer">Xem nguồn tham khảo <ExternalLink size={15} aria-hidden="true" /></a>}
        </footer>
        </div>

        <aside className={styles.stepsPanel}>
        <section className={styles.stepsSection} aria-labelledby="stretch-steps-heading">
          <div className={styles.sectionHeading}>
            <div><span className={styles.eyebrow}>THEO NHỊP VIDEO</span><h2 id="stretch-steps-heading">Lộ trình {stretchExerciseSteps.length} động tác đồng bộ</h2></div>
            <span className={styles.stepCounter}>{stepCount} / {stretchExerciseSteps.length} bài</span>
          </div>
          <div className={styles.progressSummary}>
            <span className={styles.progressRing} style={{ '--step-progress': `${stepCompletionPercent}%` } as CSSProperties}><strong>{stepCompletionPercent}%</strong></span>
            <div><strong>Tiến độ bài tập</strong><span>Đã tập: {formatTime(currentTime)} · Còn lại: {duration === null ? '--:--' : formatTime(duration - currentTime)}</span></div>
            <button type="button" onClick={scrollToActiveStep} disabled={!hasPlayed}><Target size={16} aria-hidden="true" />Hiện tại</button>
          </div>
          <div className={styles.stepGrid} ref={stepsRef}>
            {stretchExerciseSteps.map((step, index) => {
              const complete = ended || currentTime >= step.end
              const active = hasPlayed && !ended && index === activeIndex
              const stepPercent = active ? Math.max(0, Math.min(100, ((currentTime - step.start) / (step.end - step.start)) * 100)) : complete ? 100 : 0
              return <div key={step.id} ref={(node) => { stepRefs.current[index] = node }} className={`${styles.stepCard} ${complete ? styles.stepComplete : ''} ${active ? styles.stepActive : ''}`} aria-current={active ? 'step' : undefined}>
                <button type="button" className={styles.stepMain} onClick={() => seekTo(step.start, true)} disabled={mediaState !== 'ready'} aria-label={`Chuyển đến động tác ${index + 1}: ${step.title}`}>
                  <span className={styles.stepNumber}>{complete ? <Check size={17} aria-hidden="true" /> : String(index + 1).padStart(2, '0')}</span>
                  <span className={styles.stepInfo}><strong>{step.title}</strong><span className={styles.stepDescription}>{step.description}</span></span>
                  <span className={styles.stepMeta}><span className={styles.stepState}>{complete ? 'ĐÃ XONG' : active ? 'ĐANG TẬP' : `BƯỚC ${index + 1}`}</span>{!active && <span>{Math.round(step.end - step.start)}s</span>}</span>
                </button>
                {active && <div className={styles.activeDetails}>
                  <div className={styles.stepTiming}><span><Timer size={15} aria-hidden="true" />{Math.max(0, Math.ceil(step.end - currentTime))} giây còn lại</span><span>Tổng {Math.round(step.end - step.start)} giây</span></div>
                  <span className={styles.stepProgress} aria-hidden="true"><span style={{ width: `${stepPercent}%` }} /></span>
                  <div className={styles.stepActions}>
                    <button type="button" onClick={togglePlay}>{isPlaying ? <Pause size={15} fill="currentColor" aria-hidden="true" /> : <Play size={15} fill="currentColor" aria-hidden="true" />}{isPlaying ? 'Tạm dừng động tác' : 'Tiếp tục động tác'}</button>
                    <button type="button" onClick={() => seekTo(stretchExerciseSteps[index + 1]?.start ?? step.end, true)} disabled={index === stretchExerciseSteps.length - 1}>Bỏ qua <SkipForward size={15} aria-hidden="true" /></button>
                  </div>
                </div>}
              </div>
            })}
          </div>
          <span className={styles.srOnly} aria-live="polite">{announcement}</span>
        </section>
        <section className={styles.recordCard} aria-labelledby="stretch-record-heading">
          <h2 id="stretch-record-heading" className={styles.srOnly}>Ghi nhận vào kế hoạch hỗ trợ hằng ngày</h2>
          <button type="button" className={styles.recordButton} disabled={!canRecord || progressLoadState !== 'ready' || saving || status === 'COMPLETED' || recordState === 'sending'} onClick={() => void recordCompletion()}>
            <Check size={18} aria-hidden="true" />
            {status === 'COMPLETED' ? 'Đã ghi nhận hoàn thành' : saving || recordState === 'sending' ? 'Đang ghi nhận…' : 'Ghi nhận hoàn thành bài tập (+15 XP)'}
          </button>
          <p>{status === 'COMPLETED' ? 'Bài tập đã được ghi nhận vào Kế hoạch hỗ trợ hằng ngày.' : 'Kết quả hoàn thành sẽ được lưu vào Kế hoạch hỗ trợ hằng ngày của bạn.'}</p>
          {status !== 'COMPLETED' && progressLoadState === 'loading' && <p className={styles.recordHint} role="status">Đang tải tiến độ đã lưu…</p>}
          {status !== 'COMPLETED' && progressLoadState === 'error' && <div className={styles.recordError} role="alert"><span>Chưa tải được tiến độ. Video vẫn có thể xem bình thường.</span><button type="button" onClick={onRetryProgress}>Thử lại</button></div>}
          {status !== 'COMPLETED' && progressLoadState === 'ready' && !canRecord && duration !== null && <p className={styles.recordHint}>Xem thêm {remainingPercent}% video để ghi nhận. Tua qua đoạn chưa xem không được tính.</p>}
          {recordState === 'error' && <p className={styles.recordError} role="alert">{message || 'Chưa thể ghi nhận bài tập. Vui lòng thử lại.'}</p>}
          {recordState === 'success' && <p className={styles.recordSuccess} role="status">Đã lưu kết quả hoàn thành bài tập.</p>}
        </section>
        </aside>
        </div>
        <p className={styles.disclaimer}>Nội dung hỗ trợ tự chăm sóc, không dùng để chẩn đoán hoặc thay thế đánh giá và điều trị từ chuyên gia.</p>
      </div>
    </main>
  )
}
