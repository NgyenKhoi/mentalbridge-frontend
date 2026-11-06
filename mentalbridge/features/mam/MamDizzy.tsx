'use client'

import { useEffect, useState } from 'react'

import styles from './MamDizzy.module.css'

// The eye centres in the 96 px character box (fallback SVG and Rive layout).
const EYES = [41.5, 54.5] as const
const SWIRL =
  'a.7 .7 0 1 1 1.2 .2 a1.5 1.5 0 1 1 -2.8 -.2 a2.3 2.3 0 1 1 4.4 .4'
const STAR =
  'M0 -5.2 L1.6 -1.6 L5.2 0 L1.6 1.6 L0 5.2 L-1.6 1.6 L-5.2 0 L-1.6 -1.6Z'
// Calm: the swirl and the orbit run for 8 s, then rest, still readable.
const PLAY_MS = 8000

/**
 * Mầm is broken (renderer failure, MB-814 design §E): swirl eyes, a wobbly
 * mouth and three stars orbiting above the head, drawn by the host because Rive
 * itself is usually what failed. The body stays still. The motion plays for 8 s
 * after the component mounts (the host remounts it each time the dizzy message
 * opens) and then settles; `still` (reduced motion) never plays it.
 */
export function MamDizzy({
  size,
  still,
}: Readonly<{ size: number; still: boolean }>) {
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (still) return
    const timer = setTimeout(() => setSettled(true), PLAY_MS)
    return () => clearTimeout(timer)
  }, [still])
  return (
    <span
      className={styles.root}
      style={{ width: size, height: size }}
      data-still={still || settled}
      aria-hidden="true"
    >
      <span className={styles.art} style={{ scale: size / 96 }}>
        <svg viewBox="0 0 96 96" width="96" height="96" overflow="visible">
          {EYES.map((cx) => (
            <g key={cx}>
              <ellipse
                cx={cx}
                cy="55.4"
                rx="4.6"
                ry="5.2"
                className={styles.patch}
              />
              <g className={styles.swirl}>
                <path
                  d={`M${cx} 55.6 ${SWIRL}`}
                  className={styles.stroke}
                  strokeWidth="1.5"
                />
              </g>
            </g>
          ))}
          <ellipse cx="48" cy="62" rx="5.6" ry="2.6" className={styles.patch} />
          <path
            d="M43.8 62.2 q1.3 -1.9 2.6 0 t2.6 0 t2.6 0 t2.6 0"
            className={styles.stroke}
            strokeWidth="1.3"
          />
          {[0, 1, 2].map((index) => (
            <g key={index} transform="translate(48 10)">
              <g className={styles.star} data-star={index}>
                <path d={STAR} />
              </g>
            </g>
          ))}
        </svg>
      </span>
    </span>
  )
}
