// Mầm's welcome flight (MB-894, docs/ADR_MAM_RIVE_V2_CONTRACT.md): a pure flight plan, no DOM, no React.
// Every position is a pixel offset from the docked character's centre, the same space as the mover's
// `x`/`y` motion values, so the plane and the seated Mầm share one coordinate system.

export type FlightPhase =
  | 'entrance'
  | 'turn'
  | 'pass'
  | 'descent'
  | 'touchdown'
  | 'hop'
  | 'depart'
  | 'done'

/** The Rive state Mầm plays at this moment: `hop` is the `hop_down` one-shot. */
export type FlightCue = 'pilot' | 'pilot_wave' | 'hop'

/** Phase boundaries in ms. The scene is about 7 s; the greeting `wave` follows after the dock. */
export const FLIGHT_MS = {
  turn: 1700,
  pass: 2300,
  descent: 3800,
  touchdown: 5400,
  hop: 6000,
  depart: 6300,
  end: 7100,
} as const

/** The seat leaves the plane inside `hop_down` (frames 10 to 38 of 54 at 60 fps). */
const HOP_MOVE_MS = [6167, 6637] as const
/** After the roll the seat sits this far right of the dock centre (px). */
export const FLIGHT_SEAT_X = 70
const LAND_X = 150
/** Wheel contact (y 566) over the dock ground line (y 488), in artboard units. */
const WHEEL_DROP = 78
const NOSE_UNITS = 226
const FADE_EDGE_PX = 120
const BANK_MAX = 12
/** The plane and the seated Mầm are drawn larger in the air, then ease to dock size before touchdown. */
const AIR_SCALE = { desktop: 1.7, compact: 1.3 }
const SCALE_DOWN_MS = 800
/** Furthest the plane reaches from its centre (tail), and the height above it, in artboard units. */
const REACH_UNITS = 330
const RISE_UNITS = 250

export interface FlightPlan {
  readonly vw: number
  readonly vh: number
  readonly size: number
  /** Dock centre in the viewport. */
  readonly cx: number
  readonly cy: number
  readonly scale: number
  /** Plane offset y when the wheels stand on the dock ground. */
  readonly ground: number
  /** A compact viewport (900 px and narrower) flies a smaller scale. */
  readonly compact: boolean
  /** The plane leaves by fading (the edge is too near to fly off). */
  readonly fade: boolean
  readonly duration: number
}

export interface FlightSample {
  plane: {
    x: number
    y: number
    rot: number
    dirX: number
    squashY: number
    /** Drawn size, 1 = dock size. Plane and seated Mầm scale together about the seat. */
    scale: number
    /** 0 to 1: how much of the plane's ground blob shows. */
    groundBlob: number
    opacity: number
  }
  /** `free`: she has left the cockpit and must be drawn over the plane. */
  seat: {
    x: number
    y: number
    rot: number
    dirX: number
    scale: number
    free: boolean
  }
  phase: FlightPhase
  cue: FlightCue
  airborne: boolean
}

type Point = readonly [number, number]

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))
const lerp = (a: number, b: number, p: number) => a + (b - a) * p
const smooth = (p: number) => {
  const q = clamp(p, 0, 1)
  return q * q * (3 - 2 * q)
}

/** CSS `cubic-bezier(x1, y1, x2, y2)` as a function of progress. */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (t: number, a: number, b: number) =>
    3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3
  return (p: number) => {
    if (p <= 0) return 0
    if (p >= 1) return 1
    let lo = 0
    let hi = 1
    let t = p
    for (let i = 0; i < 24; i += 1) {
      if (at(t, x1, x2) < p) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return at(t, y1, y2)
  }
}

const easeEntrance = bezier(0.3, 0.2, 0.55, 1)
const easeTurn = bezier(0.4, 0, 0.6, 1)
const easePass = bezier(0.2, 0.3, 0.6, 1)
const easeDescent = bezier(0.25, 0.1, 0.35, 1)
const easeRoll = bezier(0.2, 0.6, 0.3, 1)
const easeDepartX = bezier(0.5, 0, 0.9, 0.4)
const easeDepartY = bezier(0.75, 0, 0.95, 0.5)
const easeHop = bezier(0.4, 0, 0.6, 1)

export function buildFlightPlan({
  vw,
  vh,
  dockRect,
  size,
}: {
  vw: number
  vh: number
  dockRect: { left: number; top: number }
  size: number
}): FlightPlan {
  const scale = size / 512
  const cx = dockRect.left + size / 2
  const cy = dockRect.top + size / 2
  return {
    vw,
    vh,
    size,
    cx,
    cy,
    scale,
    ground: -WHEEL_DROP * scale,
    compact: vw <= 900,
    fade: cx + FLIGHT_SEAT_X - NOSE_UNITS * scale < FADE_EDGE_PX,
    duration: FLIGHT_MS.end,
  }
}

