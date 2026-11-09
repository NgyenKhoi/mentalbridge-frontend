'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  Headphones,
  Leaf,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Sparkles,
  Volume2,
  Wind,
  Bell,
  Droplets,
  CloudRain,
  Lightbulb,
} from 'lucide-react'

import type { PublicResourceDetail } from '../api/browser-resources'
import styles from './SmallStepsResourceDetail.module.css'

export type MicroActionKey = 'window' | 'water' | 'melody'

export interface MicroActionItem {
  id: MicroActionKey
  title: string
  subtitle: string
  detail: string
  icon: typeof Leaf
  heroTitle: string
  heroSubtitle: string
  image: string
  dialogue: string
  quote: string
}

export const MICRO_ACTIONS: Record<MicroActionKey, MicroActionItem> = {
  window: {
    id: 'window',
    title: 'Mở cửa sổ đón gió',
    subtitle:
      'Hít thở 3 hơi sâu với không khí tự nhiên, cảm nhận làn gió mát chạm vào da.',
    detail: 'Hít thở 3 hơi sâu với không khí trong lành ngoài trời',
    icon: Wind,
    heroTitle: 'MỞ CỬA SỔ ĐÓN GIÓ',
    heroSubtitle: 'Đón nhận sinh khí & nhịp thở trong lành tự nhiên',
    image: '/images/small-steps/small_steps_open_window.jpg',
    dialogue:
      'Hãy bước chậm rãi về phía cửa sổ và mở rộng cánh cửa. Đón lấy luồng gió mát lành tự nhiên chạm vào gò má. Hít một hơi thật sâu qua mũi, giữ lại một giây và thở ra nhẹ nhàng. Nhịp thở tự nhiên đang đưa dưỡng khí mới nuôi dưỡng từng tế bào của bạn.',
    quote:
      'Chỉ một làn gió mát trong lành cũng đủ đánh thức các giác quan đang mỏi mệt.',
  },
  water: {
    id: 'water',
    title: 'Uống một ngụm nước ấm',
    subtitle:
      'Cảm nhận dòng nước lan tỏa ấm áp xuống lồng ngực, chậm rãi nuốt từng ngụm.',
    detail: 'Cảm nhận hơi ấm truyền qua các đầu ngón tay và xuống lồng ngực',
    icon: Coffee,
    heroTitle: 'UỐNG MỘT NGỤM NƯỚC ẤM',
    heroSubtitle: 'Cảm nhận sự lan tỏa ấm áp và xoa dịu hệ thần kinh',
    image: '/images/small-steps/small_steps_warm_water.jpg',
    dialogue:
      'Nâng cốc nước ấm bằng cả hai bàn tay. Cảm nhận hơi ấm dịu dàng truyền qua các đầu ngón tay. Nhấp một ngụm nhỏ, giữ lại trên vòm họng vài giây trước khi nuốt. Cảm nhận dòng nước ấm chảy êm đềm xuống lồng ngực, làm dịu mọi căng thẳng đang tích tụ.',
    quote:
      'Một ngụm nước ấm chậm rãi gửi tín hiệu an toàn và thư giãn đến hệ thần kinh phó giao cảm.',
  },
  melody: {
    id: 'melody',
    title: 'Nghe một giai điệu dịu',
    subtitle:
      'Khép hờ mắt và không suy nghĩ, thả lỏng toàn bộ cơ thể theo từng nốt nhạc.',
    detail: 'Thả lỏng toàn bộ cơ thể theo tần số 432Hz êm dịu',
    icon: Headphones,
    heroTitle: 'NGHE MỘT GIAI ĐIỆU DỊU',
    heroSubtitle: 'Khép hờ mắt và buông bỏ mọi áp lực theo từng nốt nhạc',
    image: '/images/small-steps/small_steps_listen_melody.jpg',
    dialogue:
      'Hãy tựa lưng vào ghế thật thoải mái và khép nhẹ mi mắt. Lắng nghe từng rung động âm thanh 432Hz đang bao bọc lấy không gian của bạn. Lúc này, không có mục tiêu nào cần phải đạt được. Bạn chỉ cần hiện diện và để âm nhạc xoa dịu tâm trí.',
    quote:
      'Âm nhạc tần số thấp giúp sóng não alpha kích hoạt, đưa tâm trí về trạng thái tĩnh tại sâu sắc.',
  },
}

