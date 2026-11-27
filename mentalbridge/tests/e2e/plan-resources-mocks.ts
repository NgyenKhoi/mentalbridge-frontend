import type { Page, Route } from '@playwright/test'
import type { components as CareComponents } from '../../contracts/care.generated'
import type { components as ContentComponents } from '../../contracts/content.generated'

export const planResourceId = 'b3000000-0000-4000-8000-000000000670'
export const planActionId = 'b1000000-0000-4000-8000-000000000670'
export const planOccurrenceId = 'b2000000-0000-4000-8000-000000000670'
export const planId = 'b5000000-0000-4000-8000-000000000670'
export const planTimeZone = 'Asia/Ho_Chi_Minh'

export function planLocalDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: planTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function planResourceAction(
  index = 0,
): CareComponents['schemas']['PlanResourceAction'] {
  const suffix = String(670 + index).padStart(12, '0')
  return {
    actionId: `b1000000-0000-4000-8000-${suffix}`,
    actionVersion: 1,
    title:
      index === 0 ? 'Một khoảng thở cho hôm nay' : `Khoảng nghỉ ${index + 1}`,
    resource: {
      resourceId: `b3000000-0000-4000-8000-${suffix}`,
      resourceVersion: '3',
      publicationId: `b6000000-0000-4000-8000-${suffix}`,
    },
    schedule: {
      scheduleId: `b4000000-0000-4000-8000-${suffix}`,
      version: 1,
      schedulePolicyVersion: 'support-plan-activity-schedule-v2',
      recurrenceType: 'DAILY',
      recurrenceDayOfWeek: null,
      daysOfWeek: [],
      localTime: '08:00',
      preferredDaypart: 'MORNING',
      timezone: planTimeZone,
      effectiveFrom: planLocalDate(),
      effectiveUntil: null,
      estimatedDurationMinutes: 5,
      reminderEnabled: false,
      status: 'ACTIVE',
    },
    today: {
      occurrenceId: `b2000000-0000-4000-8000-${suffix}`,
      occurrenceVersion: 0,
      displayState: 'SCHEDULED',
      completionEvidence: null,
    },
  }
}

export function resourceActionsProjection(
  count = 2,
): CareComponents['schemas']['PlanResourceActionsV1'] {
  return {
    planState: 'ACTIVE',
    supportPlanId: planId,
    supportPlanVersion: 1,
    representationMode: 'NATIVE_V3',
    timeZone: planTimeZone,
    localDate: planLocalDate(),
    actions: Array.from({ length: count }, (_, index) =>
      planResourceAction(index),
    ),
  }
}

export function resourceBingoBoard(
  count = 2,
): ContentComponents['schemas']['ResourceBingoPlanSync'] {
  const projection = resourceActionsProjection(count)
  return {
    weekStart: planLocalDate(),
    timeZone: planTimeZone,
    version: '0',
    updatedAt: new Date().toISOString(),
    items: projection.actions
      .slice(0, 9)
      .map(
        (
          action,
          index,
        ): ContentComponents['schemas']['ResourceBingoItemState'] => ({
          position: index + 1,
          actionId: action.actionId,
          resourceId: action.resource.resourceId,
          contentVersion: action.resource.resourceVersion,
          label: action.title,
          retired: false,
          evidence: 'NONE',
          selfConfirmedAt: null,
          verifiedAt: null,
          verificationSource: null,
        }),
      ),
    unavailableActions: [],
  }
}

export type PlanResourceWorld = {
  access: 'paid' | 'free' | 'expired' | 'unavailable'
  projection: ReturnType<typeof resourceActionsProjection>
  board: ReturnType<typeof resourceBingoBoard>
  planStatus: number
  syncStatus: number
  toggleStatus: number
  journeyStatus: number
  holdPlan?: Promise<void>
  calls: Array<{
    method: string
    path: string
    headers: Record<string, string>
    body?: unknown
  }>
}

export function resourceWorld(count = 2): PlanResourceWorld {
  return {
    access: 'paid',
    projection: resourceActionsProjection(count),
    board: resourceBingoBoard(count),
    planStatus: 200,
    syncStatus: 200,
    toggleStatus: 200,
    journeyStatus: 200,
    calls: [],
  }
}

