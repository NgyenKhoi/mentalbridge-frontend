import { expect, type Page } from '@playwright/test'

import {
  combinedMeaningFixture,
  completedScreeningEpisodeFixture,
  supportEvaluationFixture,
} from '../fixtures/combined-meaning'
import { test } from './test-fixtures'

const accessCookie = 'mentalbridge_access'
const evaluationId = '20000000-0000-4000-8000-000000000101'
const safetyEvaluationId = '20000000-0000-4000-8000-000000000303'
const severeEvaluationId = '20000000-0000-4000-8000-000000000404'
const guideId = '90000000-0000-4000-8000-000000000101'

function historicalGuide() {
  return {
    supportGuideId: guideId,
    guideVersion: 1,
    guidePolicyVersion: 'mb-support-guide-capstone-v1',
    supportEvaluationId: '80000000-0000-4000-8000-000000000101',
    generatedAt: '2026-09-10T08:05:00Z',
    guideType: 'ONE_TIME_SUPPORT_GUIDE',
    explanation: {
      code: 'STANDARD_POST_SCREENING_GUIDANCE',
      text: 'Với kết quả này, bạn có thể bắt đầu bằng một hoạt động nhỏ và vừa sức.',
    },
    safety: {
      status: 'NEGATIVE_SAFETY_SCREEN',
      reasonCode: 'PHQ9_ITEM9_NEGATIVE',
      policyVersion: 'MB-SAFETY-PHQ9-001-v1',
      guidanceCode: 'STANDARD_SAFETY_REMINDER',
      guidance:
        'Nếu bạn không yên tâm về tình trạng của mình, hãy chủ động trao đổi với chuyên gia tâm lý.',
    },
    resourceResolution: {
      status: 'AVAILABLE',
      policyVersion: 'content-eligibility-v1',
      resolvedAt: '2026-09-10T08:05:00Z',
    },
    resources: [
      {
        resourceId: '30000000-0000-4000-8000-000000000101',
        contentVersion: '1',
        publicationId: '40000000-0000-4000-8000-000000000101',
        domain: 'DEPRESSIVE_SYMPTOMS',
        role: 'PRIMARY',
        category: 'ARTICLE',
        title: 'Bắt đầu từ một hoạt động nhỏ',
        summary: 'Chọn một việc dễ thực hiện và dành vài phút cho bản thân.',
        externalUrl: null,
      },
    ],
    provenance: {
      supportEvaluationPolicyVersion: 'mb-support-routing-capstone-v1',
      assessmentResults: [
        {
          assessmentId: '10000000-0000-4000-8000-000000000101',
          instrument: 'PHQ9',
          questionnaireVersion: 'phq9-vi-vn-capstone-v2',
          scoringVersion: 'phq9-standard-bands-v1',
          screeningLevel: 'MILD',
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
    phrasing: {
      source: 'CARE_APPROVED_STANDARD',
      status: 'STANDARD',
    },
  }
}

function reviewedMeaning() {
  const fixture = combinedMeaningFixture({
    supportEvaluationId: evaluationId,
    supportGuideId: guideId,
  })
  return {
    ...fixture,
    baseMeaning: {
      ...fixture.baseMeaning,
      text: 'Dấu hiệu trầm cảm ở mức nhẹ, lo âu rất ít.',
      rationale:
        'Bạn có thể bắt đầu bằng nghỉ ngơi, ăn uống đều đặn và một hoạt động nhỏ giúp nâng đỡ tâm trạng.',
    },
    nextStep: {
      ...fixture.nextStep,
      text: 'Bạn có thể chọn một tài nguyên tự hỗ trợ đã được rà soát.',
      boundary: 'Không có cuộc hẹn hoặc chia sẻ dữ liệu tự động.',
    },
  }
}

function completedInitialCheck(
  meaning: ReturnType<typeof combinedMeaningFixture>,
) {
  const assessments = meaning.evidence.map((item) => ({
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
    phq9: assessments[0],
    gad7: assessments[1],
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

async function mockAssessmentPageDependencies(page: Page) {
  await page.route('**/api/care/assessments/history**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], nextCursor: null, hasMore: false }),
    }),
  )
  await page.route('**/api/care/support-evaluations/history**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], nextCursor: null, hasMore: false }),
    }),
  )
}

async function expectNoHorizontalOverflow(page: Page) {
  if ((page.viewportSize()?.width ?? 1440) <= 760) {
    // Resizing a desktop fixture triggers the preserved sidebar's exit motion.
    // Capture the settled responsive state, not an intermediate animation frame.
    await expect
      .poll(() =>
        page.locator('.ref-sidebar').evaluate((element) => {
          return element.getBoundingClientRect().right <= 0
        }),
      )
      .toBe(true)
  }
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true)
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
  await mockAssessmentPageDependencies(page)
  const completed = completedInitialCheck(reviewedMeaning())
  for (const assessment of [completed.phq9, completed.gad7]) {
    await page.route(
      `**/api/care/assessments/by-id/${assessment.assessmentId}`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(assessment),
        }),
    )
  }
})

