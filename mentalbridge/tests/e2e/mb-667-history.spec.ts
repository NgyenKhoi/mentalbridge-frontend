import { expect, type Page } from '@playwright/test'

import {
  combinedMeaningFixture,
  completedScreeningEpisodeFixture,
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
      text: 'Nhóm dấu hiệu PHQ-9 ở mức nhẹ, còn lo âu được ghi nhận rất ít.',
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
    `/support-guides/${guideId}?from=screening-history`,
  )
  await expect(
    page.getByRole('heading', { name: 'Gợi ý của lần đánh giá này' }),
  ).toBeVisible()
  await expect(
    page.getByText('Bản ghi lịch sử · chỉ đọc').first(),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /Tạo gợi ý/ })).toHaveCount(0)
  await expect(page.getByText('Bắt đầu từ một hoạt động nhỏ')).toBeVisible()

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
  await expect(page.getByText('Mầm An đang đồng hành')).toBeVisible()
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
    incompleteEpisode.getByLabel('GAD-7 · Lo âu: chưa có điểm'),
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
    'PHQ-9 ghi nhận nhiều dấu hiệu về tâm trạng, còn GAD-7 ghi nhận rất ít dấu hiệu lo âu.'

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
  ).toHaveAttribute('href', `/support-guides/${guideId}?from=screening-history`)
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
      name: 'Trao đổi với chuyên gia khi bạn sẵn sàng',
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
