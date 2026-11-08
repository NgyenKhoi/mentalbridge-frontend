import { expect, type Page } from '@playwright/test'

import { seedOnboardingSeen, test } from './test-fixtures'
import { homeWorld, installHomeMocks } from './home-next-step-mocks'
import { box, character, dockRoot, travelling } from './mam-dock-helpers'

// MB-769: Mầm targets, summon gestures and reviewed explanations. V1 answers
// come from reviewed copy, so a summon never calls an AI endpoint. Gestures
// are the dock host's, which loads lazily (MB-781): tests wait for the dock.

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

  // MB-814: the one Mầm leaves the dock and climbs from behind the card's top edge.
  test('right-click climbs from behind the card edge, answers beside Mầm and goes home', async ({
    page,
  }) => {
    await installHomeMocks(page, homeWorld('do-today'))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/dashboard')
    await expect(dock(page)).toBeVisible()
    const home = await box(dock(page))
    const card = page.locator('[data-mam-active]')
    // The dashboard section marks its first card as the perch surface (data-mam-perch).
    const surface = card.locator('[data-mam-perch]').first()

    await resources(page)
      .getByRole('heading', { level: 2 })
      .click({ button: 'right' })
    await expect(card).toHaveCount(1)
    const zBefore = await card.evaluate((el) => getComputedStyle(el).zIndex)
    await travelling(page, 'perch')
    await expect(bubble(page)).toBeVisible()
    await expect(page.locator('[data-mam-paw]')).toHaveCount(2)

    // 0.64·S above the card's top edge, 28 px inside its right edge, one character.
    await expect(async () => {
      const edge = await box(surface)
      const mam = await box(character(page))
      expect(Math.abs(mam.y - (edge.y - 0.64 * 96))).toBeLessThan(4)
      expect(
        Math.abs(
          mam.x - Math.min(edge.x + edge.width - 96 - 28, 1440 - 96 - 8),
        ),
      ).toBeLessThan(4)
      // Beside the head: right edge 12 px left of Mầm, bottom 22 px under the edge.
      const talk = await box(bubble(page))
      if ((await bubble(page).getAttribute('data-perch')) === 'left') {
        expect(Math.abs(talk.x + talk.width - (mam.x - 12))).toBeLessThan(3)
        expect(Math.abs(talk.y + talk.height - (edge.y + 22))).toBeLessThan(3)
      }
    }).toPass()
    await expect(page.locator('[data-mam-dock] [data-mam-status]')).toHaveCount(
      1,
    )
    // Behind the card by clipping, never by raising the card.
    expect(await card.evaluate((el) => getComputedStyle(el).zIndex)).toBe(
      zBefore,
    )
    expect(
      await page
        .locator('[data-mam-dock] > div')
        .evaluate((el) => (el as HTMLElement).style.clipPath),
    ).toContain('inset(')
    await expect(
      bubble(page).getByRole('button', { name: 'Mầm giải thích' }),
    ).toBeFocused()

    // Scrolling follows the card.
    await page.mouse.wheel(0, 120)
    await expect(async () => {
      const edge = await box(surface)
      const mam = await box(character(page))
      expect(Math.abs(mam.y - (edge.y - 0.64 * 96))).toBeLessThan(4)
    }).toPass()

    await page.keyboard.press('Escape')
    await expect(bubble(page)).toHaveCount(0)
    await travelling(page, 'dock')
    await expect(async () => {
      const mam = await box(character(page))
      expect(Math.abs(mam.x - home.x)).toBeLessThan(3)
      expect(Math.abs(mam.y - home.y)).toBeLessThan(3)
    }).toPass()
  })

  test('a card too close to the top scrolls just enough, then Mầm climbs under the header', async ({
    page,
  }) => {
    await installHomeMocks(page, homeWorld('do-today'))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/dashboard')
    await expect(dock(page)).toBeVisible()
    const heading = resources(page).getByRole('heading', { level: 2 })
    // Put the card's top edge right under the sticky header.
    await resources(page).evaluate((el) =>
      window.scrollBy(0, el.getBoundingClientRect().top - 80),
    )
    const headerBottom = await page.evaluate(
      () =>
        document.querySelector('.ref-topbar')!.getBoundingClientRect().bottom,
    )
    await heading.click({ button: 'right' })
    await travelling(page, 'perch')
    await expect(bubble(page)).toBeVisible()
    const mam = await box(character(page))
    // Mầm's head is never above the header.
    expect(mam.y).toBeGreaterThanOrEqual(headerBottom - 1)
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

  // MB-818: the answer bubble and a summon own the dock; no touch or idle motion on top.
  test('with the answer bubble open a click on Mầm only closes it: no menu, no reaction, no gaze', async ({
    page,
  }) => {
    await installHomeMocks(page, homeWorld('do-today'))
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/dashboard')
    await expect(character(page)).toHaveAttribute('data-mam-status', 'ready', {
      timeout: 15_000,
    })
    await dock(page).focus()
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Hỏi Mầm về trang này' }).click()
    await bubble(page)
      .getByRole('button', { name: 'Nên bắt đầu từ đâu?' })
      .click()
    await expect(bubble(page)).toBeVisible()
    await expect(dockRoot(page)).toHaveAttribute('data-mam-gaze', 'false')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-shot', '')

    await dock(page).click()
    await expect(bubble(page)).toHaveCount(0)
    await expect(dock(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('group', { name: 'Mầm' })).toHaveCount(0)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-shot', '')
  })

  test('a summon on a card keeps the gaze and touch motion off while Mầm is perched', async ({
    page,
  }) => {
    await installHomeMocks(page, homeWorld('do-today'))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/dashboard')
    await expect(character(page)).toHaveAttribute('data-mam-status', 'ready', {
      timeout: 15_000,
    })
    await resources(page)
      .getByRole('heading', { level: 2 })
      .click({ button: 'right' })
    await travelling(page, 'perch')
    await expect(bubble(page)).toBeVisible()
    await expect(dockRoot(page)).toHaveAttribute('data-mam-gaze', 'false')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-shot', '')
    await page.keyboard.press('Escape')
    await travelling(page, 'dock')
    // Back home, the gaze waits until no page action sits under the dock.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(dockRoot(page)).toHaveAttribute('data-yield', 'false')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-gaze', 'true')
  })

  test('a route change discards the bubble', async ({ page }) => {
    await installHomeMocks(page, homeWorld('do-today'))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/dashboard')
    await expect(dock(page)).toBeVisible()
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
    await expect(dock(page)).toBeVisible()
    await resources(page)
      .getByRole('heading', { level: 2 })
      .click({ button: 'right' })
    await expect(bubble(page)).toBeVisible()

    // Entering the check-in with the bubble open closes it.
    await page.goto(
      '/dashboard?occurrenceId=occ-1&actionId=act-1&localDate=2026-10-27',
    )
    await expect(bubble(page)).toHaveCount(0)
    // The host is back before the gesture, so "no bubble" means no target.
    await expect(dock(page)).toBeVisible()
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
      await seedOnboardingSeen(page)
      await installHomeMocks(page, homeWorld('do-today'))
      await page.goto('/dashboard')
      await expect(dock(page)).toBeVisible()
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