test('MB-667 post-screening tab and Results share the exact saved Meaning UI', async ({
  page,
}, testInfo) => {
  const meaning = reviewedMeaning()
  const older = {
    ...combinedMeaningFixture({
      supportEvaluationId: severeEvaluationId,
      priority: 'PROFESSIONAL_SUPPORT',
    }),
    evaluatedAt: '2026-09-01T08:00:00Z',
    episodeCompletedAt: '2026-09-01T08:00:00Z',
  }
  let historyRequests = 0
  await page.route('**/api/care/support-evaluations/history**', (route) => {
    historyRequests++
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          supportEvaluationFixture(meaning),
          supportEvaluationFixture(older),
        ],
        nextCursor: null,
        hasMore: false,
      }),
    })
  })
  await page.route(
    '**/api/care/support-evaluations/*/combined-meaning',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          route.request().url().includes(severeEvaluationId) ? older : meaning,
        ),
      }),
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/assessments')
  expect(historyRequests).toBe(0)
  await page.getByRole('tab', { name: 'Gợi ý sau sàng lọc' }).click()
  const panel = page.getByRole('tabpanel', { name: 'Gợi ý sau sàng lọc' })
  await expect(
    panel.getByRole('heading', { name: meaning.baseMeaning.text }),
  ).toBeVisible()
  const cards = panel.locator('.combined-meaning-score')
  const summary = panel.locator('.combined-meaning-summary')
  const scoresMarkup = await panel
    .locator('.combined-meaning-scores')
    .innerHTML()
  const summaryContent = await summary.textContent()
  for (const width of [1440, 1280, 768, 640, 375]) {
    await page.setViewportSize({ width, height: 900 })
    await expectNoHorizontalOverflow(page)
    await expect(cards.nth(0)).toHaveCSS(
      'background-color',
      'rgb(255, 255, 255)',
    )
    await expect(cards.nth(1)).toHaveCSS(
      'background-color',
      'rgb(255, 255, 255)',
    )
    const first = (await cards.nth(0).boundingBox())!
    const second = (await cards.nth(1).boundingBox())!
    if (width > 700) expect(Math.abs(first.y - second.y)).toBeLessThan(2)
    else expect(second.y).toBeGreaterThan(first.y + first.height)
    const compositionBox = (await panel
      .locator('.combined-meaning-card')
      .boundingBox())!
    const summaryBox = (await summary.boundingBox())!
    expect(summaryBox.width / compositionBox.width).toBeGreaterThan(0.98)
    if (width === 1440 || width === 375) {
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({
        path: testInfo.outputPath(`mb-667-unified-meaning-tab-${width}.png`),
        fullPage: true,
      })
    }
  }
  await panel.getByRole('link', { name: 'Mở trang kết quả' }).click()
  await expect(page).toHaveURL(`/assessments/results/${evaluationId}`)
  await expect(
    page.getByRole('heading', { name: meaning.baseMeaning.text }),
  ).toBeVisible()
  expect(await page.locator('.combined-meaning-scores').innerHTML()).toBe(
    scoresMarkup,
  )
  expect(await page.locator('.combined-meaning-summary').textContent()).toBe(
    summaryContent,
  )
  await page.getByRole('link', { name: /Quay lại lịch sử sàng lọc/ }).click()
  await page.getByRole('tab', { name: 'Gợi ý sau sàng lọc' }).click()
  await expect(
    panel.getByRole('heading', { name: meaning.baseMeaning.text }),
  ).toBeVisible()
  await panel
    .getByRole('button', { name: 'Chọn lần sàng lọc để xem kết quả' })
    .click()
  await panel.getByRole('button', { name: /Hỗ trợ chuyên môn/ }).click()
  await expect(
    panel.getByRole('heading', { name: older.baseMeaning.text }),
  ).toBeVisible()
  await expect(
    panel.getByRole('progressbar', { name: /PHQ-9: 12 trên 27 điểm/ }),
  ).toHaveCount(1)
  await expect(
    panel.getByRole('link', { name: 'Mở trang kết quả' }),
  ).toHaveAttribute('href', `/assessments/results/${severeEvaluationId}`)
  await page.getByRole('tab', { name: 'Lịch sử sàng lọc' }).click()
  await page.getByRole('tab', { name: 'Gợi ý sau sàng lọc' }).click()
  await expect(
    panel.getByRole('heading', { name: older.baseMeaning.text }),
  ).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('MB-667 current desktop uses the full content grid and the Mầm An loading composition', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const meaning = reviewedMeaning()
  let releaseCurrent!: () => void
  const currentGate = new Promise<void>((resolve) => {
    releaseCurrent = resolve
  })
  await page.route('**/api/care/initial-check?**', async (route) => {
    await currentGate
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(completedInitialCheck(meaning)),
    })
  })
  await page.goto('/initial-check')
  const loading = page.getByRole('status', {
    name: 'Đang chuẩn bị hành trình của bạn',
  })
  await expect(loading).toBeVisible()
  await expect(
    loading.locator('[data-skeleton-region="stepper"]'),
  ).toBeVisible()
  await expect(
    loading.locator('[data-skeleton-part="score-card"]'),
  ).toHaveCount(2)
  await expect(
    loading.locator('[data-skeleton-part="meaning-card"]'),
  ).toBeVisible()
  const mascot = loading.locator('svg[viewBox="0 0 120 120"]:visible')
  await expect
    .poll(async () => (await mascot.boundingBox())?.width ?? 0)
    .toBeGreaterThan(80)
  await page.screenshot({
    path: testInfo.outputPath('mb-667-current-loading-desktop.png'),
    fullPage: true,
  })
  await loading.getByRole('button', { name: 'Ẩn gợi ý nhịp thở' }).click()
  await expect(
    loading.getByRole('button', { name: 'Ẩn gợi ý nhịp thở' }),
  ).toHaveCount(0)
  releaseCurrent()
  await expect(
    page.getByRole('heading', { name: meaning.baseMeaning.text }),
  ).toBeVisible()
  const result = page.locator('.initial-check-result')
  const composition = page.locator('.combined-meaning-card')
  const cards = composition.locator('.combined-meaning-score')
  const summary = composition.locator('.combined-meaning-summary')
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    const parentBox = (await result.boundingBox())!
    const compositionBox = (await composition.boundingBox())!
    const first = (await cards.nth(0).boundingBox())!
    const second = (await cards.nth(1).boundingBox())!
    const summaryBox = (await summary.boundingBox())!
    expect(compositionBox.width / parentBox.width).toBeGreaterThan(0.98)
    expect(Math.abs(first.y - second.y)).toBeLessThan(2)
    expect(summaryBox.y).toBeGreaterThan(first.y + first.height)
    expect(summaryBox.width / compositionBox.width).toBeGreaterThan(0.98)
    const appearance = await composition.evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      headingSize: Number.parseFloat(
        getComputedStyle(element.querySelector('h1')!).fontSize,
      ),
    }))
    expect(appearance.background).toBe('rgba(0, 0, 0, 0)')
    expect(appearance.headingSize).toBeLessThanOrEqual(32)
    await expect(
      page.locator(
        '.initial-check-progress li.active .initial-check-step-marker',
      ),
    ).toHaveCSS('color', 'rgb(255, 255, 255)')
    await expectNoHorizontalOverflow(page)
    await page.screenshot({
      path: testInfo.outputPath(`mb-667-current-${width}.png`),
      fullPage: true,
    })
  }
  await page.setViewportSize({ width: 375, height: 812 })
  const firstMobile = (await cards.nth(0).boundingBox())!
  const secondMobile = (await cards.nth(1).boundingBox())!
  expect(secondMobile.y).toBeGreaterThan(firstMobile.y + firstMobile.height)
  await expectNoHorizontalOverflow(page)
  await page.screenshot({
    path: testInfo.outputPath('mb-667-current-mobile.png'),
    fullPage: true,
  })
  await page
    .getByRole('button', { name: 'Xem chi tiết điểm số và giới hạn công cụ' })
    .click()
  await expect(page.locator('.combined-meaning-detail-scores')).toBeVisible()
})

