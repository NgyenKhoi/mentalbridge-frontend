import { expect } from '@playwright/test'
import { test } from './test-fixtures'

const identityFixtureUrl = 'http://127.0.0.1:3201'

test.beforeEach(async ({ request }) => {
  const response = await request.post(`${identityFixtureUrl}/__test/reset`)
  expect(response.status()).toBe(204)
})

test('specialist publishes and withdraws a mobile 60-minute chat slot', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login')
  await page.getByLabel('Email').fill('specialist@example.com')
  await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/specialist\/dashboard$/)

  await page.goto('/specialist/availability')
  await expect(
    page.getByRole('heading', { name: 'Lịch khả dụng trực tuyến' }),
  ).toBeVisible()
  await expect(page.getByText('Chat trong ứng dụng').first()).toBeVisible()
  await expect(page.getByText(/Video chưa sẵn sàng/)).toBeVisible()
  await expect(
    page.getByRole('radio', { name: 'Video trong ứng dụng' }),
  ).toBeDisabled()

  await page.getByLabel('Ngày').fill('2098-01-03')
  await page.getByLabel('Giờ bắt đầu').fill('09:30')
  await page.getByLabel('Múi giờ hiển thị').fill('Asia/Ho_Chi_Minh')
  const publishResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/consultation/availability-slots') &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Xuất bản khung giờ' }).click()
  const published = await publishResponse
  expect(published.status()).toBe(201)
  const publishedBody = published.request().postDataJSON()
  expect(
    Date.parse(publishedBody.endAt) - Date.parse(publishedBody.startAt),
  ).toBe(3_600_000)
  await expect(page.getByText(/Đã xuất bản khung giờ/)).toBeVisible()

  const createdSlot = page.locator('li').filter({ hasText: '09:30' })
  await expect(createdSlot).toContainText('Chat trong ứng dụng')
  const withdrawResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/consultation/availability-slots/') &&
      response.request().method() === 'DELETE',
  )
  await createdSlot.getByRole('button', { name: 'Rút khung giờ' }).click()
  expect((await withdrawResponse).status()).toBe(200)
  await expect(createdSlot).toContainText('Đã rút')

  await expect(page.getByText(/địa điểm|điện thoại|liên kết họp/i)).toHaveCount(
    0,
  )
})
