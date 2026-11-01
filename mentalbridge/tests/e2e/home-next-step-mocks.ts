import { expect, type Locator, type Page, type Route } from '@playwright/test'
import type {
  GuidedJourney,
  HomeNextStep,
} from '../../features/assessment/api/care-contract'
import type { EmotionCheckIn } from '../../lib/emotion-check-in/contract'
import {
  emotionOccurrenceFixture,
  nativeSupportPlanFixture,
} from '../../features/support-plan/testing/native-support-plan-fixture'
import { emotionPlanHref } from '../../features/support-plan/emotion-plan-origin'
import { localDateIn } from '../../features/support-plan/workspace/workspace-model'
import { resourceActionsProjection } from './plan-resources-mocks'
import type { PublicResourceDetail } from '../../features/resources/api/browser-resources'
import type { Appointment } from '../../lib/consultation/consultation-validation'
import {
  mockResourceCompletionDetail,
  resourceCompletionWorld,
  type ResourceCompletionWorld,
} from './resource-completion-mocks'

type Focus = NonNullable<HomeNextStep['plan']>['focus']
export const homeTimeZone = 'Asia/Ho_Chi_Minh'
export const homeGuideId = '90000000-0000-4000-8000-000000000672'
const evaluationId = '80000000-0000-4000-8000-000000000672'
const stamp = '2026-10-13T05:00:00Z'

export const homeAcceptanceStates = [
  'loading',
  'first-use',
  'assessment-in-progress',
  'guide-required',
  'safety',
  'find-specialist',
  'free-resources',
  'entitlement-unavailable',
  'plus-proposal',
  'plan-draft',
  'do-today',
  'today-done',
  'nothing-today',
  'paused',
  'review-due',
  'last-completed',
  'safety-with-plan',
  'plan-emotion-origin',
  'unavailable',
] as const
export type HomeAcceptanceState = (typeof homeAcceptanceStates)[number]

export const homeV2States = [
  'hero-morning-plan',
  'hero-afternoon-plan',
  'hero-evening-plan',
  'hero-morning-no-plan',
  'hero-afternoon-no-plan',
  'hero-evening-no-plan',
  'resources-plan-three',
  'resources-plan-one',
  'resources-guide',
  'resources-library',
  'resources-content-error',
  'appointment-upcoming',
  'appointment-none',
  'appointment-error',
  'week-all',
  'week-mixed',
  'week-none',
  'week-error',
  'check-in-idle',
  'check-in-chosen',
  'check-in-saved',
] as const
export type HomeV2State = (typeof homeV2States)[number]

export function v2HomeWorld(state: HomeV2State): HomeWorld {
  const library =
    state === 'resources-library' ||
    state === 'resources-content-error' ||
    state.endsWith('no-plan')
  const world = homeWorld(
    library
      ? 'first-use'
      : state === 'resources-guide'
        ? 'free-resources'
        : 'do-today',
  )
  if (state === 'resources-plan-one') world.planResourceCount = 1
  if (state === 'resources-content-error') world.contentError = true
  if (state === 'appointment-upcoming') world.appointmentState = 'upcoming'
  if (state === 'appointment-error') world.appointmentState = 'error'
  if (state === 'week-all') world.week = 'all'
  if (state === 'week-none') world.week = 'none'
  if (state === 'week-error') world.week = 'error'
  return world
}

/** Fix wall time without installing a virtual clock, so CSS animation time advances. */
export async function setHomeHour(page: Page, hour: number) {
  const now = new Date()
  const date = localDateIn(homeTimeZone, now)
  const fixed = new Date(
    `${date}T${String(hour).padStart(2, '0')}:00:00+07:00`,
  ).getTime()
  await page.addInitScript((timestamp) => {
    window.Date = new Proxy(Date, {
      construct(target, args) {
        return Reflect.construct(target, args.length ? args : [timestamp])
      },
      get(target, key) {
        return key === 'now' ? () => timestamp : Reflect.get(target, key)
      },
    })
  }, fixed)
}

