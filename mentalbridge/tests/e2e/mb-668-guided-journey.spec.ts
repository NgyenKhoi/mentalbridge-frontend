import { expect, type Page } from '@playwright/test'

import { combinedMeaningFixture } from '../fixtures/combined-meaning'
import { test } from './test-fixtures'

const accessCookie = 'mentalbridge_access'
const episodeId = '70000000-0000-4000-8000-000000000668'
const presentationEvaluationId = '20000000-0000-4000-8000-000000000668'
const guideId = '90000000-0000-4000-8000-000000000668'
const resourceId = '30000000-0000-4000-8000-000000000668'

type NextAction =
  | 'REVIEW_SAFETY_SUPPORT'
  | 'FIND_SPECIALIST'
  | 'OPEN_CURRENT_PLAN'
  | 'REVIEW_PLAN_DRAFT'
  | 'START_PLAN_PROPOSAL'
  | 'EXPLORE_GUIDE_RESOURCES'

function journey(
  stage: 'GUIDE_REQUIRED' | 'GUIDE_READY',
  nextAction: NextAction,
) {
  return {
    journeyPolicyVersion: 'mb-guided-journey-v1',
    stage,
    assessmentInProgress: false,
    episodeId,
    episodeCompletedAt: '2026-10-16T03:00:00Z',
    presentationEvaluationId,
    supportGuideId: stage === 'GUIDE_READY' ? guideId : null,
    nextAction,
    currentSupportPlanId:
      nextAction === 'OPEN_CURRENT_PLAN'
        ? '60000000-0000-4000-8000-000000000668'
        : null,
    entitlementStatus:
      nextAction === 'START_PLAN_PROPOSAL' ||
      nextAction === 'EXPLORE_GUIDE_RESOURCES'
        ? 'VERIFIED'
        : 'NOT_REQUIRED',
  }
}

function guide(positiveSafety = false) {
  return {
    supportGuideId: guideId,
    guideVersion: 1,
    guidePolicyVersion: 'mb-support-guide-capstone-v1',
    supportEvaluationId: '80000000-0000-4000-8000-000000000668',
    generatedAt: '2026-10-16T03:00:02Z',
    guideType: 'ONE_TIME_SUPPORT_GUIDE',
    explanation: {
      code: 'STANDARD_POST_SCREENING_GUIDANCE',
      text: 'Bạn có thể bắt đầu bằng một hoạt động nhỏ và vừa sức.',
    },
    safety: {
      status: positiveSafety
        ? 'POSITIVE_SAFETY_SCREEN'
        : 'NEGATIVE_SAFETY_SCREEN',
      reasonCode: positiveSafety
        ? 'PHQ9_ITEM9_POSITIVE'
        : 'PHQ9_ITEM9_NEGATIVE',
      policyVersion: 'MB-SAFETY-PHQ9-001-v1',
      guidanceCode: positiveSafety
        ? 'REVIEW_SAFETY_GUIDANCE'
        : 'STANDARD_SAFETY_REMINDER',
      guidance: 'Hướng dẫn an toàn đã được duyệt.',
    },
    resourceResolution: {
      status: 'AVAILABLE',
      policyVersion: 'content-eligibility-v1',
      resolvedAt: '2026-10-16T03:00:02Z',
    },
    resources: [
      {
        resourceId,
        contentVersion: '1',
        publicationId: '40000000-0000-4000-8000-000000000668',
        domain: 'DEPRESSIVE_SYMPTOMS',
        role: 'PRIMARY',
        category: 'ARTICLE',
        title: 'Bắt đầu từ một hoạt động nhỏ',
        summary: 'Chọn một việc dễ thực hiện và dành vài phút cho bản thân.',
        externalUrl: null,
      },
    ],
    provenance: {
      supportEvaluationPolicyVersion: 'mb-support-routing-capstone-v2',
      assessmentResults: [],
    },
    phrasing: { source: 'CARE_APPROVED_STANDARD', status: 'STANDARD' },
  }
}

