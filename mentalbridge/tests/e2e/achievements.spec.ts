import { expect } from '@playwright/test'

import { test } from './test-fixtures'

const response = {
  visibilityState: 'VISIBLE',
  preferenceVersion: '0',
  policyVersion: 'achievement-rules-v1',
  calculatedAt: '2026-10-13T05:00:00.000Z',
  sources: [
    {
      domain: 'JOURNAL',
      availability: 'AVAILABLE',
      asOfLocalDate: '2026-10-13',
    },
    {
      domain: 'EMOTION_CHECK_IN',
      availability: 'UNAVAILABLE',
      asOfLocalDate: null,
    },
    { domain: 'RESOURCE', availability: 'AVAILABLE', asOfLocalDate: null },
    { domain: 'JOURNEY', availability: 'DEFERRED', asOfLocalDate: null },
  ],
  items: [
    [
      'journal.first-entry',
      'JOURNAL',
      'MILESTONE',
      'FIRST_STEP',
      'Trang viết đầu tiên',
      'EARNED',
    ],
    [
      'journal.streak-3-days',
      'JOURNAL',
      'CONSISTENCY',
      'STEADY_STEP',
      'Một nhịp viết ba ngày',
      'EARNED',
    ],
    [
      'journal.streak-7-days',
      'JOURNAL',
      'CONSISTENCY',
      'DEEPENING_STEP',
      'Một nhịp viết bảy ngày',
      'UNEARNED',
    ],
    [
      'emotion.first-check-in',
      'EMOTION_CHECK_IN',
      'MILESTONE',
      'FIRST_STEP',
      'Lắng nghe cảm xúc đầu tiên',
      'SOURCE_UNAVAILABLE',
    ],
    [
      'emotion.streak-3-days',
      'EMOTION_CHECK_IN',
      'CONSISTENCY',
      'STEADY_STEP',
      'Ba ngày lắng nghe cảm xúc',
      'SOURCE_UNAVAILABLE',
    ],
    [
      'emotion.streak-7-days',
      'EMOTION_CHECK_IN',
      'CONSISTENCY',
      'DEEPENING_STEP',
      'Bảy ngày lắng nghe cảm xúc',
      'SOURCE_UNAVAILABLE',
    ],
    [
      'resource.first-completion',
      'RESOURCE',
      'MILESTONE',
      'FIRST_STEP',
      'Tài nguyên đầu tiên đã hoàn thành',
      'EARNED',
    ],
    [
      'resource.variety-3',
      'RESOURCE',
      'MILESTONE',
      'STEADY_STEP',
      'Khám phá ba tài nguyên khác nhau',
      'UNEARNED',
    ],
    [
      'resource.practice-3-days',
      'RESOURCE',
      'CONSISTENCY',
      'STEADY_STEP',
      'Thực hành trong ba ngày khác nhau',
      'EARNED',
    ],
    [
      'resource.practice-7-days',
      'RESOURCE',
      'CONSISTENCY',
      'DEEPENING_STEP',
      'Thực hành trong bảy ngày khác nhau',
      'UNEARNED',
    ],
    [
      'journey.new-chapter',
      'JOURNEY',
      'JOURNEY',
      'JOURNEY',
      'Một chương mới',
      'DEFERRED',
    ],
  ].map(([definitionId, domain, kind, tier, title, status]) => ({
    definitionId,
    domain,
    kind,
    tier,
    title,
    description: 'Mốc riêng tư dựa trên hoạt động đã lưu.',
    status,
    evidenceClass:
      domain === 'JOURNEY'
        ? 'USER_CONFIRMED_JOURNEY'
        : domain === 'RESOURCE' && definitionId.includes('practice')
          ? 'OWNER_PRACTICE_WINDOW'
          : kind === 'CONSISTENCY'
            ? 'OWNER_STREAK_MILESTONE'
            : 'OWNER_SOURCE_FACT',
    unlockedAt: status === 'EARNED' ? '2026-10-12T05:00:00.000Z' : null,
    ruleVersion: 'achievement-rules-v1',
    privacy: 'PRIVATE',
    progress:
      status === 'SOURCE_UNAVAILABLE' || status === 'DEFERRED'
        ? null
        : {
            current: status === 'EARNED' ? 1 : 0,
            target: 1,
            unit: 'EVENT',
          },
  })),
}

for (const visibilityState of ['VISIBLE', 'HIDDEN'] as const) {
  test(`renders the private gallery accessibly with saved ${visibilityState} preference`, async ({
    context,
    page,
  }, testInfo) => {
    if (visibilityState === 'HIDDEN') {
      await page.emulateMedia({ reducedMotion: 'reduce' })
    }
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
    await page.route('**/api/achievements?*', async (route) => {
      expect(route.request().method()).toBe('GET')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { ETag: '"0"' },
        body: JSON.stringify({ ...response, visibilityState }),
      })
    })

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
      { width: 768, height: 1024 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto('/achievements')
      await expect(
        page.getByRole('heading', { name: 'Bộ sưu tập hành trình' }),
      ).toBeVisible()
      await expect(page.getByText('Chưa thể xác minh').first()).toBeVisible()
      await expect(page.getByText('Chưa mở trong phiên bản này')).toBeVisible()
      await expect(page.getByRole('switch')).toHaveCount(0)
      await expect(
        page.getByRole('button', { name: /(?:Ẩn|Hiện) bộ sưu tập/i }),
      ).toHaveCount(0)
      await expect(page.getByText('Bộ sưu tập đang được ẩn')).toHaveCount(0)
      await page.evaluate(() => document.fonts.ready)
      const typography = await page.evaluate(() => {
        const body = document.querySelector('main p')
        const heading = document.querySelector('main h1')
        return {
          body: body ? getComputedStyle(body).fontFamily : '',
          heading: heading ? getComputedStyle(heading).fontFamily : '',
          overflow:
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth,
        }
      })
      expect(typography.body).toContain('Be Vietnam Pro')
      expect(typography.heading).toContain('Fraunces')
      expect(typography.overflow).toBe(false)
      await page.screenshot({
        path: testInfo.outputPath(`gallery-${viewport.width}.png`),
        fullPage: true,
      })
    }

    const retry = page.getByRole('button', { name: 'Thử lại kết nối' })
    await retry.focus()
    await expect(retry).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('heading', { name: 'Trang viết đầu tiên' }),
    ).toBeVisible()
  })
}
