import { expect, test } from '@playwright/test'

test('public landing page navigates to the login form', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('main#top')).toBeVisible()

  const loginLink = page.locator('a[href="/login"]:visible').first()
  await expect(loginLink).toBeVisible()
  await loginLink.click()

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.locator('form input[type="email"]')).toBeVisible()
  await expect(page.locator('form input[type="password"]')).toBeVisible()
})

test('anonymous protected-route access redirects to login safely', async ({
  page,
}) => {
  await page.goto('/dashboard?tab=today')

  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%3Ftab%3Dtoday$/)
  await expect(page.locator('form input[type="email"]')).toBeVisible()
})

test('login has no client-controlled role and shows generic account feedback', async ({
  page,
}) => {
  await page.route('**/api/identity/login', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/problem+json',
      body: JSON.stringify({
        type: 'about:blank',
        title: 'Authentication failed',
        status: 401,
        code: 'AUTHENTICATION_FAILED',
        correlationId: 'a7ab44c2-544b-4da4-bb38-f62a0ecdf113',
      }),
    })
  })

  await page.goto('/login')
  await expect(page.locator('form select[name="role"]')).toHaveCount(0)
  await page.getByLabel('Email').fill('unknown@example.com')
  await page.getByLabel('Mật khẩu').fill('wrong-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()

  const loginAlert = page.locator('form [role="alert"]')
  await expect(loginAlert).toContainText('Không thể đăng nhập')
  await expect(loginAlert).not.toContainText('unknown')
})
