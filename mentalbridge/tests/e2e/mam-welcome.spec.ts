import { expect, type Page } from '@playwright/test'

import { test } from './test-fixtures'
import { homeWorld, installHomeMocks } from './home-next-step-mocks'
import { dockRoot } from './mam-dock-helpers'

// MB-894: the welcome airplane on /dashboard, with the real v0.7 asset. An automated browser only gets
// the scene with `?mamWelcome=1` (docs/ADR_MAM_RIVE_V2_CONTRACT.md), which is how every test below starts it.

const startToday = (page: Page) =>
  page
    .getByRole('region', { name: 'Bước tiếp theo', exact: true })
    .getByRole('link', { name: 'Bắt đầu ngay', exact: true })
const planes = (page: Page) => page.locator('[data-mam-plane]')
const open = async (page: Page, url = '/dashboard?mamWelcome=1') => {
  await installHomeMocks(page, homeWorld('do-today'))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(url)
}

test.describe('MB-894 Mầm welcome airplane', () => {
  test.use({ timezoneId: 'Asia/Ho_Chi_Minh' })
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'The welcome scene uses browser-owned fixtures only.',
  )

  test('flies in, lands, hops into the dock and greets, within 9 s', async ({
    page,
  }) => {
    await open(page)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'welcome', {
      timeout: 10_000,
    })
    await expect(page.locator('[data-mam-plane="front"]')).toHaveCount(1)
    // One Mầm, in the plane, with nothing blocking the page.
    await expect(page.locator('[data-mam-dock]')).toHaveCount(1)
    await expect(dockRoot(page)).toHaveAttribute('data-front', 'true')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'dock', {
      timeout: 9_000,
    })
    await expect(dockRoot(page)).toHaveAttribute('data-mam-shot', 'wave')
    await expect(planes(page)).toHaveCount(0, { timeout: 3_000 })
    await expect(dockRoot(page)).toHaveAttribute('data-mam-shot', '', {
      timeout: 4_000,
    })
  })

  test('a click on a page action mid-flight skips the scene and still activates the action', async ({
    page,
  }) => {
    await open(page)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'welcome', {
      timeout: 10_000,
    })
    await startToday(page).click()
    await expect(page).toHaveURL(/\/resources\/[^/?]+/)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'dock')
    await expect(planes(page)).toHaveCount(0, { timeout: 3_000 })
  })

  test('a click right under the flying Mầm reaches the page and skips the scene', async ({
    page,
  }) => {
    await open(page)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'welcome', {
      timeout: 10_000,
    })
    // A full-screen page control sits below the dock layer and counts the clicks it receives.
    await page.evaluate(() => {
      const probe = document.createElement('button')
      probe.type = 'button'
      probe.ariaLabel = 'probe'
      Object.assign(probe.style, {
        position: 'fixed',
        inset: '0',
        opacity: '0',
        border: '0',
        zIndex: '100',
      })
      probe.addEventListener('click', () => {
        const w = window as unknown as { probeClicks?: number }
        w.probeClicks = (w.probeClicks ?? 0) + 1
      })
      document.body.append(probe)
    })
    // Her centre now, in the page: nothing of the dock may be the hit target there.
    const spot = await page.evaluate(() => {
      const rect = document
        .querySelector('[data-mam-dock] [data-mam-status]')!
        .getBoundingClientRect()
      const x = rect.left + rect.width / 2
      const y = rect.top + rect.height / 2
      return {
        x,
        y,
        inDock: Boolean(
          document.elementFromPoint(x, y)?.closest('[data-mam-dock]'),
        ),
      }
    })
    expect(spot.inDock).toBe(false)
    await page.mouse.click(spot.x, spot.y)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'dock')
    expect(
      await page.evaluate(
        () => (window as unknown as { probeClicks?: number }).probeClicks,
      ),
    ).toBe(1)
  })

  test('a press elsewhere skips it at once and leaves the page usable', async ({
    page,
  }) => {
    await open(page)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'welcome', {
      timeout: 10_000,
    })
    await page.mouse.move(700, 300)
    await page.mouse.down()
    await page.mouse.up()
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'dock')
    await expect(planes(page)).toHaveCount(0, { timeout: 3_000 })
    await expect(startToday(page)).toBeVisible()
  })

  test('a key press (Tab) skips it and the dock stays reachable by keyboard', async ({
    page,
  }) => {
    await open(page)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'welcome', {
      timeout: 10_000,
    })
    await page.keyboard.press('Tab')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'dock')
    await expect(planes(page)).toHaveCount(0, { timeout: 3_000 })
    const mam = page.getByRole('button', { name: 'Mầm', exact: true })
    await expect(mam).not.toHaveAttribute('tabindex', '-1')
    await mam.focus()
    await expect(mam).toBeFocused()
  })

  test('does not replay after navigating away and back', async ({ page }) => {
    await open(page)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'welcome', {
      timeout: 10_000,
    })
    await startToday(page).click()
    await expect(page).toHaveURL(/\/resources\/[^/?]+/)
    await page.goBack()
    await expect(page).toHaveURL(/\/dashboard/)
    await page.waitForTimeout(2_500)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'dock')
    await expect(planes(page)).toHaveCount(0)
  })

  test('never starts under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page)
    await expect(
      page.locator('[data-mam-dock] [data-mam-reduced="true"]'),
    ).toHaveCount(1)
    await page.waitForTimeout(2_500)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'dock')
    await expect(planes(page)).toHaveCount(0)
  })

  test('is skipped without the asset: static fallback, no scene', async ({
    page,
  }) => {
    await page.route('**/mam/mam-v07.riv', (route) => route.abort('failed'))
    await open(page)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-dizzy', 'true')
    await page.waitForTimeout(2_500)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'dock')
    await expect(planes(page)).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Mầm đang gặp sự cố' }),
    ).toBeVisible()
  })

  test('an automated browser does not get the scene without the replay query', async ({
    page,
  }) => {
    await open(page, '/dashboard')
    await page.waitForTimeout(2_500)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'dock')
    await expect(planes(page)).toHaveCount(0)
  })
})