const quad = (a: Point, b: Point, c: Point, p: number): Point => [
  (1 - p) ** 2 * a[0] + 2 * (1 - p) * p * b[0] + p * p * c[0],
  (1 - p) ** 2 * a[1] + 2 * (1 - p) * p * b[1] + p * p * c[1],
]
const cubic = (a: Point, b: Point, c: Point, d: Point, p: number): Point => {
  const q = 1 - p
  return [
    q ** 3 * a[0] + 3 * q * q * p * b[0] + 3 * q * p * p * c[0] + p ** 3 * d[0],
    q ** 3 * a[1] + 3 * q * q * p * b[1] + 3 * q * p * p * c[1] + p ** 3 * d[1],
  ]
}

const easeScale = bezier(0.25, 0.1, 0.25, 1)

/** Flight scale at `t`: full in the air, 1 from touchdown on. */
export function flightScale(plan: FlightPlan, t: number) {
  const air = plan.compact ? AIR_SCALE.compact : AIR_SCALE.desktop
  const from = FLIGHT_MS.touchdown - SCALE_DOWN_MS
  if (t <= from) return air
  if (t >= FLIGHT_MS.touchdown) return 1
  return lerp(air, 1, easeScale((t - from) / SCALE_DOWN_MS))
}

/** Plane centre (= the seat while flying) at `t`; the scaled plane stays inside the viewport. */
function position(plan: FlightPlan, t: number): Point {
  const [x, y] = rawPosition(plan, t)
  if (t < FLIGHT_MS.turn || t >= FLIGHT_MS.touchdown) return [x, y]
  const k = plan.scale * flightScale(plan, t)
  const reach = REACH_UNITS * k
  return [
    clamp(x + plan.cx, reach, plan.vw - reach) - plan.cx,
    clamp(y + plan.cy, RISE_UNITS * k, plan.vh) - plan.cy,
  ]
}

function rawPosition(plan: FlightPlan, t: number): Point {
  const { vw, vh, cx, cy, ground } = plan
  const at = (fx: number, fy: number): Point => [fx * vw - cx, fy * vh - cy]
  const touch: Point = [LAND_X, ground]
  if (t < FLIGHT_MS.turn) {
    return quad(
      at(-0.15, 0.2),
      at(0.4, 0.08),
      at(0.82, 0.16),
      easeEntrance(t / FLIGHT_MS.turn),
    )
  }
  if (t < FLIGHT_MS.pass) {
    const p = easeTurn((t - FLIGHT_MS.turn) / (FLIGHT_MS.pass - FLIGHT_MS.turn))
    return cubic(
      at(0.82, 0.16),
      at(0.96, 0.1),
      at(0.96, 0.26),
      at(0.8, 0.27),
      p,
    )
  }
  if (t < FLIGHT_MS.descent) {
    const raw = (t - FLIGHT_MS.pass) / (FLIGHT_MS.descent - FLIGHT_MS.pass)
    const from = at(0.8, 0.27)
    const to = at(0.6, 0.27)
    return [
      lerp(from[0], to[0], easePass(raw)),
      from[1] + Math.sin(2 * Math.PI * raw) * 0.02 * vh,
    ]
  }
  if (t < FLIGHT_MS.touchdown) {
    const p = easeDescent(
      (t - FLIGHT_MS.descent) / (FLIGHT_MS.touchdown - FLIGHT_MS.descent),
    )
    const start = at(0.6, 0.27)
    return cubic(
      start,
      [start[0] - 0.14 * vw, start[1]],
      [touch[0] + 140, touch[1] - 45],
      touch,
      p,
    )
  }
  if (t < FLIGHT_MS.hop) {
    const p = easeRoll(
      (t - FLIGHT_MS.touchdown) / (FLIGHT_MS.hop - FLIGHT_MS.touchdown),
    )
    return [lerp(LAND_X, FLIGHT_SEAT_X, p), ground]
  }
  if (t < FLIGHT_MS.depart) return [FLIGHT_SEAT_X, ground]
  const p = clamp(
    (t - FLIGHT_MS.depart) / (FLIGHT_MS.end - FLIGHT_MS.depart),
    0,
    1,
  )
  if (plan.fade) {
    const e = easeDepartX(p)
    return [
      lerp(FLIGHT_SEAT_X, FLIGHT_SEAT_X - 30, e),
      lerp(ground, ground - 20, e),
    ]
  }
  return [
    lerp(FLIGHT_SEAT_X, -0.2 * vw - cx, easeDepartX(p)),
    lerp(ground, ground - 0.3 * vh, easeDepartY(p)),
  ]
}

