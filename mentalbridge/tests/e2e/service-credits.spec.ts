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

  const creditPanel = page.getByRole('region', { name: 'Plus' })
  await expect(creditPanel.getByRole('heading', { name: 'Plus' })).toBeVisible()
  await expect(creditPanel.getByText(/Lượt tư vấn dùng thử/)).toBeVisible()
  await expect(creditPanel.getByText('Còn lại').locator('..')).toContainText(
    '4',
  )
  await expect(
    creditPanel.getByRole('heading', { name: '1/2 lịch' }),
  ).toBeVisible()
  await expect(creditPanel.getByText(/giới hạn riêng/)).toBeVisible()
  await expect(
    creditPanel.getByText(/chỉ cấp thêm phần chênh lệch/),
  ).toBeVisible()
  await expect(creditPanel.getByText(/Đã cấp/)).toBeVisible()
})
