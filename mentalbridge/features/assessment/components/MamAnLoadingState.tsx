import { useId } from 'react'

import styles from './MamAnLoadingState.module.css'

type MamAnLoadingStateProps = Readonly<{
  title: string
  description: string
  headingLevel?: 'h1' | 'h2' | 'h3'
  preview?: 'history' | 'meaning'
  className?: string
}>

function MamAnMascot() {
  const bodyGradientId = useId()
  const leafGradientId = useId()

  return (
    <div className={styles.mascotStage} aria-hidden="true">
      <span className={styles.aura} />
      <span className={`${styles.orbitDot} ${styles.orbitDotOne}`} />
      <span className={`${styles.orbitDot} ${styles.orbitDotTwo}`} />
      <span className={`${styles.orbitDot} ${styles.orbitDotThree}`} />
      <svg
        className={styles.mascot}
        viewBox="0 0 120 120"
        fill="none"
        focusable="false"
      >
        <defs>
          <linearGradient
            id={bodyGradientId}
            x1="60"
            x2="60"
            y1="30"
            y2="104"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#ffffff" />
            <stop offset="0.62" stopColor="#f2f7f3" />
            <stop offset="1" stopColor="#dfece4" />
          </linearGradient>
          <linearGradient
            id={leafGradientId}
            x1="48"
            x2="78"
            y1="7"
            y2="24"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#6bb086" />
            <stop offset="1" stopColor="#28583e" />
          </linearGradient>
        </defs>
        <ellipse
          cx="60"
          cy="112"
          rx="28"
          ry="4"
          fill="#1e3a34"
          fillOpacity="0.09"
        />
        <path
          d="M60 32c22 0 34 16 34 36s-14 34-34 34-34-14-34-34 12-36 34-36Z"
          fill={`url(#${bodyGradientId})`}
          stroke="#cad7cf"
          strokeWidth="2"
        />
        <g className={styles.leaves}>
          <path
            d="M60 34q0-14 3-18"
            stroke="#28583e"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M61 22C51 19 46 12 51 7c7 0 10 9 10 15Z"
            fill={`url(#${leafGradientId})`}
          />
          <path d="M62 20c7-2 11-9 15-5 0 5-7 7-15 5Z" fill="#78bf93" />
        </g>
        <circle cx="44" cy="73" r="5.5" fill="#f4a582" fillOpacity="0.42" />
        <circle cx="76" cy="73" r="5.5" fill="#f4a582" fillOpacity="0.42" />
        <path
          d="M44 64q5-6 10 0M66 64q5-6 10 0M56 73q4 5 8 0"
          stroke="#1e3a34"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M60 86c-2-3-2-6 0-7 2 1 2 4 0 7Z"
          fill="#88b89a"
          fillOpacity="0.65"
        />
      </svg>
    </div>
  )
}

function LoadingPreview({ type }: Readonly<{ type: 'history' | 'meaning' }>) {
  if (type === 'history') {
    return (
      <div className={styles.historyPreview} aria-hidden="true">
        {[0, 1].map((item) => (
          <div className={styles.historyCard} key={item}>
            <div className={styles.previewHeader}>
              <span className={styles.lineMedium} />
              <span className={styles.pill} />
            </div>
            <div className={styles.previewScores}>
              <span />
              <span />
            </div>
            <span className={styles.lineLong} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={styles.meaningPreview} aria-hidden="true">
      <div className={styles.progressPreview}>
        {[0, 1, 2, 3].map((item) => (
          <span key={item} />
        ))}
      </div>
      <div className={styles.meaningCards}>
        <div>
          <span className={styles.lineShort} />
          <span className={styles.scoreBlock} />
          <span className={styles.lineLong} />
        </div>
        <div>
          <span className={styles.lineShort} />
          <span className={styles.scoreBlock} />
          <span className={styles.lineLong} />
        </div>
      </div>
    </div>
  )
}

export function MamAnLoadingState({
  title,
  description,
  headingLevel = 'h2',
  preview = 'meaning',
  className,
}: MamAnLoadingStateProps) {
  const Heading = headingLevel

  return (
    <section
      className={[styles.loading, className].filter(Boolean).join(' ')}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={title}
    >
      <div className={styles.companion}>
        <MamAnMascot />
        <div className={styles.copy}>
          <span className={styles.statusBadge}>
            <span aria-hidden="true" />
            Mầm An đang đồng hành
          </span>
          <Heading>{title}</Heading>
          <p>{description}</p>
          <span className={styles.breathingCue} aria-hidden="true">
            <span /> Hít vào nhẹ nhàng · Thở ra chậm rãi
          </span>
        </div>
      </div>
      <LoadingPreview type={preview} />
    </section>
  )
}
