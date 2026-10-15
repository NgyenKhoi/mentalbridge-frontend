import { expect, type BrowserContext } from '@playwright/test'

import {
  emotionOccurrenceFixture,
  nativeSupportPlanFixture,
} from '../../features/support-plan/testing/native-support-plan-fixture'
import { test } from './test-fixtures'

async function installSupportPlanRoutes(
  context: BrowserContext,
  options: Readonly<{ companionUnavailable?: boolean }> = {},
) {
  const plan = nativeSupportPlanFixture()
  const occurrence = emotionOccurrenceFixture()
  let companionRequests = 0
  let planMutations = 0

  await context.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    const problem = (status: number, code: string) =>
      json({ type: 'about:blank', title: code, status, code }, status)

    if (path === '/api/care/v2/support-plans/current') return json(plan)
    if (path === '/api/care/v2/support-plans/current-draft')
      return problem(404, 'SUPPORT_PLAN_DRAFT_NOT_FOUND')
    if (path === '/api/care/v2/support-plans/history')
      return json({ items: [], hasMore: false, nextCursor: null })
    if (path === '/api/care/v2/support-plan-occurrences')
      return json({
        supportPlanId: plan.supportPlanId,
        supportPlanStatus: plan.status,
        representationMode: plan.representationMode,
        from: occurrence.localDate,
        through: occurrence.localDate,
        occurrences: [occurrence],
        interpretationCode:
          'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
      })
    if (path.endsWith('/companion-explanation')) {
      companionRequests++
      if (options.companionUnavailable)
        return problem(503, 'COMPANION_DEPENDENCY_UNAVAILABLE')
      return json({
        schemaVersion: 'support-plan-companion-message-v1',
        supportPlanId: plan.supportPlanId,
        actionId: occurrence.actionId,
        intent: 'EXPLAIN_ACTION',
        surface: 'TODAY',
        text: 'Hoạt động này thuộc kế hoạch hiện tại.',
        delivery: 'GENERATED',
        policyVersion: 'support-plan-companion-policy-v1',
        promptVersion: 'support-plan-companion-prompt-v1',
        templateVersion: 'support-plan-companion-template-v1',
        provider: 'OPENAI',
        model: 'fixture-model',
        fallbackReason: null,
      })
    }
    if (request.method() !== 'GET') planMutations++
    return route.continue()
  })

  return {
    companionRequests: () => companionRequests,
    planMutations: () => planMutations,
  }
}

