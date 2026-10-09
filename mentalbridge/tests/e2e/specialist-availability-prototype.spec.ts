import { expect, type Page, type TestInfo } from '@playwright/test'
import type { AvailabilitySlot } from '@/lib/consultation/consultation-validation'
import { approvedProfile } from '../fixtures/profile-amendment'
import { test } from './test-fixtures'

test.use({ locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' })
test.beforeEach(async ({ request }) => {
  expect(
    (await request.post('http://127.0.0.1:3201/__test/reset')).status(),
  ).toBe(204)
})

async function enter(page: Page) {
  await page.route('**/api/consultation/specialist-profile', (route) =>
    route.fulfill({ json: approvedProfile, headers: { etag: '"2"' } }),
  )
  await page.goto('/login')
  await page.getByLabel('Email').fill('specialist@example.com')
  await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/specialist\/dashboard$/)
  await page.goto('/specialist/availability')
  await expect(
    page.getByRole('heading', { name: 'Lịch khả dụng trực tuyến' }),
  ).toBeVisible()
}
async function capture(page: Page, info: TestInfo, name: string) {
  for (const dismiss of await page
    .getByRole('button', { name: 'Đóng thông báo', exact: true })
    .all())
    await dismiss.click()
  await page.mouse.move(0, 0)
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(async () => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
  })
  const path = info.outputPath(`${name}.png`)
  const modalOpen = await page
    .getByRole('dialog', { name: 'Rút khung giờ này?' })
    .isVisible()
  await page.screenshot({ path, fullPage: !modalOpen, animations: 'disabled' })
  await info.attach(name, { path, contentType: 'image/png' })
}
async function noOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true)
}
function fixtureSlot(): AvailabilitySlot {
  return {
    id: '20000000-0000-4000-8000-000000000001',
    startAt: '2098-01-03T02:00:00Z',
    endAt: '2098-01-03T03:00:00Z',
    timezone: 'Asia/Ho_Chi_Minh',
    modality: 'IN_APP_CHAT',
    status: 'ACTIVE',
    readiness: 'AVAILABLE',
    withdrawnAt: null,
    createdAt: '2026-10-09T01:00:00Z',
    updatedAt: '2026-10-09T01:00:00Z',
    version: 0,
  }
}