export const INTRO_ACTION: Omit<MicroActionItem, 'id'> = {
  title: 'Tập trung vào hiện tại',
  subtitle: 'Hướng dẫn thả lỏng đa giác quan',
  detail: 'Dành 3 phút nhẹ nhàng tái kết nối với bản thân',
  icon: Leaf,
  heroTitle: 'TẬP TRUNG VÀO HIỆN TẠI',
  heroSubtitle: 'Hướng dẫn thả lỏng đa giác quan',
  image: '/images/small-steps/small_steps_intro.jpg',
  dialogue:
    'Chào bạn, hôm nay bạn không cần phải cố gắng quá sức. Chỉ cần dành ra đúng 3 phút cho một cử chỉ thật nhỏ bé và tử tế với chính mình. Chọn một hành động bạn cảm thấy dễ chịu nhất bên phải để bắt đầu.',
  quote:
    'Hôm nay chỉ cần 3 phút — không cần cố gắng quá sức, không phán xét bất kỳ điều gì.',
}

type Props = Readonly<{
  resource: PublicResourceDetail
  backHref?: string
  backLabel?: string
  status?: 'IN_PROGRESS' | 'COMPLETED'
  progressLoadState?: 'loading' | 'ready' | 'error'
  saving?: boolean
  message?: string
  planNotice?: React.ReactNode
  onRetryProgress?: () => void
  onRecord?: (watchedSeconds: number, note?: string) => Promise<boolean>
  onConfirmCompletion?: () => Promise<boolean>
}>

