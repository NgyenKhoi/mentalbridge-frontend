import { describe, expect, it } from 'vitest'

import {
  climbRoom,
  ease,
  hopSteps,
  perchBubble,
  perchClip,
  perchLeft,
  sampleVelocity,
  scrollNeeded,
  stepFlight,
  throwFrom,
  type Flight,
} from './mam-motion'

const bounds = { minX: 4, maxX: 996, floor: 600 }
const FRAME = 1 / 120

// Runs a throw from the floor until it lands; reports the peak and the events.
function fly(vx: number, vy: number, from = 500) {
  const start = throwFrom(vx, vy)
  let flight: Flight = { x: from, y: bounds.floor, rot: 0, ...start }
  let peak = 0
  let bounces = 0
  let frames = 0
  for (; frames < 120 * 20; frames += 1) {
    const step = stepFlight(flight, FRAME, bounds)
    flight = step.flight
    peak = Math.max(peak, bounds.floor - flight.y)
    if (step.event === 'bounce') bounces += 1
    if (step.event === 'land') break
  }
  return { flight, peak, bounces, seconds: frames * FRAME }
}

describe('throwFrom', () => {
  it('always tosses upward, damped and clamped', () => {
    expect(throwFrom(0, 0)).toEqual({ vx: 0, vy: -700, spin: 0 })
    // A hard flick up and sideways stays inside the caps.
    const flick = throwFrom(5000, -9000)
    expect(flick.vx).toBe(600)
    expect(flick.vy).toBe(-1150)
    expect(flick.spin).toBeCloseTo(600 * 0.35)
    // A downward fling is still tossed up.
    expect(throwFrom(0, 4000).vy).toBe(-700)
  })
})

describe('flight', () => {
  it('a plain drop hops about 90 px', () => {
    const { peak } = fly(0, 0)
    expect(peak).toBeGreaterThan(80)
    expect(peak).toBeLessThan(105)
  })

  it('a hard flick peaks near 250 px and never above 260', () => {
    const { peak } = fly(0, -9000)
    expect(peak).toBeGreaterThan(235)
    expect(peak).toBeLessThan(260)
  })

  it('bounces on a fast landing, then lands', () => {
    const { bounces, flight } = fly(0, -9000)
    expect(bounces).toBeGreaterThanOrEqual(1)
    expect(flight.y).toBe(bounds.floor)
  })

  it('lands without a bounce when it falls slowly, and bounces from 700 px/s up', () => {
    const slow: Flight = { x: 500, y: 598, vx: 0, vy: 300, rot: 0, spin: 0 }
    expect(stepFlight(slow, FRAME, bounds).event).toBe('land')
    const fast = { ...slow, vy: 900 }
    const bounce = stepFlight(fast, FRAME, bounds)
    expect(bounce.event).toBe('bounce')
    expect(bounce.flight.vy).toBeCloseTo(-(900 + 2600 * FRAME) * 0.36)
  })

  it('bounces off the side walls, halving speed and flipping the spin', () => {
    const wall: Flight = { x: 3, y: 300, vx: -400, vy: 0, rot: 0, spin: 100 }
    const { flight, event } = stepFlight(wall, FRAME, bounds)
    expect(event).toBe('none')
    expect(flight.x).toBe(bounds.minX)
    expect(flight.vx).toBe(200)
    expect(flight.spin).toBeLessThan(0)
  })

  it('spin decays at the same rate whatever the frame time', () => {
    const start: Flight = { x: 500, y: 300, vx: 0, vy: 0, rot: 0, spin: 100 }
    const one = stepFlight(start, 1 / 60, bounds).flight.spin
    const half = stepFlight(
      stepFlight(start, 1 / 120, bounds).flight,
      1 / 120,
      bounds,
    ).flight.spin
    expect(one).toBeCloseTo(100 * 0.985)
    expect(half).toBeCloseTo(one, 5)
  })
})

describe('hop home', () => {
  it('walks to the dock in steps of at most 110 px', () => {
    const steps = hopSteps(900, 100)
    expect(steps.every((step) => Math.abs(step) <= 110)).toBe(true)
    expect(900 + steps.reduce((sum, step) => sum + step, 0)).toBeCloseTo(100)
    expect(steps).toHaveLength(8)
  })

  it('hops toward the dock from either side, and not at all when home', () => {
    expect(hopSteps(0, 50)).toEqual([50])
    expect(hopSteps(200, 100)[0]).toBeLessThan(0)
    expect(hopSteps(101, 100)).toEqual([])
  })

  it('lands at the dock after a flight and its hops', () => {
    const dockX = 24
    const { flight } = fly(600, -9000, 700)
    const steps = hopSteps(flight.x, dockX)
    expect(flight.x + steps.reduce((sum, step) => sum + step, 0)).toBeCloseTo(
      dockX,
    )
  })
})

