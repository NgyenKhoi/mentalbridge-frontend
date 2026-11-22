'use client'

import { useId, useImperativeHandle, useRef, type Ref } from 'react'
import { motion, useTransform, type MotionValue } from 'framer-motion'

import styles from './MamAirplane.module.css'

// The welcome plane (MB-894, docs/ADR_MAM_RIVE_V2_CONTRACT.md). Drawn in the character's artboard
// space (512 units = the character box) and flying right; the host flips it with `scaleX`. Mầm sits
// between the two layers: the back layer is the cockpit hollow and the far wings, the front layer the
// fuselage rim that hides her belly and feet. Decorative: no pointer events, no text, hidden from AT.

const C = {
  cream: '#F5EEDC',
  hull: '#FBF3E2',
  line: '#3E6B64',
  leaf: '#9CBF7E',
  leafFar: '#86A96B',
  vein: '#5E8A5B',
  amber: '#E0A448',
  amberLine: '#B07A26',
  ink: '#2F5A53',
}
const FUSELAGE =
  'M-60 430 C-40 404 60 398 150 404 L150 412 Q256 426 362 412 L362 404 C420 402 470 420 478 452 C482 480 460 500 420 502 L40 498 C-10 494 -50 470 -60 430 Z'

export interface MamPlaneValues {
  planeX: MotionValue<number>
  planeY: MotionValue<number>
  planeRotate: MotionValue<number>
  planeDir: MotionValue<number>
  planeSquash: MotionValue<number>
  planeGroundBlob: MotionValue<number>
  planeOpacity: MotionValue<number>
}

