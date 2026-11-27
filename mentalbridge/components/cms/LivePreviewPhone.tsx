'use client'

import { useEffect, useState } from 'react'
import { Monitor, Pause, Play, Smartphone, Tablet } from 'lucide-react'

import type { CmsEditorState } from './cms-types'
import styles from './cms-editor.module.css'

type Device = 'phone' | 'tablet' | 'desktop'

const devices = [
  { id: 'phone', label: 'Điện thoại', Icon: Smartphone },
  { id: 'tablet', label: 'Máy tính bảng', Icon: Tablet },
  { id: 'desktop', label: 'Máy tính', Icon: Monitor },
] as const

const categories: Record<CmsEditorState['category'], string> = {
  ARTICLE: 'Bài viết',
  BREATHING: 'Bài tập thở',
  MEDITATION: 'Thiền định',
  VIDEO: 'Video thực hành',
  JOURNALING: 'Nhật ký',
  COMMUNITY: 'Cộng đồng',
}

function webUrl(value: string) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url : null
  } catch {
    return null
  }
}

function videoEmbed(url: URL) {
  if (url.protocol !== 'https:') return null
  const host = url.hostname.replace(/^www\./, '')
  const id =
    host === 'youtu.be'
      ? url.pathname.split('/')[1]
      : ['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)
        ? (url.searchParams.get('v') ??
          url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1])
        : null
  return id && /^[\w-]{11}$/.test(id)
    ? `https://www.youtube-nocookie.com/embed/${id}`
    : null
}

