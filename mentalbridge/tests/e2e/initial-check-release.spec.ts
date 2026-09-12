import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
  type TestInfo,
} from '@playwright/test'
import { writeFile } from 'node:fs/promises'

const mode = process.env.MB273_E2E_MODE
const isLocalMode = mode === 'fixture' || mode === 'service'
const isLiveMode = mode === 'live'
const careServiceUrl = 'http://127.0.0.1:3202'
const identityFixtureUrl = 'http://127.0.0.1:3201'
const releaseAccessToken = 'synthetic-mb273-e2e-access'
const foreignAccessToken = 'synthetic-care-e2e-other-access'
const accessCookie = 'mentalbridge_access'
const phq9Cookie = 'mentalbridge_initial_check_phq9_assessment'
const gad7Cookie = 'mentalbridge_initial_check_gad7_assessment'
const evaluationCookie = 'mentalbridge_initial_check_support_evaluation'

type ReleaseState = {
  phase: 'COMPLETED'
  phq9: {
    assessmentId: string
    questionnaireVersion: string
    result: {
      totalScore: number
      screeningLevel: string
      scoringVersion: string
      safetyStatus: string
      safetyPolicyVersion: string
    }
  }
  gad7: {
    assessmentId: string
    questionnaireVersion: string
    result: {
      totalScore: number
      screeningLevel: string
      scoringVersion: string
      safetyStatus: string
      safetyPolicyVersion: null
    }
  }
  evaluation: {
    supportEvaluationId: string
    policyVersion: string
    supportTier: string
    reasonCodes: string[]
    evidence: Array<{
      assessmentId: string
      instrument: string
      questionnaireVersion: string
      scoringVersion: string
      screeningLevel: string
      safetyStatus: string
      meaning: { text: string; limitation: string }
    }>
    nextStep: { text: string; boundary: string }
    disclaimer: string
  }
}

