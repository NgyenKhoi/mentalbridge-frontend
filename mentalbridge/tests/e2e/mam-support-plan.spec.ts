import { expect, type Page } from '@playwright/test'

import { test } from './test-fixtures'
import { crisis, dock } from './mam-dock-helpers'
import { installSupportPlanMocks } from './support-plan-mam-mocks'

// MB-772: the SupportPlan route with the global Mầm (MAM_WEB_ENABLED=true, the
// E2E default). One dock, no legacy aside, the card's own button asks Care once,
// the dock starters answer from reviewed copy, and the original CTA stays.
// The legacy Companion with the flag off is covered by the MB-650..653 specs.

const bubble = (page: Page) => page.getByRole('dialog', { name: 'Mầm' })
const cardButton = (page: Page) =>
  page.getByRole('button', { name: 'Mầm giải thích: Check-in cảm xúc' })
const legacyAside = (page: Page) =>
  page.getByRole('complementary', {
    name: 'Bạn đồng hành trong kế hoạch hỗ trợ',
  })
const cta = (page: Page) =>
  page
    .getByRole('tabpanel', { name: 'Hôm nay' })
    .getByRole('link', { name: 'Ghi lại cảm xúc' })

test.describe('MB-772 SupportPlan with the global Mầm', () => {
  test.use({ timezoneId: 'Asia/Ho_Chi_Minh' })
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack' ||
      process.env.MAM_WEB_ENABLED === 'false',
    'Uses browser-owned fixtures and needs MAM_WEB_ENABLED=true.',
  )

  test('shows one dock and no legacy companion, and asks Care nothing on entry', async ({
    page,
  }) => {
    const requests = await installSupportPlanMocks(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/support-plan')
    await expect(cta(page)).toBeVisible()
    await expect(dock(page)).toBeVisible()
    await expect(page.locator('[data-mam-dock]')).toHaveCount(1)
    await expect(legacyAside(page)).toHaveCount(0)
    await expect(page.getByText('Giải thích', { exact: true })).toHaveCount(0)
    await expect(cardButton(page)).toBeVisible()
    await crisis(page).click({ trial: true })

    for (const tab of ['Kế hoạch', 'Tiến triển', 'Điều chỉnh', 'Hôm nay']) {
      await page.getByRole('tab', { name: tab }).click()
      await expect(page.locator('[data-mam-dock]')).toHaveCount(1)
      await expect(legacyAside(page)).toHaveCount(0)
    }
    await page.waitForTimeout(500)
    expect(requests.companionSurfaces()).toEqual([])
    expect(requests.planMutations()).toBe(0)
  })

  test('the card button opens the bubble pending, shares one request, and keeps the card CTA', async ({
    page,
  }) => {
    const requests = await installSupportPlanMocks(page, {
      companionDelayMs: 600,
    })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/support-plan')
    await expect(cardButton(page)).toBeVisible()

    await cardButton(page).click()
    await cardButton(page).click()
    await expect(bubble(page)).toBeVisible()
    await expect(bubble(page)).toContainText('Mầm đang nghĩ…')
    await expect(bubble(page)).toContainText(
      'Hoạt động này thuộc kế hoạch hiện tại.',
    )
    await expect(bubble(page)).toContainText('AI diễn đạt từ kế hoạch của bạn.')
    // The card keeps its own call to action; the bubble repeats none.
    await expect(bubble(page).getByRole('link')).toHaveCount(0)
    expect(requests.companionSurfaces()).toEqual(['TODAY'])

    await crisis(page).click({ trial: true })
    await cta(page).click({ trial: true })
    await page.keyboard.press('Escape')
    await expect(bubble(page)).toHaveCount(0)
    await expect(cardButton(page)).toBeFocused()
    expect(requests.planMutations()).toBe(0)
  })

  test('shows the approved fallback when Care is unavailable and leaves the card usable', async ({
    page,
  }) => {
    const requests = await installSupportPlanMocks(page, {
      companionUnavailable: true,
    })
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/support-plan')
    await cardButton(page).click()
    await expect(bubble(page)).toContainText(
      'Chưa tải được lời giải thích lúc này. Thử lại sau.',
    )
    await expect(bubble(page)).not.toContainText('AI diễn đạt')
    await expect(cta(page)).toBeEnabled()
    expect(requests.companionSurfaces()).toEqual(['TODAY'])
    expect(requests.planMutations()).toBe(0)
  })

  test('the dock starters answer from the page with no request and lead to the focus card', async ({
    page,
  }) => {
    const requests = await installSupportPlanMocks(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/support-plan')
    await expect(cta(page)).toBeVisible()

    await dock(page).focus()
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Hỏi Mầm về trang này' }).click()
    await bubble(page)
      .getByRole('button', { name: 'Nên bắt đầu từ đâu?' })
      .click()
    await expect(bubble(page)).toContainText(
      'Việc nên làm tiếp: “Check-in cảm xúc”.',
    )
    const go = bubble(page).getByRole('button', { name: 'Đến việc này' })
    await expect(go).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(bubble(page)).toHaveCount(0)
    await expect(cta(page)).toBeFocused()

    await dock(page).click()
    await page.getByRole('button', { name: 'Hỏi Mầm về trang này' }).click()
    await bubble(page).getByRole('button', { name: 'Mầm giải thích' }).click()
    await expect(bubble(page)).toContainText('Tab Hôm nay')
    expect(requests.companionSurfaces()).toEqual([])
  })

  test('Plan rows ask for the PLAN surface and a tab change discards the bubble', async ({
    page,
  }) => {
    const requests = await installSupportPlanMocks(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/support-plan')
    await page.getByRole('tab', { name: 'Kế hoạch' }).click()
    await cardButton(page).click()
    await expect(bubble(page)).toContainText(
      'Hoạt động này thuộc kế hoạch hiện tại.',
    )
    expect(requests.companionSurfaces()).toEqual(['PLAN'])

    await page.getByRole('tab', { name: 'Tiến triển' }).click()
    await expect(bubble(page)).toHaveCount(0)
    await expect(cardButton(page)).toHaveCount(0)
  })

  test('hidden Mầm leaves no card button and the original CTA', async ({
    page,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem('mentalbridge_mam_hidden', 'true'),
    )
    const requests = await installSupportPlanMocks(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/support-plan')
    await expect(cta(page)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Hiện Mầm' })).toBeVisible()
    await expect(cardButton(page)).toHaveCount(0)
    expect(requests.companionSurfaces()).toEqual([])
  })

  test('keeps the bubble inside a phone and Help Now reachable', async ({
    page,
  }) => {
    await installSupportPlanMocks(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/support-plan')
    await cardButton(page).click()
    await expect(bubble(page)).toContainText(
      'Hoạt động này thuộc kế hoạch hiện tại.',
    )
    const rect = await bubble(page).boundingBox()
    expect(rect!.x).toBeGreaterThanOrEqual(15)
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(375 - 15)
    await crisis(page).click({ trial: true })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
})
