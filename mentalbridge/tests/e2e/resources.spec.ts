import { expect, type BrowserContext, type Page } from '@playwright/test'

import { test } from './test-fixtures'
import {
  installPlanResourcesMocks,
  planActionId,
  planOccurrenceId,
  planResourceId,
  resourceWorld,
} from './plan-resources-mocks'

test.describe('Resources journey', () => {
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'Fixture Content and Care journeys are not run against the live cross-stack environment.',
  )

  async function completeAssessment(page: Page, path: string) {
    await page.goto(path)
    await expect(
      page.getByRole('heading', { name: 'PHQ-9 — Sàng lọc triệu chứng' }),
    ).toBeVisible()

    for (let item = 1; item <= 9; item += 1) {
      await page
        .getByRole('radio', {
          name: item === 9 ? 'Vài ngày' : 'Không có gì',
        })
        .check()
      if (item < 9) {
        await page.getByRole('button', { name: 'Câu tiếp theo →' }).click()
      }
    }

    await page.getByRole('checkbox', { name: /tôi đồng ý/i }).check()
    await page.getByRole('button', { name: 'Xem kết quả' }).click()
    await expect(
      page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
    ).toBeVisible()
  }

  async function mockResources(
    context: BrowserContext,
    status: number,
    body: unknown,
  ) {
    await context.route('**/api/resources**', async (route) => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    })
  }

  test('supports catalogue bookmarks and interactive video Detail without a current plan', async ({
    context,
    page,
  }) => {
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (message) => {
      const sourceUrl = message.location().url
      const expectedFixtureMiss =
        sourceUrl.endsWith('/api/care/profile') ||
        sourceUrl.includes('/api/emotion-check-ins/')
      if (message.type() === 'error' && !expectedFixtureMiss)
        consoleErrors.push(`${sourceUrl}: ${message.text()}`)
    })
    await context.addCookies([
      {
        name: 'mentalbridge_access',
        value: 'synthetic-resource-e2e-access',
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])
    await context.route('**/api/consultation/service-credits', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          source: 'DEFAULT_FREE',
          packageCode: 'FREE',
          entitlementState: 'DEFAULT_FREE',
          supportPlanEnabled: false,
        }),
      }),
    )
    await context.route('**/api/consultation/payments', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], hasMore: false }),
      }),
    )
    await context.route('**/iframe_api', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'window.YT = window.YT || {};',
      })
    })
    const resourceId = '00000000-0000-4000-8000-000000000213'
    const overviewResourceId = '00000000-0000-4000-8000-000000000215'
    let overviewSaved = false
    const savedBookmarks = new Set<string>()
    await context.route('**/api/achievements?**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { ETag: '"0"' },
        body: JSON.stringify({
          visibilityState: 'VISIBLE',
          preferenceVersion: '0',
          policyVersion: 'achievement-rules-v1',
          calculatedAt: '2026-10-11T02:00:00Z',
          sources: [],
          items: [],
        }),
      }),
    )
    let bingoSelfConfirmed = false
    let bingoVersion = 0
    const catalogue = [
      {
        id: resourceId,
        category: 'VIDEO',
        locale: 'vi-VN',
        title: 'Video thở chánh niệm ngắn',
        summary: 'Một video thực hành đã được rà soát.',
        externalUrl: 'https://www.youtube.com/watch?v=wfDTp2GogaQ',
        sourceOrganization: 'NHS Every Mind Matters',
        status: 'PUBLISHED',
        createdAt: '2026-09-23T00:00:00.000Z',
      },
      {
        id: '00000000-0000-4000-8000-000000000214',
        category: 'ARTICLE',
        locale: 'vi-VN',
        title: 'Một khoảng nghỉ cho tâm trí',
        summary: 'Những gợi ý ngắn để chậm lại giữa một ngày nhiều suy nghĩ.',
        status: 'PUBLISHED',
        createdAt: '2026-09-23T00:00:00.000Z',
      },
      {
        id: '00000000-0000-4000-8000-000000000215',
        category: 'BREATHING',
        locale: 'vi-VN',
        title: 'Nhịp thở 4–4–6',
        summary: 'Một bài thực hành dịu dàng để đưa sự chú ý về hiện tại.',
        status: 'PUBLISHED',
        createdAt: '2026-09-23T00:00:00.000Z',
      },
      {
        id: '00000000-0000-4000-8000-000000000216',
        category: 'JOURNALING',
        locale: 'vi-VN',
        title: 'Ba dòng cho hôm nay',
        summary: 'Ghi lại điều đang hiện diện bằng một nhịp thật vừa sức.',
        status: 'PUBLISHED',
        createdAt: '2026-09-23T00:00:00.000Z',
      },
    ]
    await context.route('**/api/resources**', async (route) => {
      const requestUrl = new URL(route.request().url())
      if (requestUrl.pathname === '/api/resources/bookmarks') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [...savedBookmarks].map((savedResourceId) => ({
              resourceId: savedResourceId,
              contentVersion: '4',
              savedAt: '2026-10-11T02:00:00.000Z',
              version: '0',
            })),
          }),
        })
        return
      }
      if (requestUrl.pathname.startsWith('/api/resources/bookmarks/')) {
        const savedResourceId = requestUrl.pathname.split('/').at(-1)!
        if (route.request().method() === 'DELETE') {
          savedBookmarks.delete(savedResourceId)
          await route.fulfill({ status: 204 })
        } else {
          savedBookmarks.add(savedResourceId)
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              resourceId: savedResourceId,
              contentVersion: '4',
              savedAt: '2026-10-11T02:00:00.000Z',
              version: '0',
            }),
          })
        }
        return
      }
      if (requestUrl.pathname.startsWith('/api/resources/bingo/')) {
        if (route.request().method() === 'PUT') {
          const update = route.request().postDataJSON() as {
            selfConfirmed: boolean
          }
          bingoSelfConfirmed = update.selfConfirmed
          bingoVersion += 1
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { ETag: `"${bingoVersion}"` },
          body: JSON.stringify({
            weekStart: '2026-09-28',
            timeZone: 'Asia/Ho_Chi_Minh',
            version: String(bingoVersion),
            updatedAt: '2026-10-11T02:00:00.000Z',
            items: [
              {
                position: 1,
                resourceId: overviewResourceId,
                contentVersion: '4',
                label: catalogue[2].title,
                evidence: overviewSaved
                  ? 'CONTENT_VERIFIED'
                  : bingoSelfConfirmed
                    ? 'SELF_CONFIRMED'
                    : 'NONE',
                selfConfirmedAt: bingoSelfConfirmed
                  ? '2026-10-11T02:00:00.000Z'
                  : null,
                verifiedAt: overviewSaved ? '2026-10-11T02:00:00.000Z' : null,
                verificationSource: overviewSaved
                  ? 'RESOURCE_COMPLETION'
                  : null,
              },
            ],
          }),
        })
        return
      }
      if (requestUrl.pathname === '/api/resources/journey') {
        const date = requestUrl.searchParams.get('date') ?? '2026-09-29'
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            assignmentId: '00000000-0000-4000-8000-000000000301',
            localDate: date,
            planId: '00000000-0000-4000-8000-000000000302',
            planVersion: 1,
            items: catalogue.map((resource, index) => ({
              position: index + 1,
              resource,
              reason: 'PLAN_SELECTED',
            })),
            progress: {
              dailyCompleted: overviewSaved ? 1 : 0,
              dailyTotal: catalogue.length,
              learningCompleted: 0,
              learningTotal: catalogue.length,
              practiceStreakDays: overviewSaved ? 1 : 0,
            },
            weekStart: '2026-09-28',
            bingo: catalogue.map((resource, index) => ({
              position: index + 1,
              resourceId: resource.id,
              label: resource.title,
              stamped: overviewSaved && resource.id === overviewResourceId,
            })),
          }),
        })
        return
      }
      if (requestUrl.pathname === '/api/resources/progress') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: overviewSaved
              ? [
                  {
                    resourceId: overviewResourceId,
                    localDate: '2026-10-11',
                    contentVersion: '4',
                    status: 'COMPLETED',
                    completedActionIds: ['overview-complete'],
                    completedAt: '2026-10-11T02:00:00.000Z',
                    updatedAt: '2026-10-11T02:00:00.000Z',
                    version: '1',
                  },
                ]
              : [],
          }),
        })
        return
      }
      if (requestUrl.pathname.startsWith('/api/resources/progress/')) {
        const parts = requestUrl.pathname.split('/')
        const savedResourceId = parts.at(-2) ?? resourceId
        const body = route.request().postDataJSON() as {
          status: 'IN_PROGRESS' | 'COMPLETED'
          completedActionIds: string[]
        }
        if (
          savedResourceId === overviewResourceId &&
          body.status === 'COMPLETED'
        ) {
          overviewSaved = true
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            resourceId: savedResourceId,
            localDate: parts.at(-1),
            contentVersion: '4',
            ...body,
            completedAt:
              body.status === 'COMPLETED' ? '2026-10-11T02:00:00.000Z' : null,
            updatedAt: '2026-10-11T02:00:00.000Z',
            version: '1',
          }),
        })
        return
      }
      if (requestUrl.pathname === `/api/resources/${resourceId}`) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...catalogue[0],
            contentVersion: '4',
            contentBody: 'Dừng lại và quan sát nhịp thở hiện tại.',
            sourceTitle: 'Mindful Breathing Exercise',
            sourceUrl: 'https://www.nhs.uk/mental-health/',
            sourceReviewNote: 'Đã xác minh nguồn và nội dung.',
            effectiveAt: '2026-09-23T00:00:00.000Z',
            expiresAt: null,
          }),
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: catalogue, hasMore: false }),
      })
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/resources')
    expect(pageErrors).toEqual([])
    await expect(
      page.getByRole('heading', { level: 1, name: catalogue[0].title }),
    ).toBeVisible()
    expect(
      await page
        .getByRole('heading', { level: 1, name: catalogue[0].title })
        .evaluate((element) => getComputedStyle(element).fontFamily),
    ).toMatch(/Fraunces/i)
    expect(
      await page
        .locator('body')
        .evaluate((element) => getComputedStyle(element).fontFamily),
    ).toMatch(/Vietnam/i)
    // Bingo is scoped to the separately loaded plan section; the daily
    // catalogue journey remains usable without a current-plan projection.
    await expect(page.getByText('Chưa có chuỗi thực hành')).toBeVisible()
    await expect(page.getByText(/\bXP\b/i)).toHaveCount(0)
    await expect(page.getByText(/huy hiệu|cấp độ/i)).toHaveCount(0)
    await expect(
      page.getByText('NHS Every Mind Matters', { exact: true }).first(),
    ).toBeVisible()

    await page
      .getByRole('button', { name: 'Lưu hoạt động nổi bật' })
      .first()
      .click()
    await expect(
      page.getByRole('button', { name: 'Bỏ lưu hoạt động nổi bật' }).first(),
    ).toBeVisible()
    await page.reload()
    await expect(
      page.getByRole('button', { name: 'Bỏ lưu hoạt động nổi bật' }).first(),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Bỏ lưu hoạt động nổi bật' })
      .first()
      .click()
    await expect(
      page.getByRole('button', { name: 'Lưu hoạt động nổi bật' }).first(),
    ).toBeVisible()

    await expect(page.getByTestId('today-plan-progress')).toHaveCount(0)
    await expect(
      page.getByRole('link', {
        name: 'Hoạt động trong kế hoạch hôm nay',
        exact: true,
      }),
    ).toHaveCount(0)
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 768, height: 1024 },
      { width: 375, height: 812 },
      { width: 640, height: 400 },
    ]) {
      await page.setViewportSize(viewport)
      const layout = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        overflow: [...document.querySelectorAll<HTMLElement>('*')]
          .map((element) => {
            const rect = element.getBoundingClientRect()
            return {
              element: `${element.tagName.toLowerCase()}.${element.className}`,
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            }
          })
          .filter(
            ({ left, right, width }) =>
              left < -1 ||
              right > window.innerWidth + 1 ||
              width > window.innerWidth + 1,
          )
          .slice(0, 12),
      }))
      expect(layout.scrollWidth, JSON.stringify(layout.overflow)).toBe(
        viewport.width,
      )
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(page.locator('main').first()).toBeVisible()
    expect(['0s', '0.01ms', '1e-05s']).toContain(
      await page
        .locator('[data-resource-surface="dark"]')
        .first()
        .evaluate((element) => getComputedStyle(element).animationDuration),
    )
    if (process.env.CAPTURE_MB660_EVIDENCE === 'true') {
      await page.screenshot({
        path: 'docs/evidence/mb-660-resource-engagement-desktop.png',
        fullPage: true,
      })
      await page.setViewportSize({ width: 390, height: 844 })
      await page.screenshot({
        path: 'docs/evidence/mb-660-resource-engagement-mobile.png',
        fullPage: true,
      })
      await page.setViewportSize({ width: 1440, height: 900 })
    }
    if (process.env.CAPTURE_RESOURCE_EVIDENCE === 'true') {
      await page.screenshot({
        path: 'docs/evidence/mb-656-resources-desktop.png',
        fullPage: true,
      })
      await page.setViewportSize({ width: 375, height: 812 })
      await expect
        .poll(() =>
          page
            .locator('.ref-sidebar')
            .evaluate((element) => element.getBoundingClientRect().right),
        )
        .toBeLessThanOrEqual(0)
      await expect(
        page.getByRole('heading', { name: 'Hoạt động đã ghi nhận' }),
      ).toBeVisible()
      await page.screenshot({
        path: 'docs/evidence/mb-656-resources-mobile.png',
        fullPage: true,
      })
      await page.setViewportSize({ width: 1440, height: 900 })
    }
    await page
      .getByRole('link', { name: `Khám phá ${catalogue[0].title}` })
      .click()
    await page.waitForURL(new RegExp(`/resources/${resourceId}`))

    await expect(
      page.getByRole('heading', { level: 1, name: catalogue[0].title }),
    ).toBeVisible()
    const video = page.getByTitle(catalogue[0].title)
    const transcript = page.getByRole('complementary', {
      name: 'Nội dung video',
    })
    await expect(video).toBeVisible()
    await expect(transcript).toBeVisible()
    await expect(page.getByText(/phụ đề tiếng Việt:/i)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /tắt phụ đề/i })).toHaveCount(
      0,
    )
    const videoBox = await video.boundingBox()
    const transcriptBox = await transcript.boundingBox()
    expect(videoBox).not.toBeNull()
    expect(transcriptBox).not.toBeNull()
    expect(transcriptBox!.y).toBeGreaterThan(videoBox!.y + videoBox!.height)
    expect(Math.abs(transcriptBox!.width - videoBox!.width)).toBeLessThan(4)

    await page.setViewportSize({ width: 390, height: 844 })
    const mobileVideoBox = await video.boundingBox()
    const mobileTranscriptBox = await transcript.boundingBox()
    expect(mobileVideoBox).not.toBeNull()
    expect(mobileTranscriptBox).not.toBeNull()
    expect(mobileTranscriptBox!.y).toBeGreaterThan(
      mobileVideoBox!.y + mobileVideoBox!.height,
    )
    expect(
      Math.abs(mobileTranscriptBox!.width - mobileVideoBox!.width),
    ).toBeLessThan(4)

    await page.getByRole('button', { name: /đánh dấu đã xem xong/i }).click()
    await page.getByLabel(/dừng lại hoặc giảm cường độ/i).check()
    await page.getByLabel(/một bước nhỏ, an toàn/i).check()
    await page.getByRole('button', { name: 'Hoàn tất' }).click()
    await expect(page.getByText(/một bước nhỏ đã hoàn thành/i)).toBeVisible()
    await page.getByRole('link', { name: 'Quay lại Tài nguyên' }).click()
    await page.waitForURL(/\/resources$/)
    await expect(
      page.getByRole('heading', { level: 2, name: 'Hoạt động đã ghi nhận' }),
    ).toBeVisible()
    expect(consoleErrors).toEqual([])
  })

  test('loads reviewed published resources through the real BFF for an anonymous result', async ({
    page,
  }) => {
    const responsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/resources' &&
        response.status() === 200,
    )

    await completeAssessment(page, '/assessment/anonymous')
    await responsePromise

    await expect(page.getByText('Published Resource')).toBeVisible()
    await expect(page.getByText('Draft Resource')).toHaveCount(0)
    await expect(page.getByText('Archived Resource')).toHaveCount(0)
    await expect(page.locator('.resources-grid > *')).toHaveCount(1)

    const link = page.getByRole('link', { name: /published resource/i })
    await expect(link).toHaveAttribute(
      'href',
      '/resources/30000000-0000-4000-8000-000000000001',
    )
    await expect(link).not.toHaveAttribute('target', '_blank')
    await link.focus()
    await expect(link).toBeFocused()
  })

  test('loads resources for the authenticated USER result without skipping the journey', async ({
    context,
    page,
  }) => {
    await context.addCookies([
      {
        name: 'mentalbridge_access',
        value: 'synthetic-resource-e2e-access',
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])

    await completeAssessment(page, '/assessment/phq9')

    await expect(page.getByText('Published Resource')).toBeVisible()
    await expect(page.getByText('Draft Resource')).toHaveCount(0)
    await expect(page.getByText('Archived Resource')).toHaveCount(0)
  })

  test('distinguishes an empty catalogue from dependency failure', async ({
    context,
    page,
  }) => {
    await mockResources(context, 200, { items: [], hasMore: false })

    await completeAssessment(page, '/assessment/anonymous')

    await expect(page.getByText('Hiện chưa có tài liệu nào')).toBeVisible()
    await expect(page.getByText(/tạm thời không khả dụng/i)).toHaveCount(0)
  })

  test('renders the reviewed unavailable fallback returned by the BFF', async ({
    context,
    page,
  }) => {
    await mockResources(context, 200, {
      items: [],
      hasMore: false,
      unavailable: true,
      message:
        'Tài nguyên hỗ trợ tạm thời không khả dụng. Vui lòng thử lại sau.',
    })

    await completeAssessment(page, '/assessment/anonymous')

    await expect(
      page.getByText(
        'Tài nguyên hỗ trợ tạm thời không khả dụng. Vui lòng thử lại sau.',
      ),
    ).toBeVisible()
  })

  test('renders a distinct timeout state', async ({ context, page }) => {
    await mockResources(context, 504, { code: 'CONTENT_TIMEOUT' })

    await completeAssessment(page, '/assessment/anonymous')

    await expect(
      page.getByText('Dịch vụ đang bận, vui lòng thử lại sau'),
    ).toBeVisible()
  })

  test('renders a generic error for an unauthorized response', async ({
    context,
    page,
  }) => {
    await mockResources(context, 401, { code: 'CONTENT_REQUEST_FAILED' })

    await completeAssessment(page, '/assessment/anonymous')

    await expect(page.getByText('Không thể tải tài liệu')).toBeVisible()
  })

  test('keeps the assessment result usable when the resource request fails', async ({
    context,
    page,
  }) => {
    await context.route('**/api/resources**', async (route) => {
      await route.abort('failed')
    })

    await completeAssessment(page, '/assessment/anonymous')

    await expect(page.getByText('Không thể kết nối đến dịch vụ')).toBeVisible()
    await expect(page.locator('.resources-list')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Làm bài mới' }),
    ).toBeEnabled()
  })

  test('maps a malformed provider response to dependency unavailable', async ({
    context,
    page,
  }) => {
    await mockResources(context, 502, { code: 'CONTENT_INVALID_RESPONSE' })

    await completeAssessment(page, '/assessment/anonymous')

    await expect(
      page.getByText('Dịch vụ tạm thời không khả dụng'),
    ).toBeVisible()
  })
})

