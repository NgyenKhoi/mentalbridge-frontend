import type { HomeNextOccurrence, HomeNextStep } from './home-contract'

export const ids = {
  episode: '10000000-0000-4000-8000-000000000101',
  evaluation: '20000000-0000-4000-8000-000000000101',
  guide: '30000000-0000-4000-8000-000000000101',
  plan: '40000000-0000-4000-8000-000000000101',
  occurrence: '50000000-0000-4000-8000-000000000101',
  action: '60000000-0000-4000-8000-000000000101',
  completedPlan: '70000000-0000-4000-8000-000000000101',
} as const

export const firstUseHome: HomeNextStep = {
  homePolicyVersion: 'mb-home-next-step-v1',
  journey: {
    journeyPolicyVersion: 'mb-guided-journey-v1',
    stage: 'ASSESSMENT_REQUIRED',
    assessmentInProgress: false,
    episodeId: null,
    episodeCompletedAt: null,
    presentationEvaluationId: null,
    supportGuideId: null,
    nextAction: null,
    currentSupportPlanId: null,
    entitlementStatus: 'NOT_REQUIRED',
  },
  plan: null,
  lastCompletedPlan: null,
}

export const freeGuideHome: HomeNextStep = {
  homePolicyVersion: 'mb-home-next-step-v1',
  journey: {
    journeyPolicyVersion: 'mb-guided-journey-v1',
    stage: 'GUIDE_READY',
    assessmentInProgress: false,
    episodeId: ids.episode,
    episodeCompletedAt: '2026-10-28T03:00:00.000Z',
    presentationEvaluationId: ids.evaluation,
    supportGuideId: ids.guide,
    nextAction: 'EXPLORE_GUIDE_RESOURCES',
    currentSupportPlanId: null,
    entitlementStatus: 'UNAVAILABLE',
  },
  plan: null,
  lastCompletedPlan: null,
}

export function activePlanHome(
  actionType: HomeNextOccurrence['actionType'] = 'RESOURCE',
  actionId: string = ids.action,
): HomeNextStep {
  return {
    homePolicyVersion: 'mb-home-next-step-v1',
    journey: {
      ...freeGuideHome.journey,
      nextAction: 'OPEN_CURRENT_PLAN',
      currentSupportPlanId: ids.plan,
      entitlementStatus: 'NOT_REQUIRED',
    },
    plan: {
      supportPlanId: ids.plan,
      status: 'ACTIVE',
      focus: 'DO_TODAY',
      reviewDueOn: '2026-11-11',
      cycleDay: 1,
      cycleLengthDays: 14,
      localDate: '2026-10-29',
      timeZone: 'Asia/Bangkok',
      today: { total: 2, completed: 1 },
      nextOccurrence: {
        occurrenceId: ids.occurrence,
        actionId,
        actionType,
        title: 'Dành năm phút để chăm sóc bản thân',
        displayState: 'SCHEDULED',
        scheduledAt: '2026-10-29T03:00:00.000Z',
        estimatedDurationMinutes: 5,
      },
    },
    lastCompletedPlan: null,
  }
}

export function priorityPlanHome(
  nextAction: 'REVIEW_SAFETY_SUPPORT' | 'FIND_SPECIALIST',
): HomeNextStep {
  return {
    ...activePlanHome(),
    journey: {
      ...activePlanHome().journey,
      nextAction,
    },
  }
}

export const pausedPlanHome: HomeNextStep = {
  ...activePlanHome(),
  plan: {
    ...activePlanHome().plan!,
    status: 'PAUSED',
    focus: 'RESUME_PAUSED',
    cycleDay: null,
    cycleLengthDays: null,
    nextOccurrence: null,
  },
}
