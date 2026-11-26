'use client'

import { useEffect, useId, useRef } from 'react'

import { useReactiveReducedMotion } from '@/lib/animations/use-reduced-motion'

import styles from './MamProps.module.css'
import { BUTTERFLY_MS, BUTTERFLY_PATH } from './mam-scenes'

// The host SVG props of the MB-896 variations (docs/ADR_MAM_RIVE_V2_CONTRACT.md). Drawn in the character's
// artboard space (512 units = the character box, like the welcome plane) with the rig's palette and stroke, around
// Mầm: `back` sits behind her, `front` over her (the pot's lip), `mover` rides along with her when a scene moves her.
// Decorative: no pointer events, hidden from assistive technology. Only transform and opacity animate.

export type MamPropId =
  'parachute' | 'plantPot' | 'cheerSign' | 'umbrella' | 'butterfly'
export type MamPropLayer = 'back' | 'front' | 'mover'
export type MamPropPhase = 'in' | 'out'

const LAYERS: Record<MamPropId, readonly MamPropLayer[]> = {
  parachute: ['mover'],
  plantPot: ['back', 'front'],
  cheerSign: ['back'],
  umbrella: ['back'],
  butterfly: ['front'],
}
export const mamPropLayers = (id: MamPropId) => LAYERS[id]

const C = {
  ink: '#2F5A53',
  line: '#3E6B64',
  cream: '#F5EEDC',
  leaf: '#9CBF7E',
  amber: '#E0A448',
  amberLine: '#B07A26',
  cheek: '#E8B7A3',
  rain: '#A9D0D4',
  rainLine: '#6D9FA5',
  clay: '#D98F6B',
  clayDark: '#C77B5C',
  clayLight: '#E7A98A',
  soil: '#5C3D2E',
  wood: '#C99A6B',
}
const STROKE = {
  stroke: C.line,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
} as const

/** A dome with a scalloped hem: `from` and `to` are the hem's ends at height `hem`, `top` the apex. */
function canopy(
  from: number,
  to: number,
  hem: number,
  top: number,
  scallops: number,
) {
  const width = to - from
  const joints = Array.from(
    { length: scallops + 1 },
    (_, i) => to - (i * width) / scallops,
  )
  const hemPath = joints
    .slice(1)
    .map(
      (x, i) => `Q${joints[i]! - width / scallops / 2} ${hem + 34} ${x} ${hem}`,
    )
    .join(' ')
  const mid = (from + to) / 2
  const d = `M${from} ${hem} C${from - 10} ${top / 2} ${from + 170} ${top} ${mid} ${top} C${to - 170} ${top} ${to + 10} ${top / 2} ${to} ${hem} ${hemPath} Z`
  return { d, joints, mid }
}

function Parachute() {
  const clip = useId()
  const { d, joints, mid } = canopy(-100, 612, 20, -330, 7)
  const fills = [C.leaf, C.cream, C.amber, C.cream, C.leaf, C.cream, C.amber]
  const fists = [121, 391]
  return (
    <g className={styles.sway}>
      <clipPath id={clip}>
        <path d={d} />
      </clipPath>
      <path d={d} fill={C.cream} />
      <g clipPath={`url(#${clip})`}>
        {fills.map((fill, i) => (
          <path
            key={i}
            fill={fill}
            d={`M${mid} -330 Q${(mid + joints[i]!) / 2 + (joints[i]! - mid) * 0.25} -150 ${joints[i]} 60 L${joints[i + 1]} 60 Q${(mid + joints[i + 1]!) / 2 + (joints[i + 1]! - mid) * 0.25} -150 ${mid} -330 Z`}
          />
        ))}
      </g>
      <g fill="none" {...STROKE} strokeWidth="5">
        <path d={d} />
        {joints.slice(1, -1).map((x, i) => (
          <path
            key={i}
            d={`M${mid} -330 Q${(mid + x) / 2 + (x - mid) * 0.25} -150 ${x} 20`}
            strokeWidth="3.5"
            opacity=".7"
          />
        ))}
      </g>
      <g fill="none" {...STROKE} strokeWidth="3.5">
        {joints.map((x, i) => (
          <path key={i} d={`M${x} 22 L${fists[x < mid ? 0 : 1]} 314`} />
        ))}
      </g>
    </g>
  )
}

function PotBack() {
  return (
    <g {...STROKE} strokeWidth="6">
      <ellipse
        cx="256"
        cy="500"
        rx="176"
        ry="16"
        fill={C.ink}
        opacity=".16"
        stroke="none"
      />
      <ellipse cx="256" cy="376" rx="150" ry="22" fill={C.clayDark} />
      <ellipse cx="256" cy="380" rx="134" ry="13" fill={C.soil} stroke="none" />
    </g>
  )
}

