'use client'

import Link from 'next/link'
import * as Slider from '@radix-ui/react-slider'
import {
  ArrowLeft,
  Check,
  Clock3,
  ExternalLink,
  Eye,
  Focus,
  Headphones,
  Leaf,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Waves,
} from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'

import { Dialog } from '@/components/ui/Dialog'

import type { PublicResourceDetail } from '../api/browser-resources'
import type { ResourceAction } from '../model/resource-interactions'
import { structuredResourceContent } from '../model/structured-resource-content'
import { MindfulnessScene } from './MindfulnessScene'
import styles from './mindfulness-resource-detail.module.css'

type Props = Readonly<{
  resource: PublicResourceDetail
  actions: readonly ResourceAction[]
  backHref: string
  backLabel: string
  status: 'IN_PROGRESS' | 'COMPLETED'
  progressLoadState: 'loading' | 'ready' | 'error'
  saving: boolean
  message: string
  confirmationOpen: boolean
  onConfirmationOpenChange: (open: boolean) => void
  onRetryProgress: () => void
  onConfirm: () => void
  onConfirmCompletion: () => void
}>

function formatTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export function MindfulnessResourceDetail({
  resource,
  actions,
  backHref,
  backLabel,
  status,
  progressLoadState,
  saving,
  message,
  confirmationOpen,
  onConfirmationOpenChange,
  onRetryProgress,
  onConfirm,
  onConfirmCompletion,
}: Props) {
  const durationMinutes = 3
  const durationSeconds = durationMinutes * 60
  const stageSeconds = Math.ceil(durationSeconds / 3)
  const [remaining, setRemaining] = useState(durationSeconds)
  const [running, setRunning] = useState(false)
  const [soundPlaying, setSoundPlaying] = useState(false)
  const [soundError, setSoundError] = useState(false)
  const [volume, setVolume] = useState(65)
  const soundRef = useRef<HTMLAudioElement | null>(null)
  const phaseIndex = Math.min(
    2,
    Math.floor((durationSeconds - remaining) / stageSeconds),
  )
  const progressState =
    progressLoadState === 'ready' && message ? 'error' : progressLoadState
  const sourceUrl = resource.sourceUrl?.startsWith('https://')
    ? resource.sourceUrl
    : null
  const reviewedSteps = structuredResourceContent(resource).steps
  const stepLabels =
    actions.length >= 4
      ? actions.map((action) => action.label)
      : reviewedSteps.length >= 4
        ? reviewedSteps
        : [
            'Nhận biết một điều đang thấy',
            'Nhận biết một âm thanh',
            'Nhận biết một cảm giác chạm',
            'Quay về hoạt động đang làm',
          ]
  const stages = [
    {
      title: 'Nhận biết xung quanh',
      icon: Eye,
      steps: stepLabels.slice(0, 2),
      instructions: [
        'Dừng lại một nhịp. Nhìn quanh và chọn một vật ở gần bạn để quan sát.',
        'Gọi tên trong đầu màu sắc, hình dạng hoặc ánh sáng trên vật đó.',
        'Lắng nghe một âm thanh gần hay xa. Nếu xao nhãng, đưa chú ý về điều bạn thấy hoặc nghe.',
      ],
    },
    {
      title: 'Cảm nhận điểm chạm',
      icon: Focus,
      steps: stepLabels.slice(2, 3),
      instructions: [
        'Chọn một điểm tựa đang có: bàn chân trên sàn, lưng trên ghế hoặc tay trên đùi.',
        'Chú ý cảm giác tại đó: sức nặng, nhiệt độ hoặc bề mặt đang chạm vào cơ thể.',
        'Giữ chú ý trong vài nhịp thở. Khi tâm trí đi xa, nhẹ nhàng trở lại điểm chạm.',
      ],
    },
    {
      title: 'Quay về việc đang làm',
      icon: Leaf,
      steps: stepLabels.slice(3),
      instructions: [
        'Nhận ra việc bạn đang làm trước khi dừng lại và chọn một bước nhỏ để tiếp tục.',
        'Làm bước đó chậm rãi; cảm nhận chuyển động của tay, chân hoặc cơ thể.',
        'Nếu bị phân tâm, ghi nhận điều đó rồi quay về thao tác đang làm.',
      ],
    },
  ]
  const activeStage = stages[phaseIndex]
  const isComplete = status === 'COMPLETED'

  useEffect(() => {
    if (!running || remaining === 0) return
    const timeout = window.setTimeout(() => {
      setRemaining((value) => value - 1)
      if (remaining === 1) setRunning(false)
    }, 1000)
    return () => window.clearTimeout(timeout)
  }, [remaining, running])

  useEffect(() => {
    const audio = soundRef.current
    if (audio) audio.volume = volume / 100
  }, [volume])

  useEffect(() => {
    const audio = soundRef.current
    return () => {
      audio?.pause()
    }
  }, [])

  function stopSound() {
    const audio = soundRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    setSoundPlaying(false)
  }

  async function startSound() {
    try {
      const audio = soundRef.current
      if (!audio) return
      audio.volume = volume / 100
      await audio.play()
      setSoundPlaying(true)
      setSoundError(false)
    } catch {
      setSoundError(true)
      setSoundPlaying(false)
    }
  }

  function restart() {
    setRunning(false)
    setRemaining(durationSeconds)
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.toolbar}>
          <nav className={styles.breadcrumb} aria-label="Đường dẫn">
            <Link href={backHref}>
              <ArrowLeft size={17} aria-hidden="true" />
              {backLabel}
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{resource.title}</span>
          </nav>
          <span className={styles.typeTag}>
            <Leaf size={14} aria-hidden="true" /> Bài tập · Vừa sức ·{' '}
            {durationMinutes} phút
          </span>
        </div>

        <header className={styles.intro}>
          <span className={styles.eyebrow}>
            <i aria-hidden="true" /> Hướng dẫn nhận biết hiện tại
          </span>
          <h1>{resource.title}</h1>
          <p>{resource.summary}</p>
        </header>

        <section
          className={styles.practice}
          aria-labelledby="mindfulness-practice-title"
        >
          <h2 id="mindfulness-practice-title" className={styles.srOnly}>
            Thực hành nhận biết hiện tại
          </h2>
          <div className={styles.practiceVisual}>
            <div className={styles.scene}>
              <MindfulnessScene active={running} />
            </div>
            <div
              className={styles.timerRing}
              style={
                {
                  '--mindfulness-progress': `${(remaining / durationSeconds) * 100}%`,
                } as CSSProperties
              }
              role="timer"
              aria-label={`Thời gian còn lại ${formatTime(remaining)}`}
            >
              <div className={styles.timerInner}>
                <span>
                  <Clock3 size={14} aria-hidden="true" /> Thời gian còn lại
                </span>
                <strong>{formatTime(remaining)}</strong>
                <small>
                  {remaining === 0
                    ? 'Đã hết thời gian'
                    : `Chặng ${phaseIndex + 1}/3`}
                </small>
              </div>
            </div>
          </div>

          <div className={styles.guide} aria-live="polite">
            <div className={styles.guideMeta}>
              <span>
                <b>{phaseIndex + 1}</b> Phút {phaseIndex + 1}:{' '}
                {activeStage.title}
              </span>
              <time>
                {formatTime(phaseIndex * stageSeconds)} –{' '}
                {formatTime(
                  Math.min(durationSeconds, (phaseIndex + 1) * stageSeconds),
                )}
              </time>
            </div>
            <h3>{activeStage.title}</h3>
            <ul>
              {activeStage.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
            <span className={styles.guideInstructionLabel}>Thử làm theo</span>
            <ol className={styles.guideInstructions}>
              {activeStage.instructions.map((instruction) => (
                <li key={instruction}>{instruction}</li>
              ))}
            </ol>
            <p>{resource.contentBody}</p>
            <div
              className={styles.guideProgress}
              aria-label={`Chặng ${phaseIndex + 1} trong 3 chặng`}
            >
              <Waves size={17} aria-hidden="true" />
              <span>Đi theo nhịp riêng của bạn</span>
              <div>
                {stages.map((stage, index) => (
                  <i
                    key={stage.title}
                    className={index <= phaseIndex ? styles.filled : ''}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className={styles.audioControl}>
            <audio
              ref={soundRef}
              src="/audio/nhac-thien.mp3"
              preload="none"
              loop
              hidden
              onError={() => {
                setSoundError(true)
                setSoundPlaying(false)
              }}
            />
            <span className={styles.audioIcon}>
              <Headphones size={18} aria-hidden="true" />
            </span>
            <div>
              <small>Âm thanh thiền</small>
              <strong>Nhạc Thiền</strong>
            </div>
            <button
              type="button"
              aria-label={soundPlaying ? 'Tắt nhạc thiền' : 'Bật nhạc thiền'}
              aria-pressed={soundPlaying}
              onClick={() => (soundPlaying ? stopSound() : void startSound())}
            >
              {soundPlaying ? 'Tắt' : 'Bật'}
            </button>
          </div>

          <div className={styles.practiceControls}>
            <button
              type="button"
              className={styles.startButton}
              onClick={() => {
                if (remaining === 0) setRemaining(durationSeconds)
                setRunning((value) => !value)
              }}
            >
              {running ? (
                <Pause size={18} aria-hidden="true" />
              ) : (
                <Play size={18} aria-hidden="true" />
              )}
              {running
                ? 'Tạm dừng'
                : remaining === durationSeconds || remaining === 0
                  ? `Bắt đầu ${durationMinutes} phút`
                  : 'Tiếp tục bài tập'}
            </button>
            <button
              type="button"
              className={styles.restartButton}
              onClick={restart}
            >
              <RotateCcw size={17} aria-hidden="true" /> Bắt đầu lại
            </button>
            <div className={styles.volumeControl}>
              {volume === 0 ? (
                <VolumeX size={17} aria-hidden="true" />
              ) : (
                <Volume2 size={17} aria-hidden="true" />
              )}
              <Slider.Root
                className={styles.sliderRoot}
                value={[volume]}
                min={0}
                max={100}
                step={1}
                onValueChange={(value) => setVolume(value[0] ?? 0)}
                aria-label="Âm lượng nhạc thiền"
              >
                <Slider.Track className={styles.sliderTrack}>
                  <Slider.Range className={styles.sliderRange} />
                </Slider.Track>
                <Slider.Thumb
                  className={styles.sliderThumb}
                  aria-label="Âm lượng nhạc thiền"
                />
              </Slider.Root>
              <span>{volume}%</span>
            </div>
          </div>
          {soundError && (
            <p className={styles.audioError} role="alert">
              Chưa bật được âm thanh trên trình duyệt này. Bạn vẫn có thể tập
              không cần âm thanh.
            </p>
          )}
        </section>

        <section
          className={styles.stagesSection}
          aria-labelledby="mindfulness-stages-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="mindfulness-stages-title">
                Ba chặng, mỗi chặng một phút
              </h2>
              <p>Mỗi chặng có các bước ngắn để bạn làm theo trong một phút.</p>
            </div>
            <span>{durationMinutes} phút thực hành</span>
          </div>
          <div className={styles.stageGrid}>
            {stages.map((stage, index) => {
              const Icon = stage.icon
              return (
                <article
                  key={stage.title}
                  className={styles.stageCard}
                  data-active={phaseIndex === index}
                >
                  <div className={styles.stageCardTop}>
                    <span>
                      <Icon size={19} aria-hidden="true" />
                    </span>
                    <small>Chặng {String(index + 1).padStart(2, '0')}</small>
                  </div>
                  <h3>{stage.title}</h3>
                  <ul>
                    {stage.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                  <span className={styles.stageInstructionLabel}>
                    Làm theo từng bước
                  </span>
                  <ol className={styles.stageInstructions}>
                    {stage.instructions.map((instruction) => (
                      <li key={instruction}>{instruction}</li>
                    ))}
                  </ol>
                  <div className={styles.stageCardBottom}>
                    <span>
                      <Clock3 size={14} aria-hidden="true" />{' '}
                      {Math.min(
                        stageSeconds,
                        durationSeconds - index * stageSeconds,
                      )}{' '}
                      giây
                    </span>
                    <span>
                      {phaseIndex === index
                        ? 'Đang hiển thị'
                        : index < phaseIndex
                          ? 'Đã qua'
                          : 'Tiếp theo'}
                    </span>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        {(resource.sourceTitle || resource.sourceOrganization || sourceUrl) && (
          <section
            className={styles.sourceCard}
            aria-labelledby="mindfulness-source-title"
          >
            <div className={styles.sourceArt} aria-hidden="true">
              <div>
                <Leaf size={34} />
                <span />
                <span />
                <span />
              </div>
            </div>
            <div>
              <span className={styles.eyebrow}>Nguồn tham khảo</span>
              <h2 id="mindfulness-source-title">
                {resource.sourceTitle ||
                  resource.sourceOrganization ||
                  'Tài liệu nguồn'}
              </h2>
              <p>
                {resource.sourceOrganization
                  ? `Nội dung tham khảo từ ${resource.sourceOrganization}. `
                  : ''}
                Thực hành theo nhịp phù hợp với bạn; có thể dừng nếu thấy không
                thoải mái.
              </p>
            </div>
            {sourceUrl && (
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                Xem tài liệu nguồn <ExternalLink size={16} aria-hidden="true" />
              </a>
            )}
          </section>
        )}

        <section
          className={styles.progressCard}
          aria-labelledby="mindfulness-progress-title"
        >
          <span className={styles.progressIcon}>
            <Check size={22} aria-hidden="true" />
          </span>
          <div>
            <h2 id="mindfulness-progress-title">Ghi nhận lần thực hành</h2>
            <p>
              {progressState === 'loading'
                ? 'Đang tải tiến độ đã lưu…'
                : progressState === 'error'
                  ? message ||
                    'Chưa tải được tiến độ. Bạn vẫn có thể thực hành và thử tải lại trước khi ghi nhận.'
                  : isComplete
                    ? 'Lần thực hành này đã được ghi nhận.'
                    : 'Khi bạn xác nhận, MentalBridge sẽ lưu bài tập vào tiến độ Tài nguyên của bạn.'}
            </p>
          </div>
          {progressState === 'error' ? (
            <button type="button" onClick={onRetryProgress}>
              Thử lại
            </button>
          ) : (
            <button
              type="button"
              disabled={progressState !== 'ready' || saving || isComplete}
              onClick={onConfirm}
            >
              {isComplete
                ? 'Đã ghi nhận'
                : saving
                  ? 'Đang lưu…'
                  : 'Đánh dấu hoàn tất'}
            </button>
          )}
        </section>

        {Array.isArray(resource.safetyNotes) &&
          resource.safetyNotes.length > 0 && (
            <p className={styles.safetyNote}>
              {resource.safetyNotes.join(' ')}
            </p>
          )}
        <p className={styles.boundary}>
          Bài tập hỗ trợ tự chăm sóc, không dùng để chẩn đoán hoặc thay thế đánh
          giá và điều trị từ chuyên gia.
        </p>
      </div>

      <Dialog
        open={confirmationOpen}
        onOpenChange={onConfirmationOpenChange}
        labelledBy="mindfulness-confirm-title"
        describedBy="mindfulness-confirm-description"
        className={styles.confirmDialog}
      >
        <h2 id="mindfulness-confirm-title">Ghi nhận bài tập?</h2>
        <p id="mindfulness-confirm-description">
          MentalBridge sẽ lưu lần thực hành này vào tiến độ Tài nguyên. Bạn vẫn
          có thể quay lại tập vào lúc khác.
        </p>
        <div>
          <button type="button" onClick={() => onConfirmationOpenChange(false)}>
            Để sau
          </button>
          <button type="button" disabled={saving} onClick={onConfirmCompletion}>
            {saving ? 'Đang lưu…' : 'Xác nhận hoàn thành'}
          </button>
        </div>
      </Dialog>
    </main>
  )
}
