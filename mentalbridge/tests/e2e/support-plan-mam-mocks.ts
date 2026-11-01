import type { Page } from '@playwright/test'

import {
  emotionOccurrenceFixture,
  nativeSupportPlanFixture,
} from '../../features/support-plan/testing/native-support-plan-fixture'

// An active plan with today's one open Emotion check-in, for the SupportPlan
// route in the Mầm specs (MB-772). The page itself is server-rendered behind
// the fixture identity server; everything the workspace reads is mocked here.

const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(),
  )

export async function installSupportPlanMocks(
  page: Page,
  options: Readonly<{
    companionUnavailable?: boolean
    companionDelayMs?: number
  }> = {},
) {
  const plan = nativeSupportPlanFixture()
  const date = today()
  const occurrence = {
    ...emotionOccurrenceFixture(),
    localDate: date,
    scheduledAt: `${date}T12:00:00Z`,
    displayState: 'SCHEDULED' as const,
  }
  const companionSurfaces: string[] = []
  let planMutations = 0

  await page.context().addCookies([
    {
      name: 'mentalbridge_access',
      value: 'synthetic-mb273-e2e-access',
      url: 'http://127.0.0.1:3100',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
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
      return problem(404, 'SUPPORT_PLAN_DRAFT_NOT_FOUND')
    if (path === '/api/care/v2/support-plans/history')
      return json({ items: [], hasMore: false, nextCursor: null })
    if (path === '/api/care/v2/support-plan-occurrences')
      return json({
        supportPlanId: plan.supportPlanId,
        supportPlanStatus: plan.status,
        representationMode: plan.representationMode,
        from: date,
        through: date,
        occurrences: [occurrence],
        interpretationCode:
          'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
      })
    if (path.endsWith('/companion-explanation')) {
      const { surface } = request.postDataJSON() as { surface: string }
      companionSurfaces.push(surface)
      if (options.companionDelayMs)
        await new Promise((done) => setTimeout(done, options.companionDelayMs))
      if (options.companionUnavailable)
        return problem(503, 'COMPANION_DEPENDENCY_UNAVAILABLE')
      return json({
        schemaVersion: 'support-plan-companion-message-v1',
        supportPlanId: plan.supportPlanId,
        actionId: occurrence.actionId,
        intent: 'EXPLAIN_ACTION',
        surface,
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
    return route.fallback()
  })

  return {
    companionSurfaces: () => [...companionSurfaces],
    planMutations: () => planMutations,
  }
}
