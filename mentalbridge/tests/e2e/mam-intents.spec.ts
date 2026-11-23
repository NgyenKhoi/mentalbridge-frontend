import { expect, type Page } from '@playwright/test'

import { test } from './test-fixtures'
import { homeWorld, installHomeMocks } from './home-next-step-mocks'
import { dockRoot } from './mam-dock-helpers'

// MB-896: the orchestrator (docs/ADR_MAM_RIVE_V2_CONTRACT.md "Orchestrator"), driven by its QA trigger
// `?mamIntent=<INTENT>` (and `&mamVariation=<id>`), with the real v0.8 asset. Automated browsers skip the
// automatic welcome, so nothing but the trigger plays here. `/analytics` is a FULL route with no page action under the
// dock (on `/dashboard` the dock yields to one, which blocks the touch and idle looks by design).

const INTENTS = [
  'WELCOME',
  'IDLE',
  'HAPPY',
  'CELEBRATE',
  'ENCOURAGE',
  'COMFORT',
  'LISTEN',
  'THINK',
  'GUIDE',
  'REST',
] as const

const props = (page: Page) => page.locator('[data-mam-prop]')
const open = async (
  page: Page,
  query: string,
  { path = '/analytics', width = 1440 } = {},
) => {
  await installHomeMocks(page, homeWorld('do-today'))
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 })
  await page.goto(`${path}?${query}`)
}
const variation = (page: Page) =>
  dockRoot(page).getAttribute('data-mam-variation')

