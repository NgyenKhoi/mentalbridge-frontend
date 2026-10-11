import { expect, type BrowserContext, type Page } from '@playwright/test'

import { test } from './test-fixtures'

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

  test('supports the daily challenge and interactive video detail journey', async ({
    context,
    page,
  }) => {
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      const sourceUrl = message.location().url
      const expectedFixtureMiss = sourceUrl.endsWith('/api/care/profile')
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
    await expect(
      page.getByRole('heading', { level: 1, name: catalogue[0].title }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', {
        name: 'Bingo hoạt động trong kế hoạch',
      }),
    ).toBeVisible()
    await expect(page.getByText('Chưa có chuỗi thực hành')).toBeVisible()
    await expect(page.getByText(/\bXP\b/i)).toHaveCount(0)
    await expect(page.getByText(/huy hiệu|cấp độ/i)).toHaveCount(0)
    await expect(
      page.getByText('Nguồn: NHS Every Mind Matters').first(),
    ).toBeVisible()

    await page
      .getByRole('button', {
        name: `Ghi nhận hoàn thành và lưu: ${catalogue[2].title}`,
      })
      .click()
    await expect(
      page.getByText(`✓ Đã lưu hoàn thành “${catalogue[2].title}”.`),
    ).toBeVisible()
    await expect(page.getByText('1 ngày đã lưu')).toBeVisible()
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
        page.getByRole('heading', { name: 'Nhịp thực hành' }),
      ).toBeVisible()
      await page.screenshot({
        path: 'docs/evidence/mb-656-resources-mobile.png',
        fullPage: true,
      })
      await page.setViewportSize({ width: 1440, height: 900 })
    }
    await page
      .getByRole('link', { name: `Mở hoạt động: ${catalogue[0].title}` })
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
      page.getByRole('heading', { level: 2, name: 'Nhịp thực hành' }),
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
