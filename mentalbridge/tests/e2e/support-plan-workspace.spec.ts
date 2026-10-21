import { expect, type Page, type Route } from '@playwright/test'
import { test } from './test-fixtures'
import type {
  ActionOccurrence,
  AdaptiveSupportPlanReview,
  NativeSupportPlanReplacementReview,
  PlanAction,
  SupportPlanV3,
} from '../../features/support-plan/api/support-plan-contract'
import { nativeSupportPlanReviewFixture } from '../../features/support-plan/testing/native-support-plan-review-fixture'
import { adaptiveReviewFixture } from '../../features/support-plan/testing/adaptive-review-fixture'
import {
  emotionActionId,
  emotionOccurrenceFixture,
  emotionOccurrenceId,
  nativeSupportPlanFixture,
} from '../../features/support-plan/testing/native-support-plan-fixture'
import {
  completeResourceReflection,
  mockResourceCompletionDetail,
  resourceCompletionHref,
  resourceCompletionWorld,
} from './resource-completion-mocks'

const today = '2026-10-13'
const evaluationId = '90000000-0000-4000-8000-000000000669'
const resourceActionId = 'b1000000-0000-4000-8000-000000000644'
const resourceOccurrenceId = 'b2000000-0000-4000-8000-000000000644'
const resourceId = 'b3000000-0000-4000-8000-000000000644'

type Cycle = NonNullable<SupportPlanV3['cycle']>

function cycle(overrides: Partial<Cycle> = {}): Cycle {
  return {
    policyVersion: 'support-plan-cycle-v1',
    lengthDays: 14,
    timezone: 'Asia/Ho_Chi_Minh',
    cycleNumber: 1,
    startedOn: today,
    reviewDueOn: '2026-10-26',
    currentDay: 1,
    pausedDays: 0,
    state: 'IN_PROGRESS',
    ...overrides,
  }
}

function resourceAction(): PlanAction {
  const base = nativeSupportPlanFixture().focuses[0].actions[0]
  return {
    ...base,
    actionId: resourceActionId,
    actionType: 'RESOURCE',
    purposeCode: 'PRACTISE_CALM_BREATHING',
    rationale: 'Một bài thở ngắn giúp bạn chậm lại khi lo âu tăng lên.',
    ordinal: 2,
    source: {
      ownerDomain: 'CONTENT',
      sourceKind: 'RESOURCE_VERSION',
      sourceId: resourceId,
      sourceRevision: '3',
      sourcePolicyVersion: null,
      publicationId: null,
      eligibilityPolicyVersion: null,
      verifiedAt: '2026-10-13T05:00:00Z',
    },
    presentation: {
      title: 'Thở chậm 3 phút',
      summary: 'Bài thở có hướng dẫn.',
      instructions: null,
      externalUrl: null,
    },
    schedules: [
      {
        ...base.schedules[0],
        scheduleId: 'b4000000-0000-4000-8000-000000000644',
        localTime: '08:00',
        estimatedDurationMinutes: 5,
      },
    ],
  }
}

function proposalPlan(): SupportPlanV3 {
  const base = nativeSupportPlanFixture()
  return {
    ...base,
    planPolicyVersion: 'support-plan-proposal-v1',
    focuses: [
      {
        ...base.focuses[0],
        actions: [...base.focuses[0].actions, resourceAction()],
      },
    ],
    cycle: cycle(),
  }
}

function draftOf(plan: SupportPlanV3): SupportPlanV3 {
  return {
    ...plan,
    status: 'DRAFT',
    version: 0,
    activatedAt: null,
    cycle: cycle({
      state: 'NOT_STARTED',
      startedOn: null,
      reviewDueOn: null,
      currentDay: null,
    }),
    focuses: plan.focuses.map((focus) => ({
      ...focus,
      actions: focus.actions.map((action) => ({
        ...action,
        status: 'DRAFT' as const,
        activatedAt: null,
      })),
    })),
  }
}

function resourceOccurrence(
  overrides: Partial<ActionOccurrence> = {},
): ActionOccurrence {
  return {
    ...emotionOccurrenceFixture(),
    occurrenceId: resourceOccurrenceId,
    actionId: resourceActionId,
    actionType: 'RESOURCE',
    scheduleId: 'b4000000-0000-4000-8000-000000000644',
    scheduledAt: '2026-10-13T01:00:00Z',
    displayState: 'SCHEDULED',
    ...overrides,
  } as ActionOccurrence
}

const personalization = {
  personalizationId: null,
  schemaVersion: 'support-plan-personalization-v1',
  revision: 0,
  status: 'NOT_PROVIDED',
  preferredFocus: null,
  desiredPace: null,
  dailyTimeBudgetMinutes: null,
  preferredDaypart: null,
  preferredActivityModes: [],
  commonBarriers: [],
  submittedAt: null,
  planReview: {
    required: false,
    supportPlanId: null,
    supportPlanVersion: null,
    reasonCode: null,
  },
}