export type HomeWorld = ResourceCompletionWorld & {
  state: HomeAcceptanceState
  journey: GuidedJourney
  focus?: Focus
  homeReads: number
  consultationReads: string[]
  emotion: EmotionCheckIn | null
  emotionSaves: number
  holdHome?: Promise<void>
  holdSections?: Promise<void>
  holdEmotionSave?: Promise<void>
  resourceSource: 'plan' | 'guide' | 'library'
  planResourceCount: number
  contentError: boolean
  appointmentState: 'upcoming' | 'none' | 'error'
  week: 'all' | 'mixed' | 'none' | 'error'
  cycleDay: number | null
  cycleLengthDays: number | null
}

export function homeWorld(state: HomeAcceptanceState = 'do-today'): HomeWorld {
  const localDate = localDateIn(homeTimeZone)
  const resources: ResourceCompletionWorld = resourceCompletionWorld(localDate)
  const hasPlan = [
    'do-today',
    'today-done',
    'nothing-today',
    'paused',
    'review-due',
    'safety-with-plan',
    'plan-emotion-origin',
  ].includes(state)
  const firstUse = state === 'first-use' || state === 'assessment-in-progress'
  let nextAction: GuidedJourney['nextAction'] = firstUse
    ? null
    : hasPlan
      ? 'OPEN_CURRENT_PLAN'
      : 'EXPLORE_GUIDE_RESOURCES'
  if (state === 'plus-proposal') nextAction = 'START_PLAN_PROPOSAL'
  if (state === 'plan-draft') nextAction = 'REVIEW_PLAN_DRAFT'
  if (state === 'find-specialist') nextAction = 'FIND_SPECIALIST'
  if (state === 'safety' || state === 'safety-with-plan')
    nextAction = 'REVIEW_SAFETY_SUPPORT'
  const journey: GuidedJourney = {
    journeyPolicyVersion: 'mb-guided-journey-v1',
    stage: firstUse
      ? 'ASSESSMENT_REQUIRED'
      : state === 'guide-required'
        ? 'GUIDE_REQUIRED'
        : 'GUIDE_READY',
    assessmentInProgress: state === 'assessment-in-progress',
    episodeId: firstUse ? null : '70000000-0000-4000-8000-000000000672',
    episodeCompletedAt: firstUse ? null : stamp,
    presentationEvaluationId: firstUse ? null : evaluationId,
    supportGuideId: firstUse || state === 'guide-required' ? null : homeGuideId,
    nextAction,
    currentSupportPlanId:
      hasPlan || state === 'plan-draft'
        ? resources.current!.supportPlanId
        : null,
    entitlementStatus:
      state === 'entitlement-unavailable'
        ? 'UNAVAILABLE'
        : nextAction === 'EXPLORE_GUIDE_RESOURCES' ||
            nextAction === 'START_PLAN_PROPOSAL'
          ? 'VERIFIED'
          : 'NOT_REQUIRED',
  }
  if (state === 'plan-emotion-origin') {
    resources.current = nativeSupportPlanFixture()
    resources.current.focuses[0].actions[0].schedules[0].effectiveFrom =
      localDate
    resources.occurrences = [
      {
        ...emotionOccurrenceFixture(),
        localDate,
        scheduledAt: `${localDate}T12:00:00Z`,
        displayState: 'SCHEDULED',
      },
    ]
  }
  if (!hasPlan) resources.current = undefined
  if (state === 'paused') resources.current!.status = 'PAUSED'
  if (state === 'today-done')
    resources.occurrences[0] = {
      ...resources.occurrences[0],
      state: 'COMPLETED',
      displayState: 'COMPLETED',
    }
  if (state === 'nothing-today') resources.occurrences = []
  return {
    ...resources,
    state,
    journey,
    focus:
      state === 'paused'
        ? 'RESUME_PAUSED'
        : state === 'review-due'
          ? 'REVIEW_DUE'
          : state === 'nothing-today'
            ? 'NOTHING_TODAY'
            : undefined,
    homeReads: 0,
    consultationReads: [],
    emotion: null,
    emotionSaves: 0,
    resourceSource: hasPlan ? 'plan' : firstUse ? 'library' : 'guide',
    planResourceCount: 3,
    contentError: false,
    appointmentState: 'none',
    week: 'mixed',
    cycleDay: hasPlan ? 6 : null,
    cycleLengthDays: hasPlan ? 14 : null,
  }
}

