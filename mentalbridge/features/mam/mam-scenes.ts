// Pure motion for the MB-896 variations (docs/ADR_MAM_RIVE_V2_CONTRACT.md, "v0.8 amendment"). Nothing here
// touches the DOM: the travel controller samples `parachuteDescent`, the butterfly prop animates `BUTTERFLY_PATH`,
// and the variation catalogue derives Mầm's gaze from the same path, so the eyes follow what is drawn.

/** Where the parachute scene places Mầm: px offsets from her dock spot, a rotation in degrees and a squash. */
export interface MamSceneFrame {
  x: number
  y: number
  rot: number
  sx: number
  sy: number
}

export const PARACHUTE_MS = 4200
const SWAY_PX = 26
const SWAYS = 2.4
const LAND_FROM = 0.93

/**
 * Drifts down from `height` px above the dock: a slow ease-out descent, a sway that dies away with a
 * counter-tilt, and a small squash on touchdown. Ends exactly on the dock (0, 0).
 */
export function parachuteDescent(ms: number, height: number): MamSceneFrame {
  const p = Math.min(1, Math.max(0, ms / PARACHUTE_MS))
  const sway = SWAY_PX * Math.sqrt(1 - p) * Math.sin(2 * Math.PI * SWAYS * p)
  const k = p > LAND_FROM ? (p - LAND_FROM) / (1 - LAND_FROM) : 0
  const bump = Math.sin(Math.PI * k)
  return {
    x: sway,
    // `|| 0`: the last frame is exactly home, never -0.
    y: -height * Math.pow(1 - p, 1.6) || 0,
    rot: -sway * 0.3,
    sx: 1 + 0.07 * bump,
    sy: 1 - 0.1 * bump,
  }
}

export const BUTTERFLY_MS = 4200

/** One stop of the butterfly's wander: `t` 0 to 1 of the run, `x` and `y` as fractions of the character box from its centre. */
export interface ButterflyStop {
  t: number
  x: number
  y: number
  o: number
}

export const BUTTERFLY_PATH: readonly ButterflyStop[] = [
  { t: 0, x: 0.62, y: -0.3, o: 0 },
  { t: 0.08, x: 0.5, y: -0.32, o: 1 },
  { t: 0.25, x: 0.1, y: -0.28, o: 1 },
  { t: 0.5, x: -0.42, y: -0.08, o: 1 },
  { t: 0.75, x: 0.48, y: 0.06, o: 1 },
  { t: 0.92, x: 0.3, y: -0.4, o: 1 },
  { t: 1, x: 0.7, y: -0.6, o: 0 },
]

/** The butterfly's box-fraction position at `t` (0 to 1), eased between stops. */
export function butterflyAt(t: number) {
  const at = Math.min(1, Math.max(0, t))
  const next = BUTTERFLY_PATH.findIndex((stop) => stop.t >= at)
  if (next <= 0) return BUTTERFLY_PATH[0]!
  const a = BUTTERFLY_PATH[next - 1]!
  const b = BUTTERFLY_PATH[next]!
  // Eased like the prop's own animation (`ease-in-out` per stop), so the gaze follows what is drawn.
  const linear = (at - a.t) / (b.t - a.t)
  const k = linear * linear * (3 - 2 * linear)
  return {
    t: at,
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    o: a.o + (b.o - a.o) * k,
  }
}

/** Mầm's `attentionDirection` for a butterfly at box fraction `x`: left is -1, right is 1. */
export const gazeToward = (x: number) => Math.max(-1, Math.min(1, x * 2.2))

// The Rive hops of `dance` and `spin` are a few canvas units: about a pixel at the 96 px dock. The host adds the
// travel that makes them readable, on the same beat. `k` is the dock size over 96.
export const DANCE_MS = 2500
const BEAT_MS = 1000 / 3
const DANCE_LEAD_MS = 200
const DANCE_BEATS = 6
const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

/** A hop on every beat (ground at a quarter of the beat, the top at three quarters, like the asset) and a side sway every two. */
export function danceMotion(ms: number, k = 1): MamSceneFrame {
  const t = ms - DANCE_LEAD_MS
  const live = t >= 0 && t <= DANCE_BEATS * BEAT_MS
  const envelope = live
    ? smooth(t / 200) * smooth((DANCE_BEATS * BEAT_MS - t) / 300)
    : 0
  const up = (1 - Math.cos(2 * Math.PI * (t / BEAT_MS - 0.25))) / 2
  return {
    x: 11 * k * envelope * Math.sin((2 * Math.PI * t) / (2 * BEAT_MS)) || 0,
    y: -9 * k * envelope * up || 0,
    rot: 0,
    sx: 1,
    sy: 1,
  }
}

export const SPIN_MS = 1200
const SPIN_JUMP_FROM = 167
const SPIN_JUMP_TO = 900

/** One hop over the asset's jump (crouch at 167 ms, landing at 900 ms), so the turn leaves the ground. */
export function spinHop(ms: number, k = 1): MamSceneFrame {
  const p = smooth((ms - SPIN_JUMP_FROM) / (SPIN_JUMP_TO - SPIN_JUMP_FROM))
  const arc =
    ms >= SPIN_JUMP_FROM && ms <= SPIN_JUMP_TO ? Math.sin(Math.PI * p) : 0
  return { x: 0, y: -14 * k * arc || 0, rot: 0, sx: 1, sy: 1 }
}