type World = {
  current?: SupportPlanV3
  draft?: SupportPlanV3
  history: SupportPlanV3[]
  occurrences: ActionOccurrence[]
  journeyNext: string
  failCurrentOnce?: boolean
  proposeStatus?: number
  reconcile?: () => { status: number; recorded: boolean }
  stateStatus?: number
  replacementDraft?: SupportPlanV3
  replacementReview?: NativeSupportPlanReplacementReview
  reassessmentSummaryId?: string
  adaptiveReview?: AdaptiveSupportPlanReview
}

/** Care's adaptive review for the world's current plan (synthetic fixture period, not real days). */
function adaptiveReviewFor(plan: SupportPlanV3): AdaptiveSupportPlanReview {
  return {
    ...adaptiveReviewFixture(),
    supportPlanId: plan.supportPlanId,
    planVersion: plan.version,
    cycle: plan.cycle ?? null,
  }
}

async function authenticate(page: Page) {
  await page.clock.install({ time: new Date('2026-10-13T05:00:00Z') })
  await page.context().addCookies([
    {
      name: 'mentalbridge_access',
      value: 'synthetic-mb273-e2e-access',
      url: 'http://127.0.0.1:3100',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
}

async function mockPlanApi(page: Page, world: World) {
  const calls: Array<{
    method: string
    path: string
    headers: Record<string, string>
    body: unknown
  }> = []
  await page.route('**/api/**', async (route: Route) => {
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
      json(
        {
          type: 'about:blank',
          title: 'Controlled',
          status,
          code,
          correlationId: '62cda42f-b286-43c6-aa48-88ef64ff3361',
        },
        status,
      )
    if (!path.startsWith('/api/care/')) return route.continue()
    calls.push({
      method: request.method(),
      path,
      headers: request.headers(),
      body: request.postData() ? request.postDataJSON() : undefined,
    })
    if (path === '/api/care/v2/support-plans/current') {
      if (world.failCurrentOnce) {
        world.failCurrentOnce = false
        return problem(503, 'CARE_UNAVAILABLE')
      }
      return world.current
        ? json(world.current)
        : problem(404, 'SUPPORT_PLAN_NOT_FOUND')
    }
    if (path === '/api/care/v2/support-plans/current-draft')
      return world.draft
        ? json(world.draft)
        : problem(404, 'SUPPORT_PLAN_DRAFT_NOT_FOUND')
    if (path === '/api/care/v2/support-plans/history')
      return json({ items: world.history, hasMore: false, nextCursor: null })
    if (path === '/api/care/guided-journey')
      return json({
        journeyPolicyVersion: 'mb-guided-journey-v1',
        stage: 'GUIDE_READY',
        assessmentInProgress: false,
        episodeId: '80000000-0000-4000-8000-000000000669',
        episodeCompletedAt: '2026-10-13T01:00:00Z',
        presentationEvaluationId: evaluationId,
        supportGuideId: 'a0000000-0000-4000-8000-000000000669',
        nextAction: world.journeyNext,
        currentSupportPlanId: world.current?.supportPlanId ?? null,
        entitlementStatus: 'VERIFIED',
      })
    if (path === '/api/care/v2/support-plans/evaluation-source')
      return json({
        sourceSupportEvaluationId:
          url.searchParams.get('purpose') === 'REASSESSMENT'
            ? '90000000-0000-4000-8000-000000000652'
            : evaluationId,
      })
    if (path === '/api/care/reassessment-summaries/current')
      return world.reassessmentSummaryId
        ? json({ summaryId: world.reassessmentSummaryId })
        : problem(404, 'REASSESSMENT_SUMMARY_NOT_FOUND')
    if (path === '/api/care/support-plan-personalization')
      return json(personalization)
    if (path === '/api/care/v2/support-plans' && request.method() === 'POST') {
      if (world.proposeStatus)
        return problem(world.proposeStatus, 'SUPPORT_PLAN_ENTITLEMENT_REQUIRED')
      world.draft = world.replacementDraft ?? draftOf(proposalPlan())
      return json(world.draft, 201)
    }
    if (path.endsWith('/replacement-review') && world.replacementReview)
      return json(world.replacementReview)
    if (path.endsWith('/activate') && world.draft) {
      world.current = proposalPlan()
      world.draft = undefined
      return json(world.current)
    }
    if (path.endsWith('/status') && world.current) {
      const status = (
        request.postDataJSON() as { status: SupportPlanV3['status'] }
      ).status
      world.current = {
        ...world.current,
        status,
        version: world.current.version + 1,
        cycle: world.current.cycle && cycle(),
      }
      return json(world.current)
    }
    if (
      path.endsWith('/adaptive-review') &&
      request.method() === 'GET' &&
      world.current
    )
      return json(world.adaptiveReview ?? adaptiveReviewFor(world.current))
    if (path.endsWith('/adaptive-review/confirm') && world.current) {
      const { optionId } = request.postDataJSON() as { optionId: string }
      world.current = {
        ...world.current,
        version: world.current.version + 1,
        cycle: cycle({ cycleNumber: 2 }),
      }
      return json({
        result: 'CYCLE_CONTINUED',
        optionId,
        plan: world.current,
        draft: null,
      })
    }
    if (path.endsWith('/cycle-continuation') && world.current) {
      world.current = {
        ...world.current,
        version: world.current.version + 1,
        cycle: cycle({ cycleNumber: 2 }),
      }
      return json(world.current)
    }
    if (path === '/api/care/v2/support-plan-occurrences')
      return world.current
        ? json({
            supportPlanId: world.current.supportPlanId,
            supportPlanStatus: world.current.status,
            representationMode: world.current.representationMode,
            from: url.searchParams.get('from'),
            through: url.searchParams.get('through'),
            occurrences: world.occurrences,
            interpretationCode:
              'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
          })
        : problem(404, 'SUPPORT_PLAN_NOT_FOUND')
    const occurrenceCommand =
      /^\/api\/care\/v2\/support-plan-occurrences\/([^/]+)\/(state|engagement|emotion-check-in\/reconcile)$/.exec(
        path,
      )
    if (occurrenceCommand) {
      const [, id, command] = occurrenceCommand
      const index = world.occurrences.findIndex(
        (item) => item.occurrenceId === id,
      )
      const item = world.occurrences[index]
      if (command === 'state') {
        if (world.stateStatus)
          return problem(world.stateStatus, 'OCCURRENCE_VERSION_MISMATCH')
        const state = (
          request.postDataJSON() as { state: ActionOccurrence['state'] }
        ).state
        const next = {
          ...item,
          state,
          displayState: state,
          version: item.version + 1,
          completionEvidence:
            state === 'COMPLETED'
              ? {
                  kind: 'USER_ACKNOWLEDGEMENT',
                  ownerDomain: 'CARE',
                  factId: id,
                  factRevision: null,
                  occurredAt: '2026-10-13T05:01:00Z',
                  verifiedAt: '2026-10-13T05:01:00Z',
                }
              : null,
          outcomeRecordedAt:
            state === 'COMPLETED' ? '2026-10-13T05:01:00Z' : null,
        } as ActionOccurrence
        world.occurrences[index] = next
        return json(next)
      }
      if (command === 'engagement') {
        const next = {
          ...item,
          ...(request.postDataJSON() as object),
          version: item.version + 1,
        } as ActionOccurrence
        world.occurrences[index] = next
        return json(next)
      }
      const outcome = world.reconcile?.() ?? { status: 200, recorded: false }
      if (outcome.status !== 200)
        return problem(outcome.status, 'EMOTION_CHECK_IN_EVIDENCE_UNAVAILABLE')
      const completed = outcome.recorded
      const next = {
        ...item,
        state: completed ? 'COMPLETED' : item.state,
        displayState: completed ? 'COMPLETED' : item.displayState,
        version: completed ? item.version + 1 : item.version,
      } as ActionOccurrence
      world.occurrences[index] = next
      return json({
        schemaVersion: 'emotion-check-in-occurrence-reconciliation-v1',
        occurrenceId: id,
        actionId: item.actionId,
        localDate: item.localDate,
        sourceState: completed ? 'RECORDED' : 'MISSING',
        occurrenceState: next.state,
        version: next.version,
        completionEvidence: completed
          ? {
              kind: 'EMOTION_CHECK_IN',
              ownerDomain: 'JOURNAL_AI',
              factId: '70000000-0000-4000-8000-000000000641',
              factRevision: '1',
              occurredAt: '2026-10-13T05:00:00Z',
              verifiedAt: '2026-10-13T05:01:00Z',
            }
          : null,
        completedAt: completed ? '2026-10-13T05:01:00Z' : null,
      })
    }
    if (
      path.startsWith('/api/care/v2/') ||
      path.startsWith('/api/care/support-plans')
    )
      return problem(404, 'NOT_MOCKED')
    return route.continue()
  })
  return calls
}

async function noHorizontalScroll(
  page: Page,
  name: string,
  outputPath: (name: string) => string,
) {
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [768, 1024],
    [375, 812],
  ]) {
    await page.setViewportSize({ width, height })
    await page.evaluate(() => document.fonts.ready)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      `${name} ${width}x${height}`,
    ).toBe(false)
    await page.screenshot({
      path: outputPath(`${name}-${width}x${height}.png`),
      fullPage: true,
      animations: 'disabled',
    })
  }
  await page.setViewportSize({ width: 1280, height: 800 })
}

