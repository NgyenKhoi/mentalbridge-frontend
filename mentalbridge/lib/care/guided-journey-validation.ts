import type { GuidedJourney } from '@/features/assessment/api/care-contract'

import { isUuid } from './care-validation'

const STAGES = new Set<GuidedJourney['stage']>([
  'ASSESSMENT_REQUIRED',
  'GUIDE_REQUIRED',
  'GUIDE_READY',
])
const NEXT_ACTIONS = new Set<NonNullable<GuidedJourney['nextAction']>>([
  'REVIEW_SAFETY_SUPPORT',
  'FIND_SPECIALIST',
  'OPEN_CURRENT_PLAN',
  'REVIEW_PLAN_DRAFT',
  'START_PLAN_PROPOSAL',
  'EXPLORE_GUIDE_RESOURCES',
])
const ENTITLEMENT_STATUSES = new Set<GuidedJourney['entitlementStatus']>([
  'NOT_REQUIRED',
  'VERIFIED',
  'UNAVAILABLE',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nullableUuid(value: unknown): value is string | null {
  return value === null || isUuid(value)
}

function nullableDateTime(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value,
      ) &&
      !Number.isNaN(Date.parse(value)))
  )
}

export function parseGuidedJourney(value: unknown): GuidedJourney | null {
  if (
    !isRecord(value) ||
    value.journeyPolicyVersion !== 'mb-guided-journey-v1' ||
    !STAGES.has(value.stage as GuidedJourney['stage']) ||
    typeof value.assessmentInProgress !== 'boolean' ||
    !nullableUuid(value.episodeId) ||
    !nullableDateTime(value.episodeCompletedAt) ||
    !nullableUuid(value.presentationEvaluationId) ||
    !nullableUuid(value.supportGuideId) ||
    !nullableUuid(value.currentSupportPlanId) ||
    !(
      value.nextAction === null ||
      NEXT_ACTIONS.has(
        value.nextAction as NonNullable<GuidedJourney['nextAction']>,
      )
    ) ||
    !ENTITLEMENT_STATUSES.has(
      value.entitlementStatus as GuidedJourney['entitlementStatus'],
    )
  ) {
    return null
  }
  const stage = value.stage as GuidedJourney['stage']
  const completed = stage !== 'ASSESSMENT_REQUIRED'
  const nextAction = value.nextAction as GuidedJourney['nextAction']
  const entitlementStatus =
    value.entitlementStatus as GuidedJourney['entitlementStatus']
  const planAction =
    nextAction === 'OPEN_CURRENT_PLAN' || nextAction === 'REVIEW_PLAN_DRAFT'
  if (
    completed !== (value.episodeId !== null) ||
    completed !== (value.episodeCompletedAt !== null) ||
    completed !== (nextAction !== null) ||
    (stage === 'GUIDE_READY') !== (value.supportGuideId !== null) ||
    (planAction && value.currentSupportPlanId === null) ||
    (nextAction === 'START_PLAN_PROPOSAL' &&
      (entitlementStatus !== 'VERIFIED' ||
        value.currentSupportPlanId !== null)) ||
    (entitlementStatus === 'UNAVAILABLE' &&
      nextAction !== 'EXPLORE_GUIDE_RESOURCES') ||
    (entitlementStatus === 'VERIFIED' &&
      nextAction !== 'START_PLAN_PROPOSAL' &&
      nextAction !== 'EXPLORE_GUIDE_RESOURCES')
  ) {
    return null
  }
  return {
    journeyPolicyVersion: 'mb-guided-journey-v1',
    stage,
    assessmentInProgress: value.assessmentInProgress,
    episodeId: value.episodeId,
    episodeCompletedAt: value.episodeCompletedAt,
    presentationEvaluationId: value.presentationEvaluationId,
    supportGuideId: value.supportGuideId,
    nextAction,
    currentSupportPlanId: value.currentSupportPlanId,
    entitlementStatus,
  }
}