test.describe('MB-670 plan resources and plan-scoped Bingo', () => {
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'Controlled resource-plan states do not use shared accounts.',
  )

  function planSection(page: Page) {
    return page.getByRole('region', {
      name: 'Trong kế hoạch của tôi',
      exact: true,
    })
  }

  test('keeps two resource placeholders while the plan is loading', async ({
    page,
  }) => {
    const world = resourceWorld()
    let release = () => {}
    world.holdPlan = new Promise<void>((resolve) => {
      release = resolve
    })
    await installPlanResourcesMocks(page, world)
    await page.goto('/resources')
    const section = planSection(page)
    await expect(section).toHaveAttribute('aria-busy', 'true')
    await expect(
      section
        .getByLabel('Đang tải tài nguyên kế hoạch')
        .locator(':scope > div[aria-hidden="true"]'),
    ).toHaveCount(2)
    await expect(section.getByRole('status')).toHaveText('Đang tải…')
    await expect(
      section.getByRole('heading', { name: 'Bingo hoạt động trong kế hoạch' }),
    ).toHaveCount(0)
    release()
    await expect(section).toHaveAttribute('aria-busy', 'false')
    await expect(
      section.getByRole('link', { name: 'Mở tài nguyên', exact: true }),
    ).toHaveCount(2)
  })

  test('shows only the plan resources in order and opens exact-version Detail with its occurrence', async ({
    page,
  }) => {
    const world = resourceWorld(4)
    await installPlanResourcesMocks(page, world)
    await page.goto('/resources')
    const section = planSection(page)
    await expect(
      section.getByRole('link', { name: 'Mở tài nguyên', exact: true }),
    ).toHaveCount(3)
    await expect(section.getByRole('heading', { level: 3 }).first()).toHaveText(
      world.projection.actions[0].title,
    )
    const link = section
      .getByRole('link', { name: 'Mở tài nguyên', exact: true })
      .first()
    const href = await link.getAttribute('href')
    const detailUrl = new URL(href!, 'http://127.0.0.1:3100')
    expect(detailUrl.pathname).toBe(`/resources/${planResourceId}`)
    expect(Object.fromEntries(detailUrl.searchParams)).toMatchObject({
      from: 'support-plan',
      contentVersion: '3',
      occurrenceId: planOccurrenceId,
      actionId: planActionId,
      localDate: world.projection.localDate,
    })
    await expect(
      section.getByRole('article').getByText('Chưa làm', { exact: true }),
    ).toHaveCount(3)
    await section.getByRole('button', { name: 'Xem tất cả (4)' }).click()
    await expect(
      section.getByRole('link', { name: 'Mở tài nguyên', exact: true }),
    ).toHaveCount(4)
    const bingo = section.getByRole('region', {
      name: 'Bingo hoạt động trong kế hoạch',
    })
    await expect(bingo.getByRole('listitem')).toHaveCount(4)
    await expect(bingo.getByText('Một chút dịu dàng trong ngày')).toHaveCount(0)
    expect(
      world.calls.filter((call) => call.path.endsWith('/plan-sync')),
    ).toHaveLength(1)
    expect(
      world.calls.filter(
        (call) => call.method === 'GET' && call.path.includes('/bingo/'),
      ),
    ).toHaveLength(0)
  })

  test('renders no-plan and empty-plan states without a Bingo board', async ({
    page,
  }) => {
    const world = resourceWorld(0)
    world.projection.planState = 'NONE'
    await installPlanResourcesMocks(page, world)
    await page.goto('/resources')
    const section = planSection(page)
    await expect(
      section
        .getByText('Bạn chưa có kế hoạch hỗ trợ.', { exact: true })
        .and(section.locator(':not([role="status"])')),
    ).toBeVisible()
    await expect(
      section.getByRole('link', { name: 'Tạo kế hoạch' }),
    ).toHaveAttribute('href', '/support-plan')
    await expect(
      section.getByRole('heading', { name: 'Bingo hoạt động trong kế hoạch' }),
    ).toHaveCount(0)
    await expect(page.getByTestId('today-plan-progress')).toHaveCount(0)
    await expect(page.getByLabel('Bảy ngày gần đây')).toHaveCount(0)
    world.projection.planState = 'ACTIVE'
    await page.reload()
    await expect(
      section
        .getByText('Kế hoạch hiện tại chưa có tài nguyên nào.', {
          exact: true,
        })
        .and(section.locator(':not([role="status"])')),
    ).toBeVisible()
    await expect(
      section.getByRole('heading', { name: 'Bingo hoạt động trong kế hoạch' }),
    ).toHaveCount(0)
  })

  for (const access of ['free', 'expired', 'unavailable'] as const) {
    test(`gates ${access} entitlement before Care or Bingo calls`, async ({
      page,
    }) => {
      const world = resourceWorld()
      world.access = access
      await installPlanResourcesMocks(page, world)
      await page.goto('/resources')
      const section = planSection(page)
      await expect(
        section
          .getByText(
            access === 'unavailable'
              ? 'Chưa kiểm tra được kế hoạch của bạn lúc này.'
              : 'Kế hoạch hỗ trợ chưa được mở với tài khoản của bạn.',
            { exact: true },
          )
          .and(section.locator(':not([role="status"])')),
      ).toBeVisible()
      if (access === 'unavailable')
        await expect(
          section.getByRole('button', { name: 'Thử lại' }),
        ).toBeEnabled()
      else
        await expect(
          section.getByRole('link', { name: 'Tìm hiểu' }),
        ).toHaveAttribute('href', '/support-plan')
      expect(world.calls).toHaveLength(0)
      await expect(page.getByTestId('today-plan-progress')).toHaveCount(0)
      await expect(page.getByLabel('Bảy ngày gần đây')).toHaveCount(0)
      await expect(
        page
          .getByRole('heading', { name: 'Một chút dịu dàng trong ngày' })
          .first(),
      ).toBeVisible()
    })
  }

  test('keeps paused resources open while Bingo is read-only', async ({
    page,
  }) => {
    const world = resourceWorld()
    world.projection.planState = 'PAUSED'
    await installPlanResourcesMocks(page, world)
    await page.goto('/resources')
    const section = planSection(page)
    await expect(
      section
        .getByText(
          'Kế hoạch đang tạm dừng. Bạn vẫn mở được tài nguyên; tiến độ tiếp tục khi kế hoạch hoạt động lại.',
        )
        .and(section.locator(':not([role="status"])')),
    ).toBeVisible()
    await expect(
      section.getByRole('link', { name: 'Mở tài nguyên', exact: true }),
    ).toHaveCount(2)
    const bingo = section.getByRole('region', {
      name: 'Bingo hoạt động trong kế hoạch',
    })
    await expect(bingo).toBeVisible()
    await expect(bingo.getByRole('listitem')).toHaveCount(2)
    await expect(bingo.getByRole('button')).toHaveCount(0)
    expect(
      world.calls.filter((call) => call.path.includes('/items/')),
    ).toHaveLength(0)
  })

  test('preserves retired evidence when a plan action ends and displays a switched plan', async ({
    page,
  }) => {
    const world = resourceWorld(2)
    const retired = world.board.items[0]
    retired.retired = true
    retired.evidence = 'CONTENT_VERIFIED'
    retired.verifiedAt = new Date().toISOString()
    retired.verificationSource = 'RESOURCE_COMPLETION'
    world.projection.actions = [world.projection.actions[1]]
    await installPlanResourcesMocks(page, world)
    await page.goto('/resources')
    const section = planSection(page)
    await expect(
      section.getByRole('link', { name: 'Mở tài nguyên', exact: true }),
    ).toHaveCount(1)
    const tile = section
      .getByRole('listitem')
      .filter({ hasText: retired.label })
    await expect(
      tile.getByText('Không còn trong kế hoạch', { exact: true }),
    ).toBeVisible()
    await expect(tile.getByRole('button')).toHaveCount(0)
    expect(world.board.items[0].verifiedAt).not.toBeNull()
    world.projection.supportPlanId = 'b5000000-0000-4000-8000-000000000671'
    world.projection.actions[0].title = 'Một nhịp mới trong kế hoạch'
    world.board.items = [
      { ...world.board.items[1], label: world.projection.actions[0].title },
    ]
    await page.reload()
    await expect(
      section.getByRole('heading', {
        name: 'Một nhịp mới trong kế hoạch',
        exact: true,
      }),
    ).toBeVisible()
    await expect(section.getByText(retired.label, { exact: true })).toHaveCount(
      0,
    )
  })

  test('self-confirm and undo use the board ETag without completing a Care occurrence', async ({
    page,
  }) => {
    const world = resourceWorld(1)
    await installPlanResourcesMocks(page, world)
    await page.goto('/resources')
    const section = planSection(page)
    const toggle = section.getByRole('button', {
      name: `Tự đánh dấu ${world.board.items[0].label}`,
      exact: true,
    })
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await toggle.click()
    await expect(
      section.getByText('Bạn đã đánh dấu', { exact: true }),
    ).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(
      section.getByRole('article').getByText('Chưa làm', { exact: true }),
    ).toBeVisible()
    await expect(
      section.getByRole('listitem').getByText('Chưa làm', { exact: true }),
    ).toHaveCount(0)
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    const toggles = world.calls.filter((call) => call.path.includes('/items/'))
    expect(toggles.map((call) => call.headers['if-match'])).toEqual([
      '"0"',
      '"1"',
    ])
    expect(toggles.map((call) => call.body)).toEqual([
      { selfConfirmed: true },
      { selfConfirmed: false },
    ])
    expect(
      world.calls.filter(
        (call) => call.path.startsWith('/api/care/') && call.method !== 'GET',
      ),
    ).toHaveLength(0)
  })

  test('uses today occurrences from the plan projection for the side count and section link', async ({
    page,
  }) => {
    const world = resourceWorld(4)
    world.projection.actions[0].today!.displayState = 'COMPLETED'
    world.projection.actions[3].today = null
    const todayActions = world.projection.actions.filter(
      (action) => action.today !== null,
    )
    const completed = todayActions.filter(
      (action) => action.today?.displayState === 'COMPLETED',
    ).length
    await installPlanResourcesMocks(page, world)
    await page.goto('/resources')
    const progress = page.getByTestId('today-plan-progress')
    await expect(progress).toContainText(
      `${completed}/${todayActions.length} hoạt động hôm nay đã ghi nhận`,
    )
    const jump = page.getByRole('link', {
      name: 'Hoạt động trong kế hoạch hôm nay',
      exact: true,
    })
    await expect(jump).toHaveAttribute('href', '#plan-resources')
    await jump.click()
    await expect(page).toHaveURL(/\/resources#plan-resources$/)
    await expect(planSection(page)).toBeInViewport()
    world.projection.planState = 'PAUSED'
    await page.reload()
    await expect(progress).toContainText(
      `${completed}/${todayActions.length} hoạt động hôm nay đã ghi nhận`,
    )
  })

  test('keeps the Bingo board and previous check when a save fails, focuses retry, and retries only the save', async ({
    page,
  }) => {
    const world = resourceWorld(2)
    world.toggleStatus = 503
    await installPlanResourcesMocks(page, world)
    await page.goto('/resources')
    const section = planSection(page)
    const toggle = section.getByRole('button', {
      name: `Tự đánh dấu ${world.board.items[0].label}`,
      exact: true,
    })
    await toggle.click()
    const error = section.getByRole('alert')
    const retry = error.getByRole('button', { name: 'Thử lại', exact: true })
    await expect(error).toBeVisible()
    await expect(retry).toBeFocused()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expect(section.getByRole('listitem')).toHaveCount(2)
    await expect(
      section.getByRole('link', { name: 'Mở tài nguyên', exact: true }),
    ).toHaveCount(2)
    await expect(
      section.getByText(
        'Chưa tải được kế hoạch của bạn. Danh mục bên dưới vẫn dùng được.',
        { exact: true },
      ),
    ).toHaveCount(0)
    expect(world.board.items[0].selfConfirmedAt).toBeNull()
    world.toggleStatus = 200
    await retry.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(error).toHaveCount(0)
    expect(
      world.calls.filter((call) => call.path.includes('/items/')),
    ).toHaveLength(2)
    expect(
      world.calls.filter((call) => call.path.endsWith('/plan-sync')),
    ).toHaveLength(1)
  })

  test('places plan resources immediately after the hero before the activity panel on single-column layouts', async ({
    page,
  }) => {
    const world = resourceWorld()
    await installPlanResourcesMocks(page, world)
    await page.goto('/resources')
    const section = planSection(page)
    await expect(
      section.getByRole('link', { name: 'Mở tài nguyên', exact: true }),
    ).toHaveCount(2)
    for (const width of [1024, 768, 375]) {
      await page.setViewportSize({ width, height: 1000 })
      const heroBounds = await page
        .locator('section[aria-labelledby="resource-hero-title"]')
        .boundingBox()
      const planBounds = await section.boundingBox()
      const activityBounds = await page
        .getByRole('complementary', { name: 'Hoạt động đã ghi nhận' })
        .boundingBox()
      expect(heroBounds).not.toBeNull()
      expect(planBounds).not.toBeNull()
      expect(activityBounds).not.toBeNull()
      expect(planBounds!.y).toBeGreaterThanOrEqual(
        heroBounds!.y + heroBounds!.height,
      )
      expect(activityBounds!.y).toBeGreaterThanOrEqual(
        planBounds!.y + planBounds!.height,
      )
    }
  })

  test('shows all resource cards but at most nine Bingo items', async ({
    page,
  }) => {
    const world = resourceWorld(11)
    world.board.unavailableActions = world.projection.actions
      .slice(9)
      .map((action) => ({ actionId: action.actionId, reason: 'BOARD_FULL' }))
    await installPlanResourcesMocks(page, world)
    await page.goto('/resources')
    const section = planSection(page)
    await section.getByRole('button', { name: 'Xem tất cả (11)' }).click()
    await expect(
      section.getByRole('link', { name: 'Mở tài nguyên', exact: true }),
    ).toHaveCount(11)
    await expect(section.getByRole('listitem')).toHaveCount(9)
  })

  test('does not open a resource whose pinned version is unavailable', async ({
    page,
  }) => {
    const world = resourceWorld(1)
    world.board.items = []
    world.board.unavailableActions = [
      { actionId: planActionId, reason: 'RESOURCE_VERSION_UNAVAILABLE' },
    ]
    await installPlanResourcesMocks(page, world)
    await page.goto('/resources')
    const section = planSection(page)
    await expect(
      section.getByText('Tài nguyên này hiện không còn khả dụng.', {
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      section.getByRole('link', { name: 'Mở tài nguyên', exact: true }),
    ).toHaveCount(0)
    await expect(
      section.getByRole('heading', { name: 'Bingo hoạt động trong kế hoạch' }),
    ).toHaveCount(0)
  })

  test('offers a reload on stale self-confirmation and refreshes the plan board', async ({
    page,
  }) => {
    const world = resourceWorld(1)
    world.toggleStatus = 412
    await installPlanResourcesMocks(page, world)
    await page.goto('/resources')
    const section = planSection(page)
    await section
      .getByRole('button', { name: /^Tự đánh dấu/, exact: true })
      .click()
    await expect(
      section
        .getByText('Kế hoạch vừa thay đổi.', { exact: true })
        .and(section.locator(':not([role="status"])')),
    ).toBeVisible()
    world.toggleStatus = 200
    await section.getByRole('button', { name: 'Tải lại', exact: true }).click()
    await expect(
      section.getByRole('button', { name: /^Tự đánh dấu/, exact: true }),
    ).toBeEnabled()
    expect(
      world.calls.filter((call) => call.path.endsWith('/plan-sync')).length,
    ).toBeGreaterThan(1)
  })

  test('keeps an unavailable resource closed after another tile is self-confirmed', async ({
    page,
  }) => {
    const world = resourceWorld(2)
    world.board.items = world.board.items.slice(1)
    world.board.unavailableActions = [
      { actionId: planActionId, reason: 'RESOURCE_VERSION_UNAVAILABLE' },
    ]
    await installPlanResourcesMocks(page, world)
    await page.goto('/resources')
    const section = planSection(page)
    const unavailable = section
      .getByRole('article')
      .filter({ hasText: world.projection.actions[0].title })
    await expect(
      unavailable.getByText('Tài nguyên này hiện không còn khả dụng.', {
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      unavailable.getByRole('link', { name: 'Mở tài nguyên', exact: true }),
    ).toHaveCount(0)
    await section.getByRole('button', { name: /^Tự đánh dấu/ }).click()
    await expect(
      section.getByText('Bạn đã đánh dấu', { exact: true }),
    ).toBeVisible()
    await expect(
      unavailable.getByText('Tài nguyên này hiện không còn khả dụng.', {
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      unavailable.getByRole('link', { name: 'Mở tài nguyên', exact: true }),
    ).toHaveCount(0)
  })

  for (const dependency of ['Care', 'Content'] as const) {
    test(`keeps catalogue usable when ${dependency} plan loading fails`, async ({
      page,
    }) => {
      const world = resourceWorld()
      if (dependency === 'Care') world.planStatus = 503
      else world.syncStatus = 503
      await installPlanResourcesMocks(page, world)
      await page.goto('/resources')
      const section = planSection(page)
      await expect(
        section
          .getByText(
            'Chưa tải được kế hoạch của bạn. Danh mục bên dưới vẫn dùng được.',
            { exact: true },
          )
          .and(section.locator(':not([role="status"])')),
      ).toBeVisible()
      await expect(
        section.getByRole('button', { name: 'Thử lại' }),
      ).toBeEnabled()
      await expect(
        section.getByRole('heading', {
          name: 'Bingo hoạt động trong kế hoạch',
        }),
      ).toHaveCount(0)
      await expect(page.getByTestId('today-plan-progress')).toHaveCount(0)
      await expect(page.getByLabel('Bảy ngày gần đây')).toHaveCount(0)
      await expect(
        page
          .getByRole('heading', { name: 'Một chút dịu dàng trong ngày' })
          .first(),
      ).toBeVisible()
      world.planStatus = 200
      world.syncStatus = 200
      await section.getByRole('button', { name: 'Thử lại' }).click()
      await expect(
        section.getByRole('link', { name: 'Mở tài nguyên', exact: true }),
      ).toHaveCount(2)
    })
  }

  test('keeps plan resources and catalogue usable when daily journey fails', async ({
    page,
  }) => {
    const world = resourceWorld()
    world.journeyStatus = 503
    await installPlanResourcesMocks(page, world)
    await page.goto('/resources')
    const section = planSection(page)
    await expect(
      section.getByRole('link', { name: 'Mở tài nguyên', exact: true }),
    ).toHaveCount(2)
    await expect(
      section.getByRole('heading', { name: 'Bingo hoạt động trong kế hoạch' }),
    ).toBeVisible()
    await expect(
      page
        .getByRole('heading', { name: 'Một chút dịu dàng trong ngày' })
        .first(),
    ).toBeVisible()
  })
})
