import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const prototype = new URL('./video-specialist-mobile-prototype.html', import.meta.url)

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.route('http://127.0.0.1:3894/mobile-prototype', async route => {
    await route.fulfill({ contentType: 'text/html; charset=utf-8', body: await readFile(prototype, 'utf8') })
  })
  await page.goto('http://127.0.0.1:3894/mobile-prototype')
})

for (const width of [320, 375, 768]) {
  test(`mobile shell, fonts, controls and glyphs at ${width}px`, async ({ page }, testInfo) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width, height: 812 })
    await page.reload()
    const rendered = await page.evaluate(async () => {
      await document.fonts.ready
      const sample = 'Tư vấn trực tuyến — ẩ ễ ặ ỗ'
      const body = await document.fonts.load('16px "Be Vietnam Pro"', sample)
      const headings = await document.fonts.load('32px "Fraunces"', sample)
      return {
        fonts: [...body, ...headings].map(font => font.status),
        overflow: document.documentElement.scrollWidth > innerWidth,
        titleTop: document.querySelector('h1').getBoundingClientRect().top,
        targetHeights: ['btn-toggle-mic', 'btn-toggle-cam', 'btn-join-call', 'mobile-menu-btn'].map(id => document.getElementById(id).getBoundingClientRect().height),
      }
    })
    expect(rendered.fonts.length).toBeGreaterThan(1)
    expect(rendered.fonts.every(status => status === 'loaded')).toBe(true)
    expect(rendered.overflow).toBe(false)
    expect(rendered.titleTop).toBeLessThan(200)
    expect(rendered.targetHeights.every(height => height >= 44)).toBe(true)
    await expect(page.getByRole('heading', { name: 'Phản hồi yêu cầu lịch hẹn' })).toBeVisible()
    await expect(page.locator('#session-timer-wrap')).toBeHidden()
    expect(await page.locator('body').innerText()).not.toContain('�')
    expect(errors).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`mobile-preview-${width}.png`), fullPage: true })
  })
}

test('recovery keeps join handlers, controls and safe leave usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const state of ['permission', 'device', 'provider']) {
    await page.evaluate(state => window.renderScenario(state), state)
    await expect(page.locator('#btn-join-call')).toBeHidden()
    await expect(page.locator('#session-timer-wrap')).toBeHidden()
    await page.locator('#btn-retry-action').click()
    await page.locator('#btn-join-call').click()
    await expect(page.locator('#stage-badge-text')).toContainText('Đang chờ')
    await expect(page.locator('#session-timer-wrap')).toBeHidden()
    await page.locator('#btn-leave-standby').click()
    await expect(page.locator('#btn-join-call')).toBeVisible()
  }
  for (const id of ['btn-toggle-mic', 'btn-toggle-cam']) {
    await page.locator(`#${id}`).click()
    await expect(page.locator(`#${id}`)).toHaveAttribute('aria-pressed', 'false')
  }
  await page.evaluate(() => window.renderScenario('connected'))
  await expect(page.locator('#remote-participant-stage')).toBeVisible()
  await page.evaluate(() => window.renderScenario('reconnecting'))
  await expect(page.locator('#stage-badge-text')).toContainText('Đang kết nối lại')
  await page.locator('#btn-leave-standby').click()
  await expect(page.locator('#btn-join-call')).toBeVisible()
  await page.evaluate(() => window.renderScenario('expired'))
  await expect(page.locator('#btn-join-call')).toBeHidden()
})

test('drawer and confirmation retain keyboard focus, completion stays pending', async ({ page }) => {
  const menu = page.locator('#mobile-menu-btn')
  await menu.click()
  await expect(page.locator('#mobile-drawer')).toBeVisible()
  await expect(menu).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#drawer-close-btn')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toBeFocused()
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
  await page.evaluate(() => window.renderScenario('connected'))
  const trigger = page.locator('#btn-end-consultation')
  await trigger.click()
  await expect(page.locator('#modal-cancel-end-btn')).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.locator('#modal-confirm-end-btn')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator('#modal-cancel-end-btn')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.locator('#modal-confirm-end-btn').click()
  await expect(page.locator('#notice-pending')).toBeVisible()
  await expect(page.locator('#btn-join-call')).toBeHidden()
  await expect(page.locator('#action-backend-verified')).toBeHidden()
  await expect(page.locator('#session-timer-wrap')).toBeHidden()
})
