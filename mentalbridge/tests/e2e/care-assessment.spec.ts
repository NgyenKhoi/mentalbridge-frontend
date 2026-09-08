import { expect, type APIRequestContext, type Page } from '@playwright/test'

import { test } from './test-fixtures'

const useCareFixture = process.env.CARE_E2E_MODE === 'fixture'
const careServiceUrl = 'http://127.0.0.1:3202'
const careAccessToken = 'synthetic-care-e2e-access'
const otherCareAccessToken = 'synthetic-care-e2e-other-access'

const anonymousCookieNames = new Set([
  'mentalbridge_care_anonymous_id',
  'mentalbridge_care_anonymous_token',
  'mentalbridge_care_anonymous_expiry',
  'mentalbridge_care_anonymous_assessment',
])

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
  ).toBeVisible()
  await expect(page.getByText('1', { exact: true })).toBeVisible()
  await expect(page.getByText('Dương tính theo quy tắc sàng lọc')).toBeVisible()
  await expect(page.getByText(/không giám sát con người 24\/7/i)).toBeVisible()
  await expect(page.getByText(/hotline/i)).toHaveCount(0)
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
      privacyPolicyVersion: 'privacy-capstone-v1',
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
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    'Controlled Care fixtures are available only with the managed local server.',
  )
  test.describe.configure({ mode: 'serial' })

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

  test('completes and reopens the authenticated USER flow through Identity and Care BFFs', async ({
    context,
    page,
    request,
  }) => {
    test.setTimeout(useCareFixture ? 90_000 : 120_000)

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
      page.getByRole('heading', { name: 'Hồ sơ Care' }),
    ).toBeVisible()
    await expect(page.getByLabel('Tên hiển thị')).toHaveValue('Care E2E User')
    await expect(
      page.getByText(/phiên bản backend: privacy-capstone-v1/i),
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
  })
})
