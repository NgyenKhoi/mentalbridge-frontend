import { spotlightRect, tooltipLayout } from './tour-layout'
import { GUIDE_STEPS } from './guide-steps'

it('pads the measured target by 8 and clips only at viewport edges', () => {
  expect(
    spotlightRect({ x: 40, y: 90, width: 80, height: 44 }, 390, 844),
  ).toEqual({ x: 32, y: 82, width: 96, height: 60 })
  expect(
    spotlightRect({ x: 0, y: 800, width: 390, height: 44 }, 390, 844),
  ).toEqual({ x: 0, y: 792, width: 390, height: 52 })
})

it.each([
  [390, 844, { x: 8, y: 766, width: 70, height: 58 }],
  [390, 844, { x: 320, y: 766, width: 65, height: 58 }],
  [844, 390, { x: 280, y: 90, width: 280, height: 70 }],
  [320, 568, { x: 25, y: 110, width: 270, height: 80 }],
  [768, 1024, { x: 200, y: 600, width: 300, height: 50 }],
] as const)(
  'keeps tooltip inside safe bounds at %sx%s',
  (width, height, target) => {
    const card = tooltipLayout(
      target,
      { width, height, top: 24, bottom: 24 },
      300,
    )
    expect(card.x).toBeGreaterThanOrEqual(16)
    expect(card.y).toBeGreaterThanOrEqual(40)
    expect(card.x + card.width).toBeLessThanOrEqual(width - 16)
    expect(card.y + card.height).toBeLessThanOrEqual(height - 40)
    expect(card.height).toBeGreaterThan(150)
  },
)

it('points down to a bottom tab and uses a side when landscape has more room', () => {
  expect(
    tooltipLayout(
      { x: 10, y: 750, width: 70, height: 60 },
      { width: 390, height: 844, top: 24, bottom: 24 },
      260,
    ).side,
  ).toBe('top')
  expect(
    tooltipLayout(
      { x: 600, y: 120, width: 80, height: 60 },
      { width: 844, height: 390, top: 24, bottom: 24 },
      260,
    ).side,
  ).toBe('left')
})

it('preserves room for dismissal on a very short viewport', () => {
  const card = tooltipLayout(
    { x: 20, y: 110, width: 280, height: 40 },
    { width: 320, height: 240, top: 24, bottom: 24 },
    300,
  )
  expect(card.height).toBe(160)
  expect(card.y + card.height).toBeLessThanOrEqual(200)
})

it('configures six stable native anchors per role and includes no invented appointment', () => {
  for (const steps of Object.values(GUIDE_STEPS)) {
    expect(steps).toHaveLength(6)
    expect(new Set(steps.map((step) => step.target)).size).toBe(6)
    for (const step of steps) expect(step.route).toMatch(/^\//)
  }
  expect(GUIDE_STEPS.SPECIALIST[3]?.target).toBe(
    'specialist-appointment-actions',
  )
})
