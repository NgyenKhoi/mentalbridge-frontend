'use client'

import { Clock3, X } from 'lucide-react'
import { useId, useState } from 'react'

import { Skeleton } from '@/components/ui/Skeleton'

import styles from './MamAnLoadingState.module.css'

type MamAnLoadingStateProps = Readonly<{
  title: string
  description: string
  headingLevel?: 'h1' | 'h2' | 'h3'
  preview?: 'history' | 'meaning'
  className?: string
}>

function HistoryMamAnMascot() {
  const bodyGradientId = useId()
  const leafGradientId = useId()

  return (
    <div className={styles.mascotStage} aria-hidden="true">
      <span className={styles.aura} />
      <span className={styles.auraRing} />
      <span className={`${styles.orbitDot} ${styles.orbitDotOne}`} />
      <span className={`${styles.orbitDot} ${styles.orbitDotTwo}`} />
      <span className={`${styles.orbitDot} ${styles.orbitDotThree}`} />
      <svg
        className={`${styles.mascot} ${styles.desktopMascot}`}
        fill="none"
        viewBox="0 0 120 120"
        focusable="false"
      >
        <ellipse
          cx="60"
          cy="106"
          rx="26"
          ry="5"
          fill="#1E3A34"
          fillOpacity="0.1"
        />
        <g className={styles.leaves}>
          <path
            d="M60 48C59.5 41 58 36 57 32"
            stroke="#2F6659"
            strokeLinecap="round"
            strokeWidth="2.5"
          />
          <path
            d="M57 33C50 31 43 35 44 42C49 43 55 38 57 33Z"
            fill="#529B78"
            stroke="#1E3A34"
            strokeLinejoin="round"
            strokeWidth="1.2"
          />
          <path
            d="M57 33C64 28 72 32 71 39C66 41 60 38 57 33Z"
            fill="#78BF9B"
            stroke="#1E3A34"
            strokeLinejoin="round"
            strokeWidth="1.2"
          />
          <circle cx="68" cy="33" r="1.2" fill="#FFFFFF" />
        </g>
        <path
          d="M60 45C42 45 32 57 32 72C32 87 43 98 60 98C77 98 88 87 88 72C88 57 78 45 60 45Z"
          fill="#F8FBF8"
          stroke="#264A43"
          strokeLinecap="round"
          strokeWidth="2"
        />
        <path
          d="M60 55C48 55 40 64 40 76C40 86 48 93 60 93C72 93 80 86 80 76C80 64 72 55 60 55Z"
          fill="#E8F2EA"
          fillOpacity="0.6"
        />
        <ellipse
          cx="44"
          cy="74"
          rx="4.5"
          ry="3"
          fill="#FCA5A5"
          fillOpacity="0.55"
        />
        <ellipse
          cx="76"
          cy="74"
          rx="4.5"
          ry="3"
          fill="#FCA5A5"
          fillOpacity="0.55"
        />
        <g className={styles.eyes}>
          <path
            d="M48 68C49.5 65.5 53 65.5 54.5 68M65.5 68C67 65.5 70.5 65.5 72 68"
            stroke="#1E3A34"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </g>
        <path
          d="M56.5 75C58 77.5 62 77.5 63.5 75"
          stroke="#1E3A34"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
        <path
          d="M34 76C37 78 42 77 44 74M86 76C83 78 78 77 76 74"
          stroke="#264A43"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </svg>
      <svg
        className={`${styles.mascot} ${styles.mobileMascot}`}
        fill="none"
        viewBox="0 0 120 120"
        focusable="false"
      >
        <defs>
          <linearGradient id={bodyGradientId} x1="0%" x2="0%" y1="0%" y2="100%">
            <stop stopColor="#FFFFFF" />
            <stop offset="0.6" stopColor="#F2F7F3" />
            <stop offset="1" stopColor="#E1ECE5" />
          </linearGradient>
          <linearGradient
            id={leafGradientId}
            x1="0%"
            x2="100%"
            y1="0%"
            y2="100%"
          >
            <stop stopColor="#6BB086" />
            <stop offset="1" stopColor="#28583E" />
          </linearGradient>
        </defs>
        <ellipse
          cx="60"
          cy="112"
          rx="28"
          ry="4"
          fill="#1E3A34"
          fillOpacity="0.08"
        />
        <path
          d="M60 32C82 32 94 48 94 68C94 88 80 102 60 102C40 102 26 88 26 68C26 48 38 32 60 32Z"
          fill={`url(#${bodyGradientId})`}
          stroke="#CAD7CF"
          strokeWidth="2"
        />
        <g className={styles.leaves}>
          <path
            d="M60 34Q60 20 63 16"
            stroke="#28583E"
            strokeLinecap="round"
            strokeWidth="2.5"
          />
          <path
            d="M61 22C51 19 46 12 51 7C58 7 61 16 61 22Z"
            fill={`url(#${leafGradientId})`}
          />
          <path
            d="M62 20C69 18 73 11 77 15C77 20 70 22 62 20Z"
            fill="#78BF93"
          />
        </g>
        <circle cx="44" cy="73" r="5.5" fill="#F4A582" fillOpacity="0.42" />
        <circle cx="76" cy="73" r="5.5" fill="#F4A582" fillOpacity="0.42" />
        <g className={styles.eyes}>
          <path
            d="M44 64Q49 58 54 64M66 64Q71 58 76 64"
            stroke="#1E3A34"
            strokeLinecap="round"
            strokeWidth="2.5"
          />
        </g>
        <path
          d="M56 73Q60 78 64 73"
          stroke="#1E3A34"
          strokeLinecap="round"
          strokeWidth="2.5"
        />
        <path
          d="M60 86C58 83 58 80 60 79C62 80 62 83 60 86Z"
          fill="#88B89A"
          fillOpacity="0.65"
        />
      </svg>
    </div>
  )
}

