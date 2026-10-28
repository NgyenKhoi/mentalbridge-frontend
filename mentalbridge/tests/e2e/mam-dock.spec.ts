import { expect, type Page } from '@playwright/test'

import { test } from './test-fixtures'
import { homeWorld, installHomeMocks } from './home-next-step-mocks'
import {
  crisis,
  dock,
  expectNothingCoveredAtBottom,
  expectPageActionsClickable,
  menu,
  box,
} from './mam-dock-helpers'

// MB-768: one Mầm per tab across eligible USER routes. The E2E servers run
// with MAM_WEB_ENABLED=true (playwright.config.ts, scripts/run-e2e.mjs).

const startToday = (page: Page) =>
  page
    .getByRole('region', { name: 'Bước tiếp theo', exact: true })
    .getByRole('link', { name: 'Bắt đầu ngay', exact: true })

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
      await expect(
        page.getByRole('button', { name: 'Lưu ghi nhận', exact: true }),
      ).toBeVisible()
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
      const firstViewOverlaps = await expectPageActionsClickable(page)
      // Retain the reported first-view regression so this check cannot pass
      // solely because the dock never meets an action in these fixtures.
      if (width === 1440) expect(firstViewOverlaps).toContain('Lưu ghi nhận')
      await expectNothingCoveredAtBottom(page)
      await page.evaluate(() => window.scrollTo(0, 0))
      await startToday(page).click()
      await expect(page).toHaveURL(/\/resources\/[^/?]+/)
      await expect(dock(page)).toBeVisible()
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Viết vài dòng dịu dàng',
          exact: true,
        }),
      ).toBeVisible()
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
      await expectPageActionsClickable(page)
      await expectNothingCoveredAtBottom(page)
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

  test('still yields to page actions without transitions under reduced motion', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await installHomeMocks(page, homeWorld('do-today'))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/dashboard')
    await expect(
      page.getByRole('button', { name: 'Lưu ghi nhận', exact: true }),
    ).toBeVisible()

    expect(await expectPageActionsClickable(page)).toContain('Lưu ghi nhận')
    const root = page.locator('[data-mam-dock]')
    await expect(root).toHaveCSS('opacity', '0.35')
    await expect(root).toHaveCSS('pointer-events', 'none')
    await expect(root).toHaveCSS('transition-duration', '0s')
  })

  test('closes the menu and stays still while the crisis panel is open', async ({
    page,
  }) => {
    await installHomeMocks(page, homeWorld('do-today'))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/dashboard')

    await dock(page).focus()
    await page.keyboard.press('Enter')
    await expect(menu(page)).toBeVisible()
    await crisis(page).click()
    await expect(page.locator('[aria-modal="true"]')).toBeVisible()
    await expect(menu(page)).toHaveCount(0)
    await expect(page.locator('[data-mam-reduced="true"]')).toHaveCount(1)
  })
})
