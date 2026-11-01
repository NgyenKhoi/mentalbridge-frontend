import type {
  PublicResourceDetail,
  PublicResourceSummary,
} from '@/features/resources/api/browser-resources'
import type { SupportGuide } from '@/features/support-guide/api/support-guide-contract'
import type { PlanResourceActionsV1 } from '@/features/support-plan/api/support-plan-contract'
import type { Appointment } from '@/lib/consultation/consultation-validation'
import { HOME_GUIDE_ID, HOME_PLAN_ID } from './home-next-step-fixture'

export function homeResourceFixture(
  changes: Partial<PublicResourceSummary> = {},
): PublicResourceSummary {
  return {
    id: '70000000-0000-4000-8000-000000000672',
    category: 'BREATHING',
    resourceKind: 'PRACTICE',
    interactionType: 'BREATHING_PACER',
    repeatability: 'REPEATABLE',
    completionMode: 'EXPLICIT',
    streakEligible: false,
    expectedDurationMinutes: 5,
    cooldownDays: 0,
    recommendedFrequencyPerWeek: 3,
    planTags: [],
    locale: 'vi-VN',
    title: 'Thở chậm cùng cơ thể',
    summary: 'Một bài tập thở.',
    status: 'PUBLISHED',
    createdAt: '2026-10-01T00:00:00Z',
    ...changes,
  }
}

export function homeResourceDetailFixture(
  changes: Partial<PublicResourceDetail> = {},
): PublicResourceDetail {
  return {
    ...homeResourceFixture(),
    contentVersion: '7',
    contentBody: null,
    structuredContent: {},
    interactionConfig: {},
    safetyNotes: [],
    sourceRetrievedAt: null,
    sourceContentHash: null,
    contentVersionLabel: 'Bản đã duyệt',
    sourceReviewStatus: 'REVIEWED',
    effectiveAt: null,
    expiresAt: null,
    ...changes,
  }
}

export function homePlanResourcesFixture(count = 3): PlanResourceActionsV1 {
  return {
    planState: 'ACTIVE',
    supportPlanId: HOME_PLAN_ID,
    supportPlanVersion: 2,
    representationMode: 'NATIVE_V3',
    timeZone: 'Asia/Ho_Chi_Minh',
    localDate: '2026-10-22',
    actions: Array.from({ length: count }, (_, index) => ({
      actionId: `action-${index}`,
      actionVersion: 1,
      title: `Mục ${index + 1}`,
      resource: {
        resourceId: `resource-${index}`,
        resourceVersion: '7',
        publicationId: `publication-${index}`,
      },
      schedule: null,
      today: {
        occurrenceId: `occurrence-${index}`,
        occurrenceVersion: 1,
        displayState: 'SCHEDULED',
        completionEvidence: null,
      },
    })),
  }
}

export function homeGuideFixture(resources = true): SupportGuide {
  return {
    supportGuideId: HOME_GUIDE_ID,
    guideVersion: 1,
    guidePolicyVersion: 'mb-support-guide-capstone-v1',
    supportEvaluationId: '20000000-0000-4000-8000-000000000672',
    generatedAt: '2026-10-22T03:00:00Z',
    guideType: 'ONE_TIME_SUPPORT_GUIDE',
    explanation: {
      code: 'STANDARD_POST_SCREENING_GUIDANCE',
      text: 'Gợi ý hỗ trợ.',
    },
    safety: {
      status: 'NEGATIVE_SAFETY_SCREEN',
      reasonCode: 'PHQ9_ITEM9_NEGATIVE',
      policyVersion: 'MB-SAFETY-PHQ9-001-v1',
      guidanceCode: 'STANDARD_SUPPORT_GUIDANCE',
      guidance: 'Gợi ý hỗ trợ.',
    },
    resourceResolution: {
      status: resources ? 'AVAILABLE' : 'EMPTY',
      policyVersion: 'content-eligibility-v1',
      resolvedAt: '2026-10-22T03:00:00Z',
    },
    resources: resources
      ? [
          {
            resourceId: 'guide-resource',
            contentVersion: '3',
            publicationId: 'guide-publication',
            domain: 'ANXIETY_SYMPTOMS',
            role: 'PRIMARY',
            category: 'ARTICLE',
            title: 'Tên lưu trong hướng dẫn',
            summary: 'Bài đọc.',
          },
        ]
      : [],
    provenance: {
      supportEvaluationPolicyVersion: 'mb-support-routing-capstone-v2',
      assessmentResults: [],
    },
    phrasing: {
      source: 'CARE_APPROVED_STANDARD',
      status: 'AI_UNAVAILABLE_FALLBACK',
    },
  }
}

export function homeAppointmentFixture(
  changes: Partial<Appointment> = {},
): Appointment {
  return {
    id: '80000000-0000-4000-8000-000000000672',
    slotId: '81000000-0000-4000-8000-000000000672',
    specialistAccountId: '82000000-0000-4000-8000-000000000672',
    specialistDisplayName: 'Nguyễn Minh An',
    status: 'CONFIRMED',
    modality: 'IN_APP_VIDEO',
    scheduledStartAt: '2099-10-24T02:00:00Z',
    scheduledEndAt: '2099-10-24T02:50:00Z',
    timezone: 'Asia/Ho_Chi_Minh',
    requestedAt: '2099-10-20T02:00:00Z',
    decisionDeadlineAt: '2099-10-23T02:00:00Z',
    heldCreditId: '83000000-0000-4000-8000-000000000672',
    replacesAppointmentId: null,
    replacedByAppointmentId: null,
    originatingPlanActionId: null,
    decidedAt: null,
    decisionReason: null,
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
    version: 1,
    ...changes,
  }
}
