import { expect, type Page } from '@playwright/test'

import { makeSummary } from '../fixtures/reassessment-review'
import { combinedMeaningFixture } from '../fixtures/combined-meaning'
import { homeWorld, installHomeMocks } from './home-next-step-mocks'
import { installMocks, json, walkToStep3 } from './reassessment-review-mocks'
import { test } from './test-fixtures'

const accessCookie = 'mentalbridge_access'
const widths = [1440, 1280, 768, 375]

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true)
}

// Screenshots go to the story's capture folder when REASSESS_SHOTS_DIR is set, else to the test output.
function shot(
  page: Page,
  testInfo: { outputPath: (name: string) => string },
  name: string,
  fullPage = false,
) {
  const dir = process.env.REASSESS_SHOTS_DIR
  return page.screenshot({
    path: dir ? `${dir}/${name}.png` : testInfo.outputPath(`${name}.png`),
    fullPage,
  })
}

test.describe('reassessment review', () => {
  test.use({ timezoneId: 'Asia/Ho_Chi_Minh' })

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
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await installMocks(page)
  })

  for (const width of widths) {
    test(`flow step 3, step 4 review and the Nhìn lại tab at ${width}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await walkToStep3(page)

      // Step 3: result cards keep their headings on two lines and the flow uses the laptop width.
      await expect(page.getByText(/Chuẩn thang đo quốc tế PHQ-9/)).toBeVisible()
      const container = page.locator('.oj-container-narrow')
      const containerWidth = (await container.boundingBox())!.width
      if (width >= 1280) expect(containerWidth).toBeGreaterThan(1100)
      else expect(containerWidth).toBeLessThanOrEqual(width)
      await expectNoHorizontalOverflow(page)
      await shot(page, testInfo, `after-flow-step3-${width}`, true)

      // Step 4: the review, never a plan.
      await page.getByRole('button', { name: /Xem nhìn lại 14 ngày/ }).click()
      await expect(
        page.getByRole('heading', { level: 2, name: 'Nhìn lại 14 ngày' }),
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'Mức độ sàng lọc' }),
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'Điều bạn viết trong nhật ký' }),
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'Cảm xúc hằng ngày' }),
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'Việc đã làm' }),
      ).toBeVisible()
      await expect(page.getByText('Thở chậm')).toBeVisible()
      await expect(page.getByText('— bạn ghi')).toBeVisible()
      await expect(page.getByText(/bài sàng lọc đầu tiên/)).toHaveCount(0)
      await expect(
        page.getByRole('link', { name: 'Xem lại kế hoạch' }),
      ).toHaveAttribute('href', '/support-plan?review=open')
      await expectNoHorizontalOverflow(page)
      await shot(page, testInfo, `after-flow-step4-first-view-${width}`)
      await page.mouse.wheel(0, 700)
      await page.waitForTimeout(200)
      await shot(page, testInfo, `after-flow-step4-scrolled-${width}`)
      await shot(page, testInfo, `after-flow-step4-full-${width}`, true)

      // The same review lives in the assessments tab, with the earlier ones listed below it.
      await page.goto('/assessments?tab=reassessment')
      await expect(page.getByRole('tab', { name: 'Nhìn lại' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      const panel = page.getByRole('tabpanel', { name: 'Nhìn lại' })
      await expect(
        panel.getByRole('heading', { level: 2, name: 'Nhìn lại 14 ngày' }),
      ).toBeVisible()
      await expect(
        panel.getByRole('heading', { name: 'Các lần nhìn lại trước' }),
      ).toBeVisible()
      // The shell's flex-basis on the heading must not turn into an empty gap in the stacked mobile header.
      if (width <= 720)
        expect(
          (await page
            .locator('[data-user-page-heading]')
            .first()
            .boundingBox())!.height,
        ).toBeLessThan(160)
      await expectNoHorizontalOverflow(page)
      await shot(page, testInfo, `after-assessments-review-first-view-${width}`)
      await page.mouse.wheel(0, 900)
      await page.waitForTimeout(200)
      await shot(page, testInfo, `after-assessments-review-scrolled-${width}`)
      await shot(page, testInfo, `after-assessments-review-full-${width}`, true)

      await panel.locator('.rr-history-row').first().click()
      await expect(
        panel.getByRole('button', { name: 'Quay lại lần nhìn lại mới nhất' }),
      ).toBeVisible()
    })
  }
})

test.describe('reassessment review: consent missing', () => {
  test.use({ timezoneId: 'Asia/Ho_Chi_Minh' })

  test('every section renders and the journal section asks for consent at 1440', async ({
    context,
    page,
  }, testInfo) => {
    await context.addCookies([
      {
        name: accessCookie,
        value: 'synthetic-mb273-e2e-access',
        url: 'http://127.0.0.1:3100',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await installMocks(page)
    const noConsent = makeSummary({
      journalContext: {
        ...makeSummary().journalContext,
        state: 'UNAVAILABLE',
        unavailableReason: 'CONSENT_REQUIRED',
        jobId: null,
        analysisId: null,
        changesComparedWithPreviousPeriod: [],
        recurringThemes: [],
        helpfulPatterns: [],
        dataCoverage: null,
      },
    })
    await page.route('**/api/care/reassessment-summaries/list**', (route) =>
      route.fulfill(
        json({ items: [noConsent], nextCursor: null, hasMore: false }),
      ),
    )
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/assessments?tab=reassessment')
    await expect(
      page.getByText('Bật quyền cho AI đọc nhật ký để thấy phần này.'),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Mở quyền riêng tư' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Mức độ sàng lọc' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Việc đã làm' }),
    ).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await shot(
      page,
      testInfo,
      'after-assessments-review-consent-missing-1440',
      true,
    )
  })
})

test.describe('Home after a reassessment', () => {
  test.use({ timezoneId: 'Asia/Ho_Chi_Minh' })

  for (const width of widths) {
    test(`a mild reassessment after a severe initial check shows no severe notice at ${width}`, async ({
      page,
    }, testInfo) => {
      const world = homeWorld('do-today')
      const severeId = world.journey.presentationEvaluationId!
      const reassessmentId = '80000000-0000-4000-8000-000000000999'
      const episodeId = '70000000-0000-4000-8000-000000000999'
      world.journey = {
        ...world.journey,
        latestScreening: {
          episodeId,
          purpose: 'REASSESSMENT',
          completedAt: '2026-10-20T05:00:00Z',
          presentationEvaluationId: reassessmentId,
          supportEvaluationId: reassessmentId,
        },
      }
      await installHomeMocks(page, world)
      // The Home entry appears only when the owner has a saved review.
      await page.route('**/api/care/reassessment-summaries/list**', (route) =>
        route.fulfill(
          json({ items: [makeSummary()], nextCursor: null, hasMore: false }),
        ),
      )
      await page.emulateMedia({ reducedMotion: 'reduce' })
      const requested: string[] = []
      page.on('request', (request) => {
        const id = new URL(request.url()).pathname.split('/')[4]
        if (request.url().includes('/combined-meaning') && id)
          requested.push(id)
      })
      // The old initial check was severe; only the newer reassessment may be read.
      await page.route(
        `**/api/care/support-evaluations/${severeId}/combined-meaning`,
        (route) => {
          const meaning = combinedMeaningFixture({
            supportEvaluationId: severeId,
          })
          return route.fulfill(
            json({
              ...meaning,
              evidence: meaning.evidence.map((item) => ({
                ...item,
                totalScore: item.instrument === 'PHQ9' ? 21 : 16,
                screeningLevel: 'SEVERE',
              })),
            }),
          )
        },
      )
      await page.route(
        `**/api/care/support-evaluations/${reassessmentId}/combined-meaning`,
        (route) =>
          route.fulfill(
            json({
              ...combinedMeaningFixture({
                supportEvaluationId: reassessmentId,
                episodeId,
                purpose: 'REASSESSMENT',
              }),
              episodeCompletedAt: '2026-10-20T05:00:00Z',
            }),
          ),
      )
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/dashboard')
      await expect(
        page.getByRole('link', { name: /Nhìn lại 14 ngày vừa qua/ }),
      ).toHaveAttribute('href', '/assessments?tab=reassessment')
      await expect.poll(() => requested).toContain(reassessmentId)
      await expect(
        page.getByRole('heading', { name: 'Nên tìm hỗ trợ chuyên môn' }),
      ).toHaveCount(0)
      expect(requested).not.toContain(severeId)
      await expectNoHorizontalOverflow(page)
      await shot(page, testInfo, `after-home-${width}`, true)
    })
  }
})

test('Home shows no review entry when the owner has no saved review', async ({
  page,
}) => {
  const world = homeWorld('do-today')
  world.journey = {
    ...world.journey,
    latestScreening: {
      episodeId: '70000000-0000-4000-8000-000000000999',
      purpose: 'REASSESSMENT',
      completedAt: '2026-10-20T05:00:00Z',
      presentationEvaluationId: world.journey.presentationEvaluationId!,
      supportEvaluationId: world.journey.presentationEvaluationId!,
    },
  }
  await installHomeMocks(page, world)
  await page.route('**/api/care/reassessment-summaries/list**', (route) =>
    route.fulfill(json({ items: [], nextCursor: null, hasMore: false })),
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/dashboard')
  await expect(
    page.getByRole('region', { name: 'Bước tiếp theo', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: /Nhìn lại 14 ngày vừa qua/ }),
  ).toHaveCount(0)
})
