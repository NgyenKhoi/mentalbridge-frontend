import { expect, type Page } from '@playwright/test'

import { combinedMeaningFixture } from '../fixtures/combined-meaning'
import { test } from './test-fixtures'

const accessCookie = 'mentalbridge_access'
const presentationEvaluationId = '20000000-0000-4000-8000-000000000646'
const guideId = '90000000-0000-4000-8000-000000000646'
const domainEvaluationId = '80000000-0000-4000-8000-000000000101'
const activityId = '00000000-0000-4000-8000-000000000208'
const breathingId = '00000000-0000-4000-8000-000000000201'

type Priority = 'SELF_GUIDED' | 'PROFESSIONAL_SUPPORT' | 'SAFETY'
type NextAction =
  | 'REVIEW_SAFETY_SUPPORT'
  | 'FIND_SPECIALIST'
  | 'START_PLAN_PROPOSAL'
  | 'EXPLORE_GUIDE_RESOURCES'

function resource(id: string, title: string, domain: string) {
  return {
    resourceId: id,
    contentVersion: '0',
    publicationId: id.replace('-8000-', '-9000-'),
    domain,
    role: 'PRIMARY',
    category: domain === 'ANXIETY_SYMPTOMS' ? 'BREATHING' : 'ARTICLE',
    title,
    summary: `${title} — tóm tắt đã rà soát.`,
    externalUrl: null,
  }
}

function guide(priority: Priority, resources = 2) {
  const positive = priority === 'SAFETY'
  const professional = priority === 'PROFESSIONAL_SUPPORT'
  return {
    supportGuideId: guideId,
    guideVersion: 1,
    guidePolicyVersion: 'mb-support-guide-capstone-v1',
    supportEvaluationId: domainEvaluationId,
    generatedAt: '2026-10-16T08:05:00Z',
    guideType: 'ONE_TIME_SUPPORT_GUIDE',
    explanation: {
      code: 'STANDARD_POST_SCREENING_GUIDANCE',
      text: 'Hướng dẫn này tóm tắt kết quả sàng lọc đã lưu. Đây không phải chẩn đoán hoặc kế hoạch điều trị.',
    },
    safety: {
      status: positive ? 'POSITIVE_SAFETY_SCREEN' : 'NEGATIVE_SAFETY_SCREEN',
      reasonCode: positive ? 'PHQ9_ITEM9_POSITIVE' : 'PHQ9_ITEM9_NEGATIVE',
      policyVersion: 'MB-SAFETY-PHQ9-001-v1',
      guidanceCode: positive
        ? 'REVIEW_SAFETY_GUIDANCE'
        : 'STANDARD_SAFETY_REMINDER',
      guidance: 'Hướng dẫn an toàn đã được duyệt.',
    },
    resourceResolution: {
      status: 'AVAILABLE',
      policyVersion: 'content-eligibility-v1',
      resolvedAt: '2026-10-16T08:05:00Z',
    },
    resources: [
      resource(
        activityId,
        'Bắt đầu bằng một hoạt động nhỏ',
        'DEPRESSIVE_SYMPTOMS',
      ),
      resource(breathingId, 'Thở chậm trong 5 phút', 'ANXIETY_SYMPTOMS'),
      resource(
        '00000000-0000-4000-8000-000000000205',
        'Hiểu các dấu hiệu thường gặp của trầm cảm',
        'DEPRESSIVE_SYMPTOMS',
      ),
      resource(
        '00000000-0000-4000-8000-000000000206',
        'Hiểu lo âu và những dấu hiệu thường gặp',
        'ANXIETY_SYMPTOMS',
      ),
    ].slice(0, resources),
    provenance: {
      supportEvaluationPolicyVersion: 'mb-support-routing-capstone-v2',
      assessmentResults: [
        {
          assessmentId: '10000000-0000-4000-8000-000000000101',
          instrument: 'PHQ9',
          questionnaireVersion: 'phq9-vi-vn-capstone-v2',
          scoringVersion: 'phq9-standard-bands-v1',
          screeningLevel: professional ? 'MODERATE' : 'MILD',
        },
        {
          assessmentId: '10000000-0000-4000-8000-000000000102',
          instrument: 'GAD7',
          questionnaireVersion: 'gad7-vi-vn-adult-v1',
          scoringVersion: 'gad7-standard-bands-v1',
          screeningLevel: 'MINIMAL',
        },
      ],
    },
    phrasing: { source: 'CARE_APPROVED_STANDARD', status: 'STANDARD' },
  }
}