describe('sampleVelocity', () => {
  it('measures px per second over the window, and is zero without motion', () => {
    expect(
      sampleVelocity([
        { t: 0, x: 0, y: 0 },
        { t: 50, x: 10, y: -30 },
      ]),
    ).toEqual({ vx: 200, vy: -600 })
    expect(sampleVelocity([{ t: 0, x: 5, y: 5 }])).toEqual({ vx: 0, vy: 0 })
    expect(sampleVelocity([])).toEqual({ vx: 0, vy: 0 })
  })
})

describe('easing', () => {
  it.each(Object.entries(ease))('%s runs from 0 to 1', (_name, curve) => {
    expect(curve(0)).toBeCloseTo(0)
    expect(curve(1)).toBeCloseTo(1)
  })

  it('back overshoots and inBack pulls back first', () => {
    expect(Math.max(...[0.6, 0.7, 0.8].map(ease.back))).toBeGreaterThan(1)
    expect(ease.inBack(0.2)).toBeLessThan(0)
  })
})

describe('perch geometry', () => {
  it('needs 0.64·S + 16 px above the card, scrolling only the shortfall', () => {
    expect(climbRoom(96)).toBeCloseTo(77.44)
    expect(climbRoom(72)).toBeCloseTo(62.08)
    // Header bottom at 76: a card top at 100 needs 53.44 more (scroll up).
    expect(scrollNeeded(100, 76, 96, 900)).toBeCloseTo(-53.44)
    expect(scrollNeeded(400, 76, 96, 900)).toBe(0)
    // An edge below the fold scrolls down until it sits 48 px above the bottom.
    expect(scrollNeeded(940, 76, 96, 900)).toBe(88)
    expect(scrollNeeded(852, 76, 96, 900)).toBe(0)
  })

  it('stands 28 px inside the card edge, clamped 8 px inside the viewport', () => {
    expect(perchLeft(800, 96, 1200)).toBe(676)
    expect(perchLeft(60, 96, 1200)).toBe(8)
    expect(perchLeft(1400, 96, 1200)).toBe(1096)
  })

  it('clips below the card top and above the header, in layer coordinates', () => {
    // Layer at y 700, 96 high: the card top at 300 leaves 496 px below it.
    expect(perchClip(700, 96, 300, 76)).toBe(
      'inset(-624px -100vw 496px -100vw)',
    )
  })

  const base = {
    width: 310,
    height: 120,
    size: 96,
    cardTop: 300,
    charTop: 240,
    viewportWidth: 1200,
    viewportHeight: 800,
    visibleTop: 76,
  }

  it('opens left of Mầm: right edge 12 px away, bottom 22 px below the card top', () => {
    const placed = perchBubble({ ...base, charLeft: 700 })
    expect(placed).toEqual({
      left: 700 - 12 - 310,
      top: 300 + 22 - 120,
      side: 'left',
    })
  })

  it('treats the sidebar as no room: it flips right instead of sliding under it', () => {
    const placed = perchBubble({ ...base, charLeft: 384, viewportLeft: 232 })
    expect(placed.side).toBe('right')
    expect(placed.left).toBe(384 + 96 + 12)
  })

  it('flips to the right when the left has no room', () => {
    const placed = perchBubble({ ...base, charLeft: 200 })
    expect(placed.side).toBe('right')
    expect(placed.left).toBe(200 + 96 + 12)
  })

  it('goes above Mầm when neither side fits, and never above the header', () => {
    const narrow = perchBubble({
      ...base,
      viewportWidth: 390,
      width: 358,
      charLeft: 150,
    })
    expect(narrow.side).toBe('above')
    expect(narrow.left).toBeGreaterThanOrEqual(16)
    expect(narrow.left + 358).toBeLessThanOrEqual(374)
    const tall = perchBubble({ ...base, height: 900, charLeft: 700 })
    expect(tall.top).toBeGreaterThanOrEqual(76 + 16)
  })

  it('keeps the bubble inside the viewport bottom when the card is low', () => {
    const low = perchBubble({
      ...base,
      cardTop: 780,
      charTop: 720,
      charLeft: 700,
    })
    expect(low.top + base.height).toBeLessThanOrEqual(800 - 16)
  })
})
