import { expect, type Locator, type Page } from '@playwright/test'

import { test } from './test-fixtures'
import { homeWorld, installHomeMocks } from './home-next-step-mocks'

// MB-768: one Mầm per tab across eligible USER routes. The E2E servers run
// with MAM_WEB_ENABLED=true (playwright.config.ts, scripts/run-e2e.mjs).

const dock = (page: Page) =>
  page.getByRole('button', { name: 'Mầm', exact: true })
const menu = (page: Page) => page.getByRole('group', { name: 'Mầm' })
const startToday = (page: Page) =>
  page
    .getByRole('region', { name: 'Bước tiếp theo', exact: true })
    .getByRole('link', { name: 'Bắt đầu ngay', exact: true })
const crisis = (page: Page) =>
  page.getByRole('button', { name: 'Mở hỗ trợ khẩn cấp' })

async function box(locator: Locator) {
  const value = await locator.boundingBox()
  if (!value) throw new Error('element has no box')
  return value
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  )
}

async function expectNothingCovered(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  const dockBox = await box(dock(page))
  expect(overlaps(dockBox, await box(crisis(page)))).toBe(false)
  const covered = await page.evaluate((rect) => {
    const hits: string[] = []
    for (const element of document.querySelectorAll<HTMLElement>(
      '.ref-content a, .ref-content button, .ref-content input, .ref-content textarea',
    )) {
      const r = element.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (
        r.left < rect.x + rect.width &&
        rect.x < r.right &&
        r.top < rect.y + rect.height &&
        rect.y < r.bottom
      )
        hits.push(element.textContent?.trim() || element.tagName)
    }
    return hits
  }, dockBox)
  expect(covered).toEqual([])
}

test.describe('MB-768 Mầm dock', () => {
  test.use({ timezoneId: 'Asia/Ho_Chi_Minh' })
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'The dock journey uses browser-owned fixtures only.',
  )

  test('keeps one character across USER navigation and leaves on hidden surfaces', async ({
    page,
  }) => {
    const hydrationErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error' && /hydrat/i.test(message.text()))
        hydrationErrors.push(message.text())
    })
    await installHomeMocks(page, homeWorld('do-today'))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/dashboard')

    await expect(dock(page)).toBeVisible()
    await expect(page.locator('[data-mam-dock]')).toHaveCount(1)
    await page
      .locator('[data-mam-dock] canvas')
      .evaluate((canvas) => canvas.setAttribute('data-e2e-mark', 'first'))

    // Dashboard and resource detail sit under different USER layouts.
    await startToday(page).click()
    await expect(page).toHaveURL(/\/resources\/[^/?]+/)
    await expect(page.locator('[data-mam-dock] canvas')).toHaveAttribute(
      'data-e2e-mark',
      'first',
    )
    await expect(page.locator('[data-mam-dock]')).toHaveCount(1)

    const nav = page.getByRole('navigation', { name: 'Điều hướng chính' })

    await nav.getByRole('link', { name: 'Kế hoạch hỗ trợ' }).click()
    await expect(page).toHaveURL(/\/support-plan/)
    await expect(page.locator('[data-mam-dock]')).toHaveCount(0)

    await nav.getByRole('link', { name: 'Tổng quan' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(dock(page)).toBeVisible()
    expect(hydrationErrors).toEqual([])
  })

  test('never shows on public pages', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('main, form').first()).toBeVisible()
    await expect(page.locator('[data-mam-dock]')).toHaveCount(0)
  })

  for (const width of [1440, 1280, 768, 375]) {
    test(`covers no action or the crisis button at ${width}`, async ({
      page,
    }) => {
      await installHomeMocks(page, homeWorld('do-today'))
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/dashboard')
      await expect(dock(page)).toBeVisible()
      await expectNothingCovered(page)
      await page.evaluate(() => window.scrollTo(0, 0))
      await startToday(page).click()
      await expect(page).toHaveURL(/\/resources\/[^/?]+/)
      await expect(dock(page)).toBeVisible()
      await expectNothingCovered(page)
    })
  }

  test('menu, hide and motion controls work by keyboard and persist', async ({
    page,
  }) => {
    await installHomeMocks(page, homeWorld('do-today'))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/dashboard')

    await dock(page).focus()
    await page.keyboard.press('Enter')
    await expect(dock(page)).toHaveAttribute('aria-expanded', 'true')
    await expect(menu(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu(page)).toHaveCount(0)
    await expect(dock(page)).toBeFocused()

    await page.keyboard.press('Enter')
    await page.getByRole('switch', { name: 'Chuyển động' }).press('Space')
    await expect(page.locator('[data-mam-reduced="true"]')).toHaveCount(1)
    await page.getByRole('button', { name: 'Ẩn Mầm' }).press('Enter')
    const handle = page.getByRole('button', { name: 'Hiện Mầm' })
    await expect(handle).toBeFocused()

    await page.reload()
    await expect(handle).toBeVisible()
    await expect(dock(page)).toHaveCount(0)
    await handle.click()
    await expect(dock(page)).toBeFocused()
    await expect(page.locator('[data-mam-reduced="true"]')).toHaveCount(1)
  })

  test('steps aside while keyboard focus sits under the dock', async ({
    page,
  }) => {
    await installHomeMocks(page, homeWorld('do-today'))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/dashboard')
    const root = page.locator('[data-mam-dock]')
    const rect = await box(dock(page))
    await page.evaluate((r) => {
      const probe = document.createElement('button')
      probe.textContent = 'probe'
      probe.style.cssText = `position:fixed;left:${r.x + 8}px;top:${r.y + 8}px;width:40px;height:30px`
      document.querySelector('.ref-content')?.appendChild(probe)
    }, rect)

    await page.getByRole('button', { name: 'probe' }).focus()
    await expect(root).toHaveAttribute('data-yield', 'true')
    await expect(root).toHaveCSS('opacity', '0')
    await dock(page).evaluate((element) =>
      (element as HTMLButtonElement).focus(),
    )
    await expect(root).toHaveAttribute('data-yield', 'false')
  })

  test('closes the menu and stays still while the crisis panel is open', async ({
    page,
  }) => {
    await installHomeMocks(page, homeWorld('do-today'))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/dashboard')

    await dock(page).click()
    await expect(menu(page)).toBeVisible()
    await crisis(page).click()
    await expect(page.locator('[aria-modal="true"]')).toBeVisible()
    await expect(menu(page)).toHaveCount(0)
    await expect(page.locator('[data-mam-reduced="true"]')).toHaveCount(1)
  })
})
