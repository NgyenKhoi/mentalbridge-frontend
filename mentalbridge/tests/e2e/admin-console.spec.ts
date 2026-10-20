import { expect, test, type Page } from '@playwright/test'

const fixtureUrl = 'http://127.0.0.1:3201'

async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin-resource-e2e@example.com')
  await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard$/)
}

test.describe('consolidated admin console', () => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL) &&
      process.env.MENTALBRIDGE_MANAGED_E2E !== 'true',
    'Requires the controlled local Identity fixture.',
  )

  test.beforeEach(async ({ request }) => {
    const response = await request.post(`${fixtureUrl}/__test/reset`)
    expect(response.status()).toBe(204)
  })

  test('keeps one authoritative route map and fails visibly when dashboard sources are unavailable', async ({
    page,
  }, testInfo) => {
    await page.route('**/api/admin/operations/dashboard', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: 'about:blank',
          title: 'Dependency unavailable',
          status: 503,
          code: 'DEPENDENCY_UNAVAILABLE',
        }),
      }),
    )
    await page.route('**/api/admin/product-journey-metrics?**', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: 'about:blank',
          title: 'Dependency unavailable',
          status: 503,
          code: 'DEPENDENCY_UNAVAILABLE',
        }),
      }),
    )

    await loginAsAdmin(page)

    const navigation = page.getByRole('navigation', {
      name: 'Điều hướng quản trị',
    })
    const expectedRoutes = [
      '/admin/dashboard',
      '/admin/accounts',
      '/admin/specialists',
      '/admin/content',
      '/admin/moderation',
      '/admin/appointments',
      '/admin/disputes',
      '/admin/audit',
      '/admin/reports',
      '/admin/payments',
      '/admin/payouts',
    ]

    await expect(navigation.getByRole('link')).toHaveCount(
      expectedRoutes.length,
    )
    for (const route of expectedRoutes) {
      await expect(navigation.locator(`a[href="${route}"]`)).toHaveCount(1)
    }

    await expect(
      page.getByText('Không thể tải dữ liệu:', { exact: false }),
    ).toBeVisible()
    await expect(page.getByText('Chưa thể tải số liệu.')).toBeVisible()
    await expect(page.getByText('12.480')).toHaveCount(0)
    await expect(page.getByText('99,98%')).toHaveCount(0)
    await expect(page.getByText('96/100')).toHaveCount(0)
    await expect(
      navigation.getByRole('link', { name: /assessment|AI/i }),
    ).toHaveCount(0)

    testInfo.annotations.push(
      {
        type: 'evidence-classification',
        description:
          'ADMIN-authorized shell with dependency-unavailable dashboard state; no inferred or demo figures.',
      },
      {
        type: 'privacy-boundary',
        description:
          'Aggregate operations only; no Journal, assessment answer, chat or clinical-session content.',
      },
    )
  })
})
