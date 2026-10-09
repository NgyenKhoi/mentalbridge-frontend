'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { Dialog } from '@/components/ui/Dialog'

import type { PublicResourceDetail } from '../api/browser-resources'
import styles from './breathing-resource-detail.module.css'

type Phase = {
  cue: { label: string; seconds: number }
  index: number
  remainingSeconds: number
  cycle: number
} | null

type Props = Readonly<{
  resource: PublicResourceDetail
  backHref: string
  backLabel: string
  durationSeconds: number
  timer: number | null
  timerRunning: boolean
  phase: Phase
  inhaleSeconds: number
  exhaleSeconds: number
  cycleSeconds: number
  status: 'IN_PROGRESS' | 'COMPLETED'
  progressLoadState: 'ready' | 'loading' | 'error'
  onRetryProgress: () => void
  saving: boolean
  message: string
  confirmationOpen: boolean
  onConfirmationOpenChange: (open: boolean) => void
  onStartPause: () => void
  onConfirm: () => void
  onConfirmCompletion: () => void
}>

function timeLabel(seconds: number) {
  const safe = Math.max(0, seconds)
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

export function BreathingResourceDetail({
  resource,
  backHref,
  backLabel,
  durationSeconds,
  timer,
  timerRunning,
  phase,
  inhaleSeconds,
  exhaleSeconds,
  cycleSeconds,
  status,
  progressLoadState,
  onRetryProgress,
  saving,
  message,
  confirmationOpen,
  onConfirmationOpenChange,
  onStartPause,
  onConfirm,
  onConfirmCompletion,
}: Props) {
  const [soundPlaying, setSoundPlaying] = useState(false)
  const [soundUnavailable, setSoundUnavailable] = useState(false)
  const [volume, setVolume] = useState(45)
  const [imageFailed, setImageFailed] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const minuteCount = Math.ceil(durationSeconds / 60)
  const displayTitle = `Thở chậm trong ${minuteCount} phút`
  const remaining = timer ?? durationSeconds
  const phaseProgress = phase
    ? Math.max(0, (phase.cue.seconds - phase.remainingSeconds) / phase.cue.seconds)
    : 0
  const progressState = progressLoadState === 'ready' && message ? 'error' : progressLoadState
  const isComplete = status === 'COMPLETED'
  const phaseLabel = timer === null
    ? 'Hít vào'
    : timer === 0
      ? 'Phiên tập đã kết thúc'
      : timerRunning
        ? phase?.cue.label ?? 'Thở thật nhẹ'
        : 'Đang nghỉ một nhịp'

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100
    }
  }, [volume])

  useEffect(() => {
    const audio = audioRef.current
    return () => {
      audio?.pause()
    }
  }, [])

  function stopSound() {
    audioRef.current?.pause()
    setSoundPlaying(false)
  }

  async function startSound() {
    const audio = audioRef.current
    if (!audio) return
    try {
      audio.volume = volume / 100
      await audio.play()
      setSoundPlaying(true)
      setSoundUnavailable(false)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      setSoundUnavailable(true)
      setSoundPlaying(false)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.breadcrumb} aria-label="Đường dẫn">
          <Link href={backHref}>← {backLabel}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{displayTitle}</span>
        </nav>

        <header className={styles.pageHeader}>
          <div>
            <div className={styles.badges}>
              <span>Bài tập điều hòa nhịp thở</span>
              <span>Cường độ nhẹ</span>
              <span>{minuteCount} phút</span>
            </div>
            <h1>{displayTitle}</h1>
            <p>{resource.summary}</p>
          </div>
          <div className={styles.todayStatus} role="status">
            <span aria-hidden="true">✦</span>
            <div>
              <small>Tiến trình hôm nay</small>
              <strong>
                {progressState === 'loading'
                  ? 'Đang tải tiến độ'
                  : progressState === 'error'
                    ? 'Chưa tải được tiến độ'
                    : isComplete
                      ? 'Đã ghi nhận phiên tập'
                      : 'Chưa hoàn thành phiên tập'}
              </strong>
            </div>
          </div>
        </header>

        <div className={styles.columns}>
          <div className={styles.leftColumn}>
            <section className={styles.practiceCard} aria-label="Bài tập thở">
              <div className={styles.practiceTop}>
                <span className={styles.statusChip}>
                  <i aria-hidden="true" />{timerRunning ? 'Đang theo nhịp thở' : phaseLabel}
                </span>
                <span className={styles.rhythmChip}>
                  Nhịp {inhaleSeconds}:{exhaleSeconds}
                </span>
              </div>

              <div className={styles.orbit}>
                <div className={styles.outerRing}>
                  <i aria-hidden="true" />
                  <div
                    className={`${styles.innerOrb} ${timerRunning && phase?.index === 0 ? styles.inhaling : ''}`}
                    style={{ transitionDuration: `${timerRunning ? phase?.cue.seconds ?? inhaleSeconds : 0}s` }}
                  >
                    <span aria-live="polite">{phaseLabel}</span>
                    <strong>{timer === 0 ? 0 : phase?.remainingSeconds ?? inhaleSeconds}s</strong>
                    <small>{timerRunning ? 'thật nhẹ và vừa sức' : 'Nhấn Bắt đầu khi sẵn sàng'}</small>
                  </div>
                  <i aria-hidden="true" />
                </div>
              </div>

              <div className={styles.clock}>
                <strong>{timeLabel(remaining)}</strong>
                <span>Thời gian phiên tập còn lại</span>
              </div>

              <div className={styles.phaseTrack}>
                <div>
                  <span>● Hít vào ({inhaleSeconds}s)</span>
                  <span>Chu kỳ {cycleSeconds || 10} giây</span>
                  <span>○ Thở ra ({exhaleSeconds}s)</span>
                </div>
                <div className={styles.track} role="progressbar" aria-label="Tiến trình nhịp thở" aria-valuenow={Math.round(phaseProgress * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <i style={{ width: `${phaseProgress * 100}%` }} />
                </div>
              </div>

              <div className={styles.practiceActions}>
                <button type="button" className={styles.startButton} aria-label={timerRunning ? 'Tạm dừng tập luyện' : timer === null || timer === 0 ? 'Bắt đầu tập luyện' : 'Tiếp tục tập luyện'} onClick={onStartPause}>
                  {timerRunning ? 'Ⅱ Tạm dừng' : timer === null || timer === 0 ? '▶ Bắt đầu tập luyện' : '▶ Tiếp tục tập luyện'}
                </button>
                {timerRunning && (
                  <button type="button" className={styles.restButton} aria-label="Nghỉ tập luyện" onClick={onStartPause}>
                    Nghỉ
                  </button>
                )}
              </div>
            </section>

            <section className={styles.soundCard} aria-label="Âm thanh thư giãn">
              <audio
                ref={audioRef}
                src="/audio/am-thanh-thu-gian-tinh-tam.mp3"
                preload="none"
                onPause={() => setSoundPlaying(false)}
                onEnded={() => setSoundPlaying(false)}
                onError={() => {
                  setSoundUnavailable(true)
                  setSoundPlaying(false)
                }}
              />
              <span className={styles.soundIcon} aria-hidden="true">♫</span>
              <div className={styles.soundCopy}>
                <div><strong>Âm thanh thư giãn tĩnh tâm</strong><span>{soundPlaying ? 'Bật' : 'Tắt'}</span></div>
                <p>Nghe theo nhịp của bạn</p>
              </div>
              <button type="button" className={styles.soundToggle} aria-label={soundPlaying ? 'Tắt âm thanh' : 'Bật âm thanh'} aria-pressed={soundPlaying} onClick={() => soundPlaying ? stopSound() : void startSound()}>
                {soundPlaying ? 'Tắt' : 'Bật'}
              </button>
              <div className={styles.volumeControl}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z" /></svg>
                <input type="range" min="0" max="100" value={volume} aria-label="Âm lượng" onChange={(event) => setVolume(Number(event.target.value))} />
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3Z" /><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" /></svg>
              </div>
              {soundUnavailable && <p className={styles.audioError} role="alert">Trình duyệt chưa phát được âm thanh. Bạn có thể tiếp tục bài tập không cần âm thanh.</p>}
            </section>

            <section className={styles.videoCard} aria-labelledby="breathing-video-title">
              <div className={styles.videoHeading}>
                <span className={styles.videoIcon} aria-hidden="true">▶</span>
                <div>
                  <span className={styles.videoEyebrow}>Hướng dẫn bằng video</span>
                  <h2 id="breathing-video-title">Cùng tập thở thật nhẹ</h2>
                </div>
                <span className={styles.videoDuration}>1:12</span>
              </div>
              <div className={styles.videoFrame}>
                <video
                  controls
                  playsInline
                  preload="metadata"
                  poster="/images/resource-mist-landscape.svg"
                  aria-label="Video hướng dẫn bài tập thở chậm"
                >
                  <source src="/videos/mentalbridge-breathing-exercise.mp4" type="video/mp4" />
                  Trình duyệt chưa phát được video. Bạn có thể <a href="/videos/mentalbridge-breathing-exercise.mp4">mở video tại đây</a>.
                </video>
              </div>
              <p>Xem theo nhịp phù hợp với bạn, rồi quay lại vòng thở phía trên để thực hành.</p>
            </section>
          </div>

          <div className={styles.rightColumn}>
            <section className={styles.summaryCard}>
              <div className={styles.sectionTop}><span>● Tóm tắt dịu dàng</span><span>Checklist 3 bước</span></div>
              <h2>Điều bạn cần biết trước khi thở</h2>
              <ol className={styles.checklist}>
                <li><span aria-hidden="true">♧</span><div><strong>1. Tư thế thư giãn hoàn toàn</strong><p>Ngồi tựa lưng hoặc nằm thẳng, thả lỏng hai vai và để cơ thể được nâng đỡ.</p></div></li>
                <li><span aria-hidden="true">≋</span><div><strong>2. Nhịp thở êm, không gắng sức</strong><p>Hít nhẹ qua mũi, thở ra tự nhiên qua miệng hoặc mũi. Không cần cố hít thật sâu.</p></div></li>
                <li><span aria-hidden="true">♡</span><div><strong>3. An toàn là ưu tiên số một</strong><p>Nếu thấy chóng mặt hoặc khó chịu, hãy dừng lại và quay về nhịp thở thường ngày.</p></div></li>
              </ol>
            </section>

            <section className={styles.momentCard}>
              <div className={styles.momentArt}>
                {!imageFailed && <Image src="/images/resource-tea-moment.svg" alt="Tách trà ấm bên cửa sổ" fill sizes="(max-width: 1000px) 100vw, 480px" onError={() => setImageFailed(true)} />}
                <div><span>Khoảnh khắc chậm lại</span></div>
              </div>
              <blockquote>“Không cần làm mọi thứ cùng lúc. Một nhịp thở chậm cũng đã là một bước chăm sóc bản thân.”</blockquote>
              <p>Ghi nhớ từ MentalBridge</p>
            </section>

            <section className={styles.progressCard} data-state={progressState}>
              <div className={styles.sectionTop}>
                <strong>✓ Tiến trình bài tập</strong>
                {progressState === 'loading' ? (
                  <span className={styles.progressSkeleton} aria-label="Đang tải tiến độ" />
                ) : (
                  <span>{progressState === 'error' ? 'Chưa tải được' : isComplete ? 'Đã hoàn thành' : 'Sẵn sàng ghi nhận'}</span>
                )}
              </div>
              <p>Kết quả phiên tập được lưu vào tiến độ Tài nguyên khi bạn xác nhận. Bạn có thể xem lại bài tập bất cứ lúc nào.</p>
              {progressState === 'loading' && <div className={styles.progressSkeletonLine} role="status" aria-label="Đang tải tiến độ đã lưu" />}
              {progressState === 'error' && (
                <div className={styles.progressRecovery} role="alert">
                  <p className={styles.progressNotice}>{message || 'Chưa tải được tiến độ. Bạn có thể thử lại; bài tập vẫn dùng được.'}</p>
                  <button type="button" className={styles.retryButton} aria-label="Thử tải lại tiến độ" onClick={onRetryProgress}>Thử lại</button>
                </div>
              )}
              <button type="button" aria-label="Xác nhận hoàn thành bài tập" disabled={progressState !== 'ready' || saving || isComplete} onClick={onConfirm}>
                {isComplete ? '✓ Đã ghi nhận hoàn thành' : saving ? 'Đang lưu…' : 'Xác nhận hoàn thành'}
              </button>
            </section>
          </div>
        </div>
        <p className={styles.boundary}>Nội dung hỗ trợ tự chăm sóc, không dùng để chẩn đoán hoặc thay thế đánh giá và điều trị từ chuyên gia.</p>
      </div>

      <Dialog open={confirmationOpen} onOpenChange={onConfirmationOpenChange} labelledBy="breathing-confirm-title" describedBy="breathing-confirm-description" className={styles.confirmDialog}>
        <h2 id="breathing-confirm-title">Ghi nhận phiên tập?</h2>
        <p id="breathing-confirm-description">MentalBridge sẽ lưu kết quả hoàn thành cho ngày này. Bạn vẫn có thể quay lại thực hành vào lúc khác.</p>
        <div><button type="button" aria-label="Để sau" onClick={() => onConfirmationOpenChange(false)}>Để sau</button><button type="button" aria-label="Xác nhận hoàn thành phiên tập" disabled={saving} onClick={onConfirmCompletion}>{saving ? 'Đang lưu…' : 'Xác nhận hoàn thành'}</button></div>
      </Dialog>
    </main>
  )
}