test.describe('MB-644 + MB-669 unified plan workspace', () => {
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'Controlled plan states must not mutate shared accounts.',
  )

  test('MB-670 a saved Resource practice reconciles with its pinned version and Today shows accepted completion without undo', async ({
    page,
  }) => {
    await authenticate(page)
    const resourceWorld = resourceCompletionWorld(today)
    const world: World = {
      ...resourceWorld,
      history: [],
      journeyNext: 'OPEN_CURRENT_PLAN',
    }
    const calls = await mockPlanApi(page, world)
    const detail = await mockResourceCompletionDetail(page, world)
    await page.goto('/support-plan')
    const openResource = page.getByRole('link', { name: 'Mở nội dung' })
    const href = new URL(
      (await openResource.getAttribute('href'))!,
      'http://127.0.0.1:3100',
    )
    expect(Object.fromEntries(href.searchParams)).toMatchObject({
      from: 'support-plan',
      contentVersion: '4',
      localDate: today,
    })
    await openResource.click()
    await expect(page).toHaveURL(href.toString())
    await expect(
      page.getByRole('heading', {
        name: 'Viết vài dòng dịu dàng',
        level: 1,
        exact: true,
      }),
    ).toBeVisible()
    expect(new Set(detail.reads)).toEqual(new Set(['4']))
    expect(detail.reconciles).toHaveLength(0)
    await completeResourceReflection(page)
    await expect(
      page.getByText('Đã ghi nhận vào kế hoạch hôm nay.', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('Đã ghi nhận từ bài luyện tập', { exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByText(/Kết quả hoàn thành đã được ghi nhận/),
    ).toHaveCount(0)
    expect(detail.saves.at(-1)).toMatchObject({
      status: 'COMPLETED',
      resourceVersion: '4',
    })
    expect(detail.reconciles).toEqual([{ ifMatch: '"3"' }])
    await page
      .getByRole('link', { name: 'Quay lại kế hoạch', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Đã ghi nhận hôm nay' }),
    ).toBeVisible()
    await expect(
      page.getByText('Đã ghi nhận từ bài luyện tập', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', {
        name: /Làm lại hôm nay|Hoàn tác|Đã làm xong/,
      }),
    ).toHaveCount(0)
    expect(calls.filter((call) => call.path.endsWith('/state'))).toHaveLength(0)
    await page.getByRole('tab', { name: 'Tiến triển' }).click()
    await expect(
      page.getByText('Đã ghi nhận từ bài luyện tập', { exact: true }),
    ).toBeVisible()
  })

  test('MB-670 reconcile 503 preserves the Content save and open occurrence until an explicit retry succeeds', async ({
    page,
  }) => {
    await authenticate(page)
    const resourceWorld = resourceCompletionWorld(today)
    const world: World & { reconcileStatus: number } = {
      ...resourceWorld,
      reconcileStatus: 503,
      history: [],
      journeyNext: 'OPEN_CURRENT_PLAN',
    }
    await mockPlanApi(page, world)
    const detail = await mockResourceCompletionDetail(page, world)
    await page.goto(resourceCompletionHref(today))
    await completeResourceReflection(page)
    await expect(
      page.getByText(
        'Đã lưu bài luyện tập. Kế hoạch sẽ cập nhật khi kết nối lại.',
      ),
    ).toBeVisible()
    await expect(
      page.getByText('Đã ghi nhận vào kế hoạch hôm nay.', { exact: true }),
    ).toHaveCount(0)
    expect(world.occurrences[0].state).toBe('SCHEDULED')
    const saveCount = detail.saves.length
    world.reconcileStatus = 200
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
    await expect(
      page.getByText('Đã ghi nhận vào kế hoạch hôm nay.', { exact: true }),
    ).toBeVisible()
    expect(detail.saves).toHaveLength(saveCount)
    expect(detail.reconciles).toHaveLength(2)
    await page
      .getByRole('link', { name: 'Quay lại kế hoạch', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Đã ghi nhận hôm nay' }),
    ).toBeVisible()
  })

  test('MB-670 missing Resource evidence keeps acknowledgement available on return', async ({
    page,
  }) => {
    await authenticate(page)
    const world = {
      ...resourceCompletionWorld(today),
      reconcileStatus: 409,
      history: [],
      journeyNext: 'OPEN_CURRENT_PLAN',
    }
    await mockPlanApi(page, world)
    await mockResourceCompletionDetail(page, world)
    await page.goto(resourceCompletionHref(today))
    await completeResourceReflection(page)
    await expect(
      page.getByText(
        'Đã lưu bài luyện tập. Bạn có thể xác nhận trong kế hoạch.',
      ),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Xem trong kế hoạch' }).click()
    await expect(
      page.getByRole('button', { name: 'Đã làm xong', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Đã ghi nhận hôm nay' }),
    ).toHaveCount(0)
  })

  test('MB-670 a historical Resource occurrence never offers automatic reconciliation', async ({
    page,
  }) => {
    await authenticate(page)
    const past = '2026-10-12'
    const world: World = {
      ...resourceCompletionWorld(past),
      history: [],
      journeyNext: 'OPEN_CURRENT_PLAN',
    }
    await mockPlanApi(page, world)
    const detail = await mockResourceCompletionDetail(page, world)
    await page.goto(resourceCompletionHref(past))
    await completeResourceReflection(page)
    expect(detail.reconciles).toHaveLength(0)
    expect(world.occurrences[0].state).toBe('SCHEDULED')
    await expect(
      page.getByText('Đã ghi nhận từ bài luyện tập', { exact: true }),
    ).toHaveCount(0)
  })

  test('MB-669 prepares a 14-day proposal without a generate button and starts only on request', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000)
    await authenticate(page)
    const world: World = {
      history: [],
      occurrences: [],
      journeyNext: 'START_PLAN_PROPOSAL',
    }
    const calls = await mockPlanApi(page, world)
    await page.goto('/support-plan')
    await expect(
      page.getByRole('heading', { name: 'Kế hoạch 14 ngày dành cho bạn' }),
    ).toBeVisible()
    await expect(page.getByText('Việc đầu tiên')).toBeVisible()
    await expect(page.getByText(/Khoảng \d+ phút mỗi ngày/)).toBeVisible()
    const proposals = calls.filter(
      (call) =>
        call.method === 'POST' && call.path === '/api/care/v2/support-plans',
    )
    expect(proposals).toHaveLength(1)
    expect(proposals[0].headers['idempotency-key']).toBe(
      `auto-proposal-${evaluationId}-p0`,
    )
    expect(calls.some((call) => call.path.endsWith('/activate'))).toBe(false)
    await expect(
      page.getByRole('button', { name: /tạo kế hoạch/i }),
    ).toHaveCount(0)
    await noHorizontalScroll(page, 'proposal', (name) =>
      testInfo.outputPath(name),
    )
    await page.setViewportSize({ width: 375, height: 812 })
    await expect(
      page.getByRole('button', { name: 'Bắt đầu kế hoạch' }),
    ).toBeInViewport()
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.getByRole('button', { name: 'Bắt đầu kế hoạch' }).click()
    await expect(page.getByRole('tab', { name: 'Hôm nay' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByText('Ngày 1/14')).toBeVisible()
    const activation = calls.find((call) => call.path.endsWith('/activate'))
    expect(activation?.headers['if-match']).toBe('"0"')
  })

  test('MB-644 Today sends one resource to its owner and confirms only after the user returns', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000)
    await authenticate(page)
    const world: World = {
      current: proposalPlan(),
      history: [],
      occurrences: [
        resourceOccurrence(),
        { ...emotionOccurrenceFixture(), displayState: 'SCHEDULED' },
      ],
      journeyNext: 'OPEN_CURRENT_PLAN',
    }
    const calls = await mockPlanApi(page, world)
    await page.goto('/support-plan')
    const next = page.getByRole('region', { name: 'Thở chậm 3 phút' })
    await expect(next).toBeVisible()
    const open = next.getByRole('link', { name: /Mở nội dung/ })
    const href = new URL(
      (await open.getAttribute('href')) ?? '',
      'http://localhost',
    )
    expect(href.pathname).toBe(`/resources/${resourceId}`)
    expect(Object.fromEntries(href.searchParams)).toMatchObject({
      from: 'support-plan',
      contentVersion: '3',
      occurrenceId: resourceOccurrenceId,
      actionId: resourceActionId,
      localDate: today,
    })
    expect((await open.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
    await expect(
      page.getByRole('heading', { name: 'Sau đó trong hôm nay' }),
    ).toBeVisible()
    await noHorizontalScroll(page, 'today', (name) => testInfo.outputPath(name))
    await page.goto(
      `/support-plan?source=resource&occurrenceId=${resourceOccurrenceId}&actionId=${resourceActionId}&localDate=${today}`,
    )
    const confirm = page
      .getByRole('region', { name: 'Thở chậm 3 phút' })
      .getByRole('button', { name: 'Đã làm xong' })
    await expect(confirm).toBeVisible()
    expect(calls.filter((call) => call.path.endsWith('/state'))).toHaveLength(0)
    await confirm.click()
    await expect(
      page.getByRole('heading', { name: 'Đã ghi nhận hôm nay' }),
    ).toBeVisible()
    const state = calls.find((call) => call.path.endsWith('/state'))
    expect(state?.body).toEqual({ state: 'COMPLETED' })
    await page
      .getByRole('group', { name: /có giúp bạn không/i })
      .getByRole('button', { name: 'Có' })
      .click()
    await expect
      .poll(
        () => calls.filter((call) => call.path.endsWith('/engagement')).length,
      )
      .toBe(1)
    await page.getByRole('tab', { name: 'Tiến triển' }).click()
    await expect(page.getByText('1 lần đã làm')).toBeVisible()
    await expect(page.locator('.mbw-page')).not.toContainText('%')
  })

  test('MB-644 an emotion return is checked once and never shown as done without evidence', async ({
    page,
  }) => {
    await authenticate(page)
    let attempts = 0
    const world: World = {
      current: nativeSupportPlanFixture(),
      history: [],
      occurrences: [
        { ...emotionOccurrenceFixture(), displayState: 'SCHEDULED' },
      ],
      journeyNext: 'OPEN_CURRENT_PLAN',
      reconcile: () =>
        ++attempts === 1
          ? { status: 503, recorded: false }
          : { status: 200, recorded: true },
    }
    await mockPlanApi(page, world)
    const back = `/support-plan?occurrenceId=${emotionOccurrenceId}&actionId=${emotionActionId}&localDate=${today}`
    await page.goto(back)
    const next = page.getByRole('region', { name: 'Check-in cảm xúc' })
    await expect(next.getByText(/Chưa thực hiện được/)).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Đã ghi nhận hôm nay' }),
    ).toHaveCount(0)
    expect(attempts).toBe(1)
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Đã ghi nhận hôm nay' }),
    ).toBeVisible()
    await expect(page.getByText('Đã xong', { exact: true })).toBeVisible()
    expect(attempts).toBe(2)
  })

  test('MB-644 paused plans resume first and the 14-day review keeps the plan only on request', async ({
    page,
  }) => {
    await authenticate(page)
    const world: World = {
      current: {
        ...proposalPlan(),
        status: 'PAUSED',
        cycle: cycle({ state: 'PAUSED', pausedDays: 2 }),
      },
      history: [],
      occurrences: [],
      journeyNext: 'OPEN_CURRENT_PLAN',
    }
    const calls = await mockPlanApi(page, world)
    await page.goto('/support-plan')
    await expect(
      page.getByRole('heading', { name: 'Kế hoạch đang tạm dừng' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Tiếp tục kế hoạch' }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Tiếp tục' })
      .click()
    await expect
      .poll(() => calls.find((call) => call.path.endsWith('/status'))?.body)
      .toEqual({ status: 'ACTIVE' })

    world.current = {
      ...proposalPlan(),
      cycle: cycle({ state: 'REVIEW_DUE', currentDay: 14 }),
    }
    await page.goto('/support-plan')
    await expect(
      page.getByRole('heading', { name: 'Đến lúc cùng xem lại kế hoạch' }),
    ).toBeVisible()
    expect(
      calls.some((call) => call.path.endsWith('/cycle-continuation')),
    ).toBe(false)
    await page.getByRole('button', { name: /Xem lại kế hoạch/ }).click()
    // MB-645: the review shows separate sources and applies nothing until an explicit choice.
    await expect(page.getByLabel('Những gì đã ghi nhận')).toBeVisible()
    await expect(
      page.getByText(/Hai bài sàng lọc đang đi theo hai hướng khác nhau/),
    ).toBeVisible()
    expect(
      calls.some((call) => call.path.endsWith('/adaptive-review/confirm')),
    ).toBe(false)
    await page.getByRole('radio', { name: /Giữ nhịp này thêm 14 ngày/ }).check()
    await page
      .getByRole('button', { name: 'Giữ nhịp này thêm 14 ngày' })
      .click()
    await expect
      .poll(
        () =>
          calls.filter((call) => call.path.endsWith('/adaptive-review/confirm'))
            .length,
      )
      .toBe(1)
    const confirm = calls.find((call) =>
      call.path.endsWith('/adaptive-review/confirm'),
    )
    expect(confirm?.headers['if-match']).toBe(`"${proposalPlan().version}"`)
    expect(confirm?.headers['idempotency-key']).toBeTruthy()
    expect(confirm?.body).toMatchObject({ optionId: 'keep-current-1' })
    expect(
      calls.some((call) => call.path.endsWith('/cycle-continuation')),
    ).toBe(false)
    await expect(
      page.getByRole('heading', { name: 'Đến lúc cùng xem lại kế hoạch' }),
    ).toHaveCount(0)
  })

  test('MB-644 load errors, stale commands and the FREE tier stay truthful', async ({
    page,
  }) => {
    await authenticate(page)
    const world: World = {
      current: nativeSupportPlanFixture(),
      history: [],
      occurrences: [
        { ...emotionOccurrenceFixture(), displayState: 'SCHEDULED' },
      ],
      journeyNext: 'OPEN_CURRENT_PLAN',
      failCurrentOnce: true,
      stateStatus: 412,
    }
    await mockPlanApi(page, world)
    await page.goto('/support-plan')
    await expect(
      page.getByRole('heading', { name: 'Chưa tải được kế hoạch' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Thử lại' }).click()
    const next = page.getByRole('region', { name: 'Check-in cảm xúc' })
    await expect(next).toBeVisible()
    await next.getByRole('button', { name: 'Để hôm khác' }).click()
    await expect(
      next.getByText(/Kế hoạch vừa thay đổi ở nơi khác/),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Đã ghi nhận hôm nay' }),
    ).toHaveCount(0)

    world.current = undefined
    world.proposeStatus = 403
    world.journeyNext = 'START_PLAN_PROPOSAL'
    await page.goto('/support-plan')
    await expect(
      page.getByRole('heading', { name: 'Kế hoạch 14 ngày có trong gói Plus' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Bắt đầu kế hoạch' }),
    ).toHaveCount(0)
  })

  test('MB-671 FREE sees a labelled example, upgrades and continues to a real proposal', async ({
    page,
  }, testInfo) => {
    await authenticate(page)
    const world: World = {
      history: [],
      occurrences: [],
      journeyNext: 'START_PLAN_PROPOSAL',
    }
    const calls = await mockPlanApi(page, world)
    // Consultation's own answer; flipped once the payment would be confirmed.
    let paid = false
    await page.route('**/api/consultation/service-credits', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          accountId: '6a000000-0000-4000-8000-000000000671',
          packageCode: paid ? 'PLUS' : 'FREE',
          source: paid ? 'PAID' : 'DEFAULT_FREE',
          sourceReference: paid ? '51500000-0000-4000-8000-000000000671' : null,
          periodStart: paid ? '2026-10-13T00:00:00Z' : null,
          periodEnd: paid ? '2026-11-13T00:00:00Z' : null,
          policyVersion: 'consultation-credit-v2',
          balance: {
            available: 0,
            held: 0,
            consumed: 0,
            forfeited: 0,
            total: 0,
            releasedTransitions: 0,
          },
          reservationCapacity: { active: 0, maximum: 0, remaining: 0 },
          history: [],
          generatedAt: '2026-10-13T05:00:00Z',
          entitlementState: paid ? 'ACTIVE' : 'DEFAULT_FREE',
          supportPlanEnabled: paid,
        }),
      }),
    )

    await page.goto('/support-plan')
    const sample = page.getByRole('figure', {
      name: 'Ví dụ minh hoạ, không phải kế hoạch của bạn',
    })
    await expect(sample).toBeVisible()
    await sample.getByRole('button', { name: /Đọc một bài ngắn/ }).click()
    await expect(sample).toContainText('5 việc đã làm')
    await page.screenshot({
      path: testInfo.outputPath('mb-671-free-preview.png'),
      fullPage: true,
    })
    expect(
      calls.some(
        (call) =>
          call.method === 'POST' && call.path === '/api/care/v2/support-plans',
      ),
    ).toBe(false)

    await page.reload()
    await expect(sample).toBeVisible()
    expect(
      calls.filter(
        (call) =>
          call.method === 'POST' && call.path === '/api/care/v2/support-plans',
      ),
    ).toHaveLength(0)

    await page.getByRole('link', { name: 'Nâng cấp Plus' }).click()
    await expect(page).toHaveURL(/\/subscription$/)
    await expect(
      page.getByRole('link', { name: /Tiếp tục tới kế hoạch/ }),
    ).toHaveCount(0)

    paid = true
    await page.reload()
    await page.getByRole('link', { name: /Tiếp tục tới kế hoạch/ }).click()
    await expect(page).toHaveURL(/\/support-plan$/)
    await expect(
      page.getByRole('button', { name: 'Bắt đầu kế hoạch' }),
    ).toBeVisible()
    expect(
      calls.filter(
        (call) =>
          call.method === 'POST' && call.path === '/api/care/v2/support-plans',
      ),
    ).toHaveLength(1)
    expect(calls.some((call) => call.path.endsWith('/activate'))).toBe(false)
  })

  test('MB-652 explains a contradictory adaptive review without mutating the plan', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000)
    await authenticate(page)
    const review = nativeSupportPlanReviewFixture()
    const currentAction = review.currentPlan.focuses[0].actions[0]
    const proposedAction = review.proposedPlan.focuses[0].actions[0]
    proposedAction.presentation.title = currentAction.presentation.title
    const currentSchedule = currentAction.schedules[0]
    currentSchedule.estimatedDurationMinutes = 20
    currentSchedule.recurrenceType = 'DAILY'
    currentSchedule.preferredDaypart = 'MORNING'
    currentSchedule.localTime = '08:00'
    const proposedSchedule = proposedAction.schedules[0]
    proposedSchedule.estimatedDurationMinutes = 10
    proposedSchedule.recurrenceType = 'WEEKLY'
    proposedSchedule.daysOfWeek = [1, 3, 5]
    proposedSchedule.preferredDaypart = 'EVENING'
    proposedSchedule.localTime = '19:00'
    const world: World = {
      current: review.currentPlan,
      replacementDraft: review.proposedPlan,
      replacementReview: review,
      reassessmentSummaryId: review.reassessmentSummary.summaryId,
      history: [],
      occurrences: [],
      journeyNext: 'OPEN_CURRENT_PLAN',
    }
    const calls = await mockPlanApi(page, world)

    await page.goto('/support-plan')
    await page.getByRole('tab', { name: 'Điều chỉnh' }).click()
    await page.getByText('Phương án khác', { exact: true }).click()
    await page.getByRole('button', { name: 'Xem phương án mới' }).click()
    await page
      .getByRole('button', { name: 'So sánh với kế hoạch hiện tại' })
      .click()

    await page.getByRole('button', { name: 'Mở hướng dẫn có giới hạn' }).click()
    const panel = page.getByRole('dialog', { name: 'Bạn đồng hành' })
    await panel
      .getByRole('button', {
        name: 'Vì sao lần xem lại này gợi ý thay đổi?',
      })
      .click()

    await expect(
      panel.getByRole('heading', { name: 'Điều MentalBridge đã ghi nhận' }),
    ).toBeVisible()
    await expect(
      panel.getByText('PHQ-9: thấp hơn giai đoạn trước.'),
    ).toBeVisible()
    await expect(
      panel.getByText('GAD-7: cao hơn giai đoạn trước.'),
    ).toBeVisible()
    await expect(
      panel.getByText(/Các tín hiệu chưa hoàn toàn cùng chiều/),
    ).toBeVisible()
    await expect(
      panel.getByText(
        '“Check-in cảm xúc”: thời lượng mỗi lần từ 20 phút thành 10 phút.',
      ),
    ).toBeVisible()
    await expect(
      panel.getByText(
        '“Check-in cảm xúc”: nhịp từ mỗi ngày thành 3 ngày mỗi tuần (Thứ Hai, Thứ Tư và Thứ Sáu).',
      ),
    ).toBeVisible()
    await expect(
      panel.getByText(
        '“Check-in cảm xúc”: thời điểm từ buổi sáng (08:00) sang buổi tối (19:00).',
      ),
    ).toBeVisible()
    await expect(panel.getByRole('textbox')).toHaveCount(0)
    expect(calls.some((call) => call.path.endsWith('/replacement'))).toBe(false)
    expect(
      calls.some((call) => call.path.endsWith('/companion-explanation')),
    ).toBe(false)

    await page.screenshot({
      path: testInfo.outputPath('mb-652-review-companion-desktop.png'),
      fullPage: true,
      animations: 'disabled',
    })
    await page.setViewportSize({ width: 375, height: 812 })
    await expect(panel).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath('mb-652-review-companion-mobile.png'),
      fullPage: true,
      animations: 'disabled',
    })
  })

  test('MB-644 a v2 resource plan opens in the same workspace', async ({
    page,
  }) => {
    await authenticate(page)
    const v2 = proposalPlan()
    const adapter: SupportPlanV3 = {
      ...v2,
      planPolicyVersion: 'support-plan-selection-v1',
      representationMode: 'V2_RESOURCE_ADAPTER',
      cycle: null,
      focuses: v2.focuses.map((focus) => ({
        ...focus,
        actions: focus.actions
          .filter((action) => action.actionType === 'RESOURCE')
          .map((action) => ({
            ...action,
            representationMode: 'V2_RESOURCE_ADAPTER' as const,
          })),
      })),
    }
    const world: World = {
      current: adapter,
      history: [],
      occurrences: [
        resourceOccurrence({ representationMode: 'V2_RESOURCE_ADAPTER' }),
      ],
      journeyNext: 'OPEN_CURRENT_PLAN',
    }
    await mockPlanApi(page, world)
    await page.goto('/support-plan')
    await expect(
      page.getByRole('region', { name: 'Thở chậm 3 phút' }),
    ).toBeVisible()
    await expect(page.getByText('Đang theo kế hoạch')).toBeVisible()
    await page.getByRole('tab', { name: 'Kế hoạch' }).click()
    await expect(page.getByText(/Mỗi ngày · khoảng 5 phút/)).toBeVisible()
  })
})
