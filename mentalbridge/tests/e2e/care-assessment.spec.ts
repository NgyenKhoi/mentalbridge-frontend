import { expect, type Page } from '@playwright/test'

import { test } from './test-fixtures'

// All care-assessment tests share a single fixture server and must run serially
// to avoid concurrent resets clobbering in-flight session or consent state.
test.describe.configure({ mode: 'serial' })

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const anonymousCookieNames = new Set([
  'mentalbridge_care_anonymous_id',
  'mentalbridge_care_anonymous_token',
  'mentalbridge_care_anonymous_expiry',
  'mentalbridge_care_anonymous_assessment',
])

const identityFixtureUrl = 'http://127.0.0.1:3201'

async function resetFixture(
  request: import('@playwright/test').APIRequestContext,
) {
  const response = await request.post(`${identityFixtureUrl}/__test/reset`)
  expect(response.status()).toBe(204)
}

async function fixtureState(
  request: import('@playwright/test').APIRequestContext,
) {
  const response = await request.get(`${identityFixtureUrl}/__test/state`)
  expect(response.ok()).toBe(true)
  return (await response.json()) as {
    questionnaireCount: number
    anonymousAssessmentCount: number
    authenticatedAssessmentCount: number
    resourceCount: number
  }
}

/** Answer all 9 PHQ-9 items: items 1–8 → 'Không có gì' (0), item 9 → 'Vài ngày' (1). */
async function answerPublishedQuestionnaire(page: Page) {
  await expect(
    page.getByRole('heading', { name: 'PHQ-9 — Sàng lọc triệu chứng' }),
  ).toBeVisible()

  for (let item = 1; item <= 9; item += 1) {
    await page
      .getByRole('radio', { name: item === 9 ? 'Vài ngày' : 'Không có gì' })
      .check()
    if (item < 9) {
      await page.getByRole('button', { name: 'Câu tiếp theo →' }).click()
    }
  }

  await page.getByRole('checkbox', { name: /tôi đã đọc và xác nhận/i }).check()
  await page.getByRole('button', { name: 'Gửi cho Care chấm điểm' }).click()

  await expect(
    page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
  ).toBeVisible({ timeout: 15_000 })
  // Score is server-owned: total = 1 (item 9 answered 'Vài ngày')
  await expect(page.getByText('1', { exact: true })).toBeVisible()
  await expect(page.getByText('Dương tính theo quy tắc sàng lọc')).toBeVisible()
  // Safety disclaimer must be visible; no hotline must appear
  await expect(page.getByText(/không giám sát con người 24\/7/i)).toBeVisible()
  await expect(page.getByText(/hotline/i)).toHaveCount(0)
}

