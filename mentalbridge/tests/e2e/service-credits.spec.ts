import { expect } from '@playwright/test'
import { test } from './test-fixtures'

test('MB-377 displays the Consultation-owned demo balance on mobile', async ({
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
  await expect(creditPanel.getByText(/Credit demo có kiểm soát/)).toBeVisible()
  await expect(
    creditPanel.getByText('Có thể dùng').locator('..'),
  ).toContainText('1')
  await expect(
    creditPanel.getByText(/chỉ cấp thêm phần chênh lệch/),
  ).toBeVisible()
  await expect(creditPanel.getByText(/Đã cấp/)).toBeVisible()
})
