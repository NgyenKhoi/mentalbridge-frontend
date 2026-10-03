import { expect, test, type Page } from '@playwright/test'

const fixtureUrl = 'http://127.0.0.1:3201'

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin-resource-e2e@example.com')
  await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/admin/)
}

test.describe('admin account state journey', () => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL) &&
      process.env.MENTALBRIDGE_MANAGED_E2E !== 'true',
    'The controlled Identity fixture is available only with the managed local server.',
  )

  test.beforeEach(async ({ request }) => {
    const response = await request.post(`${fixtureUrl}/__test/reset`)
    expect(response.status()).toBe(204)
  })

  test('searches and opens the bounded non-admin account action', async ({
    page,
  }) => {
    await login(page)
    await page.goto('/admin/accounts')

    await expect(
      page.getByRole('heading', { name: 'Quản trị trạng thái tài khoản' }),
    ).toBeVisible()
    await page.getByLabel('Vai trò').selectOption('USER')
    await page.getByLabel('Email chính xác').fill('user@example.com')
    await page.getByRole('button', { name: 'Tìm tài khoản' }).click()
    await page.getByRole('button', { name: /user@example.com/ }).click()
    await expect(
      page.getByRole('button', { name: 'Tạm ngưng tài khoản' }),
    ).toBeVisible()
    await expect(page.getByText('Đã xác minh')).toBeVisible()
  })

  test('keeps the dedicated admin protected on a mobile viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page)
    await page.goto('/admin/accounts')
    await page
      .getByRole('button', { name: /admin-resource-e2e@example.com/ })
      .click()

    await expect(page.getByText(/ADMIN chuyên dụng được bảo vệ/)).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Tạm ngưng tài khoản' }),
    ).toHaveCount(0)
  })
})