/** Inject the pre-seeded Care E2E access cookie (no live login required). */
async function injectCareSession(
  context: import('@playwright/test').BrowserContext,
) {
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

// ---------------------------------------------------------------------------
// Suite: anonymous PHQ-9 → result → resource fallback
// All anonymous tests are serial to avoid fixture session state races.
// ---------------------------------------------------------------------------

test.describe('Anonymous PHQ-9 journey', () => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    'Controlled Care fixtures are available only with the managed local server.',
  )

  test.beforeEach(async ({ request }) => {
    await resetFixture(request)
  })

  test('completes PHQ-9 and reopens anonymous result without exposing bearer credential', async ({
    context,
    page,
    request,
  }) => {
    await page.goto('/assessment/anonymous')
    await answerPublishedQuestionnaire(page)

    // All four anonymous session cookies must be HttpOnly + SameSite=Lax
    const cookies = await context.cookies()
    const anonymousCookies = cookies.filter((c) =>
      anonymousCookieNames.has(c.name),
    )
    expect(anonymousCookies).toHaveLength(4)
    expect(anonymousCookies.every((c) => c.httpOnly)).toBe(true)
    expect(anonymousCookies.every((c) => c.sameSite === 'Lax')).toBe(true)

    // Token must not be readable from any browser-owned storage or HTML
    const browserState = await page.evaluate(() => ({
      cookie: document.cookie,
      local: JSON.stringify(localStorage),
      session: JSON.stringify(sessionStorage),
      html: document.documentElement.innerHTML,
    }))
    expect(browserState.cookie).not.toContain('mentalbridge_care_anonymous')
    expect(browserState.local).not.toMatch(/anonymous.*token/i)
    expect(browserState.session).not.toMatch(/anonymous.*token/i)
    expect(browserState.html).not.toContain('synthetic-anonymous')

    // Reload must reopen the same result (persistent anonymous session)
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
    ).toBeVisible({ timeout: 15_000 })

    // Fixture confirms exactly one anonymous submission reached the Care boundary
    const state = await fixtureState(request)
    expect(state.anonymousAssessmentCount).toBe(1)
    await page.getByRole('link', { name: 'Xem tài nguyên đã rà soát' }).click()
    await expect(
      page.getByRole('heading', { name: 'Tài nguyên đã được rà soát' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Kỹ thuật thở để giảm lo âu' }),
    ).toBeVisible()
    await expect(page.getByText('Đã rà soát').first()).toBeVisible()
    expect((await fixtureState(request)).resourceCount).toBe(1)
    await expect(page.getByText(/hotline/i)).toHaveCount(0)
    await expect(page.getByText(/chẩn đoán y khoa/i)).toHaveCount(0)
    await expect(page.getByText(/cấp cứu/i)).toHaveCount(0)
  })

  test('resource dependency fallback is explicit and does not invent content', async ({
    page,
  }) => {
    await page.route('**/api/content/resources', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          count: 0,
          fallback: 'unavailable',
          message:
            'Tài nguyên hỗ trợ tạm thời không khả dụng. Vui lòng thử lại sau.',
        }),
      })
    })
    await page.goto('/resources')
    await expect(
      page.getByRole('heading', { name: 'Tài nguyên hiện chưa khả dụng' }),
    ).toBeVisible()
    await expect(page.locator('.resource-card')).toHaveCount(0)
  })

  test('submission blocked by expired anonymous session shows explicit error without result data', async ({
    page,
  }) => {
    // Load the questionnaire normally (no intercept yet) so the page
    // acquires a session cookie and renders the form.
    await page.goto('/assessment/anonymous')
    await expect(
      page.getByRole('heading', { name: 'PHQ-9 — Sàng lọc triệu chứng' }),
    ).toBeVisible()

    // Answer all questions to reach the submit button
    for (let item = 1; item <= 9; item += 1) {
      await page
        .getByRole('radio', { name: item === 9 ? 'Vài ngày' : 'Không có gì' })
        .check()
      if (item < 9) {
        await page.getByRole('button', { name: 'Câu tiếp theo →' }).click()
      }
    }
    await page
      .getByRole('checkbox', { name: /tôi đã đọc và xác nhận/i })
      .check()

    // Now intercept the submit BFF call to simulate session expiry
    await page.route('**/api/care/anonymous-assessments/current', (route) => {
      if (route.request().method() === 'POST') {
        void route.fulfill({
          status: 401,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            type: 'about:blank',
            title: 'Anonymous session expired',
            status: 401,
            code: 'ANONYMOUS_SESSION_EXPIRED',
            correlationId: 'e2e-expiry-test-correlation-id',
          }),
        })
      } else {
        void route.continue()
      }
    })

    await page.getByRole('button', { name: 'Gửi cho Care chấm điểm' }).click()

    // Must show the specific expiry error message — not crash, not show a result
    await expect(
      page.getByText(/phiên đánh giá ẩn danh đã hết hạn/i),
    ).toBeVisible({ timeout: 10_000 })
    // No result heading must appear
    await expect(
      page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
    ).toHaveCount(0)
  })
})

