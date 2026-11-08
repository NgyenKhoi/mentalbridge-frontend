import { expect, type Page } from '@playwright/test'

import { seedOnboardingSeen, test } from './test-fixtures'
import { homeWorld, installHomeMocks } from './home-next-step-mocks'
import {
  character,
  crisis,
  dock,
  dockRoot,
  expectNothingCoveredAtBottom,
  expectPageActionsClickable,
  menu,
  box,
  travelling,
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
    await expect(page.locator('[data-mam-dock]')).toHaveCount(1)

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

  test('closes the menu and leaves while the crisis panel is open, then returns', async ({
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
    await expect(dock(page)).toHaveCount(0)
    await expect(page.locator('[data-mam-dock]')).toHaveAttribute(
      'data-mam-dock',
      'away',
    )
    await page.keyboard.press('Escape')
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(0)
    await expect(dock(page)).toBeVisible()
  })
})

// MB-814: Mầm plays, sleeps and gets dizzy. The asset is the real v0.4 .riv unless
// a test aborts it; the clock specs keep to `page.clock` (no motion-frame capture).
test.describe('MB-814 living Mầm on the dock', () => {
  test.use({ timezoneId: 'Asia/Ho_Chi_Minh' })
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'The dock journey uses browser-owned fixtures only.',
  )

  // The dock yields (35% opacity, no pointer events) while it sits over a page
  // action, by design. Scroll to the end, where the shell leaves room under the
  // last row, so the gestures below meet a live dock. Waiting for the renderer
  // also waits out hydration.
  const settle = async (page: Page) => {
    await expect(character(page)).toHaveAttribute('data-mam-status', 'ready', {
      timeout: 15_000,
    })
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(dockRoot(page)).toHaveAttribute('data-yield', 'false')
  }
  const open = async (page: Page, width = 1440) => {
    await installHomeMocks(page, homeWorld('do-today'))
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/dashboard')
    await expect(dock(page)).toBeVisible()
    await settle(page)
  }

  test.describe('the one-time tip', () => {
    test.use({ mamTipSeen: false })

    test('shows once after 1.4 s with the right-click copy, and not again', async ({
      page,
    }) => {
      await open(page)
      const tip = page.getByRole('group', { name: 'Mầm' })
      await expect(tip).toContainText(
        'Mẹo nè: chuột phải vào thẻ bất kỳ, mình sẽ trèo lên giải thích cho bạn.',
      )
      await expect(dock(page)).not.toBeFocused()
      await tip.getByRole('button', { name: 'Cảm ơn Mầm' }).click()
      await expect(tip).toHaveCount(0)

      await page.reload()
      await expect(dock(page)).toBeVisible()
      await page.waitForTimeout(2500)
      await expect(page.getByRole('group', { name: 'Mầm' })).toHaveCount(0)
    })

    test('stays quiet when "tự lên tiếng" is off', async ({ page }) => {
      await page.addInitScript(() =>
        sessionStorage.setItem('mentalbridge_mam_session_muted', 'true'),
      )
      await open(page)
      await page.waitForTimeout(2500)
      await expect(page.getByRole('group', { name: 'Mầm' })).toHaveCount(0)
    })

    test('shows the long-press copy on a coarse pointer', async ({
      browser,
    }) => {
      const context = await browser.newContext({
        hasTouch: true,
        isMobile: true,
        viewport: { width: 375, height: 812 },
        timezoneId: 'Asia/Ho_Chi_Minh',
      })
      const page = await context.newPage()
      await seedOnboardingSeen(page)
      await installHomeMocks(page, homeWorld('do-today'))
      await page.goto('/dashboard')
      await settle(page)
      await expect(page.getByRole('group', { name: 'Mầm' })).toContainText(
        'Mẹo nè: nhấn giữ vào thẻ bất kỳ, mình sẽ trèo lên giải thích cho bạn.',
      )
      await context.close()
    })

    test('shows without a hop under reduced motion', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await open(page)
      await expect(page.getByRole('group', { name: 'Mầm' })).toContainText(
        'Mẹo nè',
      )
      await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'dock')
    })
  })

  test('the menu lead names the right-click path even with the tip skipped', async ({
    page,
  }) => {
    await open(page)
    await dock(page).click()
    await expect(menu(page)).toContainText(
      'Chuột phải vào một thẻ để hỏi Mầm về thẻ đó.',
    )
  })

  test('drag, release and Mầm ends back at the dock; a tiny press stays a tap', async ({
    page,
  }) => {
    await open(page)
    const home = await box(dock(page))
    const grab = { x: home.x + 48, y: home.y + 48 }

    // Under 6 px is a tap: the menu opens and nothing travels.
    await page.mouse.move(grab.x, grab.y)
    await page.mouse.down()
    await page.mouse.move(grab.x + 3, grab.y + 2)
    await page.mouse.up()
    await expect(menu(page)).toBeVisible()
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'dock')
    await page.keyboard.press('Escape')

    await page.mouse.move(grab.x, grab.y)
    await page.mouse.down()
    // Small steps: the character keeps its grab offset from where the 6 px slop
    // ended, so a coarse path would leave it that far behind the pointer.
    await page.mouse.move(grab.x + 240, grab.y - 160, { steps: 80 })
    await travelling(page, 'drag')
    await expect(async () => {
      const mam = await box(character(page))
      expect(Math.abs(mam.x - (home.x + 240))).toBeLessThan(16)
      expect(Math.abs(mam.y - (home.y - 160))).toBeLessThan(16)
    }).toPass()
    // The dock button, and so every page action, never moved.
    expect(await box(dock(page))).toEqual(home)
    await page.mouse.up()
    await travelling(page, 'fly')
    await expect(menu(page)).toHaveCount(0)
    await travelling(page, 'dock', 20_000)
    await expect(async () => {
      const mam = await box(character(page))
      expect(Math.abs(mam.x - home.x)).toBeLessThan(3)
      expect(Math.abs(mam.y - home.y)).toBeLessThan(3)
    }).toPass()
    await expectPageActionsClickable(page)
  })

  test('Escape during a throw snaps Mầm home', async ({ page }) => {
    await open(page)
    const home = await box(dock(page))
    await page.mouse.move(home.x + 48, home.y + 48)
    await page.mouse.down()
    await page.mouse.move(home.x - 120, home.y - 200, { steps: 4 })
    await page.mouse.up()
    await travelling(page, 'fly')
    await page.keyboard.press('Escape')
    await travelling(page, 'dock', 1000)
  })

  test('does not drag under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page)
    const home = await box(dock(page))
    await page.mouse.move(home.x + 48, home.y + 48)
    await page.mouse.down()
    await page.mouse.move(home.x + 240, home.y - 160, { steps: 8 })
    await page.mouse.up()
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'dock')
    expect(await box(character(page))).toEqual(home)
  })

  test('crisis support during a throw snaps Mầm home and removes it', async ({
    page,
  }) => {
    await open(page)
    const home = await box(dock(page))
    await page.mouse.move(home.x + 48, home.y + 48)
    await page.mouse.down()
    await page.mouse.move(home.x - 120, home.y - 200, { steps: 4 })
    await page.mouse.up()
    await travelling(page, 'fly')
    await crisis(page).evaluate((el) => (el as HTMLButtonElement).click())
    await expect(page.locator('[aria-modal="true"]')).toBeVisible()
    await expect(dockRoot(page)).toHaveAttribute('data-mam-dock', 'away')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'dock')
  })

  test('sleeps after 60 s, only Mầm wakes it, and a tap opens no menu', async ({
    page,
  }) => {
    // A real minute of idle time: page.clock would stall Rive and rAF.
    test.setTimeout(150_000)
    await open(page)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-sleep', 'false')
    // MB-818: the upright yawn comes first, then the lie-down.
    await expect(dockRoot(page)).toHaveAttribute('data-mam-shot', 'drowsy', {
      timeout: 80_000,
    })
    await expect(dockRoot(page)).toHaveAttribute('data-mam-sleep', 'false')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-sleep', 'true', {
      timeout: 10_000,
    })
    const sleeping = page.getByRole('button', {
      name: 'Mầm đang ngủ, bấm để đánh thức',
    })
    await expect(sleeping).toBeVisible()
    // Lying on its side with "z z Z" floating up.
    await expect(async () => {
      const lying = await character(page).evaluate(
        (el) => getComputedStyle(el.parentElement!.parentElement!).transform,
      )
      expect(lying).not.toBe('none')
    }).toPass()
    await expect(page.locator('[data-mam-dock] span:text-is("Z")')).toHaveCount(
      1,
    )

    // Other page input leaves it asleep (a mouse move is not an interaction with Mầm).
    await page.mouse.move(600, 400)
    await page.keyboard.press('Shift')
    await page.waitForTimeout(1500)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-sleep', 'true')

    await sleeping.click()
    // The Rive wake replaces the old curious step.
    await expect(dockRoot(page)).toHaveAttribute('data-mam-shot', 'wake')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-sleep', 'false')
    await expect(menu(page)).toHaveCount(0)
    await expect(dock(page)).toBeVisible()
    await expect(dockRoot(page)).toHaveAttribute('data-mam-shot', '', {
      timeout: 5000,
    })
  })

  test('never sleeps under reduced motion', async ({ page }) => {
    test.setTimeout(150_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page)
    await page.waitForTimeout(65_000)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-sleep', 'false')
    // No yawn, no idle action, no gaze: a static pose.
    await expect(dockRoot(page)).toHaveAttribute('data-mam-shot', '')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-gaze', 'false')
  })

  test('is dizzy when the asset fails, and a tap or a summon says so', async ({
    page,
  }) => {
    await page.route('**/mam/mam-v06.riv', (route) => route.abort('failed'))
    await installHomeMocks(page, homeWorld('do-today'))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/dashboard')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const broken = page.getByRole('button', { name: 'Mầm đang gặp sự cố' })
    await expect(broken).toBeVisible()
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(dockRoot(page)).toHaveAttribute('data-yield', 'false')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-dizzy', 'true')
    await expect(
      page.locator('[data-mam-dock] [data-still="false"]'),
    ).toHaveCount(1)

    // Dizzy is only the broken renderer: no touch reaction, no gaze.
    await expect(dockRoot(page)).toHaveAttribute('data-mam-gaze', 'false')
    await broken.click()
    await expect(dockRoot(page)).toHaveAttribute('data-mam-shot', '')
    const message = page.getByRole('dialog', { name: 'Mầm' })
    await expect(message).toContainText(
      'Mình đang bị choáng một chút nên tạm thời chưa giúp được.',
    )
    await expect(message.getByRole('button', { name: 'Đã hiểu' })).toBeFocused()
    await expect(message.getByRole('button', { name: 'Ẩn Mầm' })).toBeVisible()
    await message.getByRole('button', { name: 'Đã hiểu' }).click()
    await expect(message).toHaveCount(0)
    await expect(broken).toBeFocused()

    // A summon on a card says the same and never climbs.
    await page
      .getByTestId('home-resources')
      .getByRole('heading', { level: 2 })
      .click({ button: 'right' })
    await expect(message).toContainText('Mình đang bị choáng')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'dock')
    await expect(page.locator('[data-mam-paw]')).toHaveCount(0)
  })

  test('static dizzy art under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.route('**/mam/mam-v06.riv', (route) => route.abort('failed'))
    await installHomeMocks(page, homeWorld('do-today'))
    await page.goto('/dashboard')
    await expect(
      page.locator('[data-mam-dock] [data-still="true"]'),
    ).toHaveCount(1)
  })
})