export function homeResponse(world: HomeWorld): HomeNextStep {
  const current = world.current
  const localDate = localDateIn(homeTimeZone)
  const open = world.occurrences.find((item) => item.state === 'SCHEDULED')
  const action = current?.focuses
    .flatMap((item) => item.actions)
    .find((item) => item.actionId === open?.actionId)
  const focus = world.focus ?? (open ? 'DO_TODAY' : 'TODAY_DONE')
  return {
    homePolicyVersion: 'mb-home-next-step-v1',
    journey: world.journey,
    plan: current
      ? {
          supportPlanId: current.supportPlanId,
          status: current.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE',
          focus,
          reviewDueOn: current.cycle?.reviewDueOn ?? null,
          cycleDay: world.cycleDay,
          cycleLengthDays: world.cycleLengthDays,
          localDate,
          timeZone: homeTimeZone,
          today: {
            total: world.occurrences.length,
            completed: world.occurrences.filter(
              (item) => item.state === 'COMPLETED',
            ).length,
          },
          nextOccurrence:
            focus === 'DO_TODAY' && open && action
              ? {
                  occurrenceId: open.occurrenceId,
                  actionId: open.actionId,
                  actionType: open.actionType,
                  title: action.presentation.title,
                  displayState:
                    open.displayState === 'OVERDUE' ? 'OVERDUE' : 'SCHEDULED',
                  scheduledAt: open.scheduledAt,
                  estimatedDurationMinutes:
                    action.schedules[0]?.estimatedDurationMinutes ?? null,
                }
              : null,
        }
      : null,
    lastCompletedPlan:
      world.state === 'last-completed'
        ? {
            supportPlanId: '60000000-0000-4000-8000-000000000672',
            completedAt: stamp,
          }
        : null,
  }
}

export function planEmotionHomeHref(world: HomeWorld) {
  const occurrence = world.occurrences[0]
  return emotionPlanHref(occurrence, '/dashboard')
}