// ---------------------------------------------------------------------------
// Suite: authenticated profile → consent → PHQ-9 → history → reassessment
// ---------------------------------------------------------------------------

test.describe('Authenticated Care journey', () => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    'Controlled Care fixtures are available only with the managed local server.',
  )

  test.beforeEach(async ({ request }) => {
    await resetFixture(request)
  })

  test('reads profile and backend-owned privacy disclosure', async ({
    context,
    page,
  }) => {
    await injectCareSession(context)
    await page.goto('/profile')

    await expect(
      page.getByRole('heading', { name: 'Hồ sơ Care' }),
    ).toBeVisible()
    // Profile data comes from fixture, not browser-invented values
    await expect(page.getByLabel('Tên hiển thị')).toHaveValue('Care E2E User')
    // Disclosure version must be the backend-owned value
    await expect(
      page.getByText(/phiên bản backend: privacy-capstone-v1/i),
    ).toBeVisible()
    // No browser-owned score or band on profile page
    await expect(page.getByText(/phq.*score/i)).toHaveCount(0)
  })

  test('grants consent on profile page then completes PHQ-9 successfully', async ({
    context,
    page,
    request,
  }) => {
    await injectCareSession(context)

    // Step 1: consent not yet granted after reset
    await page.goto('/profile')
    await expect(page.getByText('Disclosure chưa xác nhận')).toBeVisible()

    // Grant consent via the profile page button
    await page.getByRole('button', { name: 'Tôi đã đọc và xác nhận' }).click()
    await expect(
      page.getByText('✓ Đã ghi nhận xác nhận quyền riêng tư.'),
    ).toBeVisible()
    await expect(page.getByText('✓ Disclosure đã xác nhận')).toBeVisible()

    // Step 2: PHQ-9 must succeed with consent granted
    await page.goto('/assessment/phq9')
    await answerPublishedQuestionnaire(page)

    const state = await fixtureState(request)
    expect(state.authenticatedAssessmentCount).toBe(1)
  })

  test('completes PHQ-9, reassesses, and views history with two owned results', async ({
    context,
    page,
    request,
  }) => {
    await injectCareSession(context)

    // Pre-grant consent
    await page.goto('/profile')
    await page.getByRole('button', { name: 'Tôi đã đọc và xác nhận' }).click()
    await expect(
      page.getByText('✓ Đã ghi nhận xác nhận quyền riêng tư.'),
    ).toBeVisible()

    // First submission
    await page.goto('/assessment/phq9')
    await answerPublishedQuestionnaire(page)

    // Reload must reopen the same result, not create a new one
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
    ).toBeVisible({ timeout: 15_000 })

    // Reassessment creates a distinct new submission
    await page.getByRole('button', { name: 'Làm bài mới' }).click()
    await answerPublishedQuestionnaire(page)

    // History must list exactly two owned assessments
    await page.goto('/assessments')
    await expect(page.getByRole('link', { name: 'Xem lại' })).toHaveCount(2, {
      timeout: 10_000,
    })

    // Each "Xem lại" reopens the exact immutable result
    await page.getByRole('link', { name: 'Xem lại' }).first().click()
    await expect(
      page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
    ).toBeVisible({ timeout: 15_000 })

    const state = await fixtureState(request)
    expect(state.authenticatedAssessmentCount).toBe(2)
  })

  test('authenticated user receives only reviewed published resources', async ({
    context,
    page,
    request,
  }) => {
    await injectCareSession(context)
    await page.goto('/resources')
    await expect(
      page.getByRole('heading', { name: 'Thiền chánh niệm cơ bản' }),
    ).toBeVisible()
    await expect(page.getByText('Đã rà soát')).toHaveCount(2)
    expect((await fixtureState(request)).resourceCount).toBe(1)
  })

  test('cross-user Care access attempt does not render another account result', async ({
    context,
    page,
  }) => {
    // Inject a token the fixture does not recognise as a valid session
    await context.addCookies([
      {
        name: 'mentalbridge_access',
        value: 'synthetic-unknown-token-not-in-fixture',
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])

    await page.goto('/profile')

    // Either redirected to /login or shows an error — must never render
    // the care-e2e user's profile data from the fixture
    const url = page.url()
    if (url.includes('/login')) {
      await expect(page.locator('form input[type="email"]')).toBeVisible()
    } else {
      // Stayed on /profile but must show error state, not another user's data
      await expect(page.getByText('Care E2E User')).toHaveCount(0)
      await expect(page.locator('[role="alert"]')).toBeVisible()
    }
  })
})