// MB-818: idle life and touch. The renderer is the real v0.6 asset; the dock root
// reports what the character was told to play (`data-mam-shot`) and whether the
// pointer gaze is on (`data-mam-gaze`).
test.describe('MB-818 Mầm idle life and touch', () => {
  test.use({ timezoneId: 'Asia/Ho_Chi_Minh' })
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'The dock journey uses browser-owned fixtures only.',
  )

  const ready = async (page: Page) => {
    await expect(character(page)).toHaveAttribute('data-mam-status', 'ready', {
      timeout: 15_000,
    })
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(dockRoot(page)).toHaveAttribute('data-yield', 'false')
  }
  const open = async (page: Page, width = 1440) => {
    await installHomeMocks(page, homeWorld('do-today'))
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/dashboard')
    await expect(dock(page)).toBeVisible()
    await ready(page)
  }
  const shot = (page: Page, kind: string) =>
    expect(dockRoot(page)).toHaveAttribute('data-mam-shot', kind)

  test('a poke giggles and opens the menu; an open menu closes on a click; then pokes tickle and Mầm cools down', async ({
    page,
  }) => {
    await open(page)
    await dock(page).click()
    await expect(menu(page)).toBeVisible()
    await shot(page, 'giggle')
    // An open menu always closes on the next click, inside the window too.
    await dock(page).click()
    await expect(dock(page)).toHaveAttribute('aria-expanded', 'false')
    // Closed, still inside 1.5 s of the first click: pokes only, the menu stays shut.
    await dock(page).click()
    await shot(page, 'giggle')
    await expect(dock(page)).toHaveAttribute('aria-expanded', 'false')
    await dock(page).click()
    await shot(page, 'tickled')
    await expect(dock(page)).toHaveAttribute('aria-expanded', 'false')

    // A later window opens the menu; the 10 s cool-down keeps Mầm still.
    await page.waitForTimeout(1700)
    await dock(page).click()
    await expect(menu(page)).toBeVisible()
    await shot(page, '')
    await expectPageActionsClickable(page)
  })

  test('a keyboard activation toggles every time and never pokes', async ({
    page,
  }) => {
    await open(page)
    await dock(page).focus()
    for (const state of ['true', 'false', 'true', 'false']) {
      await page.keyboard.press('Enter')
      await expect(dock(page)).toHaveAttribute('aria-expanded', state)
      await shot(page, '')
    }
  })

  test('a tap on a coarse pointer pokes and opens the menu', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 375, height: 812 },
      timezoneId: 'Asia/Ho_Chi_Minh',
    })
    const page = await context.newPage()
    await seedOnboardingSeen(page)
    await installHomeMocks(page, homeWorld('do-today'))
    await page.goto('/dashboard')
    await ready(page)
    // No hover to look at: the pointer gaze never runs for touch.
    await dock(page).tap()
    await expect(menu(page)).toBeVisible()
    await shot(page, 'giggle')
    // A second tap straight away closes the open menu.
    await dock(page).tap()
    await expect(dock(page)).toHaveAttribute('aria-expanded', 'false')
    await context.close()
  })

  test('under reduced motion every click toggles and nothing plays or gazes', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-gaze', 'false')
    await dock(page).click()
    await expect(menu(page)).toBeVisible()
    await dock(page).click()
    await expect(menu(page)).toHaveCount(0)
    await shot(page, '')
  })

  test('the pointer gaze follows the mouse near the dock and gives way to the menu', async ({
    page,
  }) => {
    await open(page)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-gaze', 'true')
    const home = await box(dock(page))
    const eyes = {
      x: home.x + home.width * 0.2,
      y: home.y + home.height * 0.3,
      width: home.width * 0.6,
      height: home.height * 0.3,
    }
    // The pupils move: left and right pointers draw different eyes (a blink is
    // random, so retry until the two stills are both open-eyed).
    await expect(async () => {
      await page.mouse.move(home.x - 200, home.y + 40)
      await page.waitForTimeout(700)
      const left = await page.screenshot({ clip: eyes })
      await page.mouse.move(home.x + home.width + 200, home.y + 40)
      await page.waitForTimeout(700)
      const right = await page.screenshot({ clip: eyes })
      expect(left.equals(right)).toBe(false)
    }).toPass()
    // Two seconds without moves: back to the centre, and the menu stops the gaze.
    await dock(page).click()
    await expect(dockRoot(page)).toHaveAttribute('data-mam-gaze', 'false')
    await page.keyboard.press('Escape')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-gaze', 'true')
  })

  test('the gaze stays off in a no-interrupt zone', async ({ page }) => {
    await open(page)
    await crisis(page).click()
    await expect(page.locator('[aria-modal="true"]')).toBeVisible()
    await expect(dockRoot(page)).toHaveAttribute('data-mam-dock', 'away')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-gaze', 'false')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-shot', '')
  })

  test('a drag holds the gaze off, the throw ends back on the dock with no reaction left', async ({
    page,
  }) => {
    await open(page)
    const home = await box(dock(page))
    await page.mouse.move(home.x + 48, home.y + 48)
    await page.mouse.down()
    await page.mouse.move(home.x + 200, home.y - 140, { steps: 40 })
    await travelling(page, 'drag')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-gaze', 'false')
    // The page text under the pointer is never selected while Mầm is carried.
    const selectable = () =>
      page.evaluate(() => ({
        userSelect: getComputedStyle(document.documentElement).userSelect,
        selected: window.getSelection()?.toString() ?? '',
      }))
    await expect.poll(selectable).toEqual({ userSelect: 'none', selected: '' })
    await page.mouse.up()
    await travelling(page, 'fly')
    await expect.poll(selectable).toMatchObject({ userSelect: 'none' })
    await travelling(page, 'dock', 20_000)
    await expect
      .poll(async () => (await selectable()).userSelect)
      .not.toBe('none')
    await shot(page, '')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-gaze', 'true')
  })

  test('input during an idle action never leaves the dock mid-pose', async ({
    page,
  }) => {
    // The idle action fires 25–45 s after load; a click cuts to a poke at once.
    test.setTimeout(90_000)
    await open(page)
    await expect(async () => {
      expect(await dockRoot(page).getAttribute('data-mam-shot')).toMatch(
        /^(stretch|look_around|scratch)$/,
      )
    }).toPass({ timeout: 50_000, intervals: [250] })
    await dock(page).click()
    await shot(page, 'giggle')
    await expect(menu(page)).toBeVisible()
  })
})
