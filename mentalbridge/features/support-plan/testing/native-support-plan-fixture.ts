import type {
  ActionOccurrence,
  CompletionEvidence,
  SupportPlanV3,
} from '../api/support-plan-contract'

export const nativePlanId = '10000000-0000-4000-8000-000000000641'
export const emotionActionId = '20000000-0000-4000-8000-000000000641'
export const emotionOccurrenceId = '30000000-0000-4000-8000-000000000641'
const scheduleId = '40000000-0000-4000-8000-000000000641'
const createdAt = '2026-10-13T05:00:00Z'

export function nativeSupportPlanFixture(): SupportPlanV3 {
  return {
    supportPlanId: nativePlanId,
    modelVersion: 3,
    planPolicyVersion: 'support-plan-emotion-actions-v1',
    representationMode: 'NATIVE_V3',
    status: 'ACTIVE',
    version: 1,
    safety: {
      status: 'NEGATIVE_SAFETY_SCREEN',
      reasonCode: 'PHQ9_ITEM9_NEGATIVE',
      policyVersion: 'MB-SAFETY-PHQ9-001-v1',
      guidanceCode: 'STANDARD_SAFETY_REMINDER',
      guidance: 'Bạn có thể chủ động tìm hỗ trợ khi cần.',
    },
    focuses: [
      {
        focusId: '50000000-0000-4000-8000-000000000641',
        title: 'Một nhịp chăm sóc phù hợp',
        rationale: 'Các hoạt động theo lựa chọn đã lưu của bạn.',
        ordinal: 1,
        personalizationProvenance: {
          personalizationId: '60000000-0000-4000-8000-000000000641',
          revision: 1,
          schemaVersion: 'support-plan-personalization-v1',
          reasonCode: 'USER_PREFERENCE_AND_CARE_POLICY',
        },
        actions: [
          {
            actionId: emotionActionId,
            actionType: 'EMOTION_CHECK_IN',
            actionVersion: 1,
            representationMode: 'NATIVE_V3',
            status: 'ACTIVE',
            pathRole: 'ADJUNCT',
            purposeCode: 'NOTICE_SELF_REPORTED_EMOTIONS',
            rationale: 'Bạn đã chọn check-in cảm xúc.',
            ordinal: 1,
            source: {
              ownerDomain: 'JOURNAL_AI',
              sourceKind: 'EMOTION_CHECK_IN_CAPABILITY',
              sourceId: 'daily-emotion-check-in',
              sourceRevision: '1',
              sourcePolicyVersion: 'daily-emotion-check-in-v1',
              publicationId: null,
              eligibilityPolicyVersion: null,
              verifiedAt: createdAt,
            },
            provenance: {
              category: 'USER_SELECTED',
              referenceId: '60000000-0000-4000-8000-000000000641',
              referenceVersion: '1',
              acceptedAt: createdAt,
            },
            presentation: {
              title: 'Check-in cảm xúc',
              summary: 'Dành ít phút để ghi nhận cảm xúc của bạn.',
              instructions:
                'Lưu cảm xúc rồi quay lại đúng hoạt động để kiểm tra ghi nhận.',
              externalUrl: null,
            },
            schedules: [
              {
                scheduleId,
                version: 1,
                schedulePolicyVersion: 'support-plan-activity-schedule-v2',
                recurrenceType: 'DAILY',
                recurrenceDayOfWeek: null,
                daysOfWeek: [],
                localTime: '19:00',
                preferredDaypart: 'EVENING',
                timezone: 'Asia/Ho_Chi_Minh',
                effectiveFrom: '2026-10-13',
                effectiveUntil: null,
                estimatedDurationMinutes: 5,
                reminderEnabled: false,
                status: 'ACTIVE',
              },
            ],
            createdAt,
            updatedAt: createdAt,
            activatedAt: createdAt,
            endedAt: null,
          },
        ],
      },
    ],
    createdAt,
    updatedAt: createdAt,
    activatedAt: createdAt,
    completedAt: null,
    completionReason: null,
    supersededAt: null,
    discardedAt: null,
    disclaimerCode: 'WELLBEING_SUPPORT_NOT_TREATMENT',
    disclaimer:
      'Kế hoạch hỗ trợ sức khỏe tổng quát, không phải kế hoạch điều trị.',
  }
}

export function emotionOccurrenceFixture(): ActionOccurrence {
  return {
    occurrenceId: emotionOccurrenceId,
    actionId: emotionActionId,
    actionType: 'EMOTION_CHECK_IN',
    actionVersion: 1,
    scheduleId,
    scheduleVersion: 1,
    representationMode: 'NATIVE_V3',
    version: 0,
    localDate: '2026-10-13',
    scheduledAt: '2026-10-13T12:00:00Z',
    state: 'SCHEDULED',
    displayState: 'OVERDUE',
    stateReason: null,
    completionEvidence: null,
    outcomeRecordedAt: null,
  }
}

export function emotionCompletionFixture(): CompletionEvidence {
  return {
    kind: 'EMOTION_CHECK_IN',
    ownerDomain: 'JOURNAL_AI',
    factId: '70000000-0000-4000-8000-000000000641',
    factRevision: '1',
    occurredAt: '2026-10-13T13:00:00Z',
    verifiedAt: '2026-10-13T13:01:00Z',
  }
}
