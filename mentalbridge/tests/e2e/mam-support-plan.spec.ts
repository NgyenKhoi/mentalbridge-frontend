import { expect, type Page } from '@playwright/test'

import { test } from './test-fixtures'
import {
  box,
  character,
  crisis,
  dock,
  dockRoot,
  travelling,
} from './mam-dock-helpers'
import { installSupportPlanMocks } from './support-plan-mam-mocks'

// MB-772: the SupportPlan route with the global Mầm (MAM_WEB_ENABLED=true, the
// E2E default). One dock, no legacy aside, the card's own button asks Care once,
// the dock starters answer from reviewed copy, and the original CTA stays.
// The legacy Companion with the flag off is covered by the MB-650..653 specs.

const bubble = (page: Page) => page.getByRole('dialog', { name: 'Mầm' })
const cardButton = (page: Page) =>
  page.getByRole('button', { name: 'Mầm giải thích: Check-in cảm xúc' })
// MB-814: the row icon is hidden until focus, so a keyboard press is the path.
const ask = async (page: Page) => {
  await cardButton(page).focus()
  await page.keyboard.press('Enter')
}
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
    await expect(cardButton(page)).toBeAttached()
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

  test('hides the row icon at rest and shows it on keyboard focus', async ({
    page,
  }) => {
    await installSupportPlanMocks(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/support-plan')
    await expect(cta(page)).toBeVisible()
    await expect(cardButton(page)).toBeAttached()

    // At rest: in the DOM with its name, but visually hidden.
    await expect(cardButton(page)).toHaveCSS('clip-path', 'inset(50%)')
    const rest = await box(cardButton(page))
    expect(rest.width).toBeLessThanOrEqual(1)
    expect(rest.height).toBeLessThanOrEqual(1)

    // Tab reaches it, and the current icon appears.
    await page.getByRole('tab', { name: 'Hôm nay' }).focus()
    for (
      let i = 0;
      i < 40 &&
      !(await cardButton(page).evaluate((e) => e === document.activeElement));
      i++
    )
      await page.keyboard.press('Tab')
    await expect(cardButton(page)).toBeFocused()
    await expect(cardButton(page)).toHaveCSS('clip-path', 'none')
    const shown = await box(cardButton(page))
    expect(shown.width).toBeGreaterThanOrEqual(44)
    expect(shown.height).toBeGreaterThanOrEqual(44)
    await expect(bubble(page)).toHaveCount(0)

    // Tabbing on hides it again; right-click on the card is the pointer path.
    await page.keyboard.press('Tab')
    await expect(cardButton(page)).toHaveCSS('clip-path', 'inset(50%)')
  })

  test('climbs onto the focus card, answers beside Mầm and thanks hands focus back', async ({
    page,
  }) => {
    const requests = await installSupportPlanMocks(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/support-plan')
    await expect(cta(page)).toBeVisible()
    const home = await box(dock(page))

    await ask(page)
    await travelling(page, 'perch')
    await expect(bubble(page)).toContainText(
      'Hoạt động này thuộc kế hoạch hiện tại.',
    )
    // The card Mầm talks about: the character stands at its top edge.
    const card = page.locator('[data-mam-active]')
    await expect(async () => {
      const edge = await box(card)
      const mam = await box(character(page))
      expect(Math.abs(mam.y - (edge.y - 0.64 * 96))).toBeLessThan(4)
      expect(mam.x + 96).toBeLessThanOrEqual(edge.x + edge.width)
    }).toPass()
    expect(requests.companionSurfaces()).toEqual(['TODAY'])

    await bubble(page).getByRole('button', { name: 'Cảm ơn Mầm' }).click()
    await expect(bubble(page)).toHaveCount(0)
    await travelling(page, 'dock')
    await expect(cardButton(page)).toBeFocused()
    await expect(async () => {
      const mam = await box(character(page))
      expect(Math.abs(mam.x - home.x)).toBeLessThan(3)
      expect(Math.abs(mam.y - home.y)).toBeLessThan(3)
    }).toPass()
    expect(requests.planMutations()).toBe(0)
  })

  test('the card button opens the bubble pending, shares one request, and keeps the card CTA', async ({
    page,
  }) => {
    const requests = await installSupportPlanMocks(page, {
      // Longer than the climb (about 1.3 s): the pending state shows on arrival.
      companionDelayMs: 3000,
    })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/support-plan')
    await expect(cardButton(page)).toBeAttached()

    await ask(page)
    await ask(page)
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
    await ask(page)
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
    await ask(page)
    await expect(bubble(page)).toContainText(
      'Hoạt động này thuộc kế hoạch hiện tại.',
    )
    expect(requests.companionSurfaces()).toEqual(['PLAN'])

    await page.getByRole('tab', { name: 'Tiến triển' }).click()
    await expect(bubble(page)).toHaveCount(0)
    await expect(cardButton(page)).toHaveCount(0)
  })

  // MB-818: a confirmed SupportPlan save is a quiet nod, never a celebration. The
  // fixture has no completable action, so the page's own saved event is dispatched;
  // the workspace wiring and the check-in's silence are unit-tested.
  test('a confirmed save nods in place, once, and never while the menu is open', async ({
    page,
  }) => {
    await installSupportPlanMocks(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/support-plan')
    await expect(cta(page)).toBeVisible()
    await expect(character(page)).toHaveAttribute('data-mam-status', 'ready', {
      timeout: 15_000,
    })
    const save = () =>
      page.evaluate(() => window.dispatchEvent(new Event('mam:saved')))

    await save()
    await expect(dockRoot(page)).toHaveAttribute('data-mam-shot', 'nod')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'dock')
    // No bubble, no flight: an acknowledgement, not a celebration.
    await expect(bubble(page)).toHaveCount(0)
    await expect(dockRoot(page)).toHaveAttribute('data-front', 'false')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-shot', '', {
      timeout: 3000,
    })

    await dock(page).focus()
    await page.keyboard.press('Enter')
    await expect(dock(page)).toHaveAttribute('aria-expanded', 'true')
    await save()
    await page.waitForTimeout(300)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-shot', '')
  })

  test('a save under reduced motion plays nothing', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await installSupportPlanMocks(page)
    await page.goto('/support-plan')
    await expect(cta(page)).toBeVisible()
    await page.evaluate(() => window.dispatchEvent(new Event('mam:saved')))
    await page.waitForTimeout(300)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-shot', '')
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
    await ask(page)
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