function MamAnMascot() {
  const bodyGradientId = useId()
  const leafGradientId = useId()
  const blushGradientId = useId()

  return (
    <div className={styles.mascotStage} aria-hidden="true">
      <span className={styles.aura} />
      <span className={styles.auraRing} />
      <svg
        className={`${styles.mascot} ${styles.desktopMascot}`}
        viewBox="0 0 120 120"
        fill="none"
        focusable="false"
      >
        <defs>
          <linearGradient
            id={bodyGradientId}
            x1="20"
            x2="100"
            y1="20"
            y2="105"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#FFFFFF" />
            <stop offset="0.5" stopColor="#EAF5EE" />
            <stop offset="1" stopColor="#D4EAD9" />
          </linearGradient>
          <linearGradient
            id={leafGradientId}
            x1="0"
            x2="24"
            y1="0"
            y2="24"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#34A853" />
            <stop offset="1" stopColor="#1C4D43" />
          </linearGradient>
          <radialGradient id={blushGradientId} cx="50%" cy="50%" r="50%">
            <stop stopColor="#F9A8A8" stopOpacity="0.85" />
            <stop offset="1" stopColor="#F9A8A8" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse
          cx="60"
          cy="110"
          rx="26"
          ry="5.5"
          fill="#1C4D43"
          fillOpacity="0.12"
        />
        <g className={styles.leaves}>
          <path
            d="M60 40C60 30 58 22 53 17"
            stroke="#245E52"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path
            d="M53 17C46 10 48 3 58 5C65 6 62 15 53 17Z"
            fill={`url(#${leafGradientId})`}
          />
          <path
            d="M57 24C64 22 70 25 68 31C64 34 59 30 57 24Z"
            fill="#2E7D32"
            opacity="0.9"
          />
          <circle cx="54" cy="9" r="1.5" fill="#E8F5E9" opacity="0.6" />
        </g>
        <path
          d="M60 38C36 38 22 56 24 80C26 99 42 108 60 108C78 108 94 99 96 80C98 56 84 38 60 38Z"
          fill={`url(#${bodyGradientId})`}
          stroke="#1C4D43"
          strokeOpacity="0.15"
          strokeWidth="1.8"
        />
        <path
          d="M40 50C48 44 72 44 80 50"
          stroke="#FFFFFF"
          opacity="0.8"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="39" cy="77" r="6" fill={`url(#${blushGradientId})`} />
        <circle cx="81" cy="77" r="6" fill={`url(#${blushGradientId})`} />
        <g className={styles.eyes}>
          <path
            d="M43 69C45 65 49 65 51 69M69 69C71 65 75 65 77 69"
            stroke="#1C4D43"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </g>
        <path
          d="M56 76C58 79.5 62 79.5 64 76"
          stroke="#1C4D43"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M41 87C46 91 54 91 58 87M79 87C74 91 66 91 62 87"
          stroke="#245E52"
          strokeOpacity="0.3"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <svg
        className={`${styles.mascot} ${styles.mobileMascot}`}
        viewBox="0 0 100 100"
        fill="none"
        focusable="false"
      >
        <g className={styles.leaves}>
          <path
            d="M50 28C49 18 43 14 38 15C33 16 36 24 48 27Z"
            fill="#4E8C78"
          />
          <path
            d="M50 28C53 19 61 16 65 18C69 20 64 27 51 28Z"
            fill="#68A793"
          />
          <path
            d="M50 28Q50 34 50 36"
            stroke="#3D7564"
            strokeLinecap="round"
            strokeWidth="2.5"
          />
        </g>
        <ellipse
          cx="50"
          cy="58"
          rx="27"
          ry="25"
          fill="#CADED3"
          stroke="#A7C7B7"
          strokeWidth="1.5"
        />
        <ellipse cx="44" cy="52" rx="19" ry="17" fill="#E8F1EC" />
        <circle cx="36" cy="62" r="4.5" fill="#F4A261" fillOpacity="0.38" />
        <circle cx="64" cy="62" r="4.5" fill="#F4A261" fillOpacity="0.38" />
        <path
          d="M36 55Q40 51 44 55M56 55Q60 51 64 55"
          stroke="#1C4D43"
          strokeLinecap="round"
          strokeWidth="2"
        />
        <path
          d="M46 64Q50 67 54 64"
          stroke="#1C4D43"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
        <path
          d="M43 69Q50 73 57 69"
          stroke="#3D7564"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    </div>
  )
}