export async function installHomeMocks(
  page: Page,
  world: HomeWorld,
  options: { authenticate?: boolean } = {},
) {
  if (options.authenticate !== false)
    await page.context().addCookies([
      {
        name: 'mentalbridge_access',
        value: 'synthetic-mb273-e2e-access',
        url: 'http://127.0.0.1:3100',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, json: body })
  const problem = (route: Route, status: number, code: string) =>
    json(
      route,
      { type: 'about:blank', status, code, title: 'Controlled fixture' },
      status,
    )
  // This fallback owns only the endpoints needed by Home and its plan return.
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    if (path.startsWith('/api/consultation/'))
      world.consultationReads.push(path)
    if (path === '/api/care/home-next-step') {
      world.homeReads++
      await world.holdHome
      if (world.state === 'unavailable')
        return problem(route, 503, 'SUPPORT_POLICY_UNAVAILABLE')
      return json(route, homeResponse(world))
    }
    if (path === '/api/care/guided-journey') return json(route, world.journey)
    if (path === '/api/care/v2/support-plans/current/resource-actions') {
      await world.holdSections
      const projection = resourceActionsProjection(
        world.resourceSource === 'plan'
          ? world.planResourceCount +
              (homeResponse(world).plan?.nextOccurrence?.actionType ===
              'RESOURCE'
                ? 1
                : 0)
          : 0,
      )
      projection.supportPlanId =
        world.current?.supportPlanId ?? projection.supportPlanId
      const currentResource = world.current?.focuses
        .flatMap((focus) => focus.actions)
        .find((action) => action.actionType === 'RESOURCE')
      if (projection.actions[0] && currentResource?.source?.sourceRevision)
        projection.actions[0].resource.resourceVersion =
          currentResource.source.sourceRevision
      if (world.current?.status === 'PAUSED') projection.planState = 'PAUSED'
      return json(route, projection)
    }
    if (path === '/api/consultation/appointments') {
      await world.holdSections
      if (world.appointmentState === 'error')
        return problem(route, 503, 'DEPENDENCY_UNAVAILABLE')
      const items =
        world.appointmentState === 'upcoming' ? [homeAppointment()] : []
      return json(route, {
        items,
        count: items.length,
        generatedAt: new Date().toISOString(),
      })
    }
    if (path === '/api/resources' || /^\/api\/resources\/[^/]+$/.test(path)) {
      await world.holdSections
      if (world.contentError)
        return problem(route, 503, 'DEPENDENCY_UNAVAILABLE')
      const resources = homeResourceDetails()
      return path === '/api/resources'
        ? json(route, { items: resources, hasMore: false })
        : json(
            route,
            resources.find((item) => item.id === path.split('/').at(-1)) ??
              resources[0],
          )
    }
    if (path === '/api/care/v2/support-plans/current')
      return world.current
        ? json(route, world.current)
        : problem(route, 404, 'SUPPORT_PLAN_NOT_FOUND')
    if (path === '/api/care/v2/support-plans/current-draft')
      return problem(route, 404, 'SUPPORT_PLAN_DRAFT_NOT_FOUND')
    if (path === '/api/care/v2/support-plans/history')
      return json(route, { items: [], hasMore: false, nextCursor: null })
    if (path === '/api/care/v2/support-plan-occurrences')
      return json(route, {
        supportPlanId: world.current?.supportPlanId,
        supportPlanStatus: world.current?.status,
        representationMode: 'NATIVE_V3',
        from: url.searchParams.get('from'),
        through: url.searchParams.get('through'),
        occurrences: world.occurrences,
        interpretationCode:
          'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
      })
    if (path === `/api/care/support-guides/${homeGuideId}`) {
      await world.holdSections
      return json(route, homeGuide(world))
    }
    if (path === '/api/emotion-check-ins/progress') {
      await world.holdSections
      if (world.week === 'error')
        return problem(route, 503, 'DEPENDENCY_UNAVAILABLE')
      const items = homeEmotionHistory(world)
      const localDate = localDateIn(homeTimeZone)
      const distribution = { GREAT: 0, GOOD: 0, OKAY: 0, LOW: 0, VERY_LOW: 0 }
      for (const item of items) distribution[item.emotion]++
      return json(route, {
        asOfLocalDate: localDate,
        timezone: homeTimeZone,
        currentEmotion: world.emotion?.emotion ?? null,
        currentStreak: 0,
        longestStreak: 0,
        windows: [7, 14, 30].map((days) => ({
          days,
          startLocalDate: shiftLocalDate(localDate, 1 - days),
          endLocalDate: localDate,
          checkedInDays: items.length,
          totalDays: days,
          distribution,
        })),
        label: 'SELF_REPORTED_EMOTION',
        interpretation: 'FACTUAL_COUNTS_NOT_DIAGNOSIS_OR_RECOVERY',
      })
    }
    if (path.startsWith('/api/emotion-check-ins/')) {
      await world.holdSections
      return world.emotion && path.endsWith(world.emotion.localDate)
        ? json(route, world.emotion)
        : problem(route, 404, 'EMOTION_CHECK_IN_NOT_FOUND')
    }
    if (path === '/api/emotion-check-ins' && request.method() === 'POST') {
      await world.holdEmotionSave
      world.emotionSaves++
      world.emotion = {
        ...request.postDataJSON(),
        id: '70000000-0000-4000-8000-000000000672',
        revision: 1,
        sourceLabel: 'SELF_REPORTED_EMOTION',
        clinicalUse: 'NOT_A_DIAGNOSIS_OR_SAFETY_CLASSIFIER',
        createdAt: new Date().toISOString(),
        recordedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      return json(route, world.emotion, 201)
    }
    if (path === '/api/emotion-check-ins') {
      await world.holdSections
      if (world.week === 'error')
        return problem(route, 503, 'DEPENDENCY_UNAVAILABLE')
      return json(route, {
        items: homeEmotionHistory(world),
        page: { limit: 30, hasMore: false },
        label: 'SELF_REPORTED_EMOTION',
        interpretation: 'NOT_DIAGNOSIS_OR_RECOVERY',
      })
    }
    return route.continue()
  })
  if (
    world.occurrences.length > 0 &&
    world.current?.focuses[0].actions[0].actionType === 'RESOURCE'
  )
    await mockResourceCompletionDetail(page, world)
}