test.describe('MB-896 Mầm intents', () => {
  test.use({ timezoneId: 'Asia/Ho_Chi_Minh' })
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'The orchestrator specs use browser-owned fixtures only.',
  )

  for (const intent of INTENTS) {
    test(`${intent} plays one variation of its own on a FULL route, then returns to idle`, async ({
      page,
    }) => {
      test.setTimeout(60_000)
      // REST would lie her down until woken: its nap in place ends by itself.
      const forced = intent === 'REST' ? '&mamVariation=blanket_tuck' : ''
      await open(page, `mamIntent=${intent}${forced}`)
      await expect(dockRoot(page)).toHaveAttribute('data-mam-intent', intent, {
        timeout: 12_000,
      })
      expect(await variation(page)).not.toBe('')
      // Back to idle: nothing running, no prop left behind, Mầm in the dock.
      await expect(dockRoot(page)).toHaveAttribute('data-mam-intent', '', {
        timeout: 14_000,
      })
      await expect(props(page)).toHaveCount(0)
      await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'dock')
      await expect(dockRoot(page)).toHaveAttribute('data-mam-last', /.+/)
    })
  }

  test('the host props appear with their variation and are gone after it', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await open(page, 'mamIntent=COMFORT&mamVariation=umbrella')
    await expect(page.locator('[data-mam-prop="umbrella"]')).toHaveCount(1, {
      timeout: 10_000,
    })
    await expect(props(page)).toHaveCount(0, { timeout: 8_000 })

    await page.goto('/analytics?mamIntent=IDLE&mamVariation=butterfly')
    await expect(page.locator('[data-mam-prop="butterfly"]')).toHaveCount(1, {
      timeout: 10_000,
    })
    await expect(props(page)).toHaveCount(0, { timeout: 8_000 })

    await page.goto('/analytics?mamIntent=CELEBRATE&mamVariation=cheer_sign')
    await expect(page.locator('[data-mam-prop="cheerSign"]')).toHaveText(
      'Giỏi lắm!',
      { timeout: 10_000 },
    )
    await expect(props(page)).toHaveCount(0, { timeout: 6_000 })
  })

  test('the plant pot has a back and a front layer around her and leaves nothing behind', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await open(page, 'mamIntent=WELCOME&mamVariation=plant_pot')
    await expect(page.locator('[data-mam-prop="plantPot"]')).toHaveCount(2, {
      timeout: 10_000,
    })
    await expect(dockRoot(page)).toHaveAttribute('data-mam-intent', '', {
      timeout: 12_000,
    })
    await expect(props(page)).toHaveCount(0)
  })

  test('the parachute descends in front of the page, and a click skips it at once and still reaches the page', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await open(page, 'mamIntent=WELCOME&mamVariation=parachute')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'scene', {
      timeout: 10_000,
    })
    await expect(page.locator('[data-mam-prop="parachute"]')).toHaveCount(1)
    await expect(dockRoot(page)).toHaveAttribute('data-front', 'true')
    await page.mouse.click(700, 300)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'dock', {
      timeout: 1_500,
    })
    await expect(dockRoot(page)).toHaveAttribute('data-mam-intent', '')
    await expect(props(page)).toHaveCount(0)
  })

  test('the parachute lands on its own and ends in the dock', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await open(page, 'mamIntent=WELCOME&mamVariation=parachute')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'scene', {
      timeout: 10_000,
    })
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'dock', {
      timeout: 8_000,
    })
    await expect(dockRoot(page)).toHaveAttribute('data-mam-intent', '', {
      timeout: 4_000,
    })
    await expect(props(page)).toHaveCount(0)
  })

  test('a route change mid-sequence cancels it and leaves nothing on the next route', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await open(page, 'mamIntent=IDLE&mamVariation=butterfly')
    await expect(page.locator('[data-mam-prop="butterfly"]')).toHaveCount(1, {
      timeout: 10_000,
    })
    await page
      .getByRole('navigation', { name: 'Điều hướng chính' })
      .locator('a[href="/achievements"]')
      .first()
      .click()
    await expect(page).toHaveURL(/\/achievements/)
    await expect(props(page)).toHaveCount(0)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-intent', '')
  })

  test('a QUIET route plays only the looks marked for it, and never a welcome', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await open(page, 'mamIntent=HAPPY', { path: '/journal' })
    await expect(dockRoot(page)).toHaveAttribute('data-mam-mode', 'quiet')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-last', 'happy', {
      timeout: 12_000,
    })

    await page.goto('/journal?mamIntent=WELCOME')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-mode', 'quiet')
    await page.waitForTimeout(2_500)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-last', '')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'dock')
    await expect(props(page)).toHaveCount(0)
  })

  test('reduced motion plays nothing', async ({ page }) => {
    test.setTimeout(60_000)
    // The dev trigger waits for a calm host, so under reduced motion it never reaches the orchestrator; the
    // `skipped: reduced` reason itself is covered by the orchestrator unit tests. This proves nothing plays.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page, 'mamIntent=CELEBRATE')
    await expect(page.locator('[data-mam-dock]')).toHaveCount(1)
    await page.waitForTimeout(2_500)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-last', '')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-intent', '')
  })

  test('an expressive look grows her from her feet (1.25 desktop, 1.15 compact) and lets go; a micro look does not', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    // The scale of the flight box, read from its computed transform matrix (a, d).
    const scale = () =>
      page.evaluate(() => {
        const box = document.querySelector('[data-mam-dock] [data-flight]')
        if (!box) return -1
        const m = new DOMMatrixReadOnly(getComputedStyle(box).transform)
        return Math.round(m.a * 100) / 100
      })
    await open(page, 'mamIntent=HAPPY&mamVariation=tiny_dance')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-emphasis', 'true', {
      timeout: 10_000,
    })
    await expect.poll(scale).toBe(1.25)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-emphasis', 'false', {
      timeout: 6_000,
    })
    await expect.poll(scale).toBe(1)

    await open(page, 'mamIntent=HAPPY&mamVariation=tiny_dance', { width: 375 })
    await expect.poll(scale, { timeout: 10_000 }).toBe(1.15)

    await open(page, 'mamIntent=ENCOURAGE&mamVariation=nod')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-variation', 'nod', {
      timeout: 10_000,
    })
    await expect(dockRoot(page)).toHaveAttribute('data-mam-emphasis', 'false')
    expect(await scale()).toBe(1)
  })

  test('the cheer sign reads on the compact dock: text of 12 px or more, the whole board on screen', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await open(page, 'mamIntent=CELEBRATE&mamVariation=cheer_sign', {
      width: 375,
    })
    const sign = page.locator('[data-mam-prop="cheerSign"]')
    await expect(sign).toHaveCount(1, { timeout: 12_000 })
    const measure = await sign.evaluate((svg) => {
      const text = svg.querySelector('text')!
      const board = svg.querySelector('rect[rx="20"]')!.getBoundingClientRect()
      return {
        px:
          (svg.getBoundingClientRect().width / 512) *
          Number(text.getAttribute('font-size')),
        left: board.left,
        right: board.right,
        top: board.top,
        viewport: window.innerWidth,
      }
    })
    expect(measure.px).toBeGreaterThanOrEqual(12)
    expect(measure.left).toBeGreaterThanOrEqual(0)
    expect(measure.right).toBeLessThanOrEqual(measure.viewport)
    expect(measure.top).toBeGreaterThanOrEqual(0)
    await expect(props(page)).toHaveCount(0, { timeout: 6_000 })
  })
})