function LoadingPreview({ type }: Readonly<{ type: 'history' | 'meaning' }>) {
  if (type === 'history') {
    return (
      <div
        className={styles.historyPreview}
        data-loading-preview="history"
        aria-hidden="true"
      >
        {[0, 1].map((item) => (
          <div
            className={styles.historyCard}
            data-skeleton-part="history-card"
            key={item}
          >
            <div className={styles.previewHeader}>
              <Skeleton className={styles.lineMedium} />
              <Skeleton className={styles.pill} />
            </div>
            <div className={styles.previewScores}>
              <Skeleton />
              <Skeleton />
            </div>
            <Skeleton className={styles.lineLong} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className={styles.meaningPreview}
      data-loading-preview="meaning"
      aria-hidden="true"
    >
      <div className={styles.progressPreview} data-skeleton-region="stepper">
        <Skeleton className={styles.progressNode} />
        <Skeleton className={styles.progressConnector} />
        <Skeleton className={styles.progressNode} />
        <Skeleton className={styles.progressConnector} />
        <Skeleton className={styles.progressNode} />
        <Skeleton className={styles.progressConnector} />
        <Skeleton className={styles.progressNode} />
      </div>
      <div className={styles.meaningCards}>
        {[0, 1].map((item) => (
          <div data-skeleton-part="score-card" key={item}>
            <div className={styles.scoreHeader}>
              <Skeleton className={styles.lineShort} />
              <Skeleton className={styles.pill} />
            </div>
            <Skeleton className={styles.scoreBlock} />
            <div className={styles.segmentedScale}>
              {[0, 1, 2, 3].map((segment) => (
                <Skeleton key={segment} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={styles.summaryPreview} data-skeleton-part="meaning-card">
        <Skeleton className={styles.summaryTitle} />
        <Skeleton className={styles.summaryLineLong} />
        <Skeleton className={styles.summaryLineMedium} />
        <div className={styles.summaryActions}>
          <Skeleton />
          <Skeleton />
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
  const [showBreathingCue, setShowBreathingCue] = useState(true)

  return (
    <section
      className={[
        styles.loading,
        preview === 'history' && styles.historyLoading,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      data-purpose="mam-an-loading-skeleton-state"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={title}
    >
      <div className={styles.companion}>
        <div className={styles.companionPrimary}>
          {preview === 'history' ? <HistoryMamAnMascot /> : <MamAnMascot />}
          <div className={styles.copy}>
            <span className={styles.statusBadge}>
              <span aria-hidden="true" />
              <span className={styles.desktopBadge}>Mầm An đang đồng hành</span>
              <span className={styles.mobileBadge}>Đang xử lý kết quả</span>
            </span>
            <Heading>{title}</Heading>
            <p>{description}</p>
          </div>
        </div>
        {showBreathingCue && (
          <aside
            className={styles.microBreath}
            aria-label="Gợi ý nhịp thở vi mô"
          >
            <span className={styles.microBreathIcon} aria-hidden="true">
              <Clock3 />
            </span>
            <span className={styles.microBreathCopy}>
              <span>Nhịp thở vi mô</span>
              <strong>Hít vào nhẹ nhàng…</strong>
            </span>
            <button
              className={styles.dismissBreathingCue}
              type="button"
              aria-label="Ẩn gợi ý nhịp thở"
              onClick={() => setShowBreathingCue(false)}
            >
              <span>Đóng</span>
              <X aria-hidden="true" />
            </button>
          </aside>
        )}
      </div>
      <LoadingPreview type={preview} />
    </section>
  )
}