function homeGuide(world: HomeWorld) {
  const positive = world.journey.nextAction === 'REVIEW_SAFETY_SUPPORT'
  return {
    supportGuideId: homeGuideId,
    guideVersion: 1,
    guidePolicyVersion: 'mb-support-guide-capstone-v1',
    supportEvaluationId: evaluationId,
    generatedAt: stamp,
    guideType: 'ONE_TIME_SUPPORT_GUIDE',
    explanation: {
      code: 'STANDARD_POST_SCREENING_GUIDANCE',
      text: 'Bắt đầu bằng một hoạt động nhỏ và vừa sức.',
    },
    safety: {
      status: positive ? 'POSITIVE_SAFETY_SCREEN' : 'NEGATIVE_SAFETY_SCREEN',
      reasonCode: positive ? 'PHQ9_ITEM9_POSITIVE' : 'PHQ9_ITEM9_NEGATIVE',
      policyVersion: 'MB-SAFETY-PHQ9-001-v1',
      guidanceCode: positive
        ? 'REVIEW_SAFETY_GUIDANCE'
        : 'STANDARD_SAFETY_REMINDER',
      guidance: 'Bạn có thể chủ động tìm hỗ trợ khi cần.',
    },
    resourceResolution: {
      status: 'AVAILABLE',
      policyVersion: 'content-eligibility-v1',
      resolvedAt: stamp,
    },
    resources:
      world.resourceSource === 'library'
        ? []
        : homeResourceDetails().map((resource) => ({
            resourceId: resource.id,
            contentVersion: resource.contentVersion,
            publicationId: '40000000-0000-4000-8000-000000000672',
            domain: 'DEPRESSIVE_SYMPTOMS',
            role: 'PRIMARY',
            category: resource.category,
            title: resource.title,
            summary: resource.summary,
            externalUrl: null,
          })),
    provenance: {
      supportEvaluationPolicyVersion: 'mb-support-routing-capstone-v2',
      assessmentResults: [],
    },
    phrasing: { source: 'CARE_APPROVED_STANDARD', status: 'STANDARD' },
  }
}

export function homeResourceDetails(): PublicResourceDetail[] {
  const entries = [
    ['Viết vài dòng dịu dàng', 'JOURNALING', 'REFLECTION', 3],
    ['Hiểu về lo âu: khi cơ thể báo động nhầm', 'ARTICLE', 'LEARNING', 6],
    ['Thư giãn cơ trước khi ngủ', 'MEDITATION', 'PRACTICE', 10],
    ['Một khoảng thở chậm', 'BREATHING', 'PRACTICE', 5],
  ] as const
  return entries.map(
    (
      [title, category, resourceKind, minutes],
      index,
    ): PublicResourceDetail => ({
      id: `b3000000-0000-4000-8000-${String(670 + index).padStart(12, '0')}`,
      category,
      resourceKind,
      interactionType:
        category === 'ARTICLE' ? 'STRUCTURED_READER' : 'REFLECTION',
      repeatability: 'REPEATABLE',
      completionMode: 'EXPLICIT',
      streakEligible: false,
      expectedDurationMinutes: minutes,
      cooldownDays: 0,
      recommendedFrequencyPerWeek: 3,
      planTags: [],
      locale: 'vi-VN',
      title,
      summary: 'Một khoảng ngắn để chăm sóc bản thân.',
      externalUrl: null,
      sourceOrganization: 'MentalBridge',
      status: 'PUBLISHED',
      reviewedAt: stamp,
      createdAt: stamp,
      updatedAt: stamp,
      contentVersion: '3',
      contentBody: 'Dành vài phút trong khoảng thời gian bạn thấy phù hợp.',
      structuredContent: {},
      interactionConfig: {},
      safetyNotes: [],
      sourceRetrievedAt: stamp,
      sourceContentHash: null,
      contentVersionLabel: 'test-v3',
      sourceReviewStatus: 'REVIEWED',
      effectiveAt: stamp,
      expiresAt: null,
    }),
  )
}

