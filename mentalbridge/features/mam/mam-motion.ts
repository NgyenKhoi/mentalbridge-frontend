// Pure maths of Mầm's travel (MB-814 design §A, §C). No DOM, no React: the
// numbers come from the owner-approved spike and are checked in mam-motion.test.ts.

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/** "back" overshoots with c1 = 1.70158 (design §A notation). */
const BACK = 1.70158

export const ease = {
  out: (p: number) => 1 - (1 - p) ** 3,
  in: (p: number) => p ** 3,
  inOut: (p: number) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2),
  back: (p: number) => 1 + (BACK + 1) * (p - 1) ** 3 + BACK * (p - 1) ** 2,
  inBack: (p: number) => (BACK + 1) * p ** 3 - BACK * p ** 2,
}

export type MamEase = (progress: number) => number

// ---- Throw (design §C) ----------------------------------------------------

export const GRAVITY = 2600
const BOUNCE_MIN_SPEED = 700

export type VelocitySample = Readonly<{ t: number; x: number; y: number }>

/** Pointer velocity (px/s) over the samples of the last 90 ms. */
export function sampleVelocity(samples: readonly VelocitySample[]) {
  const first = samples[0]
  const last = samples[samples.length - 1]
  if (!first || !last || last.t <= first.t) return { vx: 0, vy: 0 }
  const seconds = (last.t - first.t) / 1000
  return {
    vx: (last.x - first.x) / seconds,
    vy: (last.y - first.y) / seconds,
  }
}

/** A pointer flick at or above this speed (px/s) lands harder and shakes off (MB-818). */
export const FAST_THROW_SPEED = 1400
export const isFastThrow = (pointerVx: number, pointerVy: number) =>
  Math.hypot(pointerVx, pointerVy) >= FAST_THROW_SPEED

/** Always tossed upward and damped ("less sensitive", owner). */
export function throwFrom(pointerVx: number, pointerVy: number) {
  const vx = clamp(pointerVx * 0.35, -600, 600)
  const vy = -Math.min(
    1150,
    700 + Math.max(0, -pointerVy) * 0.2 + Math.abs(pointerVx) * 0.05,
  )
  return { vx, vy, spin: vx * 0.35 }
}

export type Flight = Readonly<{
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  spin: number
}>

export type FlightEvent = 'none' | 'bounce' | 'land'

/**
 * One step of the flight. `x`, `y` are the character's top-left in viewport
 * px; `floor` is the dock baseline. Spin decays by 0.985 per 60 Hz frame.
 */
export function stepFlight(
  flight: Flight,
  dt: number,
  bounds: Readonly<{ minX: number; maxX: number; floor: number }>,
): { flight: Flight; event: FlightEvent } {
  let { vx, vy, spin } = flight
  vy += GRAVITY * dt
  let x = flight.x + vx * dt
  let y = flight.y + vy * dt
  const rot = flight.rot + spin * dt
  spin *= 0.985 ** (dt * 60)
  if (x < bounds.minX) {
    x = bounds.minX
    vx = Math.abs(vx) * 0.5
    spin *= -0.6
  } else if (x > bounds.maxX) {
    x = bounds.maxX
    vx = -Math.abs(vx) * 0.5
    spin *= -0.6
  }
  let event: FlightEvent = 'none'
  if (y >= bounds.floor && vy > 0) {
    y = bounds.floor
    if (vy > BOUNCE_MIN_SPEED) {
      vy = -vy * 0.36
      vx *= 0.7
      spin *= 0.5
      event = 'bounce'
    } else event = 'land'
  }
  return { flight: { x, y, vx, vy, rot, spin }, event }
}

/** Steps of at most 110 px toward the dock x; empty once within 2 px. */
export function hopSteps(from: number, home: number, maxStep = 110) {
  const steps: number[] = []
  let x = from
  while (Math.abs(home - x) > 2) {
    const step = Math.sign(home - x) * Math.min(maxStep, Math.abs(home - x))
    steps.push(step)
    x += step
  }
  return steps
}

// ---- Perch (design §A) ----------------------------------------------------

/** Room Mầm needs above the card's top edge: 0.64·S plus 16 px. */
export const climbRoom = (size: number) => 0.64 * size + 16

/** Room the card's top edge keeps above the viewport bottom: the bubble's 22 px overhang plus a gutter. */
export const BOTTOM_ROOM = 48

/**
 * Px the page must scroll so the card's top edge sits between the climb room
 * under the header and the bottom room: negative scrolls up, positive down.
 */
export const scrollNeeded = (
  cardTop: number,
  visibleTop: number,
  size: number,
  viewportHeight: number,
) => {
  const up = visibleTop + climbRoom(size) - cardTop
  if (up > 0) return -up
  return Math.max(0, cardTop - (viewportHeight - BOTTOM_ROOM))
}

/** Card's right edge minus S and 28 px, kept 8 px inside the viewport. */
export const perchLeft = (cardRight: number, size: number, viewport: number) =>
  clamp(cardRight - size - 28, 8, Math.max(8, viewport - size - 8))

/** `clip-path` that hides the character below the card's top edge and above the header. */
export function perchClip(
  layerTop: number,
  layerHeight: number,
  cardTop: number,
  visibleTop: number,
) {
  const top = visibleTop - layerTop
  const bottom = layerTop + layerHeight - cardTop
  return `inset(${top}px -100vw ${bottom}px -100vw)`
}

export type PerchBubble = Readonly<{
  left: number
  top: number
  side: 'left' | 'right' | 'above'
}>

/**
 * Bubble beside Mầm's head: right edge 12 px left of Mầm and bottom edge 22 px
 * below the card's top edge. No room on the left flips right; neither side
 * fitting puts it above Mầm. It keeps a 16 px gutter to the viewport and stays
 * under the header.
 */
export function perchBubble({
  width,
  height,
  charLeft,
  charTop,
  size,
  cardTop,
  viewportWidth,
  viewportHeight,
  viewportLeft = 0,
  visibleTop,
}: Readonly<{
  width: number
  height: number
  charLeft: number
  charTop: number
  size: number
  cardTop: number
  viewportWidth: number
  viewportHeight: number
  /** Left edge of the page content: the sidebar (above the bubble) is not room. */
  viewportLeft?: number
  visibleTop: number
}>): PerchBubble {
  const gutter = 16
  const minLeft = viewportLeft + gutter
  const fit = (top: number) =>
    clamp(
      top,
      visibleTop + gutter,
      Math.max(visibleTop + gutter, viewportHeight - gutter - height),
    )
  const beside = fit(cardTop + 22 - height)
  const left = charLeft - 12 - width
  if (left >= minLeft) return { left, top: beside, side: 'left' }
  const right = charLeft + size + 12
  if (right + width <= viewportWidth - gutter)
    return { left: right, top: beside, side: 'right' }
  return {
    left: clamp(
      charLeft + size / 2 - width / 2,
      minLeft,
      Math.max(minLeft, viewportWidth - gutter - width),
    ),
    top: fit(charTop - 12 - height),
    side: 'above',
  }
}
