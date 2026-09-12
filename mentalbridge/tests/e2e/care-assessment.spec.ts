import { expect, type APIRequestContext, type Page } from '@playwright/test'

import { test } from './test-fixtures'

const useCareFixture = process.env.E2E_RUNTIME !== 'live-cross-stack'
const careServiceUrl = 'http://127.0.0.1:3202'
const careAccessToken = 'synthetic-care-e2e-access'
const otherCareAccessToken = 'synthetic-care-e2e-other-access'
const firstTimeAccessToken = 'synthetic-resource-e2e-access'

const anonymousCookieNames = new Set([
  'mentalbridge_care_anonymous_id',
  'mentalbridge_care_anonymous_token',
  'mentalbridge_care_anonymous_expiry',
  'mentalbridge_care_anonymous_assessment',
])

async function answerPublishedQuestionnaire(page: Page) {
  await expect(
    page.getByRole('heading', { name: 'PHQ-9 — Sàng lọc triệu chứng' }),
  ).toBeVisible({ timeout: 30_000 })
  for (let item = 1; item <= 9; item += 1) {
    await page
      .getByRole('radio', { name: item === 9 ? 'Vài ngày' : 'Không có gì' })
      .check()
    if (item < 9) {
      await page.getByRole('button', { name: 'Câu tiếp theo →' }).click()
    }
  }
  await expect(page.getByText(/Đối với người dùng đã đăng nhập/)).toBeVisible()
  await expect(page.getByText(/Đối với phiên ẩn danh/)).toBeVisible()
  await page.getByRole('checkbox', { name: /tôi đồng ý/i }).check()
  await page.getByRole('button', { name: 'Xem kết quả' }).click()
  await expect(
    page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
  ).toBeVisible()
  await expect(page.getByText('1', { exact: true })).toBeVisible()
  await expect(page.getByText('Dương tính theo quy tắc sàng lọc')).toBeVisible()
  await expect(page.getByText(/không giám sát con người 24\/7/i)).toBeVisible()
  await expect(page.getByText(/hotline/i)).toHaveCount(0)
}

async function answerPublishedGad7(page: Page) {
  await expect(
    page.getByRole('heading', {
      name: 'GAD-7 — Sàng lọc triệu chứng lo âu',
    }),
  ).toBeVisible()
  await expect(
    page.getByText('Cảm giác hồi hộp, lo lắng hoặc cáu kỉnh'),
  ).toBeVisible()
  for (let item = 1; item <= 7; item += 1) {
    await page
      .getByRole('radio', { name: 'Gần như hàng ngày (11-14 ngày)' })
      .check()
    if (item < 7) {
      await page.getByRole('button', { name: 'Câu tiếp theo →' }).click()
    }
  }
  await page.getByRole('checkbox', { name: /tôi đồng ý/i }).check()
  await page.getByRole('button', { name: 'Xem kết quả' }).click()
  await expect(
    page.getByRole('heading', { name: 'Kết quả sàng lọc GAD-7' }),
  ).toBeVisible()
  await expect(page.getByText('21', { exact: true })).toBeVisible()
  await expect(page.getByText('/ 21 điểm')).toBeVisible()
  await expect(page.getByText('Không áp dụng cho bộ câu hỏi này')).toBeVisible()
  await expect(page.getByText(/invented-gad-policy/i)).toHaveCount(0)
}

async function answerGuidedInstrument(
  page: Page,
  questionCount: number,
  answerName: string,
  completionLabel: string,
  completionEvidencePath?: string,
) {
  for (let item = 1; item <= questionCount; item += 1) {
    await page.getByRole('radio', { name: answerName }).check()
    if (item < questionCount) {
      await page.getByRole('button', { name: 'Câu tiếp theo →' }).click()
    }
  }
  await page.getByRole('checkbox', { name: /tôi đồng ý/i }).check()
  if (completionEvidencePath) {
    await page.screenshot({ path: completionEvidencePath, fullPage: true })
  }
  await page.getByRole('button', { name: completionLabel }).click()
}