export async function installPlanResourcesMocks(
  page: Page,
  world: PlanResourceWorld,
) {
  await page.context().addCookies([
    {
      name: 'mentalbridge_access',
      value: 'synthetic-resource-e2e-access',
      url: 'http://127.0.0.1:3100',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  const respond = (
    route: Route,
    body: unknown,
    status = 200,
    version?: string,
  ) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      headers: version === undefined ? undefined : { ETag: `"${version}"` },
      body: JSON.stringify(body),
    })
  const problem = (route: Route, status: number) =>
    respond(
      route,
      {
        status,
        code: status === 412 ? 'VERSION_MISMATCH' : 'DEPENDENCY_UNAVAILABLE',
        title: 'Controlled fixture response',
      },
      status,
    )
  await page.route('**/api/consultation/service-credits', (route) => {
    if (world.access === 'unavailable') return problem(route, 503)
    const paid = world.access === 'paid'
    return respond(route, {
      source: paid ? 'PAID' : 'DEFAULT_FREE',
      packageCode: paid ? 'PLUS' : 'FREE',
      entitlementState: paid
        ? 'ACTIVE'
        : world.access === 'expired'
          ? 'EXPIRED'
          : 'DEFAULT_FREE',
      supportPlanEnabled: paid,
    })
  })
  await page.route('**/api/consultation/payments', (route) =>
    respond(route, { items: [], hasMore: false, nextCursor: null }),
  )
  await page.route(
    '**/api/care/v2/support-plans/current/resource-actions?**',
    async (route) => {
      const request = route.request()
      world.calls.push({
        method: request.method(),
        path: new URL(request.url()).pathname,
        headers: request.headers(),
      })
      await world.holdPlan
      if (world.planStatus !== 200) return problem(route, world.planStatus)
      return respond(route, world.projection)
    },
  )
  await page.route('**/api/resources/bingo/**', (route) => {
    const request = route.request()
    const url = new URL(request.url())
    world.calls.push({
      method: request.method(),
      path: url.pathname,
      headers: request.headers(),
      body: request.postData() ? request.postDataJSON() : undefined,
    })
    const toggle = /\/items\/\d+$/.test(url.pathname)
    const status = toggle ? world.toggleStatus : world.syncStatus
    if (status !== 200) return problem(route, status)
    world.board.weekStart = url.pathname.split('/')[4]
    if (toggle) {
      const position = Number(url.pathname.split('/').at(-1))
      const item = world.board.items.find(
        (candidate) => candidate.position === position,
      )
      const body = request.postDataJSON() as { selfConfirmed: boolean }
      if (item) {
        item.selfConfirmedAt = body.selfConfirmed
          ? new Date().toISOString()
          : null
        if (item.evidence !== 'CONTENT_VERIFIED')
          item.evidence = body.selfConfirmed ? 'SELF_CONFIRMED' : 'NONE'
      }
      world.board.version = String(Number(world.board.version) + 1)
    }
    // Item mutations return ResourceBingoBoard, whose contract intentionally
    // omits the plan-sync-only unavailableActions projection.
    const { weekStart, timeZone, version, updatedAt, items } = world.board
    const board = { weekStart, timeZone, version, updatedAt, items }
    return respond(
      route,
      toggle ? board : world.board,
      200,
      world.board.version,
    )
  })
  await page.route('**/api/resources/journey?**', (route) => {
    if (world.journeyStatus !== 200) return problem(route, world.journeyStatus)
    const date =
      new URL(route.request().url()).searchParams.get('date') ?? planLocalDate()
    return respond(route, {
      assignmentId: 'c1000000-0000-4000-8000-000000000670',
      localDate: date,
      planId,
      planVersion: 1,
      items: [],
      progress: {
        dailyCompleted: 0,
        dailyTotal: 0,
        learningCompleted: 0,
        learningTotal: 0,
        practiceStreakDays: 0,
      },
      weekStart: world.board.weekStart,
      bingo: [],
    })
  })
  await page.route('**/api/resources/bookmarks', (route) =>
    respond(route, { items: [] }),
  )
  await page.route('**/api/resources/progress?**', (route) =>
    respond(route, { items: [] }),
  )
  await page.route('**/api/achievements?**', (route) =>
    respond(
      route,
      {
        visibilityState: 'VISIBLE',
        preferenceVersion: '0',
        policyVersion: 'achievement-rules-v1',
        calculatedAt: new Date().toISOString(),
        sources: [],
        items: [],
      },
      200,
      '0',
    ),
  )
  await page.route(/\/api\/resources(?:\?.*)?$/, (route) =>
    respond(route, {
      items: [
        {
          id: 'c3000000-0000-4000-8000-000000000670',
          category: 'ARTICLE',
          locale: 'vi-VN',
          title: 'Một chút dịu dàng trong ngày',
          summary: 'Gợi ý chung để dừng lại và chăm sóc bản thân.',
          status: 'PUBLISHED',
          createdAt: '2026-10-13T05:00:00Z',
        },
      ],
      hasMore: false,
    }),
  )
}