test('MB-667 opens the exact saved pair and its persisted Guide', async ({
  page,
}, testInfo) => {
  const meaning = reviewedMeaning()
  let releaseMeaning!: () => void
  const meaningGate = new Promise<void>((resolve) => {
    releaseMeaning = resolve
  })

  await page.route('**/api/care/screening-episodes/history**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [completedScreeningEpisodeFixture(meaning)],
        nextCursor: null,
        hasMore: false,
      }),
    }),
  )
  await page.route(
    `**/api/care/support-evaluations/${evaluationId}/combined-meaning`,
    async (route) => {
      await meaningGate
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(meaning),
      })
    },
  )
  await page.route(`**/api/care/support-guides/${guideId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(historicalGuide()),
    }),
  )

  await page.goto('/assessments')
  const history = page.getByRole('region', {
    name: 'Lịch sử theo từng lượt sàng lọc',
  })
  await expect(history).toBeVisible()
  const initialEpisode = history
    .locator('article')
    .filter({ hasText: 'Kiểm tra ban đầu' })
  await expect(initialEpisode.getByText('5', { exact: true })).toBeVisible()
  await expect(initialEpisode.getByText('/27 điểm')).toBeVisible()
  await expect(initialEpisode.getByText('4', { exact: true })).toBeVisible()
  await expect(initialEpisode.getByText('/21 điểm')).toBeVisible()
  await expect(
    initialEpisode.getByRole('link', { name: /Gợi ý đã lưu/ }),
  ).toBeVisible()

  await initialEpisode.getByRole('link', { name: /Xem kết quả/ }).click()
  await expect(page).toHaveURL(`/assessments/results/${evaluationId}`)
  await expect(
    page.getByRole('status', { name: 'Đang mở đúng kết quả đã lưu' }),
  ).toBeVisible()
  await expect(page.getByText('Mầm An đang đồng hành')).toBeVisible()
  releaseMeaning()

  await expect(
    page.getByRole('heading', { name: meaning.baseMeaning.text }),
  ).toBeVisible()
  await expect(
    page.getByRole('progressbar', { name: /PHQ-9: 5 trên 27 điểm/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('progressbar', { name: /GAD-7: 4 trên 21 điểm/ }),
  ).toBeVisible()
  await expect(page.getByText('Lưu bản tóm tắt')).toHaveCount(0)

  const desktop = testInfo.outputPath('mb-667-historical-meaning-desktop.png')
  await page.screenshot({ path: desktop, fullPage: true })
  await testInfo.attach('MB-667 historical meaning desktop', {
    path: desktop,
    contentType: 'image/png',
  })

  await page.getByRole('link', { name: /Xem gợi ý đã lưu/ }).click()
  await expect(page).toHaveURL(
    `/support-guides/${guideId}?from=screening-history&resultEvaluationId=${evaluationId}`,
  )
  await expect(
    page.getByRole('heading', {
      name: 'Với kết quả của lần đánh giá này, gợi ý được lưu là bắt đầu từ những bước nhỏ',
    }),
  ).toBeVisible()
  await expect(
    page.getByText(/Bản ghi lịch sử · Chỉ đọc/i).first(),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /Tạo gợi ý/ })).toHaveCount(0)
  await expect(page.getByText('Bắt đầu từ một hoạt động nhỏ')).toBeVisible()
  await expect(
    page.getByRole('link', { name: /Quay lại Kết quả trước đây/ }),
  ).toHaveAttribute('href', `/assessments/results/${evaluationId}`)

  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(`/assessments/results/${evaluationId}`)
  await expect(
    page.getByRole('heading', { name: meaning.baseMeaning.text }),
  ).toBeVisible()
  await expectNoHorizontalOverflow(page)
  const mobile = testInfo.outputPath('mb-667-historical-meaning-mobile.png')
  await page.screenshot({ path: mobile, fullPage: true })
  await testInfo.attach('MB-667 historical meaning mobile', {
    path: mobile,
    contentType: 'image/png',
  })
})

test('MB-667 Guide distributes three saved resources across the desktop row', async ({
  page,
}, testInfo) => {
  const guide = historicalGuide()
  guide.resources = [
    ...guide.resources,
    {
      ...guide.resources[0],
      resourceId: '30000000-0000-4000-8000-000000000102',
      title: 'Nhận biết cảm xúc của mình',
    },
    {
      ...guide.resources[0],
      resourceId: '30000000-0000-4000-8000-000000000103',
      title: 'Dành một khoảng nghỉ ngắn',
    },
  ]
  const meaning = reviewedMeaning()
  meaning.domainSupportEvaluationId = guide.supportEvaluationId
  await page.route('**/api/care/initial-check?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(completedInitialCheck(meaning)),
    }),
  )
  await page.route('**/api/care/support-guides?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [guide],
        nextCursor: null,
        hasMore: false,
      }),
    }),
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/support-guides')
  await expect(page.locator('.support-guide-answer')).toBeVisible()
  await expect(page.locator('.support-guide-card')).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  )
  const resourceList = page.locator('.support-guide-resources > ol')
  const cards = resourceList.locator(':scope > li')
  await expect(cards).toHaveCount(3)
  const first = (await cards.nth(0).boundingBox())!
  const second = (await cards.nth(1).boundingBox())!
  const third = (await cards.nth(2).boundingBox())!
  const row = (await resourceList.boundingBox())!
  expect(Math.abs(first.y - third.y)).toBeLessThan(2)
  expect(Math.abs(first.width - second.width)).toBeLessThan(2)
  expect(Math.abs(third.x + third.width - row.x - row.width)).toBeLessThan(2)
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Tạo gợi ý từ kiểm tra ban đầu' }),
  ).toHaveCount(0)
  await page.screenshot({
    path: testInfo.outputPath('mb-667-guide-three-resources-desktop.png'),
    fullPage: true,
  })
  await page.setViewportSize({ width: 375, height: 812 })
  await expectNoHorizontalOverflow(page)
  await page.getByRole('link', { name: /Khám phá bài tập phù hợp/ }).click()
  await expect(resourceList).toBeInViewport()
  await page.screenshot({
    path: testInfo.outputPath('mb-667-guide-three-resources-mobile.png'),
    fullPage: true,
  })
})

test('MB-667 shows Mầm An while loading and preserves an incomplete exact pair without inventing a score', async ({
  page,
}, testInfo) => {
  let releaseHistory!: () => void
  const historyGate = new Promise<void>((resolve) => {
    releaseHistory = resolve
  })

  await page.route(
    '**/api/care/screening-episodes/history**',
    async (route) => {
      await historyGate
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              episodeId: '70000000-0000-4000-8000-000000000505',
              purpose: 'REASSESSMENT',
              status: 'IN_PROGRESS',
              startedAt: '2026-10-15T08:00:00Z',
              updatedAt: '2026-10-15T08:05:00Z',
              completedAt: null,
              presentationEvaluationId: null,
              meaningState: 'INCOMPLETE',
              evidence: [
                {
                  instrument: 'PHQ9',
                  state: 'AVAILABLE',
                  assessmentId: '10000000-0000-4000-8000-000000000505',
                  totalScore: 2,
                  screeningLevel: 'MINIMAL',
                  safetyStatus: 'POSITIVE_SAFETY_SCREEN',
                },
                {
                  instrument: 'GAD7',
                  state: 'MISSING',
                  assessmentId: null,
                  totalScore: null,
                  screeningLevel: null,
                  safetyStatus: null,
                },
              ],
              meaning: null,
            },
          ],
          nextCursor: null,
          hasMore: false,
        }),
      })
    },
  )

  await page.goto('/assessments')
  await expect(
    page.getByRole('status', { name: 'Đang chuẩn bị lịch sử sàng lọc' }),
  ).toBeVisible()
  await expect(
    page.locator('[data-skeleton-part="history-card"]').first(),
  ).toBeVisible()
  const loadingScreenshot = testInfo.outputPath('mb-667-mam-an-loading.png')
  await page.screenshot({ path: loadingScreenshot, fullPage: true })
  await testInfo.attach('MB-667 Mầm An loading', {
    path: loadingScreenshot,
    contentType: 'image/png',
  })
  releaseHistory()

  const history = page.getByRole('region', {
    name: 'Lịch sử theo từng lượt sàng lọc',
  })
  const incompleteEpisode = history
    .locator('article')
    .filter({ hasText: 'Đánh giá lại' })
  await expect(incompleteEpisode.getByText('2', { exact: true })).toBeVisible()
  await expect(incompleteEpisode.getByText('/27 điểm')).toBeVisible()
  await expect(incompleteEpisode.getByText('Chưa làm GAD-7')).toBeVisible()
  await expect(
    incompleteEpisode.getByLabel('GAD-7 · Dấu hiệu lo âu: chưa có điểm'),
  ).toBeVisible()
  await expect(
    incompleteEpisode.getByText('Có thông tin an toàn cần xem'),
  ).toBeVisible()
  await expect(
    incompleteEpisode.getByRole('link', { name: /Làm tiếp bài còn thiếu/ }),
  ).toHaveAttribute('href', '/initial-check?purpose=reassessment')
  await expect(
    incompleteEpisode.getByRole('link', { name: /Xem kết quả/ }),
  ).toHaveCount(0)

  const incompleteScreenshot = testInfo.outputPath(
    'mb-667-incomplete-history.png',
  )
  await page.screenshot({ path: incompleteScreenshot, fullPage: true })
  await testInfo.attach('MB-667 incomplete history', {
    path: incompleteScreenshot,
    contentType: 'image/png',
  })

  await page.setViewportSize({ width: 375, height: 812 })
  await expect(incompleteEpisode.getByText('Chưa làm GAD-7')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  const incompleteMobileScreenshot = testInfo.outputPath(
    'mb-667-incomplete-history-mobile.png',
  )
  await page.screenshot({ path: incompleteMobileScreenshot, fullPage: true })
  await testInfo.attach('MB-667 incomplete history mobile', {
    path: incompleteMobileScreenshot,
    contentType: 'image/png',
  })
})

test('MB-667 keeps safety authoritative and renders severe professional support as a different state', async ({
  page,
}, testInfo) => {
  const safety = combinedMeaningFixture({
    supportEvaluationId: safetyEvaluationId,
    supportGuideId: guideId,
    priority: 'SAFETY',
  })
  const severe = combinedMeaningFixture({
    supportEvaluationId: severeEvaluationId,
    priority: 'PROFESSIONAL_SUPPORT',
  })
  severe.evidence[0].totalScore = 24
  severe.evidence[0].screeningLevel = 'SEVERE'
  severe.baseMeaning.code = 'PHQ9_SEVERE_GAD7_MINIMAL'
  severe.baseMeaning.text =
    'Dấu hiệu trầm cảm ở mức nặng, lo âu rất ít. Bạn nên ưu tiên trao đổi sớm với chuyên gia.'

  await page.route(
    `**/api/care/support-evaluations/${safetyEvaluationId}/combined-meaning`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(safety),
      }),
  )
  await page.route(
    `**/api/care/support-evaluations/${severeEvaluationId}/combined-meaning`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(severe),
      }),
  )

  await page.goto(`/assessments/results/${safetyEvaluationId}`)
  await expect(
    page.getByRole('heading', {
      name: 'Xem hướng dẫn an toàn và tìm hỗ trợ trực tiếp',
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: /Xem hỗ trợ trong khu vực/ }),
  ).toHaveAttribute('href', '/safety-directory?trigger=positive-item-9')
  await expect(
    page.getByRole('link', { name: /Xem gợi ý an toàn đã lưu/ }),
  ).toHaveAttribute(
    'href',
    `/support-guides/${guideId}?from=screening-history&resultEvaluationId=${safetyEvaluationId}`,
  )
  const safetyScreenshot = testInfo.outputPath('mb-667-safety-desktop.png')
  await page.screenshot({ path: safetyScreenshot, fullPage: true })
  await testInfo.attach('MB-667 safety desktop', {
    path: safetyScreenshot,
    contentType: 'image/png',
  })

  await page.goto(`/assessments/results/${severeEvaluationId}`)
  await expect(
    page.getByRole('progressbar', {
      name: 'PHQ-9: 24 trên 27 điểm, mức Nặng',
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', {
      name: 'Nên sớm trao đổi với chuyên gia',
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: /Tìm chuyên gia hiện tại/ }),
  ).toHaveAttribute('href', '/specialists')
  await expect(
    page.getByText('Lần đánh giá này chưa có gợi ý đã lưu.'),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: /hướng dẫn an toàn/i }),
  ).toHaveCount(0)
  const severeScreenshot = testInfo.outputPath('mb-667-severe-desktop.png')
  await page.screenshot({ path: severeScreenshot, fullPage: true })
  await testInfo.attach('MB-667 severe desktop', {
    path: severeScreenshot,
    contentType: 'image/png',
  })

  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(`/assessments/results/${safetyEvaluationId}`)
  await expect(
    page.getByRole('heading', {
      name: 'Xem hướng dẫn an toàn và tìm hỗ trợ trực tiếp',
    }),
  ).toBeVisible()
  await expectNoHorizontalOverflow(page)
  const safetyMobileScreenshot = testInfo.outputPath('mb-667-safety-mobile.png')
  await page.screenshot({ path: safetyMobileScreenshot, fullPage: true })
  await testInfo.attach('MB-667 safety mobile', {
    path: safetyMobileScreenshot,
    contentType: 'image/png',
  })

  await page.goto(`/assessments/results/${severeEvaluationId}`)
  await expect(
    page.getByRole('progressbar', {
      name: 'PHQ-9: 24 trên 27 điểm, mức Nặng',
    }),
  ).toBeVisible()
  await expectNoHorizontalOverflow(page)
  const severeMobileScreenshot = testInfo.outputPath('mb-667-severe-mobile.png')
  await page.screenshot({ path: severeMobileScreenshot, fullPage: true })
  await testInfo.attach('MB-667 severe mobile', {
    path: severeMobileScreenshot,
    contentType: 'image/png',
  })
})