async function careControl(
  request: APIRequestContext,
  path: string,
  token = careAccessToken,
) {
  const response = await request.post(`${careServiceUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(response.ok()).toBe(true)
}

async function selectedAssessmentId(page: Page, index = 0) {
  const href = await page
    .getByRole('link', { name: 'Xem lại' })
    .nth(index)
    .getAttribute('href')
  const assessmentId = new URL(href ?? '', 'http://127.0.0.1').searchParams.get(
    'assessmentId',
  )
  expect(assessmentId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  )
  return assessmentId as string
}

async function expectProgressFailure(
  page: Page,
  title: string,
  expectedHistoryCount: number,
) {
  await page.getByRole('button', { name: 'So sánh' }).first().click()
  await expect(page.getByText(title, { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Xem lại' })).toHaveCount(
    expectedHistoryCount,
  )
  await page.getByRole('button', { name: 'Đóng so sánh' }).click()
}

async function submitOwnedAssessment(
  request: APIRequestContext,
  token: string,
  idempotencyKey: string,
) {
  const questionnaireResponse = await request.get(
    `${careServiceUrl}/api/v1/questionnaires/PHQ9/current?locale=vi-VN`,
  )
  expect(questionnaireResponse.ok()).toBe(true)
  const questionnaire = (await questionnaireResponse.json()) as {
    definitionId: string
    questions: Array<{ questionId: string }>
  }
  const response = await request.post(`${careServiceUrl}/api/v1/assessments`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': idempotencyKey,
    },
    data: {
      questionnaireDefinitionId: questionnaire.definitionId,
      privacyPolicyVersion: 'privacy-capstone-v3',
      privacyDisclosureAcknowledged: true,
      answers: questionnaire.questions.map(({ questionId }) => ({
        questionId,
        value: 0,
      })),
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()) as { assessmentId: string }
}

test.describe('Care-backed PHQ-9 screening', () => {
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'Fixture Care journeys are not run against the live cross-stack environment.',
  )
  test.describe.configure({ mode: 'serial' })

  test('shows first-time profile onboarding on desktop and mobile', async ({
    context,
    page,
  }) => {
    await context.addCookies([
      {
        name: 'mentalbridge_access',
        value: firstTimeAccessToken,
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])

    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/profile')
    await expect(
      page.getByRole('heading', { name: 'Bạn chưa có hồ sơ' }),
    ).toBeVisible()
    await expect(page.getByText(/không thể tải đầy đủ/i)).toHaveCount(0)
    await expect(page.getByLabel('Ngôn ngữ')).toHaveCount(0)
    await expect(page.getByLabel('Múi giờ')).toHaveCount(0)
    await expect(page.getByText(/nhắc nhở/i)).toHaveCount(0)
    const nameInput = page.getByLabel('Tên hiển thị')
    await page.getByRole('button', { name: 'Tạo hồ sơ' }).first().click()
    await expect(nameInput).toBeFocused()
    await expect
      .poll(() =>
        nameInput.evaluate((element) => getComputedStyle(element).outlineWidth),
      )
      .toBe('3px')
    await expect
      .poll(() =>
        nameInput.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        ),
      )
      .not.toBe('rgba(0, 0, 0, 0)')
    const searchInput = page.getByPlaceholder('Tìm kiếm chuyên gia, nhật ký...')
    await searchInput.focus()
    await expect
      .poll(() =>
        searchInput.evaluate(
          (element) => getComputedStyle(element, '::placeholder').color,
        ),
      )
      .toBe('rgb(138, 149, 133)')
    await page.screenshot({
      path: 'docs/evidence/story-1101-profile-desktop.png',
      fullPage: true,
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Bạn chưa có hồ sơ' }),
    ).toBeVisible()
    await page.screenshot({
      path: 'docs/evidence/story-1101-profile-mobile.png',
      fullPage: true,
    })
  })

  test('completes and reopens an anonymous result without exposing its bearer credential', async ({
    context,
    page,
  }) => {
    for (const { label, response } of [
      {
        label: 'questionnaire',
        response: await page.request.get('/api/care/questionnaires/phq9'),
      },
      {
        label: 'privacy disclosure',
        response: await page.request.get('/api/care/privacy-disclosure'),
      },
      {
        label: 'anonymous session',
        response: await page.request.post('/api/care/anonymous-session'),
      },
    ]) {
      const body = await response.text()
      expect(response.ok(), `${label}: ${body}`).toBe(true)
    }

    await page.goto('/assessment/anonymous')
    await answerPublishedQuestionnaire(page)

    const cookies = await context.cookies()
    const anonymousCookies = cookies.filter((cookie) =>
      anonymousCookieNames.has(cookie.name),
    )
    expect(anonymousCookies).toHaveLength(4)
    expect(anonymousCookies.every((cookie) => cookie.httpOnly)).toBe(true)
    expect(anonymousCookies.every((cookie) => cookie.sameSite === 'Lax')).toBe(
      true,
    )

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

    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
    ).toBeVisible()
  })

  test('shows an explicit expiry state when an anonymous session expires during submission', async ({
    page,
  }) => {
    await page.goto('/assessment/anonymous')
    await expect(
      page.getByRole('heading', { name: 'PHQ-9 — Sàng lọc triệu chứng' }),
    ).toBeVisible()
    const expiryResponse = await page.request.post(
      `${careServiceUrl}/__test/care/anonymous-expire`,
    )
    expect(expiryResponse.status()).toBe(204)

    for (let item = 1; item <= 9; item += 1) {
      await page
        .getByRole('radio', { name: item === 9 ? 'Vài ngày' : 'Không có gì' })
        .check()
      if (item < 9)
        await page.getByRole('button', { name: 'Câu tiếp theo →' }).click()
    }
    await page
      .getByRole('checkbox', { name: /tôi đã đọc và xác nhận/i })
      .check()
    await page
      .getByRole('button', { name: /Gửi cho Care chấm điểm|Xem kết quả/ })
      .click()

    await expect(
      page.getByText(/phiên đánh giá ẩn danh đã hết hạn/i),
    ).toBeVisible()
  })

  test('completes and reopens the authenticated USER flow through Identity and Care BFFs', async ({
    context,
    page,
    request,
  }) => {
    test.setTimeout(useCareFixture ? 90_000 : 120_000)
    if (useCareFixture) {
      await careControl(request, '/__test/reset')
    }

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

    await page.goto('/profile')
    await expect(
      page.getByRole('heading', { name: 'Hồ sơ và quyền riêng tư' }),
    ).toBeVisible()
    await expect(page.getByLabel('Tên hiển thị')).toHaveValue('Care E2E User')
    await expect(
      page.getByText(/thông báo và đồng ý xử lý dữ liệu sàng lọc/i),
    ).toBeVisible()
    await page.getByLabel('Tên hiển thị').fill('Care E2E Updated User')
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
    await expect(page.getByText('Care đã lưu hồ sơ của bạn.')).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Tên hiển thị')).toHaveValue(
      'Care E2E Updated User',
    )
    await page.getByRole('button', { name: 'Tôi đã đọc và xác nhận' }).click()
    await expect(
      page.getByText('Đã ghi nhận xác nhận quyền riêng tư.'),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Thu hồi cho lần xử lý mới' })
      .click()
    await expect(page.getByText('Đã ghi nhận thu hồi')).toBeVisible()
    await page.getByRole('button', { name: 'Tôi đã đọc và xác nhận' }).click()
    await expect(
      page.getByText('Đã ghi nhận xác nhận quyền riêng tư.'),
    ).toBeVisible()

    await page.goto('/assessment/phq9')
    await answerPublishedQuestionnaire(page)
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
    ).toBeVisible()

    await page.goto('/assessments')
    await expect(page.getByRole('link', { name: 'Xem lại' })).toHaveCount(1)
    await expectProgressFailure(page, 'Chưa đủ dữ liệu tương thích', 1)

    await careControl(request, '/__test/care/clock/advance?duration=PT1H')

    await page.goto('/assessment/phq9')
    await expect(
      page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Làm bài mới' }).click()
    await answerPublishedQuestionnaire(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/assessments')
    await expect(page.getByRole('link', { name: 'Xem lại' })).toHaveCount(2)

    await selectedAssessmentId(page)
    const previousAssessmentId = await selectedAssessmentId(page, 1)
    const compareButton = page.getByRole('button', { name: 'So sánh' }).first()
    await expect(compareButton).toBeVisible()
    await compareButton.click()
    await expect(page.getByText('Điểm không thay đổi.')).toBeVisible()
    await expect(page.getByText('Phiên bản chấm điểm')).toBeVisible()
    await expect(page.getByText('1 giờ')).toBeVisible()
    if (!useCareFixture) {
      await page.screenshot({
        path: 'docs/evidence/mb-205-progress-mobile.png',
        fullPage: true,
      })
    }
    await page.getByRole('button', { name: 'Đóng so sánh' }).click()
    await expect(compareButton).toBeFocused()

    await page.setViewportSize({ width: 1280, height: 720 })
    await compareButton.click()
    await expect(page.getByText('Điểm không thay đổi.')).toBeVisible()
    if (!useCareFixture) {
      await page.screenshot({
        path: 'docs/evidence/mb-205-progress-desktop.png',
        fullPage: true,
      })
    }
    await page.getByRole('button', { name: 'Đóng so sánh' }).click()

    await careControl(
      request,
      `/__test/care/assessments/${previousAssessmentId}/scoring-version?value=phq9-incompatible-e2e-v1`,
    )
    await expectProgressFailure(page, 'Chưa đủ dữ liệu tương thích', 2)
    await careControl(
      request,
      `/__test/care/assessments/${previousAssessmentId}/scoring-version?value=phq9-standard-bands-v1`,
    )

    await careControl(
      request,
      `/__test/care/assessments/${previousAssessmentId}/void`,
    )
    await expectProgressFailure(page, 'Chưa đủ dữ liệu tương thích', 2)
    await careControl(
      request,
      `/__test/care/assessments/${previousAssessmentId}/restore`,
    )

    const injectedFailureCases = [
      ...(useCareFixture
        ? []
        : ([['TIMEOUT', 'Care phản hồi quá thời gian']] as const)),
      ['UNAVAILABLE', 'Care tạm thời không khả dụng'],
      ['MALFORMED', 'Care trả về dữ liệu không hợp lệ'],
    ] as const
    for (const [mode, title] of injectedFailureCases) {
      await careControl(request, `/__test/care/progress-fault?mode=${mode}`)
      await expectProgressFailure(page, title, 2)
    }

    const otherAssessment = await submitOwnedAssessment(
      request,
      otherCareAccessToken,
      'other-user-assessment-e2e',
    )
    for (const inaccessibleAssessmentId of [
      otherAssessment.assessmentId,
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
    ]) {
      const response = await page.request.get(
        `/api/care/assessments/by-id/${inaccessibleAssessmentId}/progress`,
      )
      expect(response.status()).toBe(404)
      await expect(response.json()).resolves.toMatchObject({
        code: 'ASSESSMENT_NOT_FOUND',
      })
    }

    await expect(page.getByRole('link', { name: 'Xem lại' })).toHaveCount(2)
    await expect(page.locator('body')).not.toContainText(careAccessToken)
    await expect(page.locator('body')).not.toContainText(careServiceUrl)

    await page.getByRole('link', { name: 'Xem lại' }).first().click()
    await expect(
      page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
    ).toBeVisible()

    await page.goto('/assessment/gad7')
    await answerPublishedGad7(page)
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Kết quả sàng lọc GAD-7' }),
    ).toBeVisible()
    await page.getByText('Nội dung và thang điểm đã dùng').click()
    await expect(
      page.getByText(
        'Cảm thấy sợ như thể có một điều gì đó khủng khiếp có thể xảy ra',
      ),
    ).toBeVisible()

    await page.goto('/assessments')
    const gad7HistoryRow = page.getByRole('row').filter({ hasText: 'GAD7' })
    await expect(
      gad7HistoryRow.getByRole('link', { name: 'Xem lại' }),
    ).toHaveAttribute('href', /\/assessment\/gad7\?assessmentId=/)
  })

  test('completes and resumes the guided initial check without browser-persisted health data', async ({
    context,
    page,
  }) => {
    test.setTimeout(useCareFixture ? 90_000 : 150_000)
    await context.addCookies([
      {
        name: 'mentalbridge_access',
        value: careAccessToken,
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])

    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/dashboard')
    const start = page.getByRole('link', {
      name: /Bắt đầu kiểm tra ban đầu/,
    })
    await expect(start).toBeVisible()
    await expect(page.getByText(/14 ngày gần đây/)).toBeVisible()
    await expect(
      page.getByText(/không phải chẩn đoán y khoa/).first(),
    ).toBeVisible()
    await start.click()

    const privacyHeading = page.getByRole('heading', {
      name: 'Xác nhận quyền riêng tư',
    })
    if (await privacyHeading.isVisible().catch(() => false)) {
      await page
        .getByRole('link', { name: 'Xem quyền riêng tư và tiếp tục' })
        .click()
      await page.getByRole('button', { name: 'Tôi đồng ý' }).click()
      await page
        .getByRole('link', { name: 'Tiếp tục bước chưa hoàn tất' })
        .click()
    }

    await expect(
      page.getByRole('heading', { name: 'PHQ-9 — Sàng lọc triệu chứng' }),
    ).toBeVisible()
    const stepCenters = await page
      .locator('.initial-check-progress li')
      .evaluateAll((steps) =>
        steps.map((step) => {
          const bounds = step.getBoundingClientRect()
          return bounds.left + bounds.width / 2
        }),
      )
    expect(stepCenters[3] - stepCenters[0]).toBeGreaterThan(600)
    await page.screenshot({
      path: 'docs/evidence/mb-272-initial-check-questionnaire-desktop.png',
      fullPage: true,
    })
    await answerGuidedInstrument(
      page,
      9,
      'Vài ngày',
      'Lưu PHQ-9 và bắt đầu GAD-7',
      'docs/evidence/mb-272-phq9-to-gad7-cta.png',
    )
    await expect(
      page.getByRole('heading', {
        name: 'GAD-7 — Sàng lọc triệu chứng lo âu',
      }),
    ).toBeVisible()

    await page.reload()
    await expect(
      page.getByRole('heading', {
        name: 'GAD-7 — Sàng lọc triệu chứng lo âu',
      }),
    ).toBeVisible()
    await page.goto('/dashboard')
    await page.getByRole('link', { name: /Bắt đầu kiểm tra ban đầu/ }).click()
    await expect(
      page.getByRole('heading', {
        name: 'GAD-7 — Sàng lọc triệu chứng lo âu',
      }),
    ).toBeVisible()

    await page.route('**/api/resources?**', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: 'about:blank',
          title: 'Unavailable',
          status: 503,
          code: 'CONTENT_UNAVAILABLE',
          correlationId: '50000000-0000-4000-8000-000000000101',
        }),
      })
    })
    await answerGuidedInstrument(
      page,
      7,
      'Không bao giờ (0 ngày nào)',
      'Xem kết quả',
    )

    const resultHeading = page.getByRole('heading', {
      name: 'Kết quả kiểm tra ban đầu',
    })
    await expect(resultHeading).toBeVisible()
    expect(
      await resultHeading.evaluate(
        (element) => getComputedStyle(element).color,
      ),
    ).toBe('rgb(248, 251, 249)')
    await expect(
      page.getByRole('heading', { name: 'Ưu tiên xem hướng dẫn an toàn' }),
    ).toBeVisible()
    await expect(
      page.getByText(/chủ động liên hệ dịch vụ khẩn cấp/i),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Nên ưu tiên theo dõi an toàn' }),
    ).toBeVisible()
    await expect(
      page.getByText('Dịch vụ tạm thời không khả dụng'),
    ).toBeVisible()

    const blockOrder = await page
      .locator('.initial-check-result > section')
      .evaluateAll((elements) =>
        elements.slice(0, 6).map((element) => element.className),
      )
    expect(blockOrder).toEqual([
      'initial-check-evidence',
      'initial-check-evidence',
      'initial-check-safety positive',
      'initial-check-tier',
      'initial-check-meaning',
      'initial-check-next',
    ])

    const journeyCookies = (await context.cookies()).filter((cookie) =>
      cookie.name.startsWith('mentalbridge_initial_check_'),
    )
    expect(journeyCookies).toHaveLength(3)
    expect(journeyCookies.every((cookie) => cookie.httpOnly)).toBe(true)
    const browserState = await page.evaluate(() => ({
      cookie: document.cookie,
      local: JSON.stringify(localStorage),
      session: JSON.stringify(sessionStorage),
      url: window.location.href,
      html: document.documentElement.innerHTML,
    }))
    for (const cookie of journeyCookies) {
      expect(browserState.cookie).not.toContain(cookie.value)
      expect(browserState.local).not.toContain(cookie.value)
      expect(browserState.session).not.toContain(cookie.value)
      expect(browserState.url).not.toContain(cookie.value)
      expect(browserState.html).not.toContain(cookie.value)
    }
    expect(browserState.local).not.toMatch(/questionId|answers|totalScore/)
    expect(browserState.session).not.toMatch(/questionId|answers|totalScore/)
    await expect(page.locator('body')).not.toContainText(
      /sprint|backend|demo|test/i,
    )

    await page.screenshot({
      path: 'docs/evidence/mb-272-initial-check-desktop.png',
      fullPage: true,
    })
    await page.setViewportSize({ width: 375, height: 812 })
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Kết quả kiểm tra ban đầu' }),
    ).toBeVisible()
    await page.screenshot({
      path: 'docs/evidence/mb-272-initial-check-mobile.png',
      fullPage: true,
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    const restartButton = page.getByRole('button', {
      name: 'Bắt đầu lượt kiểm tra mới',
    })
    expect((await restartButton.boundingBox())?.height).toBeGreaterThanOrEqual(
      44,
    )

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 844, height: 390 })
    await page.reload()
    await expect(resultHeading).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
})