// ---------------------------------------------------------------------------
// Suite: service degradation — explicit unavailable states, no invented content
// ---------------------------------------------------------------------------

test.describe('Care service degradation', () => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    'Controlled Care fixtures are available only with the managed local server.',
  )

  test('questionnaire unavailable shows explicit state without inventing questions', async ({
    page,
  }) => {
    // Intercept the BFF questionnaire route to simulate Care being down
    await page.route('**/api/care/questionnaires/phq9', (route) => {
      void route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: 'about:blank',
          title: 'Care service unavailable',
          status: 503,
          code: 'CARE_UNAVAILABLE',
          correlationId: 'e2e-degradation-test-correlation-id',
        }),
      })
    })

    await page.goto('/assessment/anonymous')

    // Must show explicit unavailable heading — not a questionnaire with invented questions
    await expect(
      page.getByRole('heading', { name: 'Bài sàng lọc hiện chưa khả dụng' }),
    ).toBeVisible({ timeout: 10_000 })
    // Error text must reference the service being temporarily unavailable
    await expect(page.getByText(/tạm thời chưa sẵn sàng/i)).toBeVisible()
    // Retry option must be present
    await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible()
    // No question prompts must appear
    await expect(page.getByRole('radio')).toHaveCount(0)
    // No hotline
    await expect(page.getByText(/hotline/i)).toHaveCount(0)
  })

  test('questionnaire not found shows unavailable without generating substitute content', async ({
    page,
  }) => {
    await page.route('**/api/care/questionnaires/phq9', (route) => {
      void route.fulfill({
        status: 404,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: 'about:blank',
          title: 'Questionnaire not found',
          status: 404,
          code: 'QUESTIONNAIRE_NOT_FOUND',
          correlationId: 'e2e-not-found-test-correlation-id',
        }),
      })
    })

    await page.goto('/assessment/anonymous')

    await expect(
      page.getByRole('heading', { name: 'Bài sàng lọc hiện chưa khả dụng' }),
    ).toBeVisible({ timeout: 10_000 })
    // Must display the specific "no approved questionnaire" message
    await expect(
      page.getByText(/bản câu hỏi tiếng việt.*chưa khả dụng/i),
    ).toBeVisible()
    // Frontend must not invent or translate substitute questionnaire content
    await expect(page.getByRole('radio')).toHaveCount(0)
  })

  test('Care history unavailable shows explicit error without mock history entries', async ({
    context,
    page,
  }) => {
    await injectCareSession(context)

    // Intercept the BFF history route before navigating
    await page.route('**/api/care/assessments/history**', (route) => {
      void route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: 'about:blank',
          title: 'Care unavailable',
          status: 503,
          code: 'CARE_UNAVAILABLE',
          correlationId: 'e2e-history-degradation-correlation-id',
        }),
      })
    })

    await page.goto('/assessments')

    // Must show the error state (not the empty state)
    await expect(page.getByText('Không thể tải lịch sử')).toBeVisible({
      timeout: 10_000,
    })
    // Error block must offer retry
    await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible()
    // Must not display any mock assessment history rows
    await expect(page.getByRole('link', { name: 'Xem lại' })).toHaveCount(0)
  })
})
