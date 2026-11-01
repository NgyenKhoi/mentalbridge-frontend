import type {
  AdaptiveReviewConfirmation,
  AdaptiveSupportPlanReview,
} from '../api/support-plan-contract'
import {
  emotionActionId,
  nativePlanId,
  nativeSupportPlanFixture,
} from './native-support-plan-fixture'
import { nativeSupportPlanReviewFixture } from './native-support-plan-review-fixture'

export const lowEnergyPatternId = `barrier-low-energy-${emotionActionId}`

/** Review-due plan: PHQ-9 down, GAD-7 up, a repeated LOW_ENERGY barrier, three options. */
export function adaptiveReviewFixture(): AdaptiveSupportPlanReview {
  const summary = nativeSupportPlanReviewFixture().reassessmentSummary
  const phq9 = summary.screening.trends?.[0]?.current?.assessmentId ?? null
  const gad7 = summary.screening.trends?.[1]?.current?.assessmentId ?? null
  return {
    schemaVersion: 'adaptive-support-plan-review-v1',
    policyVersion: 'support-plan-review-v1',
    supportPlanId: nativePlanId,
    planVersion: 1,
    planStatus: 'ACTIVE',
    cycle: {
      policyVersion: 'support-plan-cycle-v1',
      lengthDays: 14,
      timezone: 'Asia/Ho_Chi_Minh',
      cycleNumber: 1,
      startedOn: '2026-10-03',
      reviewDueOn: '2026-10-16',
      currentDay: 15,
      pausedDays: 0,
      state: 'REVIEW_DUE',
    },
    reviewedAt: '2026-10-17T06:00:00Z',
    programPeriod: {
      startedOn: '2026-10-03',
      asOf: '2026-10-17',
      timezone: 'Asia/Ho_Chi_Minh',
      elapsedDays: 15,
      pausedDays: 0,
      fullCycleElapsed: true,
      scheduledCount: 14,
      completedCount: 9,
      skippedCount: 3,
      openCount: 2,
    },
    reviewState: 'REVIEW_DUE',
    reassessment: { state: 'AVAILABLE', reasonCode: null, summary },
    currentAdmission: 'ADMISSIBLE',
    outcome: 'CURRENT_PLAN_VALID_ALTERNATIVES_AVAILABLE',
    patterns: [
      {
        patternId: lowEnergyPatternId,
        kind: 'REPEATED_BARRIER',
        code: 'LOW_ENERGY',
        actionId: emotionActionId,
        actionTitle: 'Check-in cảm xúc',
        count: 2,
        occurrenceIds: [
          '30000000-0000-4000-8000-000000000642',
          '30000000-0000-4000-8000-000000000643',
        ],
      },
    ],
    contradictions: [
      {
        contradictionId: 'instrument-directions',
        kind: 'INSTRUMENT_DIRECTIONS_DIFFER',
        evidenceRefs: [
          { source: 'SCREENING_PHQ9', refId: phq9 },
          { source: 'SCREENING_GAD7', refId: gad7 },
        ],
      },
    ],
    options: [
      {
        optionId: 'keep-current-1',
        kind: 'KEEP_CURRENT',
        executionKind: 'CONTINUE_CYCLE',
        actionId: null,
        focusId: null,
        rationaleCodes: ['CURRENT_PLAN_STILL_ADMISSIBLE'],
        evidenceRefs: [{ source: 'SELF_REPORTED_EXPERIENCE', refId: null }],
        conflictingEvidenceRefs: [
          { source: 'PATTERN', refId: lowEnergyPatternId },
        ],
        changes: [],
      },
      {
        optionId: `lower-workload-${emotionActionId}-5`,
        kind: 'LOWER_WORKLOAD',
        executionKind: 'UPDATE_SCHEDULE',
        actionId: emotionActionId,
        focusId: null,
        rationaleCodes: ['REPEATED_LOW_ENERGY'],
        evidenceRefs: [{ source: 'PATTERN', refId: lowEnergyPatternId }],
        conflictingEvidenceRefs: [],
        changes: [{ field: 'DAYS_PER_WEEK', before: '7', after: '4' }],
      },
      {
        optionId: 'professional-support',
        kind: 'PROFESSIONAL_SUPPORT_NEXT_STEP',
        executionKind: 'NAVIGATE_PROFESSIONAL_SUPPORT',
        actionId: null,
        focusId: null,
        rationaleCodes: ['PROFESSIONAL_SUPPORT_ALWAYS_AVAILABLE'],
        evidenceRefs: [],
        conflictingEvidenceRefs: [],
        changes: [],
      },
    ],
    unavailableOptions: [
      { kind: 'DIFFERENT_TIME', reasonCode: 'NO_TIME_PREFERENCE' },
      { kind: 'ALTERNATIVE_ACTION', reasonCode: 'NO_SUPPORTING_PATTERN' },
      { kind: 'DIFFERENT_FOCUS', reasonCode: 'NO_ADMITTED_CANDIDATE' },
    ],
    reviewFingerprint: '3f2a9c4d7e1b6a5f8c0d2e4f6a8b0c1d',
    // Provider shape: Care emits the exact-period context on every review.
    evidenceContext: {
      comparisonPolicyVersion: 'reassessment-comparison-v1',
      previousPeriod: summary.previousPeriod,
      currentPeriod: summary.currentPeriod,
      timezone: 'UTC',
      selfReportedExperience: summary.selfReportedExperience!,
      engagementSources: [
        {
          occurrenceId: '30000000-0000-4000-8000-000000000642',
          occurrenceVersion: 2,
          actionId: emotionActionId,
          actionVersion: 1,
          supportPlanId: nativePlanId,
          sourcePlanVersion: 1,
          sourceSlotId: null,
          sourceResourceId: null,
          sourceContentVersion: null,
          scheduledAt: '2026-10-10T12:00:00Z',
          state: 'SKIPPED',
          helpfulness: null,
          barrierCode: 'LOW_ENERGY',
          engagementUpdatedAt: '2026-10-10T13:00:00Z',
        },
      ],
    },
  }
}

export function adaptiveConfirmationFixture(
  result: AdaptiveReviewConfirmation['result'] = 'CYCLE_CONTINUED',
  optionId = 'keep-current-1',
): AdaptiveReviewConfirmation {
  const plan = nativeSupportPlanFixture()
  plan.version = 2
  if (result !== 'DRAFT_PREPARED')
    return { result, optionId, plan, draft: null }
  const draft = nativeSupportPlanFixture()
  draft.supportPlanId = '10000000-0000-4000-8000-000000000652'
  draft.status = 'DRAFT'
  return { result, optionId, plan: nativeSupportPlanFixture(), draft }
}