test.describe('MB-653 Companion release hardening', () => {
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'Session, failure and performance controls belong to the fixture browser gate.',
  )

  test('persists hide for one tab session and stays silent across repeated navigation', async ({
    page,
    context,
  }) => {
    await page.clock.install({ time: new Date('2026-10-13T13:00:00Z') })
    await context.addCookies([
      {
        name: 'mentalbridge_access',
        value: 'synthetic-mb273-e2e-access',
        url: 'http://127.0.0.1:3100',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])
    const requests = await installSupportPlanRoutes(context)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/support-plan')

    const companion = page.getByRole('complementary', {
      name: 'Bạn đồng hành trong kế hoạch hỗ trợ',
    })
    await expect(companion).toBeVisible()
    expect(
      await companion
        .locator('.support-plan-companion-character *')
        .evaluateAll((elements) =>
          elements.every(
            (element) => getComputedStyle(element).animationName === 'none',
          ),
        ),
    ).toBe(true)
    await companion
      .getByRole('button', { name: 'Thu gọn bạn đồng hành' })
      .click()
    await expect(
      companion.getByRole('button', { name: 'Mở rộng bạn đồng hành' }),
    ).toHaveAttribute('aria-expanded', 'false')

    for (const tab of ['Kế hoạch', 'Tiến triển', 'Hôm nay']) {
      await page.getByRole('tab', { name: tab }).click()
      await expect(
        companion.getByRole('button', { name: 'Mở rộng bạn đồng hành' }),
      ).toHaveAttribute('aria-expanded', 'false')
    }
    await page.reload()
    await expect(
      companion.getByRole('button', { name: 'Mở rộng bạn đồng hành' }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(requests.companionRequests()).toBe(0)
    expect(await companion.locator('[aria-live]').count()).toBe(0)

    const independentPage = await context.newPage()
    await independentPage.setViewportSize({ width: 375, height: 812 })
    await independentPage.goto('/support-plan')
    await expect(
      independentPage
        .getByRole('complementary', {
          name: 'Bạn đồng hành trong kế hoạch hỗ trợ',
        })
        .getByRole('button', { name: 'Thu gọn bạn đồng hành' }),
    ).toHaveAttribute('aria-expanded', 'true')
    await independentPage.close()

    await companion
      .getByRole('button', { name: 'Mở rộng bạn đồng hành' })
      .click()
    await companion
      .getByRole('button', { name: 'Tắt lời nhắc của bạn đồng hành' })
      .click()
    await expect(companion).toHaveAttribute('data-muted', 'true')
    await page.screenshot({
      path: 'docs/evidence/mb-653-companion-mobile-muted.png',
      fullPage: true,
      animations: 'disabled',
    })

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(companion).toHaveAttribute('data-motion', 'reduced')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    for (const button of await companion.getByRole('button').all()) {
      const box = await button.boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44)
    }
    await page.screenshot({
      path: 'docs/evidence/mb-653-companion-mobile-reduced-motion.png',
      fullPage: true,
      animations: 'disabled',
    })
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.screenshot({
      path: 'docs/evidence/mb-653-companion-desktop-muted-reduced-motion.png',
      fullPage: true,
      animations: 'disabled',
    })
    expect(requests.planMutations()).toBe(0)
  })

  test('keeps the plan authoritative through dependency failure and interruption zones', async ({
    page,
    context,
  }) => {
    await page.clock.install({ time: new Date('2026-10-13T13:00:00Z') })
    await context.addCookies([
      {
        name: 'mentalbridge_access',
        value: 'synthetic-mb273-e2e-access',
        url: 'http://127.0.0.1:3100',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])
    const requests = await installSupportPlanRoutes(context, {
      companionUnavailable: true,
    })
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/support-plan')

    const sourceAction = page.getByRole('link', { name: 'Ghi nhận cảm xúc' })
    await expect(sourceAction).toBeVisible()
    await page
      .getByRole('button', {
        name: 'Nhờ bạn đồng hành giải thích: Check-in cảm xúc',
      })
      .click()
    await expect(
      page
        .getByText(
          'Chưa thể tải lời giải thích lúc này. Bạn vẫn có thể tiếp tục hoạt động hoặc thử lại khi phù hợp.',
        )
        .first(),
    ).toBeVisible()
    await expect(sourceAction).toBeEnabled()
    expect(requests.companionRequests()).toBe(1)
    expect(requests.planMutations()).toBe(0)

    const companion = page.getByRole('complementary', {
      name: 'Bạn đồng hành trong kế hoạch hỗ trợ',
    })
    const tabPanel = page.getByRole('tabpanel', { name: 'Hôm nay' })
    const [companionBox, panelBox] = await Promise.all([
      companion.boundingBox(),
      tabPanel.boundingBox(),
    ])
    expect(
      (companionBox?.y ?? 0) + (companionBox?.height ?? 0),
    ).toBeLessThanOrEqual((panelBox?.y ?? 0) + 1)

    await page.getByRole('tab', { name: 'Điều chỉnh' }).click()
    const duration = page.getByRole('spinbutton', {
      name: 'Thời lượng dự kiến (phút)',
    })
    await duration.fill('10')
    const open = companion.getByRole('button', {
      name: 'Mở hướng dẫn có giới hạn',
    })
    await expect(open).toBeDisabled()
    await expect(companion).toHaveAttribute('data-interrupted', 'true')
    await page.getByRole('tab', { name: 'Kế hoạch' }).click()
    const confirmation = page.getByRole('dialog', {
      name: 'Rời phần đang chỉnh sửa?',
    })
    await expect(confirmation).toBeVisible()
    await expect(companion).toHaveAttribute('data-interrupted', 'true')
    await confirmation.getByRole('button', { name: 'Ở lại' }).click()
    await expect(duration).toHaveValue('10')
    await expect(open).toBeDisabled()
    expect(requests.planMutations()).toBe(0)

    await page.setViewportSize({ width: 640, height: 400 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
})
