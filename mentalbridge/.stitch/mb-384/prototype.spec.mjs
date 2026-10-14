import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const prototype = new URL('./video-specialist-desktop-prototype.html', import.meta.url)

test.beforeEach(async ({ page }) => {
  await page.route('http://127.0.0.1:3894/prototype', async route => {
    await route.fulfill({ contentType: 'text/html; charset=utf-8', body: await readFile(prototype, 'utf8') })
  })
  await page.goto('http://127.0.0.1:3894/prototype')
})

for (const width of [1440, 1280, 768, 375, 320]) {
  test(`full-frame fonts, Vietnamese glyphs and render at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.reload()
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready
      const sample = 'Tư vấn trực tuyến — ẩ ễ ặ ỗ'
      const body = await document.fonts.load('16px "Be Vietnam Pro"', sample)
      const heading = await document.fonts.load('32px "Fraunces"', sample)
      return { body: body.map(f => f.status), heading: heading.map(f => f.status), overflow: document.documentElement.scrollWidth > innerWidth }
    })
    expect(fonts.body.length).toBeGreaterThan(0)
    expect(fonts.heading.length).toBeGreaterThan(0)
    expect([...fonts.body, ...fonts.heading]).toEqual(expect.arrayContaining(['loaded']))
    expect(fonts.overflow).toBe(false)
    await expect(page.getByRole('heading', { name: 'Phản hồi yêu cầu lịch hẹn' })).toBeVisible()
    await expect(page.locator('#join-room-btn')).toBeVisible()
    await expect(page.locator('#toggle-mic-btn')).toBeVisible()
    await expect(page.locator('#toggle-cam-btn')).toBeVisible()
    await expect(page.locator('#session-timer')).toBeHidden()
    expect(await page.locator('body').innerText()).not.toContain('�')
    expect(errors).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`preview-${width}.png`), fullPage: true })
  })
}

test('join waits, controls toggle, reconnect and leave never settle', async ({ page }) => {
  await page.locator('#toggle-mic-btn').click()
  await expect(page.locator('#toggle-mic-btn')).toHaveAttribute('aria-pressed', 'false')
  await page.locator('#toggle-cam-btn').click()
  await expect(page.locator('#toggle-cam-btn')).toHaveAttribute('aria-pressed', 'false')
  await page.locator('#join-room-btn').click()
  await expect(page.locator('#room-status-text')).toContainText('Đang chờ')
  await expect(page.locator('#session-timer')).toBeHidden()
  await page.evaluate(() => window.prototypeController.setScenario('connected'))
  await expect(page.locator('#temporary-leave-btn')).toBeVisible()
  await page.evaluate(() => window.prototypeController.setScenario('reconnecting'))
  await expect(page.locator('#room-status-text')).toContainText('Đang kết nối lại')
  await page.locator('#temporary-leave-btn').click()
  await expect(page.locator('#join-room-btn')).toBeVisible()
  await expect(page.locator('#session-timer')).toBeHidden()
})

test('confirmation traps/restores focus and only requests pending verification', async ({ page }) => {
  await page.evaluate(() => window.prototypeController.setScenario('connected'))
  const trigger = page.locator('#open-end-session-modal-btn')
  await trigger.click()
  const dialog = page.locator('#end-session-modal')
  await expect(dialog).toBeVisible()
  await expect(page.locator('#cancel-end-modal-btn')).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.locator('#confirm-finish-btn')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator('#cancel-end-modal-btn')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.locator('#confirm-finish-btn').click()
  await expect(page.locator('#room-status-text')).toHaveText('Đang xác minh phiên. Lượt tư vấn vẫn được giữ.')
  await expect(page.locator('#join-room-btn')).toBeHidden()
  await expect(page.locator('#session-timer')).toBeHidden()
})

test('error recovery, expiry and reduced motion remain truthful', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const state of ['permission-error', 'device-missing', 'provider-unavailable']) {
    await page.evaluate(state => window.prototypeController.setScenario(state), state)
    await expect(page.locator('#join-room-btn')).toBeHidden()
    await expect(page.locator('#session-timer')).toBeHidden()
  }
  await page.evaluate(() => window.prototypeController.setScenario('expired'))
  await expect(page.locator('#join-room-btn')).toBeDisabled()
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
})
