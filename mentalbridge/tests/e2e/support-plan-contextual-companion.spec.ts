import { expect } from '@playwright/test'

import {
  emotionOccurrenceFixture,
  nativeSupportPlanFixture,
} from '../../features/support-plan/testing/native-support-plan-fixture'
import { test } from './test-fixtures'

test.describe('MB-650 contextual SupportPlan Companion', () => {
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'The deterministic Companion response belongs to the fixture browser gate.',
  )

  test('requests from an eligible card and preserves its authoritative action on desktop and mobile', async ({
    page,
    context,
  }, testInfo) => {
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
    const plan = nativeSupportPlanFixture()
    const occurrence = emotionOccurrenceFixture()
    const responseText =
      'Hoạt động này giúp bạn ghi nhận cảm xúc do chính bạn lựa chọn.'
    let requests = 0
    let releaseFirstResponse: (() => void) | undefined
    const runtimeErrors: string[] = []
    page.on('pageerror', (error) => runtimeErrors.push(error.message))

    await page.route('**/api/**', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const path = url.pathname
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
        return problem(404, 'SUPPORT_PLAN_NOT_FOUND')
      if (path === '/api/care/v2/support-plans/history')
        return json({ items: [], hasMore: false, nextCursor: null })
      if (path === '/api/care/v2/support-plan-occurrences')
        return json({
          supportPlanId: plan.supportPlanId,
          supportPlanStatus: plan.status,
          representationMode: plan.representationMode,
          from: '2026-10-13',
          through: '2026-10-13',
          occurrences: [occurrence],
          interpretationCode:
            'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
        })
      if (
        path ===
        `/api/care/v2/support-plans/${plan.supportPlanId}/actions/${occurrence.actionId}/companion-explanation`
      ) {
        requests++
        expect(request.method()).toBe('POST')
        expect(request.postDataJSON()).toEqual({ surface: 'TODAY' })
        if (requests === 1)
          await new Promise<void>((resolve) => {
            releaseFirstResponse = resolve
          })
        return json({
          schemaVersion: 'support-plan-companion-message-v1',
          supportPlanId: plan.supportPlanId,
          actionId: occurrence.actionId,
          intent: 'EXPLAIN_ACTION',
          surface: 'TODAY',
          text: responseText,
          delivery: 'GENERATED',
          policyVersion: 'support-plan-companion-policy-v1',
          promptVersion: 'support-plan-companion-prompt-v1',
          templateVersion: 'support-plan-companion-template-v1',
          provider: 'OPENAI',
          model: 'fixture-model',
          fallbackReason: null,
        })
      }
      return route.continue()
    })

    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/support-plan')
    const activity = page.getByRole('article', {
      name: 'Check-in cảm xúc',
      exact: true,
    })
    const trigger = activity.getByRole('button', {
      name: /Nhờ bạn đồng hành giải thích/,
    })
    const originalAction = activity.getByRole('link', {
      name: 'Ghi nhận cảm xúc',
      exact: true,
    })
    await expect(activity).toBeVisible()
    await trigger.focus()
    expect(requests).toBe(0)
    await trigger.click()
    await expect(
      activity.getByText('Đang chuẩn bị lời giải thích…'),
    ).toBeVisible()
    await expect(originalAction).toBeEnabled()
    releaseFirstResponse?.()
    const desktopBubble = activity.locator('.support-plan-contextual-bubble')
    await expect(desktopBubble).toContainText(responseText)
    await expect(desktopBubble).toBeVisible()
    expect(requests).toBe(1)
    await page.screenshot({
      path: testInfo.outputPath('mb-650-desktop.png'),
      fullPage: true,
      animations: 'disabled',
    })

    await desktopBubble
      .getByRole('button', { name: 'Đóng lời giải thích' })
      .click()
    await expect(trigger).toBeFocused()
    await page.setViewportSize({ width: 375, height: 812 })
    await trigger.click()
    const mobileTray = page.locator('.support-plan-companion-contextual-tray')
    await expect(mobileTray).toContainText(responseText)
    await expect(mobileTray).toBeVisible()
    await expect(desktopBubble).toBeHidden()
    await expect(originalAction).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    expect(
      await trigger.evaluate((button) => {
        const rect = button.getBoundingClientRect()
        return rect.width >= 44 && rect.height >= 44
      }),
    ).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath('mb-650-mobile.png'),
      fullPage: true,
      animations: 'disabled',
    })
    await originalAction.click()
    await expect(page).toHaveURL(
      new RegExp(
        `/dashboard\\?occurrenceId=${occurrence.occurrenceId}&actionId=${occurrence.actionId}`,
      ),
    )
    expect(runtimeErrors).toEqual([])
  })
})
