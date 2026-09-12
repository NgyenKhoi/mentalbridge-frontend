import { expect, type BrowserContext } from '@playwright/test'

import { test } from './test-fixtures'

// All tests share the single fixture server and must run serially.
test.describe.configure({ mode: 'serial' })

const identityFixtureUrl = 'http://127.0.0.1:3201'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function resetFixture(
  request: import('@playwright/test').APIRequestContext,
) {
  const response = await request.post(`${identityFixtureUrl}/__test/reset`)
  expect(response.status()).toBe(204)
}

/** Inject the pre-seeded Care E2E USER session cookie. */
async function injectUserSession(context: BrowserContext) {
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
}

/** Inject a SPECIALIST access token produced by the fixture after login. */
async function injectSpecialistSession(
  context: BrowserContext,
  request: import('@playwright/test').APIRequestContext,
) {
  // Log in as specialist to get a real fixture token
  const response = await request.post(
    `${identityFixtureUrl}/api/v1/auth/login`,
    {
      data: {
        email: 'specialist@example.com',
        password: 'synthetic-e2e-password',
      },
    },
  )
  expect(response.ok()).toBe(true)
  const { accessToken } = (await response.json()) as { accessToken: string }
  await context.addCookies([
    {
      name: 'mentalbridge_access',
      value: accessToken,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
}

// ---------------------------------------------------------------------------
// AC1 — Cross-user Care requests fail closed
// ---------------------------------------------------------------------------

test.describe('AC1: Cross-user authorization boundaries', () => {
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'Fixture authorization journeys are not run against the live cross-stack environment.',
  )

  test.beforeEach(async ({ request }) => {
    await resetFixture(request)
  })

  test('unauthenticated request to protected dashboard redirects to login', async ({
    page,
  }) => {
    // No session cookie — layout calls requireCurrentAccount → 401 → redirect
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('form input[type="email"]')).toBeVisible()
  })

  test('invalid token on protected routes redirects to login without leaking data', async ({
    context,
    page,
  }) => {
    await context.addCookies([
      {
        name: 'mentalbridge_access',
        value: 'synthetic-invalid-token-not-in-fixture',
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])

    await page.goto('/dashboard')

    // Must land on login — not crash, not render another user's data
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('form input[type="email"]')).toBeVisible()

    // No Care profile data from any account must appear in HTML
    const html = await page.evaluate(() => document.documentElement.innerHTML)
    expect(html).not.toContain('Care E2E User')
    expect(html).not.toContain('synthetic-care-e2e-access')
  })

  test('SPECIALIST token cannot access USER dashboard and is redirected to specialist workspace', async ({
    context,
    page,
    request,
  }) => {
    await injectSpecialistSession(context, request)

    await page.goto('/dashboard')

    // SPECIALIST role → requireCurrentAccount(['USER']) throws 403 → redirect to specialist workspace
    await expect(page).toHaveURL(/\/specialist\/dashboard/)
    // Must not render USER dashboard content
    await expect(
      page.getByRole('heading', { name: /nhiệm vụ hôm nay/i }),
    ).toHaveCount(0)
  })

  test('anonymous assessment session token is never exposed in browser storage', async ({
    context,
    page,
  }) => {
    // Navigate to the anonymous assessment page which creates a Care session
    await page.goto('/assessment/anonymous')

    // Wait for the questionnaire to load
    await expect(
      page.getByRole('heading', { name: 'PHQ-9 — Sàng lọc triệu chứng' }),
    ).toBeVisible({ timeout: 10_000 })

    // Anonymous bearer token must not leak into any browser-readable storage
    const storageState = await page.evaluate(() => ({
      cookie: document.cookie,
      local: JSON.stringify(localStorage),
      session: JSON.stringify(sessionStorage),
      html: document.documentElement.innerHTML,
    }))

    expect(storageState.cookie).not.toMatch(/anonymous.*token/i)
    expect(storageState.local).not.toMatch(/synthetic-anonymous/i)
    expect(storageState.session).not.toMatch(/synthetic-anonymous/i)
    // The raw session token must not appear anywhere in rendered HTML
    expect(storageState.html).not.toContain('synthetic-anonymous')

    // Anonymous cookies must all be HttpOnly (invisible to document.cookie)
    const cookies = await context.cookies()
    const anonymousCookies = cookies.filter((c) =>
      c.name.startsWith('mentalbridge_care_anonymous'),
    )
    expect(anonymousCookies.length).toBeGreaterThan(0)
    expect(anonymousCookies.every((c) => c.httpOnly)).toBe(true)
  })

  test('authenticated user cannot open a Care assessment belonging to a different user', async ({
    context,
    page,
  }) => {
    await injectUserSession(context)

    // Attempt to access an assessment ID that does not belong to the fixture user
    const foreignAssessmentId = 'ffffffff-ffff-4fff-bfff-ffffffffffff'
    await page.goto(`/assessment/phq9?assessmentId=${foreignAssessmentId}`)

    // Must show unavailable state — not another user's result
    await expect(
      page.getByRole('heading', {
        name: /sàng lọc|khả dụng|PHQ-9/i,
      }),
    ).toBeVisible({ timeout: 10_000 })

    // The foreign assessment ID must not render as a valid result
    await expect(
      page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
    ).toHaveCount(0)
    // No score from any other user
    await expect(page.getByText(/tổng điểm/i)).toHaveCount(0)
  })
})

// ---------------------------------------------------------------------------
// AC2 — Expired sessions and service outages show explicit states
// ---------------------------------------------------------------------------

test.describe('AC2: Explicit degradation states', () => {
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'Fixture degradation journeys are not run against the live cross-stack environment.',
  )

  test.beforeEach(async ({ request }) => {
    await resetFixture(request)
  })

  test('expired access token on dashboard triggers re-authentication, not silent failure', async ({
    context,
    page,
  }) => {
    // Inject an access token that the fixture treats as expired
    await context.addCookies([
      {
        name: 'mentalbridge_access',
        value: 'synthetic-access-10000000-0000-4000-8000-000000000002-initial',
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])

    // refresh@example.com initial token is marked expired in the fixture;
    // without a matching refresh token the BFF cannot rotate the session
    await page.goto('/dashboard')

    // The page must redirect to login — not render a ghost session
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
    await expect(page.locator('form input[type="email"]')).toBeVisible()

    // No stale session tokens must remain in browser storage
    const storageState = await page.evaluate(() => ({
      cookie: document.cookie,
      local: JSON.stringify(localStorage),
    }))
    expect(storageState.cookie).not.toMatch(
      /mentalbridge_access|mentalbridge_refresh/i,
    )
    expect(storageState.local).not.toMatch(/access.*token|refresh.*token/i)
  })

  test('Identity service outage on login shows explicit error without silent fallback', async ({
    page,
  }) => {
    // Intercept the BFF login route to simulate Identity being down
    await page.route('**/api/identity/login', (route) => {
      void route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: 'about:blank',
          title: 'Identity service unavailable',
          status: 503,
          code: 'IDENTITY_UNAVAILABLE',
          correlationId: 'e2e-identity-outage-correlation-id',
        }),
      })
    })

    await page.goto('/login')
    await page.getByLabel('Email').fill('user@example.com')
    await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
    await page.getByRole('button', { name: 'Đăng nhập' }).click()

    // Must show an error state — must not log the user in
    await expect(page.locator('form [role="alert"]')).toBeVisible({
      timeout: 10_000,
    })
    // Must not navigate away from login
    await expect(page).toHaveURL(/\/login/)
    // Must not set session cookies
    const cookies = await page.context().cookies()
    const sessionCookies = cookies.filter((c) =>
      ['mentalbridge_access', 'mentalbridge_refresh'].includes(c.name),
    )
    expect(sessionCookies).toHaveLength(0)
  })

  test('Care service outage on profile page shows explicit unavailable message', async ({
    context,
    page,
  }) => {
    await injectUserSession(context)

    // Intercept all Care BFF calls to simulate Care being down
    await page.route('**/api/care/**', (route) => {
      void route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: 'about:blank',
          title: 'Care service unavailable',
          status: 503,
          code: 'CARE_UNAVAILABLE',
          correlationId: 'e2e-care-outage-correlation-id',
        }),
      })
    })

    await page.goto('/profile')

    // Must show error state — not a mock/invented profile
    await expect(
      page.getByText(
        /care tạm thời chưa tải được|không thể tải|care chưa xác nhận/i,
      ),
    ).toBeVisible({ timeout: 10_000 })

    // Profile form may render empty (to allow creating a profile), but must not
    // contain any pre-filled data from a Care-owned user profile
    await expect(page.getByLabel('Tên hiển thị')).toHaveValue('')
    // Disclosure section must show unavailable state, not backend-owned content
    await expect(page.getByText('Disclosure hiện chưa khả dụng')).toBeVisible()
  })

  test('Care service outage on assessments page shows explicit error without mock history', async ({
    context,
    page,
  }) => {
    await injectUserSession(context)

    await page.route('**/api/care/assessments/history**', (route) => {
      void route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: 'about:blank',
          title: 'Care service unavailable',
          status: 503,
          code: 'CARE_UNAVAILABLE',
          correlationId: 'e2e-care-history-outage-id',
        }),
      })
    })

    await page.goto('/assessments')

    // Error state must appear
    await expect(page.getByText('Không thể tải lịch sử')).toBeVisible({
      timeout: 10_000,
    })
    // Retry option must be available
    await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible()
    // No invented assessment rows
    await expect(page.getByRole('link', { name: 'Xem lại' })).toHaveCount(0)
  })

  test('Care service outage on anonymous PHQ-9 shows explicit unavailable without inventing questions', async ({
    page,
  }) => {
    await page.route('**/api/care/questionnaires/phq9', (route) => {
      void route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: 'about:blank',
          title: 'Care service unavailable',
          status: 503,
          code: 'CARE_UNAVAILABLE',
          correlationId: 'e2e-care-questionnaire-outage-id',
        }),
      })
    })

    await page.goto('/assessment/anonymous')

    await expect(
      page.getByRole('heading', { name: 'Bài sàng lọc hiện chưa khả dụng' }),
    ).toBeVisible({ timeout: 10_000 })

    // No radio buttons — no invented questionnaire items
    await expect(page.getByRole('radio')).toHaveCount(0)
    // Retry option available
    await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible()
  })

  test('Content outage renders an explicit resource fallback', async ({
    page,
  }) => {
    await page.route('**/api/resources**', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          hasMore: false,
          unavailable: true,
          message:
            'Tài nguyên hỗ trợ tạm thời không khả dụng. Vui lòng thử lại sau.',
        }),
      })
    })
    await page.goto('/resources')
    await expect(
      page.getByText(
        'Tài nguyên hỗ trợ tạm thời không khả dụng. Vui lòng thử lại sau.',
      ),
    ).toBeVisible()
    await expect(page.locator('.resource-card')).toHaveCount(0)
    await expect(page.getByText(/hotline/i)).toHaveCount(0)
    await expect(page.getByText(/cấp cứu/i)).toHaveCount(0)
  })
})