export function SmallStepsResourceDetail({
  resource,
  backHref = '/resources',
  status = 'IN_PROGRESS',
  saving = false,
  planNotice,
  onRecord,
  onConfirmCompletion,
}: Props) {
  // Active micro action state
  const [selectedAction, setSelectedAction] = useState<MicroActionKey>('window')
  const [hasInteractedAction, setHasInteractedAction] = useState(true)

  // Current visual item
  const currentAction = hasInteractedAction
    ? MICRO_ACTIONS[selectedAction]
    : INTRO_ACTION

  // Audio / Narration State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(192) // 03:12 default estimated duration
  const [ambientSound, setAmbientSound] = useState<'bell' | 'stream' | 'rain'>(
    'bell',
  )

  // Mindful Timer State (3 minutes = 180s)
  const TIMER_TOTAL = 180
  const [timerSeconds, setTimerSeconds] = useState(TIMER_TOTAL)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [isCompleted, setIsCompleted] = useState(status === 'COMPLETED')
  const [imageZoomed, setImageZoomed] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Format seconds to mm:ss
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // Handle Micro Action change
  const handleSelectAction = (key: MicroActionKey) => {
    setSelectedAction(key)
    setHasInteractedAction(true)
    setImageZoomed(false)
    setTimeout(() => setImageZoomed(true), 50)

    // If timer is not running, reset to 3:00 for the new action
    if (!isTimerRunning) {
      setTimerSeconds(TIMER_TOTAL)
    }

    // Optional voice narration speak if audio is playing
    if (
      isPlayingAudio &&
      typeof window !== 'undefined' &&
      'speechSynthesis' in window
    ) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(
        MICRO_ACTIONS[key].dialogue,
      )
      utterance.lang = 'vi-VN'
      utterance.rate = 0.9
      window.speechSynthesis.speak(utterance)
    }
  }

  // Web Audio ambient sound synthesizer (soothing 432Hz sine chime or soft harmonic hum)
  const playAmbientSound = useCallback((type: 'bell' | 'stream' | 'rain') => {
    try {
      if (typeof window === 'undefined') return
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      if (!AudioCtx) return

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx()
      }
      const ctx = audioContextRef.current
      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      if (type === 'bell') {
        // 432 Hz pure healing frequency singing bowl tone with gentle overtone
        osc.type = 'sine'
        osc.frequency.setValueAtTime(432, now)
        gain.gain.setValueAtTime(0.15, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 4.5)
      } else if (type === 'stream') {
        // 528 Hz harmonic gentle warm frequency
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(528, now)
        gain.gain.setValueAtTime(0.08, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 3.5)
      } else {
        // Rain 396 Hz soothing root frequency
        osc.type = 'sine'
        osc.frequency.setValueAtTime(396, now)
        gain.gain.setValueAtTime(0.1, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 4.0)
      }

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 4.5)
    } catch {
      // AudioContext fallback ignored
    }
  }, [])

  // Audio Play / Pause handler
  const togglePlayAudio = () => {
    if (!isPlayingAudio) {
      setIsPlayingAudio(true)
      playAmbientSound(ambientSound)

      // Try playing audio element
      if (audioRef.current) {
        audioRef.current.play().catch(() => {
          // Playback without blocking
        })
      }

      // Voice dialogue narration via SpeechSynthesis
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(currentAction.dialogue)
        utterance.lang = 'vi-VN'
        utterance.rate = 0.9
        window.speechSynthesis.speak(utterance)
      }
    } else {
      setIsPlayingAudio(false)
      if (audioRef.current) {
        audioRef.current.pause()
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }

  // Seek audio to given seconds
  const seekAudio = useCallback(
    (newTime: number) => {
      const bounded = Math.max(0, Math.min(newTime, audioDuration))
      setCurrentTime(bounded)
      if (audioRef.current) {
        audioRef.current.currentTime = bounded
      }
    },
    [audioDuration],
  )

  // Real media time update
  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(Math.floor(audioRef.current.currentTime))
    }
  }, [])

  // Real media metadata loaded
  const handleLoadedMetadata = useCallback(() => {
    if (
      audioRef.current &&
      Number.isFinite(audioRef.current.duration) &&
      audioRef.current.duration > 0
    ) {
      setAudioDuration(Math.floor(audioRef.current.duration))
    }
  }, [])

  // Handle completion
  const handleFinishExercise = useCallback(async () => {
    setIsCompleted(true)
    playAmbientSound('bell')
    if (onRecord) {
      await onRecord(
        180,
        `Đã thực hành vi mô 3 phút: ${MICRO_ACTIONS[selectedAction].title}`,
      )
    }
    if (onConfirmCompletion) {
      await onConfirmCompletion()
    }
  }, [onRecord, onConfirmCompletion, selectedAction, playAmbientSound])

  // Mindful Timer Countdown effect
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null
    if (isTimerRunning && timerSeconds > 0) {
      timer = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false)
            void handleFinishExercise()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [isTimerRunning, timerSeconds, handleFinishExercise])

  // Timer start/pause
  const toggleTimer = () => {
    if (isCompleted) {
      setTimerSeconds(TIMER_TOTAL)
      setIsCompleted(false)
      setIsTimerRunning(true)
      return
    }
    if (!isTimerRunning) {
      setIsTimerRunning(true)
      playAmbientSound('bell')
      if (!isPlayingAudio) {
        togglePlayAudio()
      }
    } else {
      setIsTimerRunning(false)
    }
  }

  // Timer reset
  const resetTimer = () => {
    setIsTimerRunning(false)
    setTimerSeconds(TIMER_TOTAL)
  }

  // Circular timer progress calculation
  const circleRadius = 30
  const circleCircumference = 2 * Math.PI * circleRadius
  const timerProgress = timerSeconds / TIMER_TOTAL
  const strokeDashoffset = circleCircumference * (1 - timerProgress)

  // Timeline scrub
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percent = Math.max(0, Math.min(1, clickX / rect.width))
    seekAudio(Math.round(percent * audioDuration))
  }

  const ActionIcon = currentAction.icon

  return (
    <div className={styles.page} data-resource-id={resource?.id}>
      <div className={styles.container}>
        {/* Top Navigation & Breadcrumb */}
        <header className={styles.topNav}>
          <Link href={backHref} className={styles.backLink}>
            <ArrowLeft size={16} />
            <span>Kế hoạch hỗ trợ</span>
          </Link>

          <div className={styles.studioBadge}>
            <Sparkles size={14} />
            <span>Studio Vi Mô Thực Hành</span>
          </div>

          <div className={styles.durationBadge}>
            <Clock size={14} />
            <span>
              Thời lượng khuyến nghị: <strong>3 Phút Nhẹ Nhàng</strong>
            </span>
          </div>
        </header>

        {/* Plan Notice Banner (if any) */}
        {planNotice && <div style={{ marginBottom: 20 }}>{planNotice}</div>}

        {/* Header & Quote Section */}
        <section className={styles.headerSection}>
          <div className={styles.eyebrow}>
            <Sparkles size={14} />
            <span>Phục hồi năng lượng chậm rãi</span>
          </div>
          <h1 className={styles.mainTitle}>
            {resource?.title || 'Bắt đầu bằng một hoạt động nhỏ'}
          </h1>
          <p className={styles.quoteText}>
            “Hôm nay chỉ cần 3 phút — không cần cố gắng quá sức, không phán xét
            bất kỳ điều gì.”
          </p>
        </section>

        {/* 2-Column Main Workspace */}
        <main className={styles.mainGrid}>
          {/* Left Column: Visual Hero + Narration Player + Reading Article */}
          <div className={styles.leftCol}>
            {/* Visual Hero Media Frame with High-Quality Image & Transitions */}
            <div className={styles.heroMediaCard}>
              <div className={styles.heroImageContainer}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentAction.image}
                  alt={currentAction.heroTitle}
                  className={`${styles.heroImage} ${imageZoomed ? styles.zoomed : ''}`}
                />
              </div>

              <div className={styles.heroOverlay}>
                <div className={styles.heroTopBadges}>
                  <div className={styles.audiobookBadge}>
                    <Headphones size={13} />
                    <span>Audiobook • Giọng trầm ấm</span>
                  </div>
                  <div className={styles.timeBadge}>03:12</div>
                </div>

                {/* Central Play/Pause button */}
                <button
                  type="button"
                  className={styles.heroCenterPlay}
                  onClick={togglePlayAudio}
                  aria-label={
                    isPlayingAudio ? 'Tạm dừng lời thoại' : 'Phát lời thoại'
                  }
                >
                  {isPlayingAudio ? (
                    <Pause size={24} />
                  ) : (
                    <Play size={24} style={{ marginLeft: 3 }} />
                  )}
                </button>

                <div className={styles.heroBottomContent}>
                  <h2 className={styles.heroStepTitle}>
                    {currentAction.heroTitle}
                  </h2>
                  <p className={styles.heroStepSubtitle}>
                    {currentAction.heroSubtitle}
                  </p>
                </div>
              </div>
            </div>

            {/* Audio Voiceover Player & Dialogue (Lời thoại & Sóng âm) */}
            <div className={styles.audioPlayerCard}>
              <div className={styles.narratorRow}>
                <div className={styles.narratorInfo}>
                  <div className={styles.waveformIcon}>
                    <div className={styles.equalizerBars}>
                      <span
                        className={`${styles.equalizerBar} ${isPlayingAudio ? styles.animating : ''}`}
                        style={{ height: isPlayingAudio ? 12 : 6 }}
                      />
                      <span
                        className={`${styles.equalizerBar} ${isPlayingAudio ? styles.animating : ''}`}
                        style={{ height: isPlayingAudio ? 16 : 10 }}
                      />
                      <span
                        className={`${styles.equalizerBar} ${isPlayingAudio ? styles.animating : ''}`}
                        style={{ height: isPlayingAudio ? 8 : 4 }}
                      />
                      <span
                        className={`${styles.equalizerBar} ${isPlayingAudio ? styles.animating : ''}`}
                        style={{ height: isPlayingAudio ? 14 : 7 }}
                      />
                    </div>
                  </div>
                  <div className={styles.narratorText}>
                    <h4>Giọng dẫn thiền • Chuyên viên Thuỳ Dung</h4>
                    <p>
                      Giai điệu thư giãn nhẹ nhàng, hỗ trợ điều hòa nhịp thở
                    </p>
                  </div>
                </div>

                <div className={styles.audioNavButtons}>
                  <button
                    type="button"
                    className={styles.navIconBtn}
                    onClick={() => seekAudio(currentTime - 10)}
                    title="Lùi 10 giây"
                    aria-label="Lùi 10 giây"
                  >
                    <RotateCcw size={15} />
                  </button>
                  <button
                    type="button"
                    className={styles.mainPlayBtn}
                    onClick={togglePlayAudio}
                    aria-label={isPlayingAudio ? 'Tạm dừng' : 'Phát'}
                  >
                    {isPlayingAudio ? (
                      <Pause size={18} />
                    ) : (
                      <Play size={18} style={{ marginLeft: 2 }} />
                    )}
                  </button>
                  <button
                    type="button"
                    className={styles.navIconBtn}
                    onClick={() => seekAudio(currentTime + 10)}
                    title="Tua tới 10 giây"
                    aria-label="Tua tới 10 giây"
                  >
                    <RotateCw size={15} />
                  </button>
                </div>
              </div>

              {/* Progress Slider */}
              <div className={styles.timelineRow}>
                <div
                  className={styles.timelineTrack}
                  onClick={handleTimelineClick}
                  role="slider"
                  tabIndex={0}
                  aria-label="Thanh thời gian âm thanh"
                  aria-valuemin={0}
                  aria-valuemax={audioDuration}
                  aria-valuenow={currentTime}
                >
                  <div
                    className={styles.timelineFill}
                    style={{
                      width: `${(currentTime / audioDuration) * 100}%`,
                    }}
                  />
                </div>
                <div className={styles.timeNumbers}>
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(audioDuration)}</span>
                </div>
              </div>

              {/* Synced Spoken Dialogue Box (Lời thoại hướng dẫn) */}
              <div className={styles.dialogueBox}>
                <div className={styles.dialogueLabel}>
                  <Volume2 size={13} />
                  <span>Lời thoại hướng dẫn trực tiếp</span>
                </div>
                <p className={styles.dialogueText}>
                  “{currentAction.dialogue}”
                </p>
              </div>

              {/* Ambient Sound Harmonic Mixer (Âm thanh nền hoà tấu) */}
              <div className={styles.ambientSection}>
                <h5 className={styles.ambientTitle}>
                  Âm thanh nền hoà tấu kèm theo
                </h5>
                <div className={styles.ambientPills}>
                  <button
                    type="button"
                    className={`${styles.ambientBtn} ${ambientSound === 'bell' ? styles.active : ''}`}
                    onClick={() => {
                      setAmbientSound('bell')
                      playAmbientSound('bell')
                    }}
                  >
                    <Bell size={13} />
                    <span>Chuông xoay 432Hz</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.ambientBtn} ${ambientSound === 'stream' ? styles.active : ''}`}
                    onClick={() => {
                      setAmbientSound('stream')
                      playAmbientSound('stream')
                    }}
                  >
                    <Droplets size={13} />
                    <span>Suối reo sỏi ấm</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.ambientBtn} ${ambientSound === 'rain' ? styles.active : ''}`}
                    onClick={() => {
                      setAmbientSound('rain')
                      playAmbientSound('rain')
                    }}
                  >
                    <CloudRain size={13} />
                    <span>Mưa dịu bên hiên</span>
                  </button>
                </div>
              </div>

              {/* Audio element connected to real media events */}
              <audio
                ref={audioRef}
                src="/audio/nhac-thien.mp3"
                preload="metadata"
                loop
                style={{ display: 'none' }}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlayingAudio(true)}
                onPause={() => setIsPlayingAudio(false)}
                onEnded={() => {
                  setIsPlayingAudio(false)
                  seekAudio(0)
                }}
              />
            </div>

            {/* Reading Article: Psychological Insights (Bài đọc lâm sàng) */}
            <article className={styles.readingCard}>
              <div className={styles.readingHeader}>
                <div className={styles.readingHeaderIcon}>
                  <Lightbulb size={18} />
                </div>
                <h3>Cơ chế tâm lý của một bước nhỏ</h3>
              </div>

              <div className={styles.readingBody}>
                <p>
                  Khi rơi vào tình trạng quá tải (Burnout), kiệt sức nhận thức
                  hoặc trầm cảm nhẹ, não bộ thường gặp hiện tượng{' '}
                  <strong>tê liệt hành động (Executive Dysfunction)</strong>. Vỏ
                  não trước trán đánh giá mọi nhiệm vụ — dù là dọn dẹp, học tập
                  hay trả lời email — đều như một ngọn núi khổng lồ khó vượt
                  qua.
                </p>

                <div className={styles.readingHighlight}>
                  <strong>
                    Liệu pháp Kích hoạt Hành vi (Behavioral Activation):
                  </strong>{' '}
                  Khi bạn chia nhỏ hành động xuống mức siêu nhỏ chỉ cần 3 phút,
                  rào cản tâm lý bắt đầu hành động sẽ giảm bớt rõ rệt. Mỗi hành
                  động nhỏ hoàn thành giúp bạn từng bước khôi phục cảm giác tự
                  chủ và tiếp thêm động lực tự nhiên cho cơ thể.
                </div>

                <p>
                  Đừng đợi đến khi có động lực mới bắt đầu. Trong tâm lý học trị
                  liệu hành vi nhận thức (CBT),
                  <strong>
                    {' '}
                    hành động nhỏ luôn đi trước cảm xúc và động lực
                  </strong>
                  . Bạn chỉ cần làm duy nhất một bước hôm nay.
                </p>
              </div>
            </article>
          </div>

          {/* Right Column: Micro Action Selector + Mindful Timer */}
          <div className={styles.rightCol}>
            {/* Card 1: Select 1 Micro Action */}
            <div className={styles.selectorCard}>
              <div className={styles.selectorHeader}>
                <div className={styles.selectorTitle}>
                  <Leaf size={18} color="#174e3e" />
                  <span>Chọn 1 hoạt động vi mô</span>
                </div>
                <span className={styles.selectorTimeTag}>3 phút</span>
              </div>

              <p className={styles.selectorDesc}>
                Chọn duy nhất một hành động bạn cảm thấy dễ chịu nhất ngay lúc
                này:
              </p>

              <div className={styles.actionList}>
                {(['window', 'water', 'melody'] as const).map((key) => {
                  const item = MICRO_ACTIONS[key]
                  const ItemIcon = item.icon
                  const isActive = selectedAction === key

                  return (
                    <button
                      key={key}
                      type="button"
                      className={`${styles.actionOption} ${isActive ? styles.active : ''}`}
                      onClick={() => handleSelectAction(key)}
                    >
                      <div className={styles.radioCircle}>
                        {isActive && <div className={styles.radioDot} />}
                      </div>

                      <div className={styles.actionContent}>
                        <div className={styles.actionNameRow}>
                          <ItemIcon size={16} />
                          <span>{item.title}</span>
                        </div>
                        <p className={styles.actionSubtext}>{item.subtitle}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Card 2: Mindful Timer */}
            <div className={styles.timerCard}>
              <div className={styles.timerHeader}>
                <div className={styles.timerLabel}>
                  <Clock size={15} />
                  <span>MINDFUL TIMER</span>
                </div>
                <div
                  className={`${styles.timerStateBadge} ${isTimerRunning ? styles.running : ''}`}
                >
                  {isCompleted
                    ? 'Đã hoàn thành'
                    : isTimerRunning
                      ? 'Đang thực hành'
                      : 'Sẵn sàng'}
                </div>
              </div>

              <div className={styles.timerMainSection}>
                <div className={styles.timerTextCol}>
                  <div className={styles.countdownDisplay}>
                    {formatTime(timerSeconds)}
                  </div>
                  <p className={styles.currentPracticeLabel}>
                    Thực hành:{' '}
                    <strong>{MICRO_ACTIONS[selectedAction].title}</strong>
                  </p>
                </div>

                {/* Circular Animated Progress SVG */}
                <div className={styles.timerCircleWrapper}>
                  <svg className={styles.timerSvg} viewBox="0 0 72 72">
                    <circle
                      className={styles.timerBgRing}
                      cx="36"
                      cy="36"
                      r={circleRadius}
                    />
                    <circle
                      className={styles.timerProgressRing}
                      cx="36"
                      cy="36"
                      r={circleRadius}
                      strokeDasharray={circleCircumference}
                      strokeDashoffset={strokeDashoffset}
                    />
                  </svg>
                  <div className={styles.timerCenterIcon}>
                    <ActionIcon size={20} />
                  </div>
                </div>
              </div>

              {/* Main Timer Action Button */}
              {isCompleted ? (
                <div className={styles.completedCard}>
                  <CheckCircle2 size={18} />
                  <span>Hoàn thành xuất sắc 3 phút thực hành vi mô!</span>
                </div>
              ) : (
                <button
                  type="button"
                  className={`${styles.timerActionBtn} ${styles.primary}`}
                  onClick={toggleTimer}
                  disabled={saving}
                >
                  {isTimerRunning ? (
                    <>
                      <Pause size={17} />
                      <span>Tạm dừng thực hành</span>
                    </>
                  ) : (
                    <>
                      <Play size={17} style={{ marginLeft: 2 }} />
                      <span>Bắt đầu cùng làm ({formatTime(timerSeconds)})</span>
                    </>
                  )}
                </button>
              )}

              {/* Secondary Controls */}
              <div className={styles.timerSecondaryRow}>
                <button
                  type="button"
                  className={styles.timerResetBtn}
                  onClick={resetTimer}
                  title="Đặt lại 3 phút"
                >
                  <RotateCcw size={14} />
                  <span>Đặt lại 3:00</span>
                </button>

                {!isCompleted && (
                  <button
                    type="button"
                    className={styles.timerResetBtn}
                    onClick={handleFinishExercise}
                    disabled={saving}
                    title="Xác nhận đã hoàn thành"
                  >
                    <Check size={14} />
                    <span>Hoàn thành ngay</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