function BreathingPreview({
  inhale,
  hold,
  exhale,
}: {
  inhale: number
  hold: number
  exhale: number
}) {
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(
      () => setElapsed((value) => value + 1),
      1000,
    )
    return () => window.clearInterval(timer)
  }, [playing])

  const total = inhale + hold + exhale
  const position = total > 0 ? elapsed % total : 0
  const phase =
    position < inhale
      ? { label: 'Hít vào', ends: inhale, style: styles.lotusInhale }
      : position < inhale + hold
        ? { label: 'Giữ nhẹ', ends: inhale + hold, style: styles.lotusHold }
        : { label: 'Thở ra', ends: total, style: styles.lotusExhale }

  return (
    <div className={styles.phoneBreathingWidget}>
      <div className={styles.pacerFormulaPill}>
        <span>Hít {inhale}s</span>
        {hold > 0 && <span>Giữ {hold}s</span>}
        <span>Thở {exhale}s</span>
      </div>
      <div className={styles.breathingGraphicBox}>
        <div className={styles.lotusCanvasWrapper}>
          <div className={`${styles.lotusFlowerCircle} ${phase.style}`}>
            <div className={styles.lotusInnerCenter}>
              <span className={styles.lotusPhaseText}>
                {playing ? phase.label : 'Sẵn sàng'}
              </span>
              {playing && (
                <span className={styles.lotusSeconds}>
                  {phase.ends - position}s
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          className={styles.pacerPlayBtn}
          onClick={() => {
            if (!playing) setElapsed(0)
            setPlaying(!playing)
          }}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
          {playing ? 'Tạm dừng' : 'Bắt đầu nhịp thở'}
        </button>
      </div>
    </div>
  )
}

export default function LivePreviewPhone({
  data,
  contentBody,
  safetyNotes,
  previewDevice,
  onDeviceChange,
}: {
  data: CmsEditorState
  contentBody: string
  safetyNotes: readonly string[]
  previewDevice: Device
  onDeviceChange: (device: Device) => void
}) {
  const device = devices.find(({ id }) => id === previewDevice)!
  const external = webUrl(data.videoUrl)
  const embed = external && videoEmbed(external)
  const notes = [data.safetyNotesText, ...safetyNotes].filter(Boolean)
  const cover =
    data.coverUrl.startsWith('/') && !data.coverUrl.startsWith('//')
      ? data.coverUrl
      : webUrl(data.coverUrl)?.href
  const source = webUrl(data.sourceUrl)
  const level = {
    EASY: 'Dễ chịu',
    MODERATE: 'Vừa sức',
    CHALLENGING: 'Thử thách nhẹ',
    '': '',
  }[data.practiceLevel]
  const frame = {
    phone: styles.phoneMockupPhone,
    tablet: styles.phoneMockupTablet,
    desktop: styles.phoneMockupDesktop,
  }

  return (
    <section
      className={styles.previewContainer}
      aria-label="Xem trước thời gian thực"
    >
      <div className={styles.previewPanelHeader}>
        <div className={styles.previewPanelTitle}>
          <span className={styles.previewLiveDot} />
          <strong>XEM TRƯỚC THỜI GIAN THỰC</strong>
        </div>
        <div
          className={styles.deviceSwitcher}
          role="group"
          aria-label="Thiết bị xem trước"
        >
          {devices.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={`${styles.deviceBtn} ${previewDevice === id ? styles.deviceBtnActive : ''}`}
              aria-label={label}
              aria-pressed={previewDevice === id}
              title={label}
              onClick={() => onDeviceChange(id)}
            >
              <Icon size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      <div
        className={`${styles.phoneMockupFrame} ${frame[previewDevice]}`}
        data-cms-preview-device={previewDevice}
      >
        <header className={styles.deviceChrome}>
          <device.Icon size={14} aria-hidden="true" />
          <span>{device.label}</span>
          {previewDevice === 'desktop' && (
            <span className={styles.browserAddress}>
              Tài nguyên tự chăm sóc
            </span>
          )}
        </header>
        <div className={styles.phoneScrollArea} key={previewDevice}>
          {data.activeBlocks.map((block, index) => {
            const key = `${block}-${index}`
            switch (block) {
              case 'hero':
                return (
                  <div key={key} className={styles.phoneHeroSection}>
                    {cover && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className={styles.previewCover}
                        src={cover}
                        alt={data.altText}
                      />
                    )}
                    <div className={styles.phoneBadgesRow}>
                      <span className={styles.phoneBadgeCategory}>
                        {categories[data.category]}
                      </span>
                      {level && (
                        <span className={styles.phoneBadgeLevel}>{level}</span>
                      )}
                      {data.durationSeconds > 0 && (
                        <span className={styles.phoneBadgeDuration}>
                          {Math.round(data.durationSeconds / 60)} phút
                        </span>
                      )}
                    </div>
                    <h2 className={styles.phoneArticleTitle}>
                      {data.title || 'Tiêu đề tài nguyên'}
                    </h2>
                    {data.shortSummary && (
                      <p className={styles.phoneSummaryCard}>
                        {data.shortSummary}
                      </p>
                    )}
                    {contentBody && (
                      <p className={styles.previewContentBody}>{contentBody}</p>
                    )}
                    {external &&
                      !data.activeBlocks.includes('video') &&
                      !data.activeBlocks.includes('audio') && (
                        <a
                          href={external.href}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Mở tài nguyên
                        </a>
                      )}
                  </div>
                )
              case 'breathing':
                return (
                  <BreathingPreview
                    key={key}
                    inhale={data.inhaleSeconds}
                    hold={data.holdSeconds}
                    exhale={data.exhaleSeconds}
                  />
                )
              case 'video':
                return (
                  <div key={key} className={styles.phoneVideoWidget}>
                    {embed ? (
                      <iframe
                        className={styles.previewVideo}
                        src={embed}
                        title={data.title || 'Video tài nguyên'}
                        loading="lazy"
                        allowFullScreen
                      />
                    ) : external ? (
                      /\.(mp4|webm|ogg)$/i.test(external.pathname) ? (
                        <video
                          className={styles.previewVideo}
                          controls
                          preload="none"
                          src={external.href}
                        />
                      ) : (
                        <a
                          href={external.href}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Mở video
                        </a>
                      )
                    ) : (
                      <p>Chưa có liên kết video.</p>
                    )}
                    {data.videoMilestones.length > 0 && (
                      <ul>
                        {data.videoMilestones.map(({ id, time, label }) => (
                          <li key={id}>
                            {time} · {label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              case 'checklist':
                return (
                  data.checklistSteps.length > 0 && (
                    <div key={key} className={styles.phoneChecklistWidget}>
                      <h3 className={styles.phoneSectionHeading}>
                        Các bước thực hành
                      </h3>
                      <ol className={styles.phoneStepsList}>
                        {data.checklistSteps.map((step, i) => (
                          <li key={step.id} className={styles.phoneStepItem}>
                            <span
                              className={styles.stepNumberCircle}
                              aria-hidden="true"
                            >
                              {i + 1}
                            </span>
                            <div className={styles.stepContentCol}>
                              <strong className={styles.stepName}>
                                {step.name}
                              </strong>
                              {step.description && (
                                <p className={styles.stepDescription}>
                                  {step.description}
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )
                )
              case 'quote':
                return (
                  data.quoteText && (
                    <blockquote key={key} className={styles.phoneQuoteWidget}>
                      <p className={styles.quoteBody}>{data.quoteText}</p>
                      {data.quoteAuthor && (
                        <cite className={styles.quoteAuthor}>
                          {data.quoteAuthor}
                        </cite>
                      )}
                    </blockquote>
                  )
                )
              case 'audio':
                return (
                  <div key={key} className={styles.phoneAudioWidget}>
                    {data.audioTitle && <strong>{data.audioTitle}</strong>}
                    {data.audioFrequency && <p>{data.audioFrequency}</p>}
                    {external ? (
                      <audio controls preload="none" src={external.href} />
                    ) : (
                      <p>Chưa có liên kết âm thanh.</p>
                    )}
                  </div>
                )
              case 'mood_slider':
                return (
                  <label key={key} className={styles.phoneMoodWidget}>
                    <span>Thang cảm xúc</span>
                    <input type="range" min="0" max="10" defaultValue="5" />
                    <small>
                      {data.moodScaleMin} · {data.moodScaleMax}
                    </small>
                  </label>
                )
              case 'safety':
                return (
                  notes.length > 0 && (
                    <div key={key} className={styles.phoneSafetyWidget}>
                      <strong>Lưu ý an toàn</strong>
                      <ul>
                        {notes.map((note, i) => (
                          <li key={i}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  )
                )
              case 'evidence':
                return (
                  (data.sourceOrg || data.sourceDocTitle) && (
                    <div key={key} className={styles.phoneEvidenceFootnote}>
                      <span>{data.sourceOrg}</span>
                      {source && (
                        <a href={source.href} target="_blank" rel="noreferrer">
                          {data.sourceDocTitle || 'Mở nguồn'}
                        </a>
                      )}
                    </div>
                  )
                )
            }
          })}
        </div>
      </div>
    </section>
  )
}