// ---------------------------------------------------------------------------
// AC3 — No false claims: monitoring, emergency dispatch, unavailable functionality
// ---------------------------------------------------------------------------

test.describe('AC3: No false monitoring, emergency, or paid-feature claims', () => {
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'Fixture claim-boundary journeys are not run against the live cross-stack environment.',
  )

  test.beforeEach(async ({ request }) => {
    await resetFixture(request)
  })

  test('dashboard does not claim monitoring, emergency dispatch, or live specialist availability', async ({
    context,
    page,
  }) => {
    await injectUserSession(context)
    await page.goto('/dashboard')

    await expect(
      page.getByRole('heading', { name: /nhiệm vụ hôm nay/i }),
    ).toBeVisible({ timeout: 10_000 })

    const html = await page.evaluate(() => document.body.innerHTML)

    // No emergency or monitoring claims
    expect(html).not.toMatch(/giám sát.*24\/7/i)
    expect(html).not.toMatch(/ứng cứu khẩn cấp/i)
    expect(html).not.toMatch(/cấp cứu/i)
    expect(html).not.toMatch(/hotline/i)

    // PHQ result card must show placeholder, not a fake result
    await expect(
      page.getByText('Chưa có kết quả Care trong phiên này'),
    ).toBeVisible()
  })

  test('free-tier dashboard gates paid features with an explicit upgrade prompt', async ({
    context,
    page,
  }) => {
    await injectUserSession(context)
    // Ensure no plan is set in localStorage (free tier)
    await page.goto('/dashboard')
    await page.evaluate(() => localStorage.removeItem('mentalbridge_plan'))
    await page.reload()

    await expect(
      page.getByRole('heading', { name: /nhiệm vụ hôm nay/i }),
    ).toBeVisible({ timeout: 10_000 })

    // PlanGate must show upgrade link for locked features, not pretend they work
    await expect(
      page.getByRole('link', { name: /nâng cấp plus/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: /nâng cấp premium/i }),
    ).toBeVisible()

    // The locked feature content must be behind the gate overlay (aria-hidden preview)
    // and the gate link must point to /subscription
    const upgradeLinks = page.getByRole('link', { name: /nâng cấp/i })
    for (const link of await upgradeLinks.all()) {
      const href = await link.getAttribute('href')
      expect(href).toBe('/subscription')
    }
  })

  test('notifications page does not claim real-time delivery or emergency dispatch', async ({
    context,
    page,
  }) => {
    await injectUserSession(context)
    await page.goto('/notifications')

    await expect(
      page.getByRole('heading', { name: 'Thông báo của bạn' }),
    ).toBeVisible({ timeout: 10_000 })

    const html = await page.evaluate(() => document.body.innerHTML)

    // No emergency dispatch claim
    expect(html).not.toMatch(/ứng cứu khẩn cấp/i)
    expect(html).not.toMatch(/cấp cứu/i)
    expect(html).not.toMatch(/hotline/i)
    // No claim of continuous monitoring
    expect(html).not.toMatch(/giám sát.*24\/7/i)

    // The safety note must not promise emergency response — only security alerts
    await page.getByRole('button', { name: /Cài đặt/ }).click()
    await expect(
      page.getByText('Thông báo an toàn luôn được ưu tiên'),
    ).toBeVisible()
    // "An toàn" in this context is account security, not emergency service
    await expect(page.getByText(/dịch vụ ứng cứu/i)).toHaveCount(0)
  })

  test('specialists page does not claim live booking or guaranteed availability', async ({
    context,
    page,
  }) => {
    await injectUserSession(context)
    await page.goto('/specialists')

    await expect(
      page.getByRole('heading', { name: 'Chuyên gia tư vấn' }),
    ).toBeVisible({ timeout: 10_000 })

    const html = await page.evaluate(() => document.body.innerHTML)

    // No emergency dispatch or monitoring claim
    expect(html).not.toMatch(/ứng cứu khẩn cấp/i)
    expect(html).not.toMatch(/cấp cứu/i)
    expect(html).not.toMatch(/hotline/i)
    expect(html).not.toMatch(/giám sát.*24\/7/i)

    // Unavailable specialists must be clearly marked, not shown as available
    await expect(page.getByText('Đang bận')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Chưa có lịch trống' }),
    ).toBeVisible()
  })

  test('subscription checkout modal is explicitly labeled as simulation, not live payment', async ({
    context,
    page,
  }) => {
    await injectUserSession(context)
    await page.goto('/subscription')

    await expect(page.getByRole('heading', { name: /chọn gói/i })).toBeVisible({
      timeout: 10_000,
    })

    // Open checkout for Plus plan
    await page.getByRole('button', { name: 'Nâng cấp lên Plus' }).click()

    await expect(page.getByRole('dialog')).toBeVisible()

    // Must explicitly state it is a simulation
    await expect(page.getByText(/chế độ mô phỏng/i)).toBeVisible()

    // Must not claim real payment processing has occurred until confirmed
    await expect(page.getByText('Thanh toán thành công')).toHaveCount(0)
  })

  test('no protected page claims continuous human monitoring or emergency response', async ({
    context,
    page,
  }) => {
    await injectUserSession(context)

    const protectedRoutes = [
      '/dashboard',
      '/assessments',
      '/profile',
      '/notifications',
      '/specialists',
      '/resources',
      '/subscription',
    ]

    for (const route of protectedRoutes) {
      await page.goto(route)
      // Wait for page to settle
      await page.waitForLoadState('networkidle').catch(() => undefined)

      const bodyText = await page.evaluate(() => document.body.innerText)

      expect(
        bodyText,
        `Page ${route} must not claim 24/7 human monitoring`,
      ).not.toMatch(/giám sát con người 24\/7/i)

      expect(
        bodyText,
        `Page ${route} must not claim emergency dispatch`,
      ).not.toMatch(/ứng cứu khẩn cấp/i)

      expect(
        bodyText,
        `Page ${route} must not reference a hotline`,
      ).not.toMatch(/hotline/i)
    }
  })
})