function shiftLocalDate(localDate: string, days: number) {
  const date = new Date(`${localDate}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function homeEmotionHistory(world: HomeWorld): EmotionCheckIn[] {
  const date = localDateIn(homeTimeZone)
  const emotions: EmotionCheckIn['emotion'][] = [
    'GOOD',
    'OKAY',
    'GREAT',
    'LOW',
    'OKAY',
    'OKAY',
    'GOOD',
  ]
  const offsets =
    world.week === 'all'
      ? [-6, -5, -4, -3, -2, -1, 0]
      : world.week === 'mixed'
        ? [-6, -5, -3, -2, -1]
        : []
  const items = offsets.map((offset, index): EmotionCheckIn => {
    const localDate = shiftLocalDate(date, offset)
    return {
      id: `70000000-0000-4000-8000-${String(672 + index).padStart(12, '0')}`,
      localDate,
      timezone: homeTimeZone,
      emotion: emotions[offset + 6],
      intensity: 3,
      factors: [],
      note: null,
      revision: 1,
      sourceLabel: 'SELF_REPORTED_EMOTION',
      clinicalUse: 'NOT_A_DIAGNOSIS_OR_SAFETY_CLASSIFIER',
      createdAt: `${localDate}T02:00:00Z`,
      recordedAt: `${localDate}T02:00:00Z`,
      updatedAt: `${localDate}T02:00:00Z`,
    }
  })
  return world.emotion
    ? [
        ...items.filter((item) => item.localDate !== world.emotion!.localDate),
        world.emotion,
      ]
    : items
}

export function homeAppointment(): Appointment {
  const date = shiftLocalDate(localDateIn(homeTimeZone), 2)
  return {
    id: '20000000-0000-4000-8000-000000000672',
    slotId: '21000000-0000-4000-8000-000000000672',
    specialistAccountId: '22000000-0000-4000-8000-000000000672',
    specialistDisplayName: 'Nguyễn Minh An',
    status: 'CONFIRMED',
    modality: 'IN_APP_VIDEO',
    scheduledStartAt: `${date}T02:00:00Z`,
    scheduledEndAt: `${date}T02:50:00Z`,
    timezone: homeTimeZone,
    requestedAt: stamp,
    decisionDeadlineAt: stamp,
    heldCreditId: '23000000-0000-4000-8000-000000000672',
    replacesAppointmentId: null,
    replacedByAppointmentId: null,
    originatingPlanActionId: null,
    decidedAt: stamp,
    decisionReason: 'SPECIALIST_ACCEPTED',
    cancelledAt: null,
    cancellationReason: null,
    cancellationActor: null,
    cancellationCreditOutcome: null,
    sessionOutcome: null,
    sessionOutcomeReason: null,
    sessionPolicyVersion: null,
    sessionEndedAt: null,
    sessionSettledAt: null,
    completionFactId: null,
    creditState: 'HELD',
    history: [],
    version: 0,
  }
}

/** Move focus through the real tab order, then activate without pointer input. */
export async function keyboardActivate(
  page: Page,
  target: Locator,
  key = 'Enter',
) {
  await keyboardFocus(page, target)
  await page.keyboard.press(key)
}

export async function keyboardFocus(page: Page, target: Locator) {
  await expect(target).toBeVisible()
  for (let index = 0; index < 100; index++) {
    const focused = await target.evaluate(
      (element) => element === document.activeElement,
    )
    if (focused) {
      return
    }
    await page.keyboard.press('Tab')
  }
  throw new Error(
    `Target was not reachable in the keyboard tab order: ${(await target.getAttribute('aria-label')) ?? (await target.textContent())}`,
  )
}
