'use client'

import React, { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Headphones,
  ListOrdered,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react'

import type { PublicResourceDetail } from '../api/browser-resources'
import styles from './sleep-routine-resource-detail.module.css'

export interface SleepRoutineStep {
  id: 'step1' | 'step2' | 'step3'
  num: number
  time: string
  title: string
  subtitle: string
  detail: string
  start: number
  end: number
  colorClass: 'stepNumberAmber' | 'stepNumberTeal' | 'stepNumberForest'
}

export const SLEEP_ROUTINE_STEPS: SleepRoutineStep[] = [
  {
    id: 'step1',
    num: 1,
    time: '22:30',
    title: 'Tắt màn hình xanh',
    subtitle: 'Đặt điện thoại xa tầm tay, hạ độ sáng đèn phòng',
    detail: 'Giảm kích thích ánh sáng để cơ thể tiết Melatonin tự nhiên.',
    start: 35,
    end: 105,
    colorClass: 'stepNumberAmber',
  },
  {
    id: 'step2',
    num: 2,
    time: '22:40',
    title: 'Trút bỏ lo âu',
    subtitle: 'Viết nhanh các việc chưa xong ra giấy để rỗng não',
    detail:
      'Giải tỏa tải nhận thức, ngăn chặn hội chứng suy nghĩ quá độ ban đêm.',
    start: 105,
    end: 185,
    colorClass: 'stepNumberTeal',
  },
  {
    id: 'step3',
    num: 3,
    time: '22:50',
    title: 'Hạ nhịp thở sâu',
    subtitle: 'Nằm thư giãn, thở cơ hoành 4-7-8 đưa cơ thể vào giấc',
    detail:
      'Kích hoạt hệ thần kinh phó giao cảm, hạ nhịp tim và thả lỏng cơ vân.',
    start: 185,
    end: 270,
    colorClass: 'stepNumberForest',
  },
]

type Props = Readonly<{
  resource: PublicResourceDetail
  date?: string
  backHref: string
  status: 'IN_PROGRESS' | 'COMPLETED'
  progressLoadState: 'loading' | 'ready' | 'error'
  saving: boolean
  message: string
  planNotice?: React.ReactNode
  onRetryProgress?: () => void
  onConfirmCompletion: () => Promise<boolean>
}>

type VideoChoice = 'main' | 'secondary1' | 'secondary2'

const VIDEO_CONFIGS = {
  main: {
    src: '/videos/chuan-bi-nhip-ngu-sau.mp4',
    poster: '/images/sleep-routine-main-poster.jpg',
    durationLabel: '05:00',
    title: 'Thiết lập nhịp sinh học & Không gian nghỉ ngơi',
    tag: 'MÔ-ĐUN 01 • TRỌNG TÂM',
    badge: 'Video hướng dẫn chính • 5 phút',
  },
  secondary1: {
    src: '/videos/giai-quyet-van-de-cbt.mp4',
    poster: '/images/sleep-routine-secondary-1.jpg',
    durationLabel: '03:15',
    title: 'Thực hành 3 phút: Ghi chép xả lo âu & Trà thảo mộc',
    tag: 'MÔ-ĐUN BỔ TRỢ • THỰC HÀNH 3 PHÚT',
    badge: 'Thực hành nhanh • 3 phút',
  },
  secondary2: {
    src: '/videos/gian-co-7-phut.mp4',
    poster: '/images/sleep-routine-secondary-2.jpg',
    durationLabel: '04:20',
    title: 'Thiền buông thư 4 phút: Thư giãn tâm trí buổi tối',
    tag: 'MÔ-ĐUN BỔ TRỢ • THIỀN BUÔNG THƯ',
    badge: 'Thiền êm dịu • 4 phút',
  },
} as const

function formatSeconds(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function SleepRoutineResourceDetail({
  resource,
  backHref,
  status,
  saving,
  onConfirmCompletion,
}: Props) {
  const [activeVideo, setActiveVideo] = useState<VideoChoice>('main')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(300)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Checklist items
  const [checkedSteps, setCheckedSteps] = useState<string[]>(() =>
    status === 'COMPLETED' ? ['step1', 'step2', 'step3'] : [],
  )
  const [localCompleted, setLocalCompleted] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const activeConfig = VIDEO_CONFIGS[activeVideo]
  const completed = status === 'COMPLETED' || localCompleted

  // Toggle checklist steps
  const toggleStep = useCallback((stepId: string) => {
    setCheckedSteps((prev) => {
      const next = prev.includes(stepId)
        ? prev.filter((id) => id !== stepId)
        : [...prev, stepId]
      return next
    })
  }, [])

  // Calculate completion percentage
  const effectiveSteps = completed ? ['step1', 'step2', 'step3'] : checkedSteps
  const stepsCount = effectiveSteps.length
  const completionPercent = completed ? 100 : Math.round((stepsCount / 3) * 100)

  // Toggle Video Playback
  const handleTogglePlay = useCallback(() => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause?.()
      setIsPlaying(false)
    } else {
      const playPromise = videoRef.current.play?.()
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false))
      } else {
        setIsPlaying(true)
      }
    }
  }, [isPlaying])

  // Active step in main video
  const activeStep =
    activeVideo === 'main'
      ? SLEEP_ROUTINE_STEPS.find(
          (step) => currentTime >= step.start && currentTime < step.end,
        ) || null
      : null

  // Jump to step
  const handleJumpToStep = useCallback(
    (startSeconds: number) => {
      if (activeVideo !== 'main') {
        setActiveVideo('main')
      }
      if (videoRef.current) {
        videoRef.current.currentTime = startSeconds
        const playPromise = videoRef.current.play?.()
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false))
        } else {
          setIsPlaying(true)
        }
      }
      setCurrentTime(startSeconds)
    },
    [activeVideo],
  )

  // Fullscreen handling
  const handleToggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current
        .requestFullscreen?.()
        .then(() => setIsFullscreen(true))
        .catch(() => {})
    } else {
      document
        .exitFullscreen?.()
        .then(() => setIsFullscreen(false))
        .catch(() => {})
    }
  }, [])

  // Switch video track
  const handleSelectVideo = useCallback((choice: VideoChoice) => {
    setActiveVideo(choice)
    setIsPlaying(false)
    setCurrentTime(0)
    if (videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.load()
    }
  }, [])

  // Mark completion
  const handleMarkComplete = async () => {
    if (completed || saving) return
    setLocalCompleted(true)
    setCheckedSteps(['step1', 'step2', 'step3'])
    await onConfirmCompletion()
  }

  return (
    <div className={styles.page}>
      {/* Top Navigation Bar */}
      <div className={styles.topBar}>
        <Link href={backHref || '/support-plan'} className={styles.backLink}>
          <ArrowLeft size={16} />
          <span>Quay lại kế hoạch hỗ trợ</span>
        </Link>
        <div className={styles.programContext}>
          Chương trình: Khởi tạo giấc ngủ sâu khoa học
        </div>
      </div>

      {/* Hero Header Card */}
      <section
        className={styles.heroCard}
        aria-labelledby="sleep-resource-title"
      >
        <div className={styles.heroLeft}>
          <div className={styles.badgesRow}>
            <span className={styles.badgeEmerald}>
              <span>📼</span> Micro-practice
            </span>
            <span className={styles.badgeAmber}>Dễ thực hiện</span>
            <span className={styles.badgeMuted}>
              <Clock size={12} /> 12 phút thực hành
            </span>
          </div>

          <h1 id="sleep-resource-title" className={styles.title}>
            {resource.title || 'Chuẩn bị một nhịp ngủ dễ chịu hơn'}
          </h1>
          <p className={styles.subtitle}>
            Phương pháp tiếp cận hành vi không dùng thuốc. Xem video ngắn, điều
            chỉnh nhịp sinh học và hoàn thành 3 bước nhỏ trước khi tắt đèn.
          </p>
        </div>

        {/* Hero Right Widget: Progress & Completion Button */}
        <div className={styles.progressWidget}>
          <div className={styles.progressCircleBox}>
            <span className={styles.progressPillDot}>
              • {completionPercent}%
            </span>
            <div className={styles.progressTextGroup}>
              <span className={styles.progressStepCount}>
                {completed ? '3 / 3' : `${stepsCount} / 3`} bước
              </span>
              <span className={styles.progressStepLabel}>Tiến độ hôm nay</span>
            </div>
          </div>

          <button
            type="button"
            className={`${styles.completeBtn} ${completed ? styles.completeBtnActive : ''}`}
            onClick={handleMarkComplete}
            disabled={saving}
          >
            <Check size={16} />
            <span>{completed ? 'Đã hoàn thành' : 'Đánh dấu hoàn thành'}</span>
          </button>
        </div>
      </section>

      {/* Main 2-Column Grid */}
      <div className={styles.mainGrid}>
        {/* Left Column: Featured Video & Secondary Videos */}
        <div className={styles.leftColumn}>
          {/* Main Video Card */}
          <div className={styles.mainVideoCard} ref={containerRef}>
            {/* Step Progress Tracker Bar */}
            <div className={styles.stepTrackerHeader}>
              <div className={styles.stepTrackerHeaderTop}>
                <div className={styles.stepTrackerTitleGroup}>
                  <ListOrdered size={15} className={styles.stepTrackerIcon} />
                  <span className={styles.stepTrackerTitle}>
                    Thanh tiến trình 3 bước nhịp ngủ
                  </span>
                  {activeStep && (
                    <span className={styles.activeStepLivePill}>
                      • Đang phát: Bước {activeStep.num} ({activeStep.time})
                    </span>
                  )}
                </div>
                <span className={styles.stepTrackerHint}>
                  Nhấp vào từng bước để chuyển nhanh video
                </span>
              </div>

              {/* 3 Steps Progress Segments */}
              <div className={styles.stepTrackerSegments}>
                {SLEEP_ROUTINE_STEPS.map((step) => {
                  const isCurrentActive =
                    activeVideo === 'main' &&
                    currentTime >= step.start &&
                    currentTime < step.end
                  const isPassed =
                    activeVideo === 'main' && currentTime >= step.end
                  const stepDuration = step.end - step.start
                  const progressPct =
                    activeVideo !== 'main' || currentTime < step.start
                      ? 0
                      : isPassed
                        ? 100
                        : Math.min(
                            100,
                            Math.max(
                              0,
                              Math.round(
                                ((currentTime - step.start) / stepDuration) *
                                  100,
                              ),
                            ),
                          )

                  return (
                    <button
                      key={step.id}
                      type="button"
                      className={`${styles.stepSegmentCard} ${
                        isCurrentActive ? styles.stepSegmentCardActive : ''
                      } ${isPassed ? styles.stepSegmentCardPassed : ''}`}
                      onClick={() => handleJumpToStep(step.start)}
                      aria-label={`Chuyển đến Bước ${step.num}: ${step.title} (${step.time})`}
                    >
                      <div className={styles.stepSegmentTop}>
                        <div className={styles.stepSegmentBadge}>
                          {isPassed ? (
                            <CheckCircle2
                              size={14}
                              className={styles.stepPassedIcon}
                            />
                          ) : (
                            <span className={styles.stepNumCircle}>
                              {step.num}
                            </span>
                          )}
                          <span className={styles.stepTimeText}>
                            {step.time}
                          </span>
                        </div>
                        <span className={styles.stepStatusText}>
                          {isPassed
                            ? 'Đã qua'
                            : isCurrentActive
                              ? `${progressPct}%`
                              : `${formatSeconds(step.start)}`}
                        </span>
                      </div>

                      <div className={styles.stepSegmentTitle}>
                        {step.title}
                      </div>

                      {/* Micro Progress Bar */}
                      <div className={styles.stepSegmentProgressTrack}>
                        <div
                          className={styles.stepSegmentProgressBar}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className={styles.videoContainer}>
              <video
                ref={videoRef}
                className={styles.videoElement}
                src={activeConfig.src}
                poster={activeConfig.poster}
                playsInline
                muted={isMuted}
                onTimeUpdate={() => {
                  if (videoRef.current) {
                    setCurrentTime(videoRef.current.currentTime)
                  }
                }}
                onLoadedMetadata={() => {
                  if (videoRef.current && videoRef.current.duration) {
                    setDuration(videoRef.current.duration)
                  }
                }}
                onEnded={() => setIsPlaying(false)}
              />

              {/* Top Badges */}
              <div className={styles.videoBadgeTopLeft}>
                <span className={styles.amberPulseDot} />
                <span>{activeConfig.badge}</span>
              </div>

              <div className={styles.videoBadgeTopRight}>HD 4K AUDIO</div>

              {/* Big Center Play Button Overlay (when paused) */}
              {!isPlaying && (
                <div
                  className={styles.centerPlayOverlay}
                  onClick={handleTogglePlay}
                  role="button"
                  tabIndex={0}
                  aria-label="Phát video hướng dẫn"
                >
                  <div className={styles.playCircleLarge}>
                    <div className={styles.playIconTriangle} />
                  </div>
                </div>
              )}

              {/* Bottom Video Banner Overlay */}
              <div className={styles.videoBottomOverlay}>
                <div>
                  <div className={styles.moduleTag}>{activeConfig.tag}</div>
                  <div className={styles.moduleTitle}>{activeConfig.title}</div>
                </div>
                <div className={styles.durationBadge}>
                  {isPlaying
                    ? formatSeconds(currentTime)
                    : activeConfig.durationLabel}
                </div>
              </div>
            </div>

            {/* Video Controls Bar */}
            <div className={styles.videoControlsRow}>
              <button
                type="button"
                className={styles.controlBtn}
                onClick={handleTogglePlay}
                aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
              >
                {isPlaying ? <Pause size={17} /> : <Play size={17} />}
              </button>

              <button
                type="button"
                className={styles.controlBtn}
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0
                    setCurrentTime(0)
                  }
                }}
                aria-label="Phát lại từ đầu"
              >
                <RotateCcw size={15} />
              </button>

              <input
                type="range"
                className={styles.seekBar}
                min={0}
                max={duration || 300}
                value={currentTime}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  setCurrentTime(val)
                  if (videoRef.current) {
                    videoRef.current.currentTime = val
                  }
                }}
                aria-label="Tiến trình video"
              />

              <div className={styles.timeDisplay}>
                {formatSeconds(currentTime)} / {formatSeconds(duration || 300)}
              </div>

              <button
                type="button"
                className={styles.controlBtn}
                onClick={() => setIsMuted((prev) => !prev)}
                aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              >
                {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </button>

              <button
                type="button"
                className={styles.controlBtn}
                onClick={handleToggleFullscreen}
                aria-label="Toàn màn hình"
              >
                {isFullscreen ? (
                  <Minimize2 size={17} />
                ) : (
                  <Maximize2 size={17} />
                )}
              </button>
            </div>

            {/* Feature Sub-bar */}
            <div className={styles.videoFeatureBar}>
              <div className={styles.featureItemsLeft}>
                <span className={styles.featureItem}>
                  <Headphones size={15} color="#164e3f" /> Khuyên dùng tai nghe
                </span>
                <span className={styles.featureItem}>
                  <Sparkles size={15} color="#d97706" /> Giọng đọc chuẩn y khoa
                </span>
              </div>

              <button
                type="button"
                className={styles.fullscreenBtn}
                onClick={handleToggleFullscreen}
              >
                <Maximize2 size={14} />
                <span>Mở rộng toàn màn hình</span>
              </button>
            </div>
          </div>

          {/* Secondary Video Row (2 side-by-side cards) */}
          <div className={styles.secondaryGrid}>
            {/* Card 1 */}
            <div
              className={styles.secondaryCard}
              onClick={() => handleSelectVideo('secondary1')}
              role="button"
              tabIndex={0}
              aria-label="Xem video Thực hành 3 phút: Ghi chép xả lo âu"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/sleep-routine-secondary-1.jpg"
                alt="Thực hành 3 phút"
                className={styles.secondaryImg}
              />
              <span className={styles.secondaryBadge}>Thực hành 3 phút</span>
              <div className={styles.secondaryPlayIcon}>
                <Play
                  size={18}
                  fill="#164e3f"
                  color="#164e3f"
                  style={{ marginLeft: 2 }}
                />
              </div>
              <span className={styles.secondaryDuration}>03:15</span>
            </div>

            {/* Card 2 */}
            <div
              className={styles.secondaryCard}
              onClick={() => handleSelectVideo('secondary2')}
              role="button"
              tabIndex={0}
              aria-label="Xem video Thiền buông thư 4 phút: Thư giãn tâm trí"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/sleep-routine-secondary-2.jpg"
                alt="Thiền buông thư 4 phút"
                className={styles.secondaryImg}
              />
              <span className={styles.secondaryBadge}>
                Thiền buông thư 4 phút
              </span>
              <div className={styles.secondaryPlayIcon}>
                <Play
                  size={18}
                  fill="#164e3f"
                  color="#164e3f"
                  style={{ marginLeft: 2 }}
                />
              </div>
              <span className={styles.secondaryDuration}>04:20</span>
            </div>
          </div>
        </div>

        {/* Right Column: Widgets */}
        <div className={styles.rightColumn}>
          {/* Widget 1: LỊCH TRÌNH TRỰC QUAN */}
          <div className={styles.sidebarCard}>
            <div className={styles.widgetHeaderRow}>
              <span className={styles.widgetCategoryTag}>
                LỊCH TRÌNH TRỰC QUAN
              </span>
              <Clock size={16} color="#6d8479" />
            </div>

            <h2 className={styles.widgetMainTitle}>Nhịp sinh học 30 phút</h2>
            <p className={styles.widgetSubTitle}>
              Quy tắc bậc thang giảm dần kích thích thần kinh.
            </p>

            <div className={styles.stepperList}>
              {SLEEP_ROUTINE_STEPS.map((step) => {
                const isCurrentActive =
                  activeVideo === 'main' &&
                  currentTime >= step.start &&
                  currentTime < step.end
                const isPassed =
                  activeVideo === 'main' && currentTime >= step.end

                return (
                  <div
                    key={step.id}
                    className={`${styles.stepperItem} ${
                      isCurrentActive ? styles.stepperItemActive : ''
                    }`}
                    onClick={() => handleJumpToStep(step.start)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Xem đoạn Bước ${step.num}: ${step.title} (${step.time})`}
                  >
                    <div
                      className={`${styles.stepNumberCircle} ${styles[step.colorClass]}`}
                    >
                      {isPassed ? (
                        <Check size={14} strokeWidth={3} />
                      ) : (
                        step.num
                      )}
                    </div>
                    <div className={styles.stepContent}>
                      <div className={styles.stepHeaderRow}>
                        <span className={styles.stepTimeHeading}>
                          {step.time} • {step.title}
                        </span>
                        <span
                          className={`${styles.stepMinutesBadge} ${
                            isCurrentActive ? styles.stepMinutesBadgeActive : ''
                          }`}
                        >
                          {isCurrentActive ? 'Đang phát ▶' : '10m'}
                        </span>
                      </div>
                      <div className={styles.stepDescription}>
                        {step.subtitle}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Lightbulb Callout */}
            <div className={styles.lightbulbCallout}>
              <span className={styles.lightbulbIcon}>💡</span>
              <p className={styles.lightbulbText}>
                Không ép bản thân phải ngủ ngay. Nếu sau 20 phút còn tỉnh, hãy
                ngồi dậy đọc vài trang sách.
              </p>
            </div>
          </div>

          {/* Widget 2: THỰC HÀNH NHANH */}
          <div className={styles.sidebarCard}>
            <div className={styles.widgetHeaderRow}>
              <span className={styles.widgetCategoryTag}>THỰC HÀNH NHANH</span>
              <span className={styles.widgetCategoryRight}>
                {stepsCount}/3 hoàn thành
              </span>
            </div>

            <h2 className={styles.widgetMainTitle}>3 Bước sẵn sàng tối nay</h2>
            <p className={styles.widgetSubTitle}>
              Chạm vào từng mục khi bạn đã sẵn sàng buông bỏ công việc:
            </p>

            <div className={styles.checklistGroup}>
              {/* Item 1 */}
              <div
                className={`${styles.checkItem} ${effectiveSteps.includes('step1') ? styles.checkItemActive : ''}`}
                onClick={() => toggleStep('step1')}
                role="checkbox"
                aria-checked={effectiveSteps.includes('step1')}
                tabIndex={0}
              >
                <div className={styles.customCheckCircle}>
                  {effectiveSteps.includes('step1') && (
                    <Check size={12} strokeWidth={3} />
                  )}
                </div>
                <span className={styles.checkItemText}>
                  Tối ưu phòng ngủ (Tối, mát, yên tĩnh)
                </span>
              </div>

              {/* Item 2 */}
              <div
                className={`${styles.checkItem} ${effectiveSteps.includes('step2') ? styles.checkItemActive : ''}`}
                onClick={() => toggleStep('step2')}
                role="checkbox"
                aria-checked={effectiveSteps.includes('step2')}
                tabIndex={0}
              >
                <div className={styles.customCheckCircle}>
                  {effectiveSteps.includes('step2') && (
                    <Check size={12} strokeWidth={3} />
                  )}
                </div>
                <span className={styles.checkItemText}>
                  Xả suy nghĩ &amp; Tránh caffeine chiều
                </span>
              </div>

              {/* Item 3 */}
              <div
                className={`${styles.checkItem} ${effectiveSteps.includes('step3') ? styles.checkItemActive : ''}`}
                onClick={() => toggleStep('step3')}
                role="checkbox"
                aria-checked={effectiveSteps.includes('step3')}
                tabIndex={0}
              >
                <div className={styles.customCheckCircle}>
                  {effectiveSteps.includes('step3') && (
                    <Check size={12} strokeWidth={3} />
                  )}
                </div>
                <span className={styles.checkItemText}>
                  Hạ nhịp thở sâu với nhịp 4-7-8
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
