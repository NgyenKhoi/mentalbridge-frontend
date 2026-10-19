import { expect } from '@playwright/test'
import { test } from './test-fixtures'

test('MB-558 separates Consultation-owned credits from reservation capacity on mobile', async ({
  context,
  page,
}) => {
  await context.addCookies([
    {
      name: 'mentalbridge_access',
      value: 'synthetic-care-e2e-access',
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  await page.setViewportSize({ width: 390, height: 844 })
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().endsWith('/api/consultation/service-credits') &&
      candidate.request().method() === 'GET',
  )
  await page.goto('/subscription')
  expect((await response).status()).toBe(200)

  const creditPanel = page.getByRole('region', { name: 'Gói Plus dùng thử' })
  await expect(creditPanel).toBeVisible()
  await expect(
    creditPanel.getByText('Còn lại', { exact: true }).locator('..'),
  ).toContainText('4')
  await expect(
    creditPanel.getByText(/Bạn đang giữ 1 lịch hẹn tư vấn/),
  ).toBeVisible()
  const plus = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: 'Plus', exact: true }),
  })
  await expect(plus.getByText('2 lịch', { exact: true })).toBeVisible()
  await expect(
    page.getByText(/Nâng Plus lên Premium thu đủ giá Premium/),
  ).toBeVisible()
  await creditPanel.getByRole('button', { name: 'Lịch sử lượt tư vấn' }).click()
  await expect(
    creditPanel.getByRole('heading', { name: 'Lịch sử lượt tư vấn' }),
  ).toBeVisible()
  await expect(
    creditPanel.getByRole('heading', { name: '1/2 lịch' }),
  ).toBeVisible()
  await expect(creditPanel.getByText('Đã cấp', { exact: true })).toBeVisible()
})
