import { expect } from '@playwright/test'

import {
  emotionOccurrenceFixture,
  nativeSupportPlanFixture,
} from '../../features/support-plan/testing/native-support-plan-fixture'
import { test } from './test-fixtures'

test.describe('MB-651 guided SupportPlan Companion', () => {
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'The deterministic guided response belongs to the fixture browser gate.',
  )

  test('opens from context, handles a bounded follow-up, and navigates on desktop and mobile', async ({
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
    const basePlan = nativeSupportPlanFixture()
    const occurrence = emotionOccurrenceFixture()
    const secondActionId = '20000000-0000-4000-8000-000000000652'
    const secondOccurrenceId = '30000000-0000-4000-8000-000000000652'
    const secondScheduleId = '40000000-0000-4000-8000-000000000652'
    const firstAction = basePlan.focuses[0].actions[0]
    const secondAction = {
      ...firstAction,
      actionId: secondActionId,
      ordinal: 2,
      presentation: {
        ...firstAction.presentation,
        title: 'Thở chậm 3 phút',
      },
      schedules: firstAction.schedules.map((schedule) => ({
        ...schedule,
        scheduleId: secondScheduleId,
        localTime: '20:00',
      })),
    }
    const plan = {
      ...basePlan,
      focuses: basePlan.focuses.map((focus, index) =>
        index === 0
          ? { ...focus, actions: [...focus.actions, secondAction] }
          : focus,
      ),
    }
    const secondOccurrence = {
      ...occurrence,
      occurrenceId: secondOccurrenceId,
      actionId: secondActionId,
      scheduleId: secondScheduleId,
      scheduledAt: '2026-10-13T13:00:00Z',
    }
    const responseText =
      'Hoạt động này thuộc kế hoạch hiện tại và được giải thích trong phạm vi đã duyệt.'
    let companionRequests = 0
    const runtimeErrors: string[] = []
    page.on('pageerror', (error) => runtimeErrors.push(error.message))

    await page.route('**/api/**', async (route) => {
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
          occurrences: [occurrence, secondOccurrence],
          interpretationCode:
            'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
        })
      if (path.endsWith('/companion-explanation')) {
        companionRequests++
        expect(request.method()).toBe('POST')
        expect(request.postDataJSON()).toEqual({ surface: 'TODAY' })
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
    const open = page.getByRole('button', {
      name: 'Mở hướng dẫn có giới hạn',
    })
    await expect(open).toBeVisible()
    await open.click()
    const panel = page.getByRole('dialog', { name: 'Bạn đồng hành' })
    await expect(panel).toBeVisible()
    expect(companionRequests).toBe(0)
    await expect(panel.getByRole('textbox')).toHaveCount(0)

    await panel
      .getByRole('button', {
        name: 'Vì sao hoạt động này có trong kế hoạch?',
      })
      .click()
    await expect(panel.getByText(responseText)).toBeVisible()
    expect(companionRequests).toBe(1)

    const targetAction = page.locator(
      `[data-support-plan-action-id="${occurrence.actionId}"]`,
    )
    const otherAction = page.locator(
      `[data-support-plan-action-id="${secondActionId}"]`,
    )
    await expect(otherAction).toContainText('Thở chậm 3 phút')
    await panel.getByRole('button', { name: 'Mở hoạt động này' }).click()
    await expect(panel).toBeHidden()
    await expect(targetAction).toBeFocused()
    await expect(otherAction).not.toBeFocused()

    await open.click()

    await panel
      .getByRole('button', { name: 'Chỉ tôi nơi có thể điều chỉnh' })
      .click()
    const response = panel.locator('.support-plan-guided-response')
    await expect(response).toContainText(
      'Việc điều hướng không tự lưu hoặc thay đổi kế hoạch.',
    )
    await response.getByRole('button', { name: 'Đến mục Điều chỉnh' }).click()
    const adjustTab = page.getByRole('tab', { name: 'Điều chỉnh' })
    await expect(adjustTab).toHaveAttribute('aria-selected', 'true')
    await expect(adjustTab).toBeFocused()
    await expect(panel).toBeHidden()

    await page.getByRole('tab', { name: 'Hôm nay' }).click()
    await page.setViewportSize({ width: 375, height: 812 })
    await open.click()
    await expect(panel).toBeVisible()
    await expect(panel).toHaveCSS('position', 'static')
    await expect(panel).toHaveAttribute('aria-modal', 'true')
    const shell = page.locator('.support-plan-companion.is-panel-open')
    await expect(shell).toHaveCSS('position', 'fixed')
    const pageHeader = page.locator('.support-plan-page > header')
    await expect(pageHeader).toHaveAttribute('inert', '')
    const close = panel.getByRole('button', {
      name: 'Đóng hướng dẫn Bạn đồng hành',
    })
    const lastStarter = panel.getByRole('button', {
      name: 'Chỉ tôi nơi có thể điều chỉnh',
    })
    await expect(close).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(lastStarter).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(close).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()
    await expect(open).toBeFocused()
    await expect(pageHeader).not.toHaveAttribute('inert', '')

    await open.click()
    await expect(panel).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    for (const button of await panel.getByRole('button').all()) {
      const box = await button.boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }
    await page.screenshot({
      path: testInfo.outputPath('mb-651-mobile-guided-sheet.png'),
      fullPage: true,
      animations: 'disabled',
    })
    expect(runtimeErrors).toEqual([])
  })
})