function journey(nextAction: NextAction) {
  return {
    journeyPolicyVersion: 'mb-guided-journey-v1',
    stage: 'GUIDE_READY',
    assessmentInProgress: false,
    episodeId: '70000000-0000-4000-8000-000000000101',
    episodeCompletedAt: '2026-10-16T08:00:00Z',
    presentationEvaluationId,
    supportGuideId: guideId,
    nextAction,
    currentSupportPlanId: null,
    entitlementStatus:
      nextAction === 'START_PLAN_PROPOSAL' ||
      nextAction === 'EXPLORE_GUIDE_RESOURCES'
        ? 'VERIFIED'
        : 'NOT_REQUIRED',
  }
}

async function mockCare(
  page: Page,
  options: Readonly<{
    priority: Priority
    nextAction: NextAction
    resources?: number
    journeyFailures?: number
    recoveryDelayMs?: number
  }>,
) {
  const saved = guide(options.priority, options.resources)
  const state = { ensureCalls: 0, journeyCalls: 0, planPosts: 0 }
  await page.route('**/api/care/guided-journey', async (route) => {
    state.journeyCalls += 1
    if (state.journeyCalls <= (options.journeyFailures ?? 0)) {
      await route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        body: JSON.stringify({ status: 503, code: 'SERVICE_UNAVAILABLE' }),
      })
      return
    }
    if (options.recoveryDelayMs && state.journeyCalls > 1)
      await new Promise((resolve) =>
        setTimeout(resolve, options.recoveryDelayMs),
      )
    await route.fulfill({ json: journey(options.nextAction) })
  })
  await page.route('**/api/care/support-guides**', async (route) => {
    if (route.request().method() === 'POST') state.ensureCalls += 1
    await route.fulfill({
      json: route.request().url().includes(guideId)
        ? saved
        : { items: [saved], nextCursor: null, hasMore: false },
    })
  })
  await page.route(
    `**/api/care/support-evaluations/${presentationEvaluationId}/combined-meaning`,
    (route) =>
      route.fulfill({
        json: combinedMeaningFixture({
          supportEvaluationId: presentationEvaluationId,
          supportGuideId: guideId,
          priority: options.priority,
        }),
      }),
  )
  await page.route('**/api/care/v2/support-plans**', async (route) => {
    if (route.request().method() === 'POST') state.planPosts += 1
    await route.fallback()
  })
  return state
}

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    {
      name: accessCookie,
      value: 'synthetic-mb273-e2e-access',
      url: 'http://127.0.0.1:3100',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
})

test('MB-646 self-guided Guide leads with the saved meaning and two mapped resources', async ({
  page,
}) => {
  const state = await mockCare(page, {
    priority: 'SELF_GUIDED',
    nextAction: 'EXPLORE_GUIDE_RESOURCES',
  })
  await page.goto('/support-guides')

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Dấu hiệu trầm cảm ở mức nhẹ, lo âu rất ít.',
    }),
  ).toBeVisible()
  const bands = page.getByRole('list', { name: 'Mức độ đã lưu' })
  await expect(bands).toContainText('Tâm trạng · Mức nhẹ')
  await expect(bands).toContainText('Lo âu · Mức tối thiểu')
  const resources = page.getByRole('region', { name: 'Việc bạn có thể thử' })
  await expect(resources.getByRole('listitem')).toHaveCount(2)
  await expect(
    resources.getByRole('link', { name: 'Xem bài tập' }).first(),
  ).toHaveAttribute(
    'href',
    `/resources/${activityId}?contentVersion=0&from=support-guide&supportGuideId=${guideId}`,
  )
  await expect(page.getByText(/3 bước tự hỗ trợ|Miễn phí cho mọi/)).toHaveCount(
    0,
  )

  await page.getByRole('link', { name: /Khám phá bài tập phù hợp/ }).click()
  await expect(page).toHaveURL(/#support-guide-resources$/)
  await expect(page.locator('#support-guide-resources')).toBeFocused()
  expect(state.ensureCalls).toBe(0)
})

test('MB-646 paid continuation only navigates to the plan review', async ({
  page,
}) => {
  const state = await mockCare(page, {
    priority: 'SELF_GUIDED',
    nextAction: 'START_PLAN_PROPOSAL',
  })
  await page.goto('/support-guides')

  const primary = page.locator('.support-guide-primary')
  await expect(primary).toHaveCount(1)
  await expect(primary).toHaveText(/Tiếp tục với kế hoạch hỗ trợ/)
  await expect(primary).toHaveAttribute('href', '/support-plan')
  expect(state.planPosts).toBe(0)
})