function completedInitialCheck() {
  const meaning = combinedMeaningFixture({
    supportEvaluationId: presentationEvaluationId,
  })
  const [phq9, gad7] = meaning.evidence.map((item) => ({
    assessmentId: item.assessmentId,
    questionnaireDefinitionId: '30000000-0000-4000-8000-000000000101',
    instrument: item.instrument,
    questionnaireVersion: item.questionnaireVersion,
    privacyPolicyVersion: 'privacy-capstone-v3',
    submittedAt: meaning.evaluatedAt,
    voidedAt: null,
    result: {
      totalScore: item.totalScore,
      screeningLevel: item.screeningLevel,
      scoringVersion: item.scoringVersion,
      safetyStatus: item.safetyStatus,
      safetyPolicyVersion:
        item.instrument === 'PHQ9' ? 'MB-SAFETY-PHQ9-001-v1' : null,
      disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
    },
  }))
  return {
    phase: 'COMPLETED',
    phq9,
    gad7,
    evaluation: {
      supportEvaluationId: meaning.supportEvaluationId,
      policyVersion: meaning.sourcePolicyVersion,
      evaluatedAt: meaning.evaluatedAt,
      supportTier: meaning.supportTier,
      reasonCodes: ['ALL_SCREENING_LEVELS_MINIMAL_OR_MILD'],
      evidence: meaning.evidence,
      nextStep: meaning.nextStep,
      safetyGuidance: meaning.safetyGuidance,
      disclaimerCode: meaning.disclaimerCode,
      disclaimer: meaning.disclaimer,
    },
    combinedMeaning: meaning,
  }
}

async function json(page: Page, pattern: string, body: () => unknown) {
  await page.route(pattern, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body()),
    }),
  )
}

async function mockGuide(page: Page, nextAction: NextAction, positive = false) {
  const state = { ensureCalls: 0, planProposals: 0 }
  await json(page, '**/api/care/guided-journey', () =>
    journey(
      state.ensureCalls === 0 ? 'GUIDE_REQUIRED' : 'GUIDE_READY',
      nextAction,
    ),
  )
  await page.route('**/api/care/support-guides**', async (route) => {
    const request = route.request()
    if (request.method() === 'POST') state.ensureCalls += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        request.method() === 'POST' || request.url().includes(guideId)
          ? guide(positive)
          : {
              items: state.ensureCalls === 0 ? [] : [guide(positive)],
              nextCursor: null,
              hasMore: false,
            },
      ),
    })
  })
  await page.route('**/api/care/v2/support-plans**', async (route) => {
    if (route.request().method() === 'POST') state.planProposals += 1
    await route.fallback()
  })
  return state
}