const dirAt = (t: number) =>
  t < FLIGHT_MS.turn
    ? 1
    : t < FLIGHT_MS.pass
      ? Math.cos(
          Math.PI *
            easeTurn((t - FLIGHT_MS.turn) / (FLIGHT_MS.pass - FLIGHT_MS.turn)),
        )
      : -1

/** Nose-up flare in the last 0.4 s of the descent; the nose settles as the wheels touch. */
const flare = (t: number) =>
  t < FLIGHT_MS.touchdown - 400
    ? 0
    : t < FLIGHT_MS.touchdown
      ? 6 * smooth((t - (FLIGHT_MS.touchdown - 400)) / 400)
      : 6 * (1 - smooth((t - FLIGHT_MS.touchdown) / 150))

/** Suspension: the body dips on touchdown and rebounds (300 ms). */
function squash(t: number) {
  const tt = t - FLIGHT_MS.touchdown
  if (tt <= 0 || tt >= 300) return 1
  if (tt < 100) return lerp(1, 0.94, smooth(tt / 100))
  if (tt < 200) return lerp(0.94, 1.02, smooth((tt - 100) / 100))
  return lerp(1.02, 1, smooth((tt - 200) / 100))
}

const phaseAt = (t: number): FlightPhase =>
  t < FLIGHT_MS.turn
    ? 'entrance'
    : t < FLIGHT_MS.pass
      ? 'turn'
      : t < FLIGHT_MS.descent
        ? 'pass'
        : t < FLIGHT_MS.touchdown
          ? 'descent'
          : t < FLIGHT_MS.hop
            ? 'touchdown'
            : t < FLIGHT_MS.depart
              ? 'hop'
              : t < FLIGHT_MS.end
                ? 'depart'
                : 'done'

export function sampleFlight(plan: FlightPlan, tMs: number): FlightSample {
  const t = clamp(tMs, 0, plan.duration)
  const [x, y] = position(plan, t)
  const dirX = dirAt(t)
  // Bank follows the tangent (a gentle fraction of it), never more than BANK_MAX.
  const [bx, by] = position(plan, clamp(t + 8, 0, plan.duration))
  const [ax, ay] = position(plan, clamp(t - 8, 0, plan.duration))
  const vx = bx - ax
  const vy = by - ay
  const up =
    Math.hypot(vx, vy) < 0.01
      ? 0
      : (Math.atan2(-vy, Math.abs(vx)) * 180) / Math.PI
  const sign = dirX >= 0 ? 1 : -1
  const rot = clamp(-sign * (0.45 * up + flare(t)), -BANK_MAX, BANK_MAX)

  const altitude = plan.ground - y
  const onGround = t >= FLIGHT_MS.touchdown && t < FLIGHT_MS.depart
  const groundBlob =
    t < FLIGHT_MS.descent ? 0 : onGround ? 1 : clamp(1 - altitude / 160, 0, 1)
  const fadeOut =
    plan.fade && t > FLIGHT_MS.depart
      ? clamp(1 - (t - FLIGHT_MS.depart) / 200, 0, 1)
      : 1

  // The seat rides the plane until it hops out, then moves to the dock (0, 0).
  let seatX = x
  let seatY = y
  let seatRot = rot
  let seatDir = dirX
  if (t >= FLIGHT_MS.hop) {
    const [from, to] = HOP_MOVE_MS
    const p = easeHop(clamp((t - from) / (to - from), 0, 1))
    seatX = lerp(FLIGHT_SEAT_X, 0, p)
    // Rive's own jump is a few px; the host adds the arc that carries her out and down.
    seatY = lerp(plan.ground, 0, p) - Math.sin(Math.PI * p) * 0.12 * plan.size
    const turn = smooth((t - FLIGHT_MS.hop) / 250)
    seatDir = lerp(-1, 1, turn)
    seatRot = 0
  }

  return {
    plane: {
      x,
      y,
      rot,
      dirX,
      squashY: squash(t),
      scale: flightScale(plan, t),
      groundBlob,
      opacity: fadeOut,
    },
    seat: {
      x: seatX,
      y: seatY,
      rot: seatRot,
      dirX: seatDir,
      scale: flightScale(plan, t),
      free: t >= HOP_MOVE_MS[0],
    },
    phase: phaseAt(tMs),
    cue:
      t >= FLIGHT_MS.hop
        ? 'hop'
        : t >= FLIGHT_MS.pass && t < FLIGHT_MS.descent
          ? 'pilot_wave'
          : 'pilot',
    airborne: altitude > 6,
  }
}