test('MB-646 professional Guide makes specialist discovery the one primary action', async ({
  page,
}) => {
  await mockCare(page, {
    priority: 'PROFESSIONAL_SUPPORT',
    nextAction: 'FIND_SPECIALIST',
  })
  await page.goto('/support-guides')

  await expect(
    page.getByRole('heading', { level: 1, name: /Bạn nên trao đổi thêm/ }),
  ).toBeVisible()
  const primary = page.locator('.support-guide-primary')
  await expect(primary).toHaveCount(1)
  await expect(primary).toHaveAttribute(
    'href',
    `/specialists?from=support-guide&supportGuideId=${guideId}`,
  )
  await expect(page.getByText(/Chưa có lịch hẹn nào được đặt/)).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Trong lúc chờ trao đổi với chuyên gia' }),
  ).toBeVisible()
})

test('MB-646 safety Guide keeps stored guidance first and folds resources away', async ({
  page,
}) => {
  await mockCare(page, {
    priority: 'SAFETY',
    nextAction: 'REVIEW_SAFETY_SUPPORT',
  })
  await page.goto('/support-guides')

  await expect(page.getByText('Hướng dẫn an toàn đã được duyệt.')).toBeVisible()
  await expect(
    page.getByRole('link', { name: /Xem hỗ trợ trong khu vực/ }),
  ).toHaveAttribute('href', '/safety-directory?trigger=positive-item-9')
  await expect(page.locator('.support-guide-primary')).toHaveCount(0)
  await expect(
    page.getByText('Thở chậm trong 5 phút', { exact: true }),
  ).toBeHidden()
  await page.getByText('Bài tập đã lưu cùng gợi ý này').click()
  await expect(
    page.getByText('Thở chậm trong 5 phút', { exact: true }),
  ).toBeVisible()
})

test('MB-646 historical Guide is read without ensure, keeps all saved resources and returns from a withdrawn resource', async ({
  page,
}) => {
  const state = await mockCare(page, {
    priority: 'SELF_GUIDED',
    nextAction: 'EXPLORE_GUIDE_RESOURCES',
    resources: 4,
  })
  await page.route(`**/api/resources/${activityId}**`, (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/problem+json',
      body: JSON.stringify({ status: 404, code: 'RESOURCE_NOT_FOUND' }),
    }),
  )
  const historicalUrl = `/support-guides/${guideId}?from=screening-history&resultEvaluationId=${presentationEvaluationId}`
  await page.goto(historicalUrl)

  await expect(
    page.getByText(/Gợi ý này được lưu ngày 16\/10\/2026/),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Dấu hiệu trầm cảm ở mức nhẹ, lo âu rất ít.',
    }),
  ).toBeVisible()
  await expect(page.locator('.support-guide-resources ol > li')).toHaveCount(4)
  expect(state.ensureCalls).toBe(0)
  expect(state.journeyCalls).toBe(0)

  await page.getByRole('link', { name: 'Xem bài tập' }).first().click()
  await expect(page).toHaveURL(/guideHistory=1/)
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Bài tập này không còn mở được' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Quay lại gợi ý hỗ trợ' }).click()
  await expect(page).toHaveURL(historicalUrl)
  expect(state.ensureCalls).toBe(0)
})

test('MB-646 never fabricates content when an exact Guide resource is unavailable', async ({
  page,
}) => {
  const problemSolvingId = '00000000-0000-4000-8000-000000000209'
  await page.route(`**/api/resources/${problemSolvingId}**`, (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/problem+json',
      body: JSON.stringify({ status: 503, code: 'CONTENT_UNAVAILABLE' }),
    }),
  )
  await page.goto(
    `/resources/${problemSolvingId}?contentVersion=0&from=support-guide&supportGuideId=${guideId}`,
  )

  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Tài nguyên này tạm thời chưa tải được' }),
  ).toBeVisible()
  await expect(
    page.getByText('Giải quyết một vấn đề theo từng bước'),
  ).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Quay lại gợi ý hỗ trợ' }),
  ).toHaveAttribute('href', `/support-guides/${guideId}`)
})

test('MB-646 recovers from a Guide load failure through the retry panel', async ({
  page,
}) => {
  await mockCare(page, {
    priority: 'SELF_GUIDED',
    nextAction: 'EXPLORE_GUIDE_RESOURCES',
    journeyFailures: 1,
    recoveryDelayMs: 1500,
  })
  await page.goto('/support-guides')

  const panel = page.getByRole('alert').filter({
    hasText: 'Chưa thể tải gợi ý hỗ trợ',
  })
  await expect(panel).toBeVisible()
  const retry = panel.getByRole('button', { name: 'Thử lại' })
  await retry.focus()
  await page.keyboard.press('Enter')
  const busy = panel.getByRole('button', { name: 'Đang thử lại…' })
  await expect(busy).toBeVisible()
  await expect(busy).toBeFocused()
  await expect(busy).toHaveAttribute('aria-busy', 'true')
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Dấu hiệu trầm cảm ở mức nhẹ, lo âu rất ít.',
    }),
  ).toBeVisible()
})