async function setAccessCookie(
  context: BrowserContext,
  token: string,
  baseURL = 'http://127.0.0.1:3100',
) {
  const url = new URL(baseURL)
  await context.addCookies([
    {
      name: accessCookie,
      value: token,
      domain: url.hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: url.protocol === 'https:',
    },
  ])
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  const status = await page.evaluate(
    async ({ loginEmail, loginPassword }) => {
      const response = await fetch('/api/identity/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      })
      return response.status
    },
    { loginEmail: email, loginPassword: password },
  )
  expect(status).toBe(200)
}

async function createProfileAndConsent(
  page: Page,
  name: string,
  exerciseValidation: boolean,
) {
  await page.goto('/profile?returnTo=%2Finitial-check')
  const form = page.locator('form').first()
  const nameInput = form.getByLabel('Tên hiển thị')
  const birthDate = form.getByLabel('Ngày sinh')
  const save = form.getByRole('button', { name: 'Tạo hồ sơ' })

  if (exerciseValidation) {
    await save.click()
    await expect(nameInput).toBeFocused()
    await expect(
      page.getByText(/nhập tên hiển thị từ 1 đến 120 ký tự/i),
    ).toBeVisible()
    await nameInput.fill(name)
    await birthDate.fill('2099-01-01')
    await save.click()
    await expect(
      page.getByText('Ngày sinh không được ở trong tương lai.'),
    ).toBeVisible()
    await expect(birthDate).toBeFocused()
  } else {
    await nameInput.fill(name)
  }

  await birthDate.fill('2000-01-01')
  await save.click()
  await expect(page.getByText('Đã tạo hồ sơ của bạn.')).toBeVisible()

  const grant = page.getByRole('button', { name: 'Tôi đồng ý' })
  if (await grant.isVisible().catch(() => false)) {
    await grant.click()
    await expect(
      page.getByText('Đã ghi nhận sự đồng ý xử lý dữ liệu sàng lọc.'),
    ).toBeVisible()
  }
}

async function completeQuestions(
  page: Page,
  answers: string[],
  beforeSubmit?: () => Promise<void>,
  completionLabel = 'Xem kết quả',
) {
  for (let index = 0; index < answers.length; index += 1) {
    await page.getByRole('radio', { name: answers[index], exact: true }).check()
    if (index < answers.length - 1) {
      await page.getByRole('button', { name: 'Câu tiếp theo →' }).click()
    }
  }
  await page.getByRole('checkbox', { name: /tôi đồng ý/i }).check()
  if (beforeSubmit) await beforeSubmit()
  await page.getByRole('button', { name: completionLabel }).click()
}

async function injectLocalCareFault(request: APIRequestContext) {
  const response = await request.post(
    `${careServiceUrl}/__test/care/initial-check-fault?mode=GAD_UNAVAILABLE`,
    { headers: { Authorization: `Bearer ${releaseAccessToken}` } },
  )
  expect([200, 204]).toContain(response.status())
}

async function injectLocalContentFault(request: APIRequestContext) {
  const response = await request.post(
    `${identityFixtureUrl}/__test/content-fault?mode=UNAVAILABLE`,
  )
  expect(response.status()).toBe(204)
}

async function submitForeignGad(request: APIRequestContext) {
  const questionnaireResponse = await request.get(
    `${careServiceUrl}/api/v1/questionnaires/GAD7/current?locale=vi-VN`,
  )
  expect(questionnaireResponse.status()).toBe(200)
  const questionnaire = (await questionnaireResponse.json()) as {
    definitionId: string
    questions: Array<{ questionId: string }>
  }
  const response = await request.post(`${careServiceUrl}/api/v1/assessments`, {
    headers: {
      Authorization: `Bearer ${foreignAccessToken}`,
      'Idempotency-Key': 'mb273-foreign-gad-0001',
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
  const responseBody = (await response.json()) as { assessmentId: string }
  expect(response.status(), JSON.stringify(responseBody)).toBe(201)
  return responseBody.assessmentId
}

async function submitLiveForeignGad(browser: Browser, baseURL: string) {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  try {
    await login(
      page,
      process.env.MB273_FOREIGN_SYNTHETIC_EMAIL!,
      process.env.MB273_FOREIGN_SYNTHETIC_PASSWORD!,
    )
    await page.goto('/profile')
    if (
      await page
        .getByRole('heading', { name: 'Bạn chưa có hồ sơ' })
        .isVisible()
        .catch(() => false)
    ) {
      await createProfileAndConsent(page, 'MB-273 Foreign Evidence', false)
    }
    const grant = page.getByRole('button', { name: 'Tôi đồng ý' })
    if (await grant.isVisible().catch(() => false)) {
      await grant.click()
      await expect(
        page.getByText('Đã ghi nhận sự đồng ý xử lý dữ liệu sàng lọc.'),
      ).toBeVisible()
    }

    await page.goto('/assessment/gad7')
    const submission = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/api/care/assessments/current'),
    )
    await completeQuestions(
      page,
      Array.from({ length: 7 }, () => 'Không bao giờ (0 ngày nào)'),
    )
    const response = await submission
    expect(response.status()).toBe(201)
    return ((await response.json()) as { assessmentId: string }).assessmentId
  } finally {
    await context.close()
  }
}

function releaseEvidence(state: ReleaseState) {
  return {
    classification:
      mode === 'fixture'
        ? 'fixture-browser'
        : mode === 'service'
          ? 'service-integration'
          : 'live-cross-stack',
    environmentId: process.env.MB273_ENVIRONMENT_ID ?? `loopback-${mode}`,
    frontendCommit: process.env.MB273_FRONTEND_COMMIT ?? 'working-tree',
    backendCommit: process.env.MB273_BACKEND_COMMIT ?? 'working-tree',
    phq9: {
      assessmentId: state.phq9.assessmentId,
      questionnaireVersion: state.phq9.questionnaireVersion,
      scoringVersion: state.phq9.result.scoringVersion,
      totalScore: state.phq9.result.totalScore,
      screeningLevel: state.phq9.result.screeningLevel,
      safetyStatus: state.phq9.result.safetyStatus,
      safetyPolicyVersion: state.phq9.result.safetyPolicyVersion,
    },
    gad7: {
      assessmentId: state.gad7.assessmentId,
      questionnaireVersion: state.gad7.questionnaireVersion,
      scoringVersion: state.gad7.result.scoringVersion,
      totalScore: state.gad7.result.totalScore,
      screeningLevel: state.gad7.result.screeningLevel,
      safetyStatus: state.gad7.result.safetyStatus,
    },
    support: {
      supportEvaluationId: state.evaluation.supportEvaluationId,
      policyVersion: state.evaluation.policyVersion,
      supportTier: state.evaluation.supportTier,
      reasonCodes: state.evaluation.reasonCodes,
    },
  }
}

async function attachEvidence(testInfo: TestInfo, state: ReleaseState) {
  const evidence = JSON.stringify(releaseEvidence(state), null, 2)
  await testInfo.attach('mb-273-persisted-evidence', {
    body: Buffer.from(evidence),
    contentType: 'application/json',
  })
  if (mode === 'fixture' || mode === 'service') {
    await writeFile(
      `docs/evidence/mb-273-${mode}-persisted-evidence.json`,
      `${evidence}\n`,
      'utf8',
    )
  }
}

test.describe('MB-273 initial-check release readiness', () => {
  test.skip(
    !isLocalMode && !isLiveMode,
    'Run through one of the explicit MB-273 evidence modes.',
  )
  test.describe.configure({ mode: 'serial' })

  test('proves the fresh-user, recovery, safety, ownership and redaction journeys', async ({
    browser,
    context,
    page,
    request,
  }, testInfo) => {
    test.setTimeout(isLiveMode ? 360_000 : 240_000)
    const browserMessages: string[] = []
    page.on('console', (message) => browserMessages.push(message.text()))

    if (isLiveMode) {
      await login(
        page,
        process.env.MB273_SYNTHETIC_EMAIL!,
        process.env.MB273_SYNTHETIC_PASSWORD!,
      )
    } else {
      await setAccessCookie(context, releaseAccessToken)
    }

    const unauthenticated = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
    })
    const unauthorizedResponse = await unauthenticated.request.get(
      '/api/care/initial-check',
    )
    expect(unauthorizedResponse.status()).toBe(401)
    await unauthenticated.close()

    await page.goto('/initial-check')
    await expect(
      page.getByRole('heading', { name: 'Hoàn thiện hồ sơ cơ bản' }),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Tạo hồ sơ và tiếp tục' }).click()
    await createProfileAndConsent(page, 'MB-273 Release User', true)
    await page
      .getByRole('link', { name: 'Tiếp tục bước chưa hoàn tất' })
      .click()

    await expect(
      page.getByRole('heading', { name: 'PHQ-9 — Sàng lọc triệu chứng' }),
    ).toBeVisible()
    const phq9SubmissionRequest = page.waitForRequest(
      (pending) =>
        pending.method() === 'POST' &&
        pending.url().includes('/api/care/initial-check/assessments/phq9'),
    )

    let liveGadFault = false
    if (isLiveMode) {
      liveGadFault = true
      await page.route('**/api/care/questionnaires/gad7', async (route) => {
        if (!liveGadFault) {
          await route.continue()
          return
        }
        await route.fulfill({
          status: 503,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            type: 'about:blank',
            title: 'Unavailable',
            status: 503,
            code: 'QUESTIONNAIRE_UNAVAILABLE',
            correlationId: '50000000-0000-4000-8000-000000000273',
          }),
        })
      })
    }

    await completeQuestions(
      page,
      [...Array.from({ length: 8 }, () => 'Không có gì'), 'Vài ngày'],
      isLocalMode ? () => injectLocalCareFault(request) : undefined,
      'Lưu PHQ-9 và bắt đầu GAD-7',
    )
    const originalRequest = await phq9SubmissionRequest
    const originalHeaders = await originalRequest.allHeaders()
    const idempotencyKey = originalHeaders['idempotency-key']
    expect(idempotencyKey).toBeTruthy()

    await expect(
      page.getByRole('heading', { name: 'Bài sàng lọc hiện chưa khả dụng' }),
    ).toBeVisible()
    if (isLiveMode) {
      liveGadFault = false
      await page.unroute('**/api/care/questionnaires/gad7')
    }

    const duplicateStatus = await page.evaluate(
      async ({ key, body }) => {
        const response = await fetch(
          '/api/care/initial-check/assessments/phq9',
          {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': key,
            },
            body: JSON.stringify(body),
          },
        )
        return response.status
      },
      { key: idempotencyKey!, body: originalRequest.postDataJSON() },
    )
    expect(duplicateStatus).toBe(201)

    await page.getByRole('button', { name: 'Thử lại' }).click()
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

    if (isLocalMode) {
      await injectLocalContentFault(request)
    } else {
      await page.route('**/api/resources?**', (route) =>
        route.fulfill({
          status: 503,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            type: 'about:blank',
            title: 'Unavailable',
            status: 503,
            code: 'CONTENT_UNAVAILABLE',
            correlationId: '50000000-0000-4000-8000-000000000274',
          }),
        }),
      )
    }
    await completeQuestions(
      page,
      Array.from({ length: 7 }, () => 'Không bao giờ (0 ngày nào)'),
    )

    const resultHeading = page.getByRole('heading', {
      name: 'Kết quả kiểm tra ban đầu',
    })
    await expect(resultHeading).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Ưu tiên xem hướng dẫn an toàn' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Nên ưu tiên theo dõi an toàn' }),
    ).toBeVisible()
    await expect(
      page.getByText(/không phải chẩn đoán y khoa/i).first(),
    ).toBeVisible()
    await expect(
      page.getByText(/chủ động liên hệ dịch vụ khẩn cấp/i),
    ).toBeVisible()
    await expect(
      page.getByText('Dịch vụ tạm thời không khả dụng'),
    ).toBeVisible()

    const stateResult = await page.evaluate(async () => {
      const response = await fetch('/api/care/initial-check', {
        credentials: 'same-origin',
      })
      return { status: response.status, body: await response.json() }
    })
    expect(stateResult.status).toBe(200)
    const state = stateResult.body as ReleaseState
    expect(state).toMatchObject({
      phase: 'COMPLETED',
      phq9: {
        questionnaireVersion: 'phq9-vi-vn-capstone-v2',
        result: {
          totalScore: 1,
          screeningLevel: 'MINIMAL',
          safetyStatus: 'POSITIVE_SAFETY_SCREEN',
        },
      },
      gad7: {
        questionnaireVersion: 'gad7-vi-vn-adult-v1',
        result: {
          totalScore: 0,
          screeningLevel: 'MINIMAL',
          safetyStatus: 'NOT_APPLICABLE',
        },
      },
      evaluation: {
        policyVersion: 'mb-support-routing-capstone-v1',
        supportTier: 'SAFETY_FOLLOW_UP_RECOMMENDED',
        reasonCodes: ['PHQ9_SAFETY_SCREEN_POSITIVE'],
      },
    })
    expect(state.evaluation.evidence.map((item) => item.instrument)).toEqual([
      'PHQ9',
      'GAD7',
    ])
    expect(state.evaluation.evidence.map((item) => item.assessmentId)).toEqual([
      state.phq9.assessmentId,
      state.gad7.assessmentId,
    ])
    expect(
      state.evaluation.evidence.every(
        (item) =>
          item.meaning.text.length > 0 && item.meaning.limitation.length > 0,
      ),
    ).toBe(true)
    expect(state.evaluation.nextStep.text).toBeTruthy()
    expect(state.evaluation.nextStep.boundary).toBeTruthy()
    expect(state.evaluation.disclaimer).toMatch(/không phải chẩn đoán/i)
    await attachEvidence(testInfo, state)

    const evidencePath =
      mode === 'fixture'
        ? 'docs/evidence/mb-273-fixture-result-desktop.png'
        : testInfo.outputPath('mb-273-result-desktop.png')
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: evidencePath, fullPage: true })
    if (mode !== 'fixture') {
      await testInfo.attach('mb-273-result-desktop', {
        path: evidencePath,
        contentType: 'image/png',
      })
    }

    await page.setViewportSize({ width: 375, height: 812 })
    await page.reload()
    await expect(resultHeading).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    const mobilePath =
      mode === 'fixture'
        ? 'docs/evidence/mb-273-fixture-result-mobile.png'
        : testInfo.outputPath('mb-273-result-mobile.png')
    await page.screenshot({ path: mobilePath, fullPage: true })
    if (mode !== 'fixture') {
      await testInfo.attach('mb-273-result-mobile', {
        path: mobilePath,
        contentType: 'image/png',
      })
    }

    const foreignAssessmentId = isLiveMode
      ? await submitLiveForeignGad(
          browser,
          String(testInfo.project.use.baseURL),
        )
      : await submitForeignGad(request)
    const cookieUrl = String(testInfo.project.use.baseURL)
    await context.addCookies([
      {
        name: gad7Cookie,
        value: foreignAssessmentId,
        url: cookieUrl,
        httpOnly: true,
        sameSite: 'Lax',
        secure: cookieUrl.startsWith('https:'),
      },
    ])
    const foreignResult = await page.evaluate(async () => {
      const response = await fetch('/api/care/initial-check/evaluation', {
        method: 'POST',
        credentials: 'same-origin',
      })
      return { status: response.status, body: await response.json() }
    })
    expect(foreignResult.status).toBe(404)
    expect(foreignResult.body).toMatchObject({
      code: 'ASSESSMENT_NOT_FOUND',
    })

    await context.addCookies([
      {
        name: gad7Cookie,
        value: state.gad7.assessmentId,
        url: cookieUrl,
        httpOnly: true,
        sameSite: 'Lax',
        secure: cookieUrl.startsWith('https:'),
      },
      {
        name: evaluationCookie,
        value: state.evaluation.supportEvaluationId,
        url: cookieUrl,
        httpOnly: true,
        sameSite: 'Lax',
        secure: cookieUrl.startsWith('https:'),
      },
    ])
    await page.goto('/dashboard')
    await page.getByRole('link', { name: /Bắt đầu kiểm tra ban đầu/ }).click()
    await expect(resultHeading).toBeVisible()

    const journeyCookies = (await context.cookies()).filter((cookie) =>
      [phq9Cookie, gad7Cookie, evaluationCookie].includes(cookie.name),
    )
    expect(journeyCookies).toHaveLength(3)
    expect(journeyCookies.every((cookie) => cookie.httpOnly)).toBe(true)
    const browserState = await page.evaluate(() => ({
      cookie: document.cookie,
      local: JSON.stringify(localStorage),
      session: JSON.stringify(sessionStorage),
      url: window.location.href,
    }))
    for (const cookie of journeyCookies) {
      expect(browserState.cookie).not.toContain(cookie.value)
      expect(browserState.local).not.toContain(cookie.value)
      expect(browserState.session).not.toContain(cookie.value)
      expect(browserState.url).not.toContain(cookie.value)
    }
    expect(browserState.local).not.toMatch(/questionId|answers|totalScore/)
    expect(browserState.session).not.toMatch(/questionId|answers|totalScore/)
    expect(browserMessages.join('\n')).not.toMatch(
      /synthetic-mb273-e2e-access|questionId|answers|totalScore/,
    )
  })
})