function PotFront() {
  return (
    <g {...STROKE} strokeWidth="6">
      <path
        d="M114 392 L398 392 Q408 392 405 404 L376 492 Q372 506 356 506 L156 506 Q140 506 136 492 L107 404 Q104 392 114 392 Z"
        fill={C.clay}
      />
      <path
        d="M134 438 L378 438"
        stroke={C.clayLight}
        strokeWidth="9"
        opacity=".75"
      />
      <rect x="96" y="372" width="320" height="38" rx="16" fill={C.clayDark} />
      <path
        d="M0 0 C-8 -16 -34 -22 -48 -10 C-36 4 -14 8 0 0 Z"
        transform="translate(282 474) scale(.62) rotate(-28)"
        fill={C.leaf}
        strokeWidth="7"
      />
    </g>
  )
}

export type MamSignSide = 'right' | 'above'

/** The sign's measures (artboard units). Compact text is bigger so it stays at 12 px or more on the 72 px dock. */
const SIGN = {
  regular: { w: 372, h: 156, font: 66 },
  compact: { w: 460, h: 190, font: 86 },
} as const
const SIGN_LEFT = 392
const SIGN_FOOT = 500
const SIGN_BOARD_BOTTOM = 300
const ABOVE_BOARD_BOTTOM = 20

/** Where the sign pivots, as percentages of the 512 box (the svg's own transform origin). */
function signOrigin(side: MamSignSide, compact: boolean) {
  const { w } = SIGN[compact ? 'compact' : 'regular']
  return side === 'right'
    ? { x: SIGN_LEFT + w / 2, y: SIGN_FOOT }
    : { x: 256, y: ABOVE_BOARD_BOTTOM }
}

/**
 * "Giỏi lắm!" on a small board. On the roomy side of her (right of the dock) it stands on a pole; with no room there
 * it floats above her head with a little pointer.
 */
function CheerSign({
  compact,
  side,
}: Readonly<{ compact: boolean; side: MamSignSide }>) {
  const { w, h, font } = SIGN[compact ? 'compact' : 'regular']
  const left = side === 'right' ? SIGN_LEFT : 256 - w / 2
  const bottom = side === 'right' ? SIGN_BOARD_BOTTOM : ABOVE_BOARD_BOTTOM
  const top = bottom - h
  const cx = left + w / 2
  const origin = signOrigin(side, compact)
  return (
    <g
      className={styles.signSway}
      style={{ transformOrigin: `${origin.x}px ${origin.y}px` }}
      {...STROKE}
    >
      {side === 'right' ? (
        <>
          <ellipse
            cx={cx}
            cy={SIGN_FOOT}
            rx="56"
            ry="10"
            fill={C.ink}
            opacity=".16"
            stroke="none"
          />
          <rect
            x={cx - 8}
            y={bottom - 4}
            width="16"
            height={SIGN_FOOT - bottom + 4}
            rx="6"
            fill={C.wood}
            strokeWidth="6"
          />
        </>
      ) : (
        <path
          d={`M${cx - 22} ${bottom - 2} L${cx} ${bottom + 26} L${cx + 22} ${bottom - 2} Z`}
          fill={C.cream}
          strokeWidth="6"
        />
      )}
      <g
        className={styles.signBoard}
        style={{ transformOrigin: `${cx}px ${bottom}px` }}
      >
        <rect
          x={left}
          y={top}
          width={w}
          height={h}
          rx="20"
          fill={C.cream}
          strokeWidth="8"
        />
        <rect
          x={left + 14}
          y={top + 14}
          width={w - 28}
          height={h - 28}
          rx="12"
          fill="none"
          stroke={C.amber}
          strokeWidth="4"
          strokeDasharray="14 10"
        />
        <text
          x={cx}
          y={top + h / 2 + font * 0.34}
          textAnchor="middle"
          fontSize={font}
          fontWeight="700"
          fontStyle="italic"
          fill={C.ink}
          stroke="none"
          style={{ fontFamily: 'var(--font-fraunces), Georgia, serif' }}
          transform={`rotate(-3 ${cx} ${top + h / 2})`}
        >
          Giỏi lắm!
        </text>
      </g>
    </g>
  )
}

const DROPS = [-90, -48, 566, 608, -70, 590]

function Umbrella() {
  const clip = useId()
  const { d, joints, mid } = canopy(-40, 552, 20, -200, 4)
  const fills = [C.rain, C.cream, C.rain, C.cream]
  return (
    <g>
      <g className={styles.rain} aria-hidden="true">
        {DROPS.map((x, i) => (
          <path
            key={x}
            className={styles.drop}
            style={{ animationDelay: `${-i * 190}ms` }}
            d={`M${x} -210 C${x + 5} -196 ${x + 9} -190 ${x + 9} -184 C${x + 9} -178 ${x + 5} -175 ${x} -175 C${x - 5} -175 ${x - 9} -178 ${x - 9} -184 C${x - 9} -190 ${x - 5} -196 ${x} -210 Z`}
            fill={C.rain}
            stroke={C.rainLine}
            strokeWidth="3"
          />
        ))}
      </g>
      <g className={styles.umbrellaBody} {...STROKE}>
        <path
          d="M256 20 L372 436 Q378 462 354 462"
          fill="none"
          stroke={C.amberLine}
          strokeWidth="9"
        />
        <clipPath id={clip}>
          <path d={d} />
        </clipPath>
        <path d={d} fill={C.cream} stroke="none" />
        <g clipPath={`url(#${clip})`} stroke="none">
          {fills.map((fill, i) => (
            <path
              key={i}
              fill={fill}
              d={`M${mid} -200 Q${(mid + joints[i]!) / 2} -120 ${joints[i]} 60 L${joints[i + 1]} 60 Q${(mid + joints[i + 1]!) / 2} -120 ${mid} -200 Z`}
            />
          ))}
        </g>
        <path d={d} fill="none" strokeWidth="6" />
        <path
          d={`M${mid} -200 L${mid} -222`}
          fill="none"
          stroke={C.amberLine}
          strokeWidth="7"
        />
      </g>
    </g>
  )
}

