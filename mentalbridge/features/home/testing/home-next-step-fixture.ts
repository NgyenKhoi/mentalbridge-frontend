import type {
  GuidedJourney,
  HomeNextStep,
  HomePlanStep,
} from '@/features/assessment/api/care-contract'

export const HOME_GUIDE_ID = '30000000-0000-4000-8000-000000000672'
export const HOME_PLAN_ID = '40000000-0000-4000-8000-000000000672'

export function homeJourneyFixture(
  changes: Partial<GuidedJourney> = {},
): GuidedJourney {
  return {
    journeyPolicyVersion: 'mb-guided-journey-v1',
    stage: 'GUIDE_READY',
    assessmentInProgress: false,
    episodeId: '10000000-0000-4000-8000-000000000672',
    episodeCompletedAt: '2026-10-22T03:00:00Z',
    presentationEvaluationId: '20000000-0000-4000-8000-000000000672',
    supportGuideId: HOME_GUIDE_ID,
    nextAction: 'EXPLORE_GUIDE_RESOURCES',
    currentSupportPlanId: null,
    entitlementStatus: 'VERIFIED',
    ...changes,
  }
}

export function homeNextStepFixture(
  changes: Partial<HomeNextStep> = {},
): HomeNextStep {
  return {
    homePolicyVersion: 'mb-home-next-step-v1',
    journey: homeJourneyFixture(),
    plan: null,
    lastCompletedPlan: null,
    ...changes,
  }
}

export function homePlanFixture(
  focus: HomePlanStep['focus'],
  changes: Partial<HomePlanStep> = {},
): HomePlanStep {
  return {
    supportPlanId: HOME_PLAN_ID,
    status: focus === 'RESUME_PAUSED' ? 'PAUSED' : 'ACTIVE',
    focus,
    reviewDueOn: '2026-11-04',
    cycleDay: 6,
    cycleLengthDays: 14,
    localDate: '2026-10-22',
    timeZone: 'Asia/Ho_Chi_Minh',
    today: { total: 3, completed: 1 },
    nextOccurrence:
      focus === 'DO_TODAY'
        ? {
            occurrenceId: '50000000-0000-4000-8000-000000000672',
            actionId: '60000000-0000-4000-8000-000000000672',
            actionType: 'RESOURCE',
            title: 'Đọc về giấc ngủ',
            displayState: 'SCHEDULED',
            scheduledAt: '2026-10-22T09:00:00Z',
            estimatedDurationMinutes: 5,
          }
        : null,
    ...changes,
  }
}

export function homeFirstUseFixture(): HomeNextStep {
  return homeNextStepFixture({
    journey: homeJourneyFixture({
      stage: 'ASSESSMENT_REQUIRED',
      nextAction: null,
      supportGuideId: null,
      episodeId: null,
      episodeCompletedAt: null,
      presentationEvaluationId: null,
      entitlementStatus: 'NOT_REQUIRED',
    }),
  })
}