test('availability complete setup, keyboard pickers, publish, cancel and withdraw at desktop/mobile sizes', async ({
  page,
}, info) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  let slots: AvailabilitySlot[] = []
  let withdrawals = 0
  await page.route(
    '**/api/consultation/availability-slots**',
    async (route) => {
      const method = route.request().method()
      if (method === 'GET')
        return route.fulfill({
          json: {
            items: slots,
            count: slots.length,
            generatedAt: new Date().toISOString(),
            videoPublishingEnabled: false,
          },
        })
      if (method === 'POST') {
        const body = route.request().postDataJSON()
        expect(Date.parse(body.endAt) - Date.parse(body.startAt)).toBe(
          3_600_000,
        )
        expect(route.request().headers()['idempotency-key']).toMatch(
          /^[0-9a-f-]{36}$/,
        )
        slots = [{ ...fixtureSlot(), ...body }]
        return route.fulfill({
          status: 201,
          json: slots[0],
          headers: { etag: '"0"' },
        })
      }
      if (method === 'DELETE') {
        withdrawals += 1
        expect(route.request().headers()['if-match']).toBe('"0"')
        slots = [
          {
            ...slots[0],
            status: 'WITHDRAWN',
            readiness: 'WITHDRAWN',
            version: 1,
            withdrawnAt: new Date().toISOString(),
          },
        ]
        return route.fulfill({ json: slots[0], headers: { etag: '"1"' } })
      }
      return route.abort()
    },
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await enter(page)
  await expect(
    page.getByRole('heading', { name: 'Chưa có khung giờ nào được xuất bản' }),
  ).toBeVisible()
  await noOverflow(page)
  await capture(page, info, 'availability-01-empty-1440')
  await page.getByRole('button', { name: 'Tạo khung giờ đầu tiên' }).click()
  await expect(page.getByLabel('Ngày', { exact: true })).toBeFocused()
  const calendarTrigger = page.getByRole('button', {
    name: 'Mở lịch chọn ngày',
  })
  await calendarTrigger.click()
  const calendar = page.getByRole('dialog', { name: 'Chọn ngày tư vấn' })
  await expect(calendar).toBeVisible()
  await calendar.getByRole('button', { name: 'Tháng sau' }).click()
  await calendar.getByRole('button', { name: 'Tháng trước' }).click()
  const firstEnabledDate = await page
    .getByLabel('Ngày', { exact: true })
    .getAttribute('min')
  await expect
    .poll(() =>
      calendar.evaluate(() =>
        document.activeElement?.getAttribute('data-date'),
      ),
    )
    .toBe(firstEnabledDate)
  await capture(page, info, 'availability-02-calendar-1440')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await expect(calendar).not.toBeVisible()
  await expect(calendarTrigger).toBeFocused()
  await expect(page.getByLabel('Ngày', { exact: true })).not.toHaveValue('')
  await expect
    .poll(() =>
      page
        .getByLabel('Ngày', { exact: true })
        .evaluate((el) => getComputedStyle(el).color),
    )
    .toBe('rgba(0, 0, 0, 0)')
  await expect
    .poll(() =>
      page
        .locator('[data-availability-ui] button[aria-pressed="true"] strong')
        .evaluate((el) => getComputedStyle(el).color),
    )
    .toBe('rgb(255, 255, 255)')

  const timeTrigger = page.getByRole('button', { name: 'Mở bộ chọn giờ' })
  await timeTrigger.click()
  await page.getByRole('button', { name: '10 giờ', exact: true }).click()
  await page.getByRole('button', { name: '15 phút', exact: true }).click()
  await capture(page, info, 'availability-03-time-picker-1440')
  await page.getByRole('button', { name: 'Chọn 10:15', exact: true }).click()
  await expect(timeTrigger).toBeFocused()
  await expect
    .poll(() =>
      page
        .getByLabel('Giờ bắt đầu', { exact: true })
        .evaluate((el) => getComputedStyle(el).color),
    )
    .toBe('rgba(0, 0, 0, 0)')
  await expect(page.getByText('10:15 – 11:15', { exact: true })).toBeVisible()
  const publish = page.getByRole('button', { name: 'Xuất bản khung giờ' })
  await expect(publish).toBeEnabled()
  await expect
    .poll(() => publish.evaluate((el) => getComputedStyle(el).backgroundColor))
    .not.toBe('rgba(0, 0, 0, 0)')
  await publish.hover()
  await expect
    .poll(() =>
      publish.evaluate(
        (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42,
      ),
    )
    .toBeLessThan(0)
  await capture(page, info, 'availability-04-form-preview-1440')
  await publish.click()
  await expect(
    page
      .getByRole('region', { name: 'Khung giờ đã lưu' })
      .getByRole('status')
      .filter({ hasText: 'Đã xuất bản khung giờ' }),
  ).toBeVisible()
  const card = page.locator('li').filter({ hasText: '10:15 – 11:15' })
  await expect(card).toContainText('Có thể đặt')
  await expect(page.getByLabel('Ngày', { exact: true })).toHaveValue('')
  await capture(page, info, 'availability-05-published-1440')

  const withdrawButton = card.getByRole('button', { name: 'Rút khung giờ' })
  await withdrawButton.click()
  const dialog = page.getByRole('dialog', { name: 'Rút khung giờ này?' })
  await expect(dialog).toContainText('10:15 – 11:15')
  await expect(dialog).toContainText('Các cuộc hẹn đã có không bị thay đổi.')
  await capture(page, info, 'availability-06-withdraw-confirm-1440')
  await page.setViewportSize({ width: 375, height: 812 })
  await noOverflow(page)
  await expect
    .poll(() =>
      dialog.evaluate((el) => {
        const bounds = el.getBoundingClientRect()
        return (
          bounds.left >= 0 &&
          bounds.right <= innerWidth &&
          bounds.top >= 0 &&
          bounds.bottom <= innerHeight
        )
      }),
    )
    .toBe(true)
  await capture(page, info, 'availability-06-withdraw-confirm-375')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.keyboard.press('Tab')
  await expect
    .poll(() => dialog.evaluate((el) => el.contains(document.activeElement)))
    .toBe(true)
  await dialog.getByRole('button', { name: 'Giữ lại khung giờ' }).click()
  await expect(dialog).not.toBeVisible()
  await expect(withdrawButton).toBeFocused()
  expect(withdrawals).toBe(0)
  await withdrawButton.click()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(withdrawButton).toBeFocused()
  expect(withdrawals).toBe(0)
  await withdrawButton.click()
  await dialog
    .getByRole('button', { name: 'Rút khung giờ', exact: true })
    .click()
  await expect(dialog).not.toBeVisible()
  await expect(card).toContainText('Đã rút')
  await expect(card.getByRole('button', { name: 'Rút khung giờ' })).toHaveCount(
    0,
  )
  await expect(
    page.getByRole('heading', { name: 'Khung giờ đã lưu' }),
  ).toBeFocused()
  expect(withdrawals).toBe(1)
  await capture(page, info, 'availability-07-withdrawn-1440')
  await page.getByRole('button', { name: 'Xem khung giờ có thể đặt' }).click()
  await expect(
    page.getByRole('heading', { name: 'Chưa có khung giờ có thể đặt' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Xem tất cả', exact: true }).click()
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 768, height: 900 },
    { width: 640, height: 900 },
    { width: 375, height: 812 },
  ]) {
    await page.setViewportSize(viewport)
    await noOverflow(page)
    await capture(page, info, `availability-08-saved-${viewport.width}`)
  }
  await calendarTrigger.click()
  await expect(calendar).toBeVisible()
  await noOverflow(page)
  await capture(page, info, 'availability-09-calendar-375')
  await page.keyboard.press('Escape')
  await timeTrigger.click()
  await expect(
    page.getByRole('dialog', { name: 'Chọn giờ bắt đầu' }),
  ).toBeVisible()
  await noOverflow(page)
  await capture(page, info, 'availability-10-time-picker-375')
  await page.keyboard.press('Escape')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByLabel('Ngày', { exact: true }).fill('2098-01-04')
  await page.getByLabel('Giờ bắt đầu', { exact: true }).fill('09:30')
  await publish.hover()
  await expect
    .poll(() => publish.evaluate((el) => getComputedStyle(el).transform))
    .toBe('none')
  await page.getByRole('button', { name: 'Nhập lại' }).click()
  await expect(page.getByLabel('Ngày', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Giờ bắt đầu', { exact: true })).toHaveValue('')
  expect(errors).toEqual([])
})

test('availability loading, refresh and publish failures preserve data; stale withdrawal reloads safely', async ({
  page,
}, info) => {
  test.setTimeout(90_000)
  let slot = fixtureSlot()
  let failRead = false
  let failPublish = false
  let staleWithdraw = false
  let releaseRead!: () => void
  const firstRead = new Promise<void>((resolve) => {
    releaseRead = resolve
  })
  let reads = 0
  await page.route(
    '**/api/consultation/availability-slots**',
    async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        reads += 1
        if (reads === 1) await firstRead
        if (failRead)
          return route.fulfill({
            status: 503,
            json: {
              code: 'DEPENDENCY_UNAVAILABLE',
              title: 'Synthetic dependency failure',
            },
          })
        return route.fulfill({
          json: {
            items: [slot],
            count: 1,
            generatedAt: new Date().toISOString(),
            videoPublishingEnabled: false,
          },
        })
      }
      if (method === 'POST' && failPublish)
        return route.fulfill({
          status: 409,
          json: {
            code: 'AVAILABILITY_SLOT_OVERLAP',
            title: 'Availability overlaps an active slot',
          },
        })
      if (method === 'DELETE' && staleWithdraw) {
        slot = { ...slot, version: 1 }
        return route.fulfill({
          status: 412,
          json: {
            code: 'AVAILABILITY_SLOT_VERSION_MISMATCH',
            title: 'Slot version changed',
          },
        })
      }
      return route.abort()
    },
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await enter(page)
  await expect(page.getByText('Đang tải lịch khả dụng…')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Xuất bản khung giờ' }),
  ).toBeDisabled()
  await capture(page, info, 'availability-11-loading')
  releaseRead()
  const card = page.locator('li').filter({ hasText: '09:00 – 10:00' })
  await expect(card).toBeVisible()
  await page.getByLabel('Ngày', { exact: true }).fill('2098-01-04')
  await page.getByLabel('Giờ bắt đầu', { exact: true }).fill('14:30')
  failRead = true
  await page.getByRole('button', { name: 'Tải lại', exact: true }).click()
  await expect(page.getByText('Chưa thể cập nhật danh sách')).toBeVisible()
  await expect(card).toBeVisible()
  await expect(page.getByLabel('Ngày', { exact: true })).toHaveValue(
    '2098-01-04',
  )
  await capture(page, info, 'availability-12-refresh-failed-retained-data')
  failRead = false
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByText('Chưa thể cập nhật danh sách')).toHaveCount(0)
  failPublish = true
  await page.getByRole('button', { name: 'Xuất bản khung giờ' }).click()
  await expect(
    page.getByText(/Khung giờ này trùng với một khung giờ/),
  ).toBeVisible()
  await expect(page.getByLabel('Giờ bắt đầu', { exact: true })).toHaveValue(
    '14:30',
  )
  await capture(page, info, 'availability-13-publish-conflict')
  staleWithdraw = true
  await card.getByRole('button', { name: 'Rút khung giờ' }).click()
  await page
    .getByRole('dialog', { name: 'Rút khung giờ này?' })
    .getByRole('button', { name: 'Rút khung giờ', exact: true })
    .click()
  await expect(
    page.getByText(
      'Khung giờ đã thay đổi. Danh sách mới nhất đã được tải lại.',
    ),
  ).toBeVisible()
  await expect(card).toContainText('Có thể đặt')
  await capture(page, info, 'availability-14-withdraw-stale-reloaded')
  expect(reads).toBe(4)
  await noOverflow(page)
})