export function MamAirplane({
  layer,
  size,
  values,
}: Readonly<{
  layer: 'back' | 'front'
  size: number
  values: MamPlaneValues
}>) {
  const clip = useId()
  return (
    <motion.svg
      className={styles.plane}
      data-mam-plane={layer}
      viewBox="0 0 512 512"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      style={{
        x: values.planeX,
        y: values.planeY,
        rotate: values.planeRotate,
        scaleX: values.planeDir,
        scaleY: values.planeSquash,
        // The body's own pivot, so the seated Mầm and the plane bank around one point.
        originX: 0.5,
        originY: 0.62,
      }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
    >
      {/* The departure fade drives the shared value here; the svg itself only runs the cancel fade. */}
      <motion.g style={{ opacity: values.planeOpacity }}>
        {layer === 'back' ? (
          <g>
            <ellipse
              cx="256"
              cy="414"
              rx="112"
              ry="14"
              fill={C.ink}
              opacity=".3"
            />
            <path
              d="M368 406 Q384 386 420 388 Q446 392 440 408 Z"
              fill={C.leafFar}
              stroke={C.line}
              strokeWidth="6"
              strokeLinejoin="round"
            />
            <ellipse
              cx="-24"
              cy="404"
              rx="34"
              ry="9"
              fill={C.leafFar}
              stroke={C.line}
              strokeWidth="5"
            />
          </g>
        ) : (
          <g strokeLinejoin="round" strokeLinecap="round">
            <clipPath id={clip}>
              <path d={FUSELAGE} />
            </clipPath>
            <path
              d="M-48 432 L-74 338 Q-70 322 -52 330 L22 408 Z"
              fill={C.hull}
              stroke={C.line}
              strokeWidth="6"
            />
            <path
              d="M-73 336 Q-70 323 -53 331 L-38 348 Q-58 350 -73 336 Z"
              fill={C.amber}
              stroke={C.amberLine}
              strokeWidth="3"
            />
            <path d={FUSELAGE} fill={C.hull} stroke={C.line} strokeWidth="6" />
            <path
              d="M-30 462 C80 470 300 472 470 462"
              fill="none"
              stroke={C.amber}
              strokeWidth="10"
              clipPath={`url(#${clip})`}
            />
            <path
              d="M0 0 C-8 -16 -34 -22 -48 -10 C-36 4 -14 8 0 0 Z"
              transform="translate(70 462) scale(.7) rotate(180)"
              fill={C.leaf}
              stroke={C.line}
              strokeWidth="5"
            />
            <path
              d="M150 452 L338 452 Q378 456 356 478 L184 504 Q134 508 150 452 Z"
              fill={C.leaf}
              stroke={C.line}
              strokeWidth="6"
            />
            <path
              d="M170 470 L336 466"
              stroke={C.vein}
              strokeWidth="4"
              fill="none"
            />
            <path
              d="M200 498 L192 540 M330 498 L338 540"
              stroke={C.line}
              strokeWidth="7"
              fill="none"
            />
            {[192, 338].map((x) => (
              <g key={x}>
                <circle
                  cx={x}
                  cy="548"
                  r="18"
                  fill={C.ink}
                  stroke={C.line}
                  strokeWidth="4"
                />
                <circle cx={x} cy="548" r="6" fill={C.hull} />
              </g>
            ))}
            <circle
              cx="482"
              cy="452"
              r="16"
              fill={C.amber}
              stroke={C.amberLine}
              strokeWidth="4"
            />
            <ellipse
              cx="486"
              cy="452"
              rx="6"
              ry="66"
              fill={C.cream}
              opacity=".35"
            />
            <ellipse
              className={styles.blade}
              cx="486"
              cy="452"
              rx="9"
              ry="64"
              fill={C.hull}
              stroke={C.line}
              strokeWidth="3"
            />
            <ellipse
              className={`${styles.blade} ${styles.bladeLate}`}
              cx="486"
              cy="452"
              rx="9"
              ry="64"
              fill={C.hull}
              stroke={C.line}
              strokeWidth="3"
            />
          </g>
        )}
      </motion.g>
    </motion.svg>
  )
}

export interface MamFlightFx {
  /** One cloud puff at a point in the character box, in px; `scale` is the flight scale. */
  emit(x: number, y: number, scale: number): void
}

const MAX_PUFFS = 14
/** Puff radii in px at dock size, cycled: a varied trail without randomness. */
const PUFF_RADII = [9, 13, 11, 16, 10, 14]
const PUFF_MS = 900

/**
 * The plane's ground blob (a soft patch under the wheels) and its cloud trail. Puffs live in the flight space (they stay where
 * they were dropped) and animate transform and opacity only; an unmounted layer removes them all.
 */
export function MamFlightFx({
  size,
  values,
  ref,
}: Readonly<{ size: number; values: MamPlaneValues; ref: Ref<MamFlightFx> }>) {
  const trail = useRef<HTMLSpanElement>(null)
  const puffs = useRef(0)
  const scale = size / 512
  const groundOpacity = useTransform(
    values.planeGroundBlob,
    (value) => value * 0.18,
  )
  useImperativeHandle(ref, () => ({
    emit(x, y, scale) {
      const host = trail.current
      if (!host || typeof host.animate !== 'function') return
      while (host.childElementCount >= MAX_PUFFS)
        host.firstElementChild?.remove()
      const puff = document.createElement('span')
      const radius = PUFF_RADII[puffs.current++ % PUFF_RADII.length]! * scale
      puff.className = styles.puff ?? ''
      puff.style.left = `${x - radius}px`
      puff.style.top = `${y - radius}px`
      puff.style.width = puff.style.height = `${radius * 2}px`
      const animation = puff.animate(
        [
          { transform: 'translateY(0) scale(.6)', opacity: 0.9 },
          { transform: 'translateY(-6px) scale(1.4)', opacity: 0 },
        ],
        {
          duration: PUFF_MS,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          fill: 'forwards',
        },
      )
      animation.onfinish = () => puff.remove()
      host.append(puff)
    },
  }))
  return (
    <>
      <motion.span
        className={styles.groundBlob}
        aria-hidden="true"
        data-mam-plane="groundBlob"
        style={{
          x: values.planeX,
          left: 26 * scale,
          top: 474 * scale,
          width: 460 * scale,
          height: 28 * scale,
          opacity: groundOpacity,
        }}
      />
      <span
        ref={trail}
        className={styles.trail}
        aria-hidden="true"
        data-mam-plane="trail"
      />
    </>
  )
}
