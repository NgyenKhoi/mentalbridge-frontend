import type { Emotion } from '@/lib/emotion-check-in/contract'
import styles from './MoodFace.module.css'

const mouths: Readonly<Record<Emotion, string>> = {
  GREAT: 'M10 19 C13 25 21 25 24 19',
  GOOD: 'M11 20 C14 23.5 20 23.5 23 20',
  OKAY: 'M11.5 21.5 H22.5',
  LOW: 'M11 23 C14 20 20 20 23 23',
  VERY_LOW: 'M10 24 C13 18.5 21 18.5 24 24',
}

export function MoodFace({
  emotion,
  size = 36,
}: Readonly<{ emotion: Emotion; size?: number }>) {
  return (
    <svg
      className={`${styles.face} ${styles[emotion]}`}
      width={size}
      height={size}
      viewBox="0 0 34 34"
      aria-hidden="true"
    >
      <circle cx="17" cy="17" r="16" className={styles.fill} />
      <circle cx="12" cy="14" r="1.6" fill="var(--ink)" />
      <circle cx="22" cy="14" r="1.6" fill="var(--ink)" />
      <path
        d={mouths[emotion]}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