test.beforeEach(async ({ context, page }) => {
  await context.addCookies([
    {
      name: accessCookie,
      value: 'synthetic-mb273-e2e-access',
      url: 'http://127.0.0.1:3100',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  await json(page, '**/api/care/initial-check?**', completedInitialCheck)
})

test('MB-668 continues Meaning to an automatic Guide, opens a resource and returns to the same Guide', async ({
  page,
}) => {
  const state = await mockGuide(page, 'EXPLORE_GUIDE_RESOURCES')
  await page.route(`**/api/resources/${resourceId}**`, (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/problem+json',
      body: JSON.stringify({ status: 404, code: 'RESOURCE_NOT_FOUND' }),
    }),
  )

  await page.goto('/initial-check')
  await page
    .getByRole('navigation', { name: 'Điều hướng chính' })
    .getByRole('link', { name: 'Gợi ý hỗ trợ', exact: true })
    .click()

  await expect(page).toHaveURL(/\/support-guides$/)
  const steps = page.getByRole('navigation', { name: 'Các bước sau sàng lọc' })
  await expect(steps).toBeVisible()
  await expect(steps.locator('[aria-current="step"]')).toContainText(
    'Gợi ý hỗ trợ',
  )
  await expect(page.getByRole('button', { name: /Tạo gợi ý/ })).toHaveCount(0)
  expect(state.ensureCalls).toBe(1)

  await page.getByRole('link', { name: 'Xem bài tập' }).click()
  await expect(page).toHaveURL(
    new RegExp(`from=support-guide&supportGuideId=${guideId}`),
  )
  await page.getByRole('link', { name: 'Quay lại gợi ý hỗ trợ' }).click()

  await expect(page).toHaveURL(new RegExp(`/support-guides/${guideId}$`))
  await expect(
    page.getByRole('link', { name: /Khám phá bài tập phù hợp/ }),
  ).toBeVisible()
  await expect(steps).toBeVisible()
  expect(state.ensureCalls).toBe(1)
})

test('MB-668 reopens an existing current plan instead of proposing a new one', async ({
  page,
}) => {
  const state = await mockGuide(page, 'OPEN_CURRENT_PLAN')
  state.ensureCalls = 1

  await page.goto(`/support-guides/${guideId}`)

  await expect(
    page.getByRole('link', { name: /Tiếp tục kế hoạch hiện tại/ }),
  ).toHaveAttribute('href', '/support-plan')
  await expect(
    page.getByRole('link', { name: /Tiếp tục với kế hoạch hỗ trợ/ }),
  ).toHaveCount(0)
  expect(state.planProposals).toBe(0)
})

test('MB-668 keeps safety guidance ahead of every ordinary continuation', async ({
  page,
}) => {
  await mockGuide(page, 'REVIEW_SAFETY_SUPPORT', true)

  await page.goto('/support-guides')

  await expect(
    page.getByRole('heading', {
      name: 'Xem hướng dẫn an toàn và tìm hỗ trợ trực tiếp',
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Xem hỗ trợ trong khu vực' }).first(),
  ).toHaveAttribute('href', '/safety-directory?trigger=positive-item-9')
  await expect(
    page.locator('.support-guide-answer-actions .support-guide-primary'),
  ).toHaveCount(0)
})

test('MB-668 shows retry instead of a fabricated Guide when the journey is unavailable', async ({
  page,
}) => {
  let available = false
  await page.route('**/api/care/guided-journey', (route) =>
    available
      ? route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(journey('GUIDE_READY', 'FIND_SPECIALIST')),
        })
      : route.fulfill({
          status: 503,
          contentType: 'application/problem+json',
          body: JSON.stringify({ status: 503, code: 'SERVICE_UNAVAILABLE' }),
        }),
  )
  await json(page, '**/api/care/support-guides**', () => ({
    items: [guide()],
    nextCursor: null,
    hasMore: false,
  }))

  await page.goto('/support-guides')

  await expect(
    page.getByRole('alert').filter({ hasText: 'Chưa thể tải gợi ý hỗ trợ' }),
  ).toBeVisible()
  await expect(page.locator('.support-guide-card')).toHaveCount(0)
  available = true
  await page.getByRole('button', { name: 'Thử lại' }).click()
  await expect(
    page.getByRole('link', { name: /Tìm chuyên gia phù hợp/ }),
  ).toHaveAttribute(
    'href',
    `/specialists?from=support-guide&supportGuideId=${guideId}`,
  )
})

test('MB-668 sends expired privacy consent back to readiness without preparing a Guide', async ({
  page,
}) => {
  await page.unroute('**/api/care/initial-check?**')
  await json(page, '**/api/care/initial-check?**', () => ({
    phase: 'CONSENT_REQUIRED',
  }))
  let ensureCalls = 0
  await page.route('**/api/care/support-guides', (route) => {
    ensureCalls += 1
    return route.abort()
  })

  await page.goto('/initial-check')

  await expect(
    page.getByRole('heading', { name: 'Xác nhận quyền riêng tư' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: /Tiếp tục xem gợi ý hỗ trợ/ }),
  ).toHaveCount(0)
  expect(ensureCalls).toBe(0)
})