async function mockResourceSuccess(page: Page, id: string, title: string) {
  const detailRequests: string[] = []
  await page.route(/\/api\/resources\/progress/, (route) =>
    route.fulfill({ json: { items: [] } }),
  )
  await page.route(/\/api\/resources\?/, (route) =>
    route.fulfill({ json: { items: [], hasMore: false } }),
  )
  const detailPath = `/api/resources/${id}`
  await page.route(
    (url) => url.pathname === detailPath,
    (route) => {
      detailRequests.push(route.request().url())
      return route.fulfill({
        json: {
          id,
          category: 'ARTICLE',
          locale: 'vi-VN',
          title,
          summary: `${title} — tóm tắt đã rà soát.`,
          externalUrl: null,
          status: 'PUBLISHED',
          reviewedAt: '2026-09-23T00:00:00Z',
          createdAt: '2026-09-23T00:00:00Z',
          updatedAt: '2026-09-23T00:00:00Z',
          contentBody: 'Chọn một việc đủ nhỏ để bắt đầu hôm nay.',
          contentVersion: '0',
          sourceOrganization: 'NHS Every Mind Matters',
          sourceTitle: 'Tackling your to-do list',
          sourceUrl: 'https://www.nhs.uk/every-mind-matters/',
          sourceReviewNote: 'Nội dung tổng hợp cho kiểm thử.',
          effectiveAt: null,
          expiresAt: null,
        },
      })
    },
  )
  return detailRequests
}

test('MB-646 current Guide opens the exact saved resource version and returns to the same Guide', async ({
  page,
}) => {
  const state = await mockCare(page, {
    priority: 'SELF_GUIDED',
    nextAction: 'EXPLORE_GUIDE_RESOURCES',
  })
  const detailRequests = await mockResourceSuccess(
    page,
    activityId,
    'Bắt đầu bằng một hoạt động nhỏ',
  )
  await page.goto('/support-guides')

  await page.getByRole('link', { name: 'Xem bài tập' }).first().click()
  await expect(page).toHaveURL(
    `/resources/${activityId}?contentVersion=0&from=support-guide&supportGuideId=${guideId}`,
  )
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Bắt đầu bằng một hoạt động nhỏ',
    }),
  ).toBeVisible()
  expect(detailRequests.length).toBeGreaterThan(0)
  expect(
    detailRequests.every(
      (url) => new URL(url).searchParams.get('contentVersion') === '0',
    ),
  ).toBe(true)

  await page.getByRole('link', { name: 'Quay lại gợi ý hỗ trợ' }).click()
  await expect(page).toHaveURL(`/support-guides/${guideId}`)
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Dấu hiệu trầm cảm ở mức nhẹ, lo âu rất ít.',
    }),
  ).toBeVisible()
  expect(state.ensureCalls).toBe(0)
  expect(state.planPosts).toBe(0)
})

test('MB-646 historical Guide opens the exact saved resource version and returns with its result context', async ({
  page,
}) => {
  const state = await mockCare(page, {
    priority: 'SELF_GUIDED',
    nextAction: 'EXPLORE_GUIDE_RESOURCES',
  })
  const detailRequests = await mockResourceSuccess(
    page,
    activityId,
    'Bắt đầu bằng một hoạt động nhỏ',
  )
  const historicalUrl = `/support-guides/${guideId}?from=screening-history&resultEvaluationId=${presentationEvaluationId}`
  await page.goto(historicalUrl)

  await page.getByRole('link', { name: 'Xem bài tập' }).first().click()
  await expect(page).toHaveURL(
    `/resources/${activityId}?contentVersion=0&from=support-guide&supportGuideId=${guideId}&guideHistory=1&resultEvaluationId=${presentationEvaluationId}`,
  )
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Bắt đầu bằng một hoạt động nhỏ',
    }),
  ).toBeVisible()
  expect(detailRequests.length).toBeGreaterThan(0)
  expect(
    detailRequests.every(
      (url) => new URL(url).searchParams.get('contentVersion') === '0',
    ),
  ).toBe(true)

  await page.getByRole('link', { name: 'Quay lại gợi ý hỗ trợ' }).click()
  await expect(page).toHaveURL(historicalUrl)
  await expect(page.getByText(/Gợi ý này được lưu ngày/)).toBeVisible()
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Dấu hiệu trầm cảm ở mức nhẹ, lo âu rất ít.',
    }),
  ).toBeVisible()
  expect(state.ensureCalls).toBe(0)
  expect(state.journeyCalls).toBe(0)
  expect(state.planPosts).toBe(0)
})
