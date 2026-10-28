import { expect, type Page } from '@playwright/test'

import { test } from './test-fixtures'
import { homeWorld, installHomeMocks } from './home-next-step-mocks'

// MB-769: Mầm targets, summon gestures and reviewed explanations. V1 answers
// come from reviewed copy, so a summon never calls an AI endpoint.

const dock = (page: Page) =>
  page.getByRole('button', { name: 'Mầm', exact: true })
const bubble = (page: Page) => page.getByRole('dialog', { name: 'Mầm' })
const nextStep = (page: Page) =>
  page.getByRole('region', { name: 'Bước tiếp theo', exact: true })
const resources = (page: Page) => page.getByTestId('home-resources')

function watchAiRequests(page: Page) {
  const calls: string[] = []
  page.on('request', (request) => {
    if (
      new URL(request.url()).pathname.startsWith('/api/') &&
      /ai-companion|companion-explanation/.test(request.url())
    )
      calls.push(request.url())
  })
  return calls
}

test.describe('MB-769 Mầm summon', () => {
  test.use({ timezoneId: 'Asia/Ho_Chi_Minh' })
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'The summon journey uses browser-owned fixtures only.',
  )

  test('right-click explains a card from reviewed copy and Esc dismisses', async ({
    page,
  }) => {
    const aiCalls = watchAiRequests(page)
    await installHomeMocks(page, homeWorld('do-today'))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/dashboard')
    await expect(dock(page)).toBeVisible()

    // A link inside the card keeps the browser menu.
    await nextStep(page)
      .getByRole('link', { name: 'Bắt đầu ngay', exact: true })
      .click({ button: 'right' })
    await expect(bubble(page)).toHaveCount(0)

    await resources(page)
      .getByRole('heading', { level: 2 })
      .click({ button: 'right' })
    await expect(bubble(page)).toBeVisible()
    const starter = bubble(page).getByRole('button', { name: 'Mầm giải thích' })
    await expect(starter).toBeFocused()
    await starter.click()
    await expect(bubble(page)).toContainText('thư viện MentalBridge')

    await page.keyboard.press('Escape')
    await expect(bubble(page)).toHaveCount(0)
    expect(aiCalls).toEqual([])
  })

  test('dock asks about the page and leads to the next step by keyboard', async ({
    page,
  }) => {
    await installHomeMocks(page, homeWorld('do-today'))
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/dashboard')

    await dock(page).focus()
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Hỏi Mầm về trang này' }).click()
    await bubble(page)
      .getByRole('button', { name: 'Nên bắt đầu từ đâu?' })
      .click()
    const go = bubble(page).getByRole('button', { name: 'Đưa mình tới đó' })
    await expect(go).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(bubble(page)).toHaveCount(0)
    await expect(
      nextStep(page).getByRole('link', { name: 'Bắt đầu ngay', exact: true }),
    ).toBeFocused()

    // Shift+F10 on the focused link opens the starters for its card.
    await page.keyboard.press('Shift+F10')
    await expect(bubble(page)).toBeVisible()
  })

  test('a route change discards the bubble', async ({ page }) => {
    await installHomeMocks(page, homeWorld('do-today'))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/dashboard')
    await resources(page)
      .getByRole('heading', { level: 2 })
      .click({ button: 'right' })
    await expect(bubble(page)).toBeVisible()
    await page
      .getByRole('navigation', { name: 'Điều hướng chính' })
      .getByRole('link', { name: 'Thành tựu' })
      .click()
    await expect(page).toHaveURL(/\/achievements$/)
    await expect(bubble(page)).toHaveCount(0)
  })

  test('safety support registers no targets', async ({ page }) => {
    await installHomeMocks(page, homeWorld('safety'))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/dashboard')
    await expect(dock(page)).toBeVisible()
    await nextStep(page).click({ button: 'right', position: { x: 24, y: 24 } })
    await expect(bubble(page)).toHaveCount(0)
    await dock(page).click()
    await expect(
      page.getByRole('button', { name: 'Hỏi Mầm về trang này' }),
    ).toHaveCount(0)
  })

  test('plan emotion check-in registers no targets', async ({ page }) => {
    await installHomeMocks(page, homeWorld('do-today'))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/dashboard')
    await resources(page)
      .getByRole('heading', { level: 2 })
      .click({ button: 'right' })
    await expect(bubble(page)).toBeVisible()

    // Entering the check-in with the bubble open closes it.
    await page.goto(
      '/dashboard?occurrenceId=occ-1&actionId=act-1&localDate=2026-10-27',
    )
    await expect(bubble(page)).toHaveCount(0)
    await resources(page)
      .getByRole('heading', { level: 2 })
      .click({ button: 'right' })
    await expect(bubble(page)).toHaveCount(0)
    await dock(page).focus()
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('button', { name: 'Hỏi Mầm về trang này' }),
    ).toHaveCount(0)
  })

  for (const width of [375, 768]) {
    test(`touch long-press opens a bubble inside the viewport at ${width}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        hasTouch: true,
        isMobile: width === 375,
        viewport: { width, height: 800 },
        timezoneId: 'Asia/Ho_Chi_Minh',
      })
      const page = await context.newPage()
      await installHomeMocks(page, homeWorld('do-today'))
      await page.goto('/dashboard')
      const heading = resources(page).getByRole('heading', { level: 2 })
      await heading.scrollIntoViewIfNeeded()
      const box = await heading.boundingBox()
      if (!box) throw new Error('heading has no box')
      const x = box.x + box.width - 4
      const y = box.y + box.height / 2
      // Synthetic touch press: pointerdown, hold past 500 ms, pointerup.
      await page.evaluate(
        ([px, py]) => {
          const target = document.elementFromPoint(px, py)!
          const init = {
            bubbles: true,
            clientX: px,
            clientY: py,
            pointerType: 'touch',
            pointerId: 7,
            isPrimary: true,
          }
          target.dispatchEvent(new PointerEvent('pointerdown', init))
          setTimeout(
            () => target.dispatchEvent(new PointerEvent('pointerup', init)),
            650,
          )
        },
        [x, y],
      )
      await expect(bubble(page)).toBeVisible()
      const rect = await bubble(page).boundingBox()
      expect(rect).not.toBeNull()
      expect(rect!.x).toBeGreaterThanOrEqual(15)
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(width - 15)

      // The taller answer stays fully on screen.
      await bubble(page).getByRole('button', { name: 'Mầm giải thích' }).tap()
      await expect(bubble(page)).toContainText('thư viện MentalBridge')
      await expect(async () => {
        const answer = await bubble(page).boundingBox()
        expect(answer!.y).toBeGreaterThanOrEqual(15)
        expect(answer!.y + answer!.height).toBeLessThanOrEqual(800 - 15)
      }).toPass()
      await context.close()
    })
  }
})
