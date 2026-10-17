import type {
  ActionOccurrence,
  CanonicalSupportPlan,
  EmotionReconciliation,
} from './support-plan-action-contract'
import { makePlan } from './support-plan-test-fixtures'

export const nativeIds = {
  plan: '10000000-0000-4000-8000-000000000641',
  action: '20000000-0000-4000-8000-000000000641',
  occurrence: '30000000-0000-4000-8000-000000000641',
  schedule: '40000000-0000-4000-8000-000000000641',
  evaluation: '50000000-0000-4000-8000-000000000641',
}
export function nativePlan(
  status: CanonicalSupportPlan['status'] = 'ACTIVE',
): CanonicalSupportPlan {
  const instant = '2026-10-13T01:00:00Z'
  return {
    supportPlanId: nativeIds.plan,
    modelVersion: 3,
    planPolicyVersion: 'support-plan-emotion-actions-v1',
    representationMode: 'NATIVE_V3',
    status,
    version: 1,
    safety: makePlan().safety,
    focuses: [
      {
        focusId: 'emotion',
        title: 'Nhận biết cảm xúc',
        rationale: null,
        ordinal: 1,
        personalizationProvenance: null,
        actions: [
          {
            actionId: nativeIds.action,
            actionType: 'EMOTION_CHECK_IN',
            actionVersion: 1,
            representationMode: 'NATIVE_V3',
            status: status === 'DRAFT' ? 'DRAFT' : 'ACTIVE',
            pathRole: 'ADJUNCT',
            purposeCode: 'NOTICE_SELF_REPORTED_EMOTIONS',
            rationale: null,
            ordinal: 1,
            source: {
              ownerDomain: 'JOURNAL_AI',
              sourceKind: 'EMOTION_CHECK_IN_CAPABILITY',
              sourceId: 'daily-emotion-check-in',
              sourceRevision: '1',
              sourcePolicyVersion: 'daily-emotion-check-in-v1',
              publicationId: null,
              eligibilityPolicyVersion: null,
              verifiedAt: instant,
            },
            provenance: {
              category: 'USER_SELECTED',
              referenceId: null,
              referenceVersion: null,
              acceptedAt: instant,
            },
            presentation: {
              title: 'Dành một phút nhìn lại cảm xúc',
              summary: 'Nhận biết điều bạn đang cảm nhận.',
              instructions: null,
              externalUrl: null,
            },
            schedules: [
              {
                scheduleId: nativeIds.schedule,
                version: 1,
                schedulePolicyVersion: 'support-plan-activity-schedule-v2',
                recurrenceType: 'DAILY',
                recurrenceDayOfWeek: null,
                daysOfWeek: [],
                preferredDaypart: 'EVENING',
                estimatedDurationMinutes: 5,
                localTime: '19:00:00',
                timezone: 'Asia/Ho_Chi_Minh',
                effectiveFrom: '2026-10-13',
                effectiveUntil: null,
                reminderEnabled: false,
                status: status === 'DRAFT' ? 'DRAFT' : 'ACTIVE',
              },
            ],
            createdAt: instant,
            updatedAt: instant,
            activatedAt: status === 'DRAFT' ? null : instant,
            endedAt: null,
          },
        ],
      },
    ],
    createdAt: instant,
    updatedAt: instant,
    activatedAt: status === 'DRAFT' ? null : instant,
    completedAt: null,
    completionReason: null,
    supersededAt: null,
    discardedAt: null,
    disclaimerCode: 'WELLBEING_SUPPORT_NOT_TREATMENT',
    disclaimer: 'Kế hoạch hỗ trợ sức khỏe tinh thần, không thay thế điều trị.',
  }
}
export function nativeOccurrence(
  overrides: Partial<ActionOccurrence> = {},
): ActionOccurrence {
  return {
    occurrenceId: nativeIds.occurrence,
    actionId: nativeIds.action,
    actionType: 'EMOTION_CHECK_IN',
    actionVersion: 1,
    scheduleId: nativeIds.schedule,
    scheduleVersion: 1,
    representationMode: 'NATIVE_V3',
    version: 0,
    localDate: '2026-10-13',
    scheduledAt: '2026-10-13T12:00:00Z',
    state: 'SCHEDULED',
    displayState: 'SCHEDULED',
    stateReason: null,
    completionEvidence: null,
    outcomeRecordedAt: null,
    ...overrides,
  }
}
export function reconciliation(
  sourceState: EmotionReconciliation['sourceState'] = 'RECORDED',
  completed = true,
): EmotionReconciliation {
  return {
    schemaVersion: 'emotion-check-in-occurrence-reconciliation-v1',
    occurrenceId: nativeIds.occurrence,
    actionId: nativeIds.action,
    localDate: '2026-10-13',
    sourceState,
    occurrenceState: completed ? 'COMPLETED' : 'SCHEDULED',
    version: completed ? 1 : 0,
    completedAt: completed ? '2026-10-13T12:02:00Z' : null,
    completionEvidence: completed
      ? {
          ownerDomain: 'JOURNAL_AI',
          kind: 'EMOTION_CHECK_IN',
          factId: '60000000-0000-4000-8000-000000000641',
          factRevision: '1',
          occurredAt: '2026-10-13T12:01:00Z',
          verifiedAt: '2026-10-13T12:02:00Z',
        }
      : null,
  }
}
