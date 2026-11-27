import type { NativeSupportPlanReplacementReview } from '../api/support-plan-contract'
import { nativeSupportPlanFixture } from './native-support-plan-fixture'

const previousPeriod = {
  startAt: '2026-09-20T00:00:00Z',
  endAt: '2026-10-03T00:00:00Z',
}
const currentPeriod = {
  startAt: '2026-10-03T00:00:00Z',
  endAt: '2026-10-17T00:00:00Z',
}

export function nativeSupportPlanReviewFixture(): NativeSupportPlanReplacementReview {
  const currentPlan = nativeSupportPlanFixture()
  const proposedPlan = nativeSupportPlanFixture()
  proposedPlan.supportPlanId = '10000000-0000-4000-8000-000000000652'
  proposedPlan.status = 'DRAFT'
  proposedPlan.focuses[0].actions[0].presentation.title =
    'Check-in cảm xúc vào buổi sáng'
  return {
    outcome: 'CURRENT_PLAN_VALID_ALTERNATIVES_AVAILABLE',
    rationaleCodes: ['CURRENT_PLAN_ADMISSIBLE', 'PROPOSED_PLAN_ADMISSIBLE'],
    currentPlan,
    proposedPlan,
    reviewedAt: '2026-10-17T06:00:00Z',
    reassessmentSummary: {
      summaryId: 'c0000000-0000-4000-8000-000000000652',
      summaryVersion: 'reassessment-summary-v2',
      composedAt: '2026-10-17T05:55:00Z',
      previousPeriod,
      currentPeriod,
      screening: {
        state: 'AVAILABLE',
        trends: [
          {
            instrument: 'PHQ9',
            state: 'AVAILABLE',
            scoringVersion: 'phq9-v1',
            previous: {
              assessmentId: 'd0000000-0000-4000-8000-000000000651',
              questionnaireVersion: 'phq9-v1',
              submittedAt: '2026-10-02T04:00:00Z',
              totalScore: 10,
              screeningLevel: 'MODERATE',
            },
            current: {
              assessmentId: 'd0000000-0000-4000-8000-000000000652',
              questionnaireVersion: 'phq9-v1',
              submittedAt: '2026-10-17T04:00:00Z',
              totalScore: 7,
              screeningLevel: 'MILD',
            },
            rawDelta: -3,
            direction: 'DECREASED',
          },
          {
            instrument: 'GAD7',
            state: 'AVAILABLE',
            scoringVersion: 'gad7-v1',
            previous: {
              assessmentId: 'e0000000-0000-4000-8000-000000000651',
              questionnaireVersion: 'gad7-v1',
              submittedAt: '2026-10-02T04:05:00Z',
              totalScore: 6,
              screeningLevel: 'MILD',
            },
            current: {
              assessmentId: 'e0000000-0000-4000-8000-000000000652',
              questionnaireVersion: 'gad7-v1',
              submittedAt: '2026-10-17T04:05:00Z',
              totalScore: 9,
              screeningLevel: 'MILD',
            },
            rawDelta: 3,
            direction: 'INCREASED',
          },
        ],
      },
      journalContext: {
        state: 'INSUFFICIENT_DATA',
        unavailableReason: null,
        jobId: null,
        analysisId: null,
        sourceJournalRevisions: [],
        contextSignals: [],
        emotionIndicators: [],
        recurringThemes: [],
        changesComparedWithPreviousPeriod: [],
        preferences: [],
        barriers: [],
        helpfulPatterns: [],
        dataCoverage: {
          previousPeriodJournalEntryCount: 0,
          currentPeriodJournalEntryCount: 1,
          sufficientForComparison: false,
        },
        provenance: null,
      },
      supportPlanEngagement: {
        state: 'AVAILABLE',
        previousPeriod: { completedCount: 2, skippedCount: 1 },
        currentPeriod: { completedCount: 3, skippedCount: 2 },
        sources: [1, 2].map((index) => ({
          occurrenceId: `f0000000-0000-4000-8000-00000000065${index}`,
          supportPlanId: currentPlan.supportPlanId,
          sourcePlanVersion: currentPlan.version,
          sourceSlotId: `slot-${index}`,
          sourceResourceId: `a0000000-0000-4000-8000-00000000065${index}`,
          sourceContentVersion: 1,
          scheduledAt: `2026-10-${10 + index}T02:00:00Z`,
          period: 'CURRENT' as const,
          state: 'SKIPPED' as const,
          barrierCode: 'NOT_ENOUGH_TIME' as const,
        })),
      },
      selfReportedExperience: {
        state: 'AVAILABLE',
        unavailableReason: null,
        source: {
          selfReportId: 'b0000000-0000-4000-8000-000000000652',
          sourceVersion: 'reassessment-self-report-v1',
          sourceRevision: 1,
          currentPeriod,
          currentExperience: 'MORE_DIFFICULT',
          helpfulContext: null,
          difficultContext: null,
          authoredAt: '2026-10-17T04:15:00Z',
          updatedAt: '2026-10-17T04:15:00Z',
        },
      },
      activityReflection: {
        state: 'AVAILABLE',
        sources: [1, 2].map((index) => ({
          occurrenceId: `f0000000-0000-4000-8000-00000000066${index}`,
          period: 'CURRENT' as const,
          helpfulness: 'HELPFUL' as const,
          reflection: null,
          engagementUpdatedAt: `2026-10-${12 + index}T02:00:00Z`,
        })),
      },
      disclaimerCode: 'FOUR_DIMENSIONS_NOT_COMBINED',
    },
  }
}
