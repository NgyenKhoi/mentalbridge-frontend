import { describe, expect, it } from 'vitest'
import { clampPip, pipCorner } from './video-pip'
describe('bounded call PiP presentation', () => {
  const bounds = { width: 1000, height: 600, pipWidth: 256, pipHeight: 176 }
  it('defaults bottom-right, cycles through four corners and reserves controls/status space', () => {
    expect(pipCorner(0, bounds)).toEqual({ x: 720, y: 328 })
    expect(pipCorner(1, bounds)).toEqual({ x: 20, y: 328 })
    expect(pipCorner(2, bounds)).toEqual({ x: 20, y: 72 })
    expect(pipCorner(3, bounds)).toEqual({ x: 720, y: 72 })
    expect(clampPip({ x: -500, y: -500 }, bounds)).toEqual({ x: 12, y: 64 })
    expect(clampPip({ x: 9000, y: 9000 }, bounds)).toEqual({ x: 732, y: 328 })
  })
  it('clamps an already dragged PiP after desktop-to-mobile resize', () => {
    expect(
      clampPip(
        { x: 720, y: 328 },
        { width: 288, height: 540, pipWidth: 208, pipHeight: 144 },
      ),
    ).toEqual({ x: 68, y: 300 })
  })
})
