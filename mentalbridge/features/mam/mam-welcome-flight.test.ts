import { describe, expect, it } from 'vitest'

import {
  buildFlightPlan,
  FLIGHT_MS,
  FLIGHT_SEAT_X,
  sampleFlight,
  type FlightPhase,
} from './mam-welcome-flight'

const desktop = buildFlightPlan({
  vw: 1440,
  vh: 900,
  dockRect: { left: 256, top: 780 },
  size: 96,
})
const compact = buildFlightPlan({
  vw: 375,
  vh: 812,
  dockRect: { left: 16, top: 724 },
  size: 72,
})
const plans = { desktop, compact }
const steps = (plan: typeof desktop) =>
  Array.from({ length: Math.floor(plan.duration / 20) + 1 }, (_, i) => i * 20)
const viewport = (plan: typeof desktop, t: number) => {
  const { plane } = sampleFlight(plan, t)
  return { x: plane.x + plan.cx, y: plane.y + plan.cy }
}

describe.each(Object.entries(plans))('welcome flight (%s)', (_name, plan) => {
  it('starts off-screen and lasts 6 to 8 seconds', () => {
    expect(viewport(plan, 0).x).toBeLessThan(0)
    expect(plan.duration).toBeGreaterThanOrEqual(6000)
    expect(plan.duration).toBeLessThanOrEqual(8000)
  })

  it('lands the seat 70 px right of the dock, then puts Mầm at the dock', () => {
    const landed = sampleFlight(plan, FLIGHT_MS.hop - 1)
    expect(landed.seat.x).toBeCloseTo(FLIGHT_SEAT_X, 0)
    expect(landed.seat.y).toBeCloseTo(plan.ground, 0)
    expect(landed.plane.groundBlob).toBe(1)
    const end = sampleFlight(plan, plan.duration)
    expect(end.seat.x).toBeCloseTo(0, 6)
    expect(end.seat.y).toBeCloseTo(0, 6)
    expect(end.seat).toMatchObject({ dirX: 1, rot: 0 })
    expect(end.phase).toBe('done')
  })

  it('never banks more than 12 degrees', () => {
    for (const t of steps(plan))
      expect(Math.abs(sampleFlight(plan, t).plane.rot)).toBeLessThanOrEqual(12)
  })

  it('keeps the flight in the viewport between entering and leaving', () => {
    for (const t of steps(plan).filter(
      (t) => t >= FLIGHT_MS.turn && t < FLIGHT_MS.depart,
    )) {
      const { x, y } = viewport(plan, t)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(plan.vw)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(plan.vh)
    }
  })

  it('flies large, then is dock size from touchdown on, never above 1.7', () => {
    const air = plan.compact ? 1.3 : 1.7
    expect(sampleFlight(plan, 500).plane.scale).toBe(air)
    expect(sampleFlight(plan, FLIGHT_MS.touchdown - 800).plane.scale).toBe(air)
    for (const t of steps(plan)) {
      const { plane, seat } = sampleFlight(plan, t)
      expect(plane.scale).toBeLessThanOrEqual(1.7)
      expect(plane.scale).toBeGreaterThanOrEqual(1)
      expect(seat.scale).toBe(plane.scale)
      if (t >= FLIGHT_MS.touchdown) expect(plane.scale).toBe(1)
    }
  })

  it('keeps the scaled plane inside the viewport from the turn to the landing', () => {
    const reach = 330 * plan.scale
    for (const t of steps(plan).filter(
      (t) => t >= FLIGHT_MS.turn && t < FLIGHT_MS.touchdown,
    )) {
      const { x } = viewport(plan, t)
      const k = sampleFlight(plan, t).plane.scale
      expect(x - reach * k).toBeGreaterThanOrEqual(-0.5)
      expect(x + reach * k).toBeLessThanOrEqual(plan.vw + 0.5)
    }
  })

  it('walks the phases in order and turns around once', () => {
    const order: FlightPhase[] = [
      'entrance',
      'turn',
      'pass',
      'descent',
      'touchdown',
      'hop',
      'depart',
      'done',
    ]
    const seen = steps(plan).map((t) =>
      order.indexOf(sampleFlight(plan, t).phase),
    )
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
    expect(new Set(seen).size).toBe(order.length)
    expect(sampleFlight(plan, 0).plane.dirX).toBe(1)
    expect(sampleFlight(plan, FLIGHT_MS.pass).plane.dirX).toBeCloseTo(-1, 5)
  })

  it('waves only on the pass, hops from the touchdown roll on, and leaves the ground blob to the landing', () => {
    expect(sampleFlight(plan, 500).cue).toBe('pilot')
    expect(sampleFlight(plan, 3000).cue).toBe('pilot_wave')
    expect(sampleFlight(plan, 4500).cue).toBe('pilot')
    expect(sampleFlight(plan, FLIGHT_MS.hop).cue).toBe('hop')
    expect(sampleFlight(plan, 3000).plane.groundBlob).toBe(0)
    expect(sampleFlight(plan, 3000).airborne).toBe(true)
    expect(sampleFlight(plan, FLIGHT_MS.touchdown + 100).airborne).toBe(false)
  })
})

describe('welcome flight departure', () => {
  it('flies off the desktop screen and fades on a compact one', () => {
    expect(desktop.fade).toBe(false)
    expect(compact.fade).toBe(true)
    expect(viewport(desktop, desktop.duration).x).toBeLessThan(0)
    expect(sampleFlight(desktop, desktop.duration).plane.opacity).toBe(1)
    expect(sampleFlight(compact, compact.duration).plane.opacity).toBe(0)
  })

  it('frees the seat above the plane only once she moves out', () => {
    expect(sampleFlight(desktop, FLIGHT_MS.hop + 50).seat.free).toBe(false)
    expect(sampleFlight(desktop, FLIGHT_MS.hop + 400).seat.free).toBe(true)
  })

  it('keeps the seat in the cockpit until it hops', () => {
    const t = FLIGHT_MS.touchdown - 100
    const sample = sampleFlight(desktop, t)
    expect(sample.seat.x).toBe(sample.plane.x)
    expect(sample.seat.y).toBe(sample.plane.y)
  })
})
