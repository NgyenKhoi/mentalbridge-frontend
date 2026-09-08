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

test('registration follows the public contract and reaches a verification-pending state', async ({
  page,
}) => {
  let requestBody: unknown
  let idempotencyKey: string | null = null
  await page.route('**/api/identity/register', async (route) => {
    const request = route.request()
    requestBody = request.postDataJSON()
    idempotencyKey = request.headers()['idempotency-key'] ?? null
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ registrationPending: true }),
    })
  })

  await page.goto('/register')
  await expect(page.getByRole('radio', { name: /người dùng/i })).toBeVisible()
  await expect(page.getByRole('radio', { name: /chuyên gia/i })).toBeVisible()
  await expect(page.getByText(/admin/i)).toHaveCount(0)
  await expect(page.getByLabel(/họ.*tên/i)).toHaveCount(0)

  await page.getByRole('radio', { name: /chuyên gia/i }).check()
  await page.getByLabel('Email').fill('specialist@example.com')
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill('correct horse battery staple')
  await page
    .getByLabel('Xác nhận mật khẩu')
    .fill('correct horse battery staple')
  await page.locator('.checkbox-custom').click()
  await expect(page.locator('input[name="agreeToTerms"]')).toBeChecked()
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click()

  await expect(page.getByText(/kiểm tra email của bạn/i)).toBeVisible()
  await page.getByRole('button', { name: /gửi lại email xác minh/i }).click()
  await expect(
    page.getByText(/nếu tài khoản đang chờ xác minh và đủ điều kiện/i),
  ).toBeVisible()
  expect(requestBody).toEqual({
    email: 'specialist@example.com',
    password: 'correct horse battery staple',
    actorType: 'SPECIALIST',
  })
  expect(idempotencyKey).toMatch(/^[\x20-\x7E]{16,128}$/)
})

test('email verification consumes and removes the challenge from browser history', async ({
  page,
}) => {
  const challenge = 'v'.repeat(32)
  await page.goto(`/verify-email?challenge=${challenge}`)

  await expect(page.getByText(/xác minh thành công/i)).toBeVisible()
  await expect(page).toHaveURL(/\/verify-email$/)
  await expect(page.getByRole('link', { name: 'Đăng nhập' })).toBeVisible()
})

test('password recovery keeps account eligibility private', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/reset-password')

  await page.getByLabel('Email').fill('unknown@example.com')
  await page.getByRole('button', { name: /gửi liên kết khôi phục/i }).click()

  await expect(page.getByRole('status')).toContainText(
    'Nếu tài khoản đủ điều kiện',
  )
  await page.screenshot({
    path: 'docs/evidence/mb-902-password-recovery-mobile.png',
    fullPage: true,
  })
})

test('password reset removes its challenge and returns to a fresh login', async ({
  page,
}) => {
  const challenge = 'r'.repeat(32)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto(`/reset-password?challenge=${challenge}`)

  await expect(page).toHaveURL(/\/reset-password$/)
  await page
    .getByLabel('Mật khẩu mới', { exact: true })
    .fill('a sufficiently long password')
  await page
    .getByLabel('Xác nhận mật khẩu mới')
    .fill('a sufficiently long password')
  await page.screenshot({
    path: 'docs/evidence/mb-902-password-reset-desktop.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: /đặt lại mật khẩu/i }).click()

  await expect(page).toHaveURL(/\/login\?credential=reset$/)
})
