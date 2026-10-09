'use client'

import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  Expand,
  List,
  Maximize,
  Minimize,
  Pause,
  Play,
  Settings,
  ShieldCheck,
  Volume2,
  VolumeX,
  Wind,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import { Dialog } from '@/components/ui/Dialog'

import { getResourceProgress } from '../api/browser-resource-progress'
import type { PublicResourceDetail } from '../api/browser-resources'
import {
  progressiveRelaxationDuration,
  progressiveRelaxationSegments,
} from '../model/progressive-relaxation-segments'
import styles from './progressive-relaxation-resource-detail.module.css'
import './progressive-relaxation-shell.css'

type Props = Readonly<{
  resource: PublicResourceDetail
  date: string
  backHref: string
  embedUrl: string | null
  status: 'IN_PROGRESS' | 'COMPLETED'
  progressLoadState: 'loading' | 'ready' | 'error'
  saving: boolean
  message: string
  onRetryProgress: () => void
  onMarkViewed: () => Promise<boolean>
  onConfirmCompletion: () => Promise<boolean>
}>

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`
}

function weekDatesFor(date: string) {
  const selected = new Date(`${date}T12:00:00Z`)
  const monday = new Date(selected)
  monday.setUTCDate(selected.getUTCDate() - ((selected.getUTCDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday)
    day.setUTCDate(monday.getUTCDate() + index)
    return day.toISOString().slice(0, 10)
  })
}

export function ProgressiveRelaxationResourceDetail({
  resource,
  date,
  backHref,
  embedUrl,
  status,
  progressLoadState,
  saving,
  message,
  onRetryProgress,
  onMarkViewed,
  onConfirmCompletion,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerShellRef = useRef<HTMLDivElement>(null)
  const [mediaState, setMediaState] = useState<'loading' | 'ready' | 'error'>('ready')
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
  const [muted, setMuted] = useState(false)
  const [captionsVisible, setCaptionsVisible] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [quizOpen, setQuizOpen] = useState(false)
  const [quizAnswers, setQuizAnswers] = useState({ watched: '', next: '' })
  const [quizMessage, setQuizMessage] = useState('')
  const [weekProgress, setWeekProgress] = useState<Set<string>>(new Set())
  const [weekLoading, setWeekLoading] = useState(true)
  const [weekUnavailable, setWeekUnavailable] = useState(false)
  const weekDates = useMemo(() => weekDatesFor(date), [date])
  const weekStart = weekDates[0]
  const weekEnd = weekDates[6]

  useEffect(() => {
    const onFullscreenChange = () =>
      setFullscreen(document.fullscreenElement === playerShellRef.current)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    let active = true
    const loadWeek = () => {
      setWeekLoading(true)
      void getResourceProgress(weekStart, weekEnd)
        .then((items) => {
          if (!active) return
          setWeekProgress(
            new Set(
              items
                .filter(
                  (item) =>
                    item.resourceId === resource.id && item.status === 'COMPLETED',
                )
                .map((item) => item.localDate),
            ),
          )
          setWeekLoading(false)
          setWeekUnavailable(false)
        })
        .catch(() => {
          if (active) {
            setWeekLoading(false)
            setWeekUnavailable(true)
          }
        })
    }
    loadWeek()
    window.addEventListener('mb:resource-progress-updated', loadWeek)
    return () => {
      active = false
      window.removeEventListener('mb:resource-progress-updated', loadWeek)
    }
  }, [resource.id, weekEnd, weekStart])

  const activeSegmentIndex =
    currentTime >= progressiveRelaxationDuration
      ? progressiveRelaxationSegments.length - 1
      : Math.max(
          0,
          progressiveRelaxationSegments.findIndex(
            (segment) => currentTime >= segment.start && currentTime < segment.end,
          ),
        )
  const activeSegment =
    progressiveRelaxationSegments[activeSegmentIndex] ?? progressiveRelaxationSegments[0]
  const breathPosition = Math.floor(currentTime) % 10
  const inhaling = breathPosition < 4
  const breathSecond = inhaling ? breathPosition + 1 : breathPosition - 3
  const breathProgress = inhaling
    ? (breathPosition + 1) / 4
    : (breathPosition - 3) / 6
  const ringLength = 2 * Math.PI * 68
  const playedPercent = (currentTime / progressiveRelaxationDuration) * 100

  function seekTo(seconds: number) {
    const target = Math.min(progressiveRelaxationDuration, Math.max(0, seconds))
    if (videoRef.current) {
      videoRef.current.currentTime = target
      void videoRef.current.play().catch(() => {})
    }
    setCurrentTime(target)
    setEnded(false)
  }

  function togglePlay() {
    if (!videoRef.current) return
    if (ended) {
      seekTo(0)
    } else if (videoRef.current.paused) {
      void videoRef.current.play().catch(() => {})
    } else {
      videoRef.current.pause()
    }
  }

  function toggleMute() {
    if (!videoRef.current) return
    videoRef.current.muted = !videoRef.current.muted
    setMuted(videoRef.current.muted)
  }

  function setRate(rate: number) {
    if (!videoRef.current) return
    videoRef.current.playbackRate = rate
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await playerShellRef.current?.requestFullscreen()
    }
  }

  // Keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement
      if (
        activeEl?.tagName === 'INPUT' &&
        (activeEl as HTMLInputElement).type !== 'range'
      ) {
        return
      }
      if (e.code === 'Space' && (e.target === playerShellRef.current || playerShellRef.current?.contains(e.target as Node))) {
        e.preventDefault()
        togglePlay()
      } else if (e.code === 'ArrowLeft' && playerShellRef.current?.contains(e.target as Node)) {
        e.preventDefault()
        seekTo(Math.max(0, currentTime - 5))
      } else if (e.code === 'ArrowRight' && playerShellRef.current?.contains(e.target as Node)) {
        e.preventDefault()
        seekTo(Math.min(progressiveRelaxationDuration, currentTime + 5))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentTime, ended, isPlaying])

  async function startCompletion() {
    if (!ended || progressLoadState !== 'ready' || saving) return
    const saved = await onMarkViewed()
    if (saved) setQuizOpen(true)
  }

  async function confirmCompletion() {
    if (quizAnswers.watched !== 'complete' || quizAnswers.next !== 'gentle') {
      setQuizMessage('Hãy xem lại thông điệp an toàn của video rồi thử lại nhé.')
      return
    }
    setQuizMessage('')
    const saved = await onConfirmCompletion()
    if (saved) setQuizOpen(false)
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <nav className={styles.breadcrumb} aria-label="Đường dẫn">
              <Link href={backHref}><ArrowLeft size={17} aria-hidden="true" /> Tài nguyên</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">Thư giãn cơ tiến triển</span>
            </nav>
            <h1>Thư giãn cơ tiến triển</h1>
            <div className={styles.tags}>
              <span>Thư giãn thể chất</span>
              <span>8 phút</span>
              <span>Khoa học thần kinh</span>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button type="button" onClick={() => void toggleFullscreen()}>
              <Expand size={17} aria-hidden="true" /> Chế độ Zen toàn màn hình
            </button>
            <button type="button" onClick={() => setSummaryOpen(true)}>
              <List size={18} aria-hidden="true" /> Tóm tắt
            </button>
          </div>
        </header>

        <section className={styles.playerSection} aria-label="Video thư giãn cơ tiến triển">
          <div
            className={styles.player}
            ref={playerShellRef}
            tabIndex={0}
            role="region"
            aria-label="Trình phát video thư giãn cơ tiến triển"
          >
            <video
              ref={videoRef}
              className={styles.mediaVideo}
              poster="/images/progressive-relaxation-poster.png"
              playsInline
              preload="metadata"
              onLoadedMetadata={() => setMediaState('ready')}
              onCanPlay={() => setMediaState('ready')}
              onTimeUpdate={() => {
                if (videoRef.current) {
                  setCurrentTime(Math.min(progressiveRelaxationDuration, videoRef.current.currentTime))
                }
              }}
              onPlay={() => {
                setIsPlaying(true)
                setEnded(false)
              }}
              onPause={() => setIsPlaying(false)}
              onEnded={() => {
                setCurrentTime(progressiveRelaxationDuration)
                setIsPlaying(false)
                setEnded(true)
              }}
              onError={() => setMediaState('error')}
              onClick={togglePlay}
            >
              <source src="/videos/thu-gian-co-tien-trien-pmr.mp4" type="video/mp4" />
              <source src="/videos/thu-gian-co-tien-trien-pmr-720p.mp4" type="video/mp4" />
            </video>

            {/* Nút Play lớn ở giữa khi video đang tạm dừng */}
            {!isPlaying && (
              <div
                className={styles.centerPlayOverlay}
                onClick={togglePlay}
                role="button"
                tabIndex={-1}
                aria-label="Phát video"
              >
                <div className={styles.centerPlayButton}>
                  <Play size={36} fill="currentColor" aria-hidden="true" style={{ marginLeft: 4 }} />
                </div>
              </div>
            )}

            {mediaState === 'error' && (
              <div className={styles.mediaNotice} role="status">
                <strong>Video chưa phát được</strong>
                <span>Bạn vẫn có thể xem các phân đoạn và phần tóm tắt.</span>
                {resource.externalUrl?.startsWith('https://') && (
                  <a href={resource.externalUrl} target="_blank" rel="noopener noreferrer">Mở nguồn video</a>
                )}
              </div>
            )}

            <div className={styles.controls}>
              <div className={styles.timeline} style={{ '--played': `${playedPercent}%` } as CSSProperties}>
                <input
                  type="range"
                  min={0}
                  max={progressiveRelaxationDuration}
                  step={0.5}
                  value={Math.min(progressiveRelaxationDuration, Math.floor(currentTime))}
                  disabled={mediaState !== 'ready'}
                  onChange={(event) => seekTo(Number(event.target.value))}
                  aria-label="Tua video"
                  aria-valuetext={`${formatTime(currentTime)} trên ${formatTime(progressiveRelaxationDuration)}`}
                />
                {progressiveRelaxationSegments.map((segment, index) => (
                  <button
                    key={segment.id}
                    type="button"
                    className={styles.marker}
                    style={{ left: `${(segment.start / progressiveRelaxationDuration) * 100}%` }}
                    disabled={mediaState !== 'ready'}
                    onClick={(e) => {
                      e.stopPropagation()
                      seekTo(segment.start)
                    }}
                    aria-label={`Tua đến ${formatTime(segment.start)}: ${segment.title}`}
                    aria-current={index === activeSegmentIndex ? 'step' : undefined}
                    title={`${formatTime(segment.start)} · ${segment.title}`}
                  />
                ))}
              </div>
              <div className={styles.controlRow}>
                <button
                  className={styles.playButton}
                  type="button"
                  disabled={mediaState !== 'ready'}
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Tạm dừng' : 'Phát video'}
                >
                  {isPlaying ? <Pause size={22} fill="currentColor" aria-hidden="true" /> : <Play size={22} fill="currentColor" aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  disabled={mediaState !== 'ready'}
                  onClick={toggleMute}
                  aria-label={muted ? 'Bật tiếng' : 'Tắt tiếng'}
                >
                  {muted ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
                </button>
                <time>{formatTime(currentTime)} / {formatTime(progressiveRelaxationDuration)}</time>
                <span className={styles.controlSpacer} />
                <button
                  className={styles.ccButton}
                  type="button"
                  onClick={() => setCaptionsVisible((visible) => !visible)}
                  aria-pressed={captionsVisible}
                  aria-label={captionsVisible ? 'Ẩn phụ đề' : 'Hiện phụ đề'}
                >
                  CC
                </button>
                <details className={styles.settings}>
                  <summary aria-label="Cài đặt tốc độ phát"><Settings size={19} aria-hidden="true" /></summary>
                  <div>
                    {[1, 1.25, 1.5].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        disabled={mediaState !== 'ready'}
                        onClick={() => setRate(rate)}
                      >
                        {rate}×
                      </button>
                    ))}
                  </div>
                </details>
                <button
                  type="button"
                  onClick={() => void toggleFullscreen()}
                  aria-label={fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
                >
                  {fullscreen ? <Minimize size={20} aria-hidden="true" /> : <Maximize size={20} aria-hidden="true" />}
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className={styles.cards}>
          <section className={`${styles.card} ${styles.segmentsCard}`} aria-labelledby="pmr-segments-title">
            <div className={styles.cardHeading}>
              <h2 id="pmr-segments-title"><span className={styles.headingDot} />Phân đoạn nhóm cơ</h2>
              <small>1-Chạm chuyển phân đoạn</small>
            </div>
            <ol className={styles.segmentList}>
              {progressiveRelaxationSegments.map((segment, index) => (
                <li key={segment.id}>
                  <button
                    type="button"
                    disabled={mediaState !== 'ready'}
                    onClick={() => seekTo(segment.start)}
                    className={index === activeSegmentIndex ? styles.activeSegment : ''}
                    aria-current={index === activeSegmentIndex ? 'step' : undefined}
                    aria-label={`${String(index + 1).padStart(2, '0')}. ${segment.title}, ${formatTime(segment.start)} đến ${formatTime(segment.end)}`}
                  >
                    <span className={styles.segmentNumber}>{String(index + 1).padStart(2, '0')}</span>
                    <span className={styles.segmentTitle}>{segment.title}</span>
                    {index === activeSegmentIndex
                      ? <span className={styles.learning}><i aria-hidden="true" />Đang học</span>
                      : <time>{formatTime(segment.start)} - {formatTime(segment.end)}</time>}
                  </button>
                </li>
              ))}
            </ol>
          </section>

          <section className={`${styles.card} ${styles.breathCard}`} aria-labelledby="pmr-breath-title">
            <div className={styles.cardHeading}>
              <h2 id="pmr-breath-title"><Wind size={21} aria-hidden="true" />Nhịp thở dẫn đường</h2>
              <span className={styles.breathChip}>Chuông gió êm dịu</span>
            </div>
            <div className={styles.breathRing} role="status" aria-label={`${inhaling ? 'Hít vào' : 'Thở ra'} ${breathSecond} giây`}>
              <svg viewBox="0 0 160 160" aria-hidden="true">
                <circle cx="80" cy="80" r="68" className={styles.breathTrack} />
                <circle cx="80" cy="80" r="68" className={styles.breathValue} strokeDasharray={ringLength} strokeDashoffset={ringLength * (1 - breathProgress)} />
              </svg>
              <div><strong>{inhaling ? 'Hít vào' : 'Thở ra'}</strong><span>{breathSecond}s</span></div>
            </div>
            <div className={styles.breathGuide}>
              <div><i aria-hidden="true" /><span>Hít vào chậm<strong>4 giây</strong></span></div>
              <div><i aria-hidden="true" /><span>Thở ra thư giãn<strong>6 giây</strong></span></div>
            </div>
          </section>

          <section className={`${styles.card} ${styles.weekCard}`} aria-labelledby="pmr-week-title">
            <div className={styles.cardHeading}>
              <h2 id="pmr-week-title">Tiến độ tuần</h2>
              <span>{weekLoading || weekUnavailable ? '—/5 buổi' : `${weekProgress.size}/5 buổi`}</span>
            </div>
            <div className={styles.weekChart} aria-label={weekLoading ? 'Đang tải tiến độ tuần' : weekUnavailable ? 'Chưa tải được tiến độ tuần' : `Đã hoàn thành ${weekProgress.size} buổi trong tuần`}>
              {weekDates.map((day, index) => (
                <div key={day} className={styles.weekDay}>
                  <span className={weekProgress.has(day) ? styles.dayDone : ''} style={{ height: weekProgress.has(day) ? `${[43, 59, 37, 53, 47, 56, 42][index]}px` : '14px' }} />
                  <small>{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][index]}</small>
                </div>
              ))}
            </div>
            <button
              className={styles.completeButton}
              type="button"
              disabled={!ended || progressLoadState !== 'ready' || saving || status === 'COMPLETED'}
              onClick={() => void startCompletion()}
            >
              <Check size={19} aria-hidden="true" />{status === 'COMPLETED' ? 'Đã hoàn thành' : saving ? 'Đang ghi nhận...' : 'Hoàn thành (+15 XP)'}
            </button>
            {progressLoadState === 'error' && <button className={styles.retryButton} type="button" onClick={onRetryProgress}>Tải lại tiến độ</button>}
            {message && <p className={styles.progressError} role="alert">{message}</p>}
            <div className={styles.sourceNote}>
              <ShieldCheck size={19} aria-hidden="true" />
              <span>NHS Every Mind Matters. Phác đồ thư giãn cơ tiến triển Jacobson được chuẩn hóa lâm sàng.</span>
            </div>
          </section>
        </div>
      </div>

      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen} labelledBy="pmr-summary-title" className={styles.dialog}>
        <div className={styles.dialogHeader}>
          <h2 id="pmr-summary-title">Tóm tắt bài tập</h2>
          <button type="button" onClick={() => setSummaryOpen(false)} aria-label="Đóng tóm tắt"><X size={20} aria-hidden="true" /></button>
        </div>
        <p>Thư giãn cơ tiến triển (PMR) gồm siết rồi thả lỏng lần lượt từng nhóm cơ để nhận ra sự khác biệt giữa căng và thư giãn.</p>
        <ol>{progressiveRelaxationSegments.map((segment) => <li key={segment.id}>{segment.title}</li>)}</ol>
        <p>Hít vào 4 giây qua mũi, thở ra 6 giây qua miệng. Với mỗi nhóm cơ, siết nhẹ khoảng 5 giây rồi thả lỏng khoảng 10 giây, ở mức khoảng 60–70% sức.</p>
        <p>Không siết đến mức đau; bỏ qua vùng đang chấn thương hoặc đau cấp. Nếu chóng mặt hoặc khó chịu, hãy dừng lại và thở bình thường.</p>
        <p className={styles.dialogSource}>Nguồn: NHS Every Mind Matters. Nội dung hỗ trợ tự chăm sóc, không thay thế đánh giá hay điều trị của chuyên gia.</p>
      </Dialog>

      <Dialog open={quizOpen} onOpenChange={setQuizOpen} labelledBy="pmr-quiz-title" className={styles.dialog}>
        <div className={styles.dialogHeader}>
          <h2 id="pmr-quiz-title">Hai câu để giữ lại điều hữu ích</h2>
          <button type="button" onClick={() => setQuizOpen(false)} aria-label="Đóng xác nhận"><X size={20} aria-hidden="true" /></button>
        </div>
        <p>Chọn cách thực hành an toàn trước khi ghi nhận hoàn thành.</p>
        <fieldset>
          <legend>Khi hướng dẫn khiến cơ thể không thoải mái, bạn nên làm gì?</legend>
          <label><input type="radio" name="pmr-watched" checked={quizAnswers.watched === 'complete'} onChange={() => setQuizAnswers((value) => ({ ...value, watched: 'complete' }))} />Dừng lại hoặc giảm cường độ về mức dễ chịu</label>
          <label><input type="radio" name="pmr-watched" checked={quizAnswers.watched === 'partial'} onChange={() => setQuizAnswers((value) => ({ ...value, watched: 'partial' }))} />Cố tiếp tục để hoàn thành đủ bài</label>
        </fieldset>
        <fieldset>
          <legend>Bước phù hợp nhất sau nội dung này là gì?</legend>
          <label><input type="radio" name="pmr-next" checked={quizAnswers.next === 'gentle'} onChange={() => setQuizAnswers((value) => ({ ...value, next: 'gentle' }))} />Chọn một bước nhỏ, an toàn và vừa sức</label>
          <label><input type="radio" name="pmr-next" checked={quizAnswers.next === 'all'} onChange={() => setQuizAnswers((value) => ({ ...value, next: 'all' }))} />Cố gắng làm tất cả ngay lập tức</label>
        </fieldset>
        {quizMessage && <p className={styles.progressError} role="alert">{quizMessage}</p>}
        <div className={styles.dialogActions}>
          <button type="button" onClick={() => setQuizOpen(false)}>Để sau</button>
          <button type="button" disabled={!quizAnswers.watched || !quizAnswers.next || saving} onClick={() => void confirmCompletion()}>{saving ? 'Đang lưu...' : 'Hoàn tất'}</button>
        </div>
      </Dialog>
    </main>
  )
}
