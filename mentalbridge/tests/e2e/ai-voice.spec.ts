import { expect, type Page } from '@playwright/test'
import { test } from './test-fixtures'
import { disclosure, eligibility } from '../fixtures/voice'

async function setup(page: Page, value = eligibility()) {
  await page.context().addCookies([
    {
      name: 'mentalbridge_access',
      value: 'synthetic-resource-e2e-access',
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  await page.addInitScript(() => {
    let requests = 0
    Object.defineProperty(window, '__voiceMicRequests', { get: () => requests })
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: () => {
        requests += 1
        return Promise.reject(
          new DOMException('Synthetic microphone denial', 'NotAllowedError'),
        )
      },
    })
  })
  await page.route('**/api/ai-companion/conversations**', (route) =>
    route.fulfill({ json: { items: [] } }),
  )
  await page.route('**/api/resources**', (route) =>
    route.fulfill({ json: { items: [] } }),
  )
  let admitted = 0
  let state = value
  await page.route('**/api/ai-companion/voice/**', (route) => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)
    if (name === 'eligibility')
      return route.fulfill({
        json: state,
        headers: { 'Cache-Control': 'no-store' },
      })
    if (name === 'disclosure') return route.fulfill({ json: disclosure })
    if (name === 'consent') {
      state = eligibility()
      return route.fulfill({
        json: {
          consentType: 'AI_VOICE_PROCESSING',
          consentVersion: disclosure.consentVersion,
          current: true,
          granted: true,
          acceptedAt: new Date().toISOString(),
        },
      })
    }
    admitted += 1
    return route.fulfill({
      status: 503,
      json: { code: 'PROVIDER_UNAVAILABLE' },
    })
  })
  await page.goto('/ai-companion')
  const entry = page.getByRole('button', { name: 'Gọi AI', exact: true })
  await expect(entry).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, '__voiceMicRequests')))
    .toBe(0)
  await entry.click()
  await expect(page.getByRole('dialog', { name: 'Gọi AI' })).toBeVisible()
  return { admitted: () => admitted, entry }
}

for (const width of [1440, 375])
  test(`MB-761 finite preview, keyboard and microphone denial at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const f = await setup(
      page,
      eligibility('PLUS', { availableSessionSeconds: 120 }),
    )
    await expect(page.getByText('Tối đa 2 phút', { exact: true })).toBeVisible()
    const dialog = page.getByRole('dialog')
    const help = dialog.getByRole('link', { name: 'Cần trợ giúp ngay' })
    await expect(help).toBeVisible()
    await expect(help).toHaveAttribute('href', '/safety-directory')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath(`mb761-${width}-precall.png`),
      fullPage: true,
    })
    await dialog.getByRole('button', { name: 'Bắt đầu cuộc gọi' }).click()
    await expect(dialog.getByText(/Micro chưa được cho phép/)).toBeVisible()
    expect(f.admitted()).toBe(0)
    expect(
      await page.evaluate(() => Reflect.get(window, '__voiceMicRequests')),
    ).toBe(1)
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await expect(f.entry).toBeFocused()
  })

test('MB-761 FREE and expired paid access show honest locked preview with text continuation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 844 })
  const f = await setup(
    page,
    eligibility('PLUS', {
      state: 'FREE_LOCKED',
      eligible: false,
      availableSessionSeconds: 0,
    }),
  )
  await expect(
    page.getByText('Bản xem trước · Chưa kết nối micro'),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Xem gói Plus / Premium' }),
  ).toHaveAttribute('href', '/subscription')
  await expect(
    page.getByRole('button', { name: 'Bắt đầu cuộc gọi' }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Tiếp tục nhắn tin' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(
    page.getByRole('button', { name: /Cuộc trò chuyện mới/ }),
  ).toBeVisible()
  expect(f.admitted()).toBe(0)
})

test('MB-761 Voice disclosure requires explicit acceptance without automatically calling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 844 })
  const f = await setup(
    page,
    eligibility('PLUS', {
      state: 'VOICE_CONSENT_REQUIRED',
      eligible: false,
      availableSessionSeconds: 0,
    }),
  )
  await page.getByRole('button', { name: 'Xem thông tin và đồng ý' }).click()
  const agree = page.getByRole('button', { name: 'Đồng ý và tiếp tục' })
  await expect(agree).toBeDisabled()
  await expect(page.getByText(disclosure.disclosureText)).toBeVisible()
  await page.getByRole('checkbox').check()
  await agree.click()
  await expect(
    page.getByRole('button', { name: 'Bắt đầu cuộc gọi' }),
  ).toBeVisible()
  expect(
    await page.evaluate(() => Reflect.get(window, '__voiceMicRequests')),
  ).toBe(0)
  expect(f.admitted()).toBe(0)
})

test('MB-761 capacity full never presents a positive call action', async ({
  page,
}) => {
  const f = await setup(
    page,
    eligibility('PREMIUM', {
      state: 'GLOBAL_CAPACITY_FULL',
      eligible: false,
      availableSessionSeconds: 0,
    }),
  )
  await expect(page.getByText('Hiện đã đủ cuộc gọi.')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Bắt đầu cuộc gọi' }),
  ).toHaveCount(0)
  expect(f.admitted()).toBe(0)
})
