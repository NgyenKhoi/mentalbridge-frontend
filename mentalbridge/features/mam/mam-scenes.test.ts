import { describe, expect, it } from 'vitest'

import {
  BUTTERFLY_MS,
  BUTTERFLY_PATH,
  butterflyAt,
  DANCE_MS,
  danceMotion,
  gazeToward,
  PARACHUTE_MS,
  parachuteDescent,
  SPIN_MS,
  spinHop,
} from './mam-scenes'

describe('parachuteDescent', () => {
  it('starts above the dock, comes down without ever rising, and ends exactly home', () => {
    const height = 700
    expect(parachuteDescent(0, height).y).toBe(-height)
    let previous = -Infinity
    for (let ms = 0; ms <= PARACHUTE_MS; ms += 60) {
      const frame = parachuteDescent(ms, height)
      expect(frame.y).toBeGreaterThanOrEqual(previous)
      expect(frame.y).toBeLessThanOrEqual(0)
      previous = frame.y
    }
    expect(parachuteDescent(PARACHUTE_MS, height)).toEqual({
      x: expect.closeTo(0, 6),
      y: 0,
      rot: expect.closeTo(0, 6),
      sx: 1,
      sy: 1,
    })
  })

  it('sways and counter-tilts, then squashes a little on touchdown', () => {
    const xs = Array.from(
      { length: 40 },
      (_, i) => parachuteDescent(i * 100, 600).x,
    )
    expect(Math.max(...xs)).toBeGreaterThan(8)
    expect(Math.min(...xs)).toBeLessThan(-8)
    const frame = parachuteDescent(PARACHUTE_MS * 0.965, 600)
    expect(frame.sy).toBeLessThan(1)
    expect(frame.sx).toBeGreaterThan(1)
    // Clamped outside the run.
    expect(parachuteDescent(-50, 600)).toEqual(parachuteDescent(0, 600))
    expect(parachuteDescent(PARACHUTE_MS * 2, 600).y).toBe(0)
  })
})

describe('butterfly path', () => {
  it('fades in and out, stays inside the dock area and interpolates between stops', () => {
    expect(BUTTERFLY_PATH[0]!.o).toBe(0)
    expect(BUTTERFLY_PATH.at(-1)!.o).toBe(0)
    for (const stop of BUTTERFLY_PATH) {
      expect(Math.abs(stop.x)).toBeLessThanOrEqual(0.75)
      expect(Math.abs(stop.y)).toBeLessThanOrEqual(0.65)
    }
    expect(butterflyAt(0.25).x).toBeCloseTo(0.1)
    expect(butterflyAt(0.25).y).toBeCloseTo(-0.28)
    const mid = butterflyAt(0.375)
    expect(mid.x).toBeGreaterThan(-0.42)
    expect(mid.x).toBeLessThan(0.1)
    expect(butterflyAt(-1).t).toBe(0)
    expect(butterflyAt(2).o).toBe(0)
    expect(BUTTERFLY_MS).toBeGreaterThan(3000)
  })

  it('maps the butterfly side to a gaze in -1 to 1', () => {
    expect(gazeToward(-0.42)).toBeLessThan(-0.5)
    expect(gazeToward(0.48)).toBeGreaterThan(0.5)
    expect(gazeToward(5)).toBe(1)
    expect(gazeToward(-5)).toBe(-1)
    expect(gazeToward(0)).toBe(0)
  })
})

describe('dance and spin travel', () => {
  it('hops on every beat with the top three quarters in, and rests at both ends', () => {
    const ground = danceMotion(200 + 83.3)
    const top = danceMotion(200 + 250)
    expect(ground.y).toBeCloseTo(0, 0)
    expect(top.y).toBeLessThan(-6)
    expect(danceMotion(0).y).toBe(0)
    expect(danceMotion(DANCE_MS).y).toBe(0)
    expect(danceMotion(DANCE_MS).x).toBe(0)
    const xs = Array.from({ length: 25 }, (_, i) => danceMotion(i * 100).x)
    expect(Math.max(...xs)).toBeGreaterThan(6)
    expect(Math.min(...xs)).toBeLessThan(-6)
    // It scales with the dock size and never turns or squashes the character itself.
    expect(danceMotion(450, 0.75).y).toBeCloseTo(danceMotion(450).y * 0.75, 5)
    expect(danceMotion(450)).toMatchObject({ rot: 0, sx: 1, sy: 1 })
  })

  it('spins in one hop over the asset jump and is home before it ends', () => {
    expect(spinHop(0).y).toBe(0)
    expect(spinHop(100).y).toBe(0)
    expect(spinHop(530).y).toBeLessThan(-12)
    expect(spinHop(950).y).toBe(0)
    expect(spinHop(SPIN_MS).y).toBe(0)
    expect(spinHop(530, 0.75).y).toBeCloseTo(spinHop(530).y * 0.75, 5)
  })
})