function Butterfly({
  phase,
  onGone,
}: Readonly<{ phase: MamPropPhase; onGone: () => void }>) {
  const ref = useRef<SVGSVGElement>(null)
  const reduced = useReactiveReducedMotion()
  // The path already fades her out; when the sequence takes the prop away it is simply retired.
  useEffect(() => {
    if (phase === 'out') onGone()
  }, [phase, onGone])
  useEffect(() => {
    const el = ref.current
    // Reduced motion: no look starts, but a stray render must not move either.
    if (reduced || !el || typeof el.animate !== 'function') return
    const animation = el.animate(
      BUTTERFLY_PATH.map((stop) => ({
        offset: stop.t,
        opacity: stop.o,
        transform: `translate(${stop.x * 100}%, ${stop.y * 100}%)`,
        easing: 'ease-in-out',
      })),
      { duration: BUTTERFLY_MS, fill: 'both' },
    )
    return () => animation.cancel()
  }, [reduced])
  return (
    <svg
      ref={ref}
      className={styles.prop}
      data-mam-prop="butterfly"
      viewBox="0 0 512 512"
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
      style={{ opacity: 0 }}
    >
      {/* Bigger than drawn: at the dock size she must read as a butterfly; the bob animates the inner group. */}
      <g transform="translate(256 256) scale(1.3) translate(-256 -256)">
        <g className={styles.bob} {...STROKE} strokeWidth="5">
          {[-1, 1].map((side) => (
            <g key={side} className={side < 0 ? styles.wingL : styles.wingR}>
              <ellipse
                cx={256 + side * 44}
                cy="232"
                rx="46"
                ry="36"
                transform={`rotate(${side * 24} ${256 + side * 44} 232)`}
                fill={C.amber}
              />
              <ellipse
                cx={256 + side * 34}
                cy="274"
                rx="30"
                ry="24"
                transform={`rotate(${-side * 18} ${256 + side * 34} 274)`}
                fill={C.cheek}
              />
            </g>
          ))}
          <ellipse cx="256" cy="256" rx="9" ry="34" fill={C.ink} />
          <path
            d="M252 224 Q240 196 226 190 M260 224 Q272 196 286 190"
            fill="none"
            strokeWidth="4"
          />
        </g>
      </g>
    </svg>
  )
}

export function MamProp({
  id,
  phase,
  layer,
  size,
  side = 'right',
  onGone,
}: Readonly<{
  id: MamPropId
  phase: MamPropPhase
  layer: MamPropLayer
  size: number
  /** The cheer sign's side: right of the dock when there is room, else above her head. */
  side?: MamSignSide
  onGone: (id: MamPropId) => void
}>) {
  const reduced = useReactiveReducedMotion()
  // The exit animations live under `no-preference`: with reduced motion none runs, so nothing would ever end.
  useEffect(() => {
    if (phase === 'out' && reduced) onGone(id)
  }, [phase, reduced, id, onGone])
  const compact = size <= 72
  if (id === 'butterfly')
    return (
      <span
        className={styles.box}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <Butterfly phase={phase} onGone={() => onGone(id)} />
      </span>
    )
  return (
    <svg
      className={styles.prop}
      data-mam-prop={id}
      data-mam-layer={layer}
      data-phase={phase}
      style={
        id === 'cheerSign'
          ? {
              transformOrigin: `${(signOrigin(side, compact).x / 5.12).toFixed(1)}% ${(signOrigin(side, compact).y / 5.12).toFixed(1)}%`,
            }
          : undefined
      }
      viewBox="0 0 512 512"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      onAnimationEnd={(event) => {
        // Only the exit's own animation retires the prop, never a looping child (sway, rain).
        if (phase === 'out' && event.target === event.currentTarget) onGone(id)
      }}
    >
      {id === 'parachute' ? <Parachute /> : null}
      {id === 'plantPot' ? layer === 'back' ? <PotBack /> : <PotFront /> : null}
      {id === 'cheerSign' ? <CheerSign compact={compact} side={side} /> : null}
      {id === 'umbrella' ? <Umbrella /> : null}
    </svg>
  )
}
