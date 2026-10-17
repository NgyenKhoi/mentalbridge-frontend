import type {
  PlanChangeRequest,
  SupportPlan,
  SupportPlanOccurrence,
  SupportPlanOccurrenceList,
} from './support-plan-contract'

const ids = {
  currentPlan: '10000000-0000-4000-8000-000000000001',
  draftPlan: '10000000-0000-4000-8000-000000000002',
  evaluation: '20000000-0000-4000-8000-000000000001',
  resource: '30000000-0000-4000-8000-000000000001',
  alternative: '30000000-0000-4000-8000-000000000002',
  publication: '40000000-0000-4000-8000-000000000001',
  occurrence: '50000000-0000-4000-8000-000000000001',
  schedule: '60000000-0000-4000-8000-000000000001',
  request: '70000000-0000-4000-8000-000000000001',
  proposal: '80000000-0000-4000-8000-000000000001',
  appointment: '90000000-0000-4000-8000-000000000001',
  summary: 'a0000000-0000-4000-8000-000000000001',
  specialist: 'b0000000-0000-4000-8000-000000000001',
} as const

export function makePlan(
  status: SupportPlan['status'] = 'ACTIVE',
  overrides: Partial<SupportPlan> = {},
): SupportPlan {
  return {
    supportPlanId: status === 'DRAFT' ? ids.draftPlan : ids.currentPlan,
    status,
    version: 3,
    source: {
      supportEvaluationId: ids.evaluation,
      evaluationVersion: 2,
      evaluationPolicyVersion: 'mb-support-routing-capstone-v2',
      evaluatedAt: '2026-10-06T08:00:00.000Z',
      selectionPolicyVersion: 'mb-support-plan-selection-v1',
      resourceEligibilityPolicyVersion: 'content-eligibility-v1',
      resourcesResolvedAt: '2026-10-06T08:01:00.000Z',
    },
    entitlement: {
      packageCode: 'PLUS',
      source: 'PAID',
      policyVersion: 'service-entitlement-v1',
      version: 1,
      decidedAt: '2026-10-06T08:00:00.000Z',
    },
    rationale: {
      code: 'DOMAIN_AWARE_WELLBEING_SUPPORT',
      text: 'Các hoạt động hỗ trợ sức khỏe tinh thần đã được kiểm tra.',
    },
    safety: {
      status: 'NEGATIVE_SAFETY_SCREEN',
      reasonCode: 'PHQ9_ITEM9_NEGATIVE',
      policyVersion: 'phq9-item9-v1',
      guidanceCode: 'STANDARD_SAFETY_REMINDER',
      guidance: 'Bạn có thể chủ động tìm hỗ trợ khi cần.',
    },
    templateFamilies: [
      {
        family: 'ANXIETY_SELF_GUIDED',
        templateVersion: 1,
        targetDomain: 'ANXIETY_SYMPTOMS',
      },
    ],
    slots: [
      {
        slotId: 'breathing-core',
        kind: 'CORE',
        targetDomain: 'ANXIETY_SYMPTOMS',
        purposeCode: 'GROUNDING',
        selectedResource: {
          resourceId: ids.resource,
          contentVersion: '1',
          publicationId: ids.publication,
          role: 'PRIMARY',
          category: 'BREATHING',
          title: 'Thở chậm trong 3 phút',
          summary: 'Một bài thở ngắn để bạn quay lại nhịp hiện tại.',
          externalUrl: 'https://example.test/resources/breathing',
        },
        allowedAlternatives: [
          {
            resourceId: ids.resource,
            contentVersion: '1',
            publicationId: ids.publication,
            role: 'PRIMARY',
            category: 'BREATHING',
            title: 'Thở chậm trong 3 phút',
            summary: 'Một bài thở ngắn để bạn quay lại nhịp hiện tại.',
            externalUrl: 'https://example.test/resources/breathing',
          },
          {
            resourceId: ids.alternative,
            contentVersion: '2',
            publicationId: '40000000-0000-4000-8000-000000000002',
            role: 'PRIMARY',
            category: 'MEDITATION',
            title: 'Thư giãn có hướng dẫn',
            summary: 'Một lựa chọn khác đã được xác nhận là phù hợp.',
            externalUrl: null,
          },
        ],
      },
    ],
    selectedResourceCount: 1,
    createdAt: '2026-10-06T08:00:00.000Z',
    updatedAt: '2026-10-06T08:10:00.000Z',
    activatedAt: status === 'DRAFT' ? null : '2026-10-06T08:05:00.000Z',
    completedAt: status === 'COMPLETED' ? '2026-10-07T08:00:00.000Z' : null,
    completionReason: null,
    supersededAt: null,
    discardedAt: null,
    disclaimerCode: 'WELLBEING_SUPPORT_NOT_TREATMENT',
    disclaimer:
      'Kế hoạch này hỗ trợ sức khỏe tinh thần và không thay thế điều trị.',
    ...overrides,
  }
}

export function makeOccurrence(
  overrides: Partial<SupportPlanOccurrence> = {},
): SupportPlanOccurrence {
  return {
    occurrenceId: ids.occurrence,
    supportPlanId: ids.currentPlan,
    scheduleId: ids.schedule,
    scheduleVersion: 1,
    localDate: '2026-10-07',
    localTime: '09:00:00',
    timezone: 'Asia/Ho_Chi_Minh',
    scheduledAt: '2026-10-07T02:00:00.000Z',
    state: 'SCHEDULED',
    displayState: 'SCHEDULED',
    stateReason: null,
    version: 2,
    source: {
      type: 'RESOURCE',
      supportPlanVersion: 3,
      slotId: 'breathing-core',
      resourceId: ids.resource,
      contentVersion: '1',
      title: 'Thở chậm trong 3 phút',
    },
    updatedAt: '2026-10-07T01:00:00.000Z',
    completedAt: null,
    skippedAt: null,
    cancelledAt: null,
    hidden: false,
    helpfulness: null,
    barrierCode: null,
    reflection: null,
    summaryReuseApproved: false,
    engagementUpdatedAt: null,
    interpretationCode:
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
    ...overrides,
  }
}

export function makeOccurrenceList(
  occurrences: SupportPlanOccurrence[] = [makeOccurrence()],
): SupportPlanOccurrenceList {
  return {
    supportPlanId: ids.currentPlan,
    supportPlanStatus: 'ACTIVE',
    schedulePolicyVersion: 'support-plan-activity-schedule-v1',
    from: '2026-10-01',
    through: '2026-10-21',
    occurrences,
    interpretationCode:
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
  }
}

export function makePlanChangeRequest(
  overrides: Partial<PlanChangeRequest> = {},
): PlanChangeRequest {
  return {
    requestId: ids.request,
    version: 0,
    status: 'READY_FOR_REVIEW',
    outcomeCode: 'PROPOSAL_ADMISSIBLE',
    sourceProposalId: ids.proposal,
    sourceAppointmentId: ids.appointment,
    sourceSummaryId: ids.summary,
    specialistId: ids.specialist,
    proposalReasonCode: 'POST_CONSULTATION_CONTINUITY',
    proposalDetails: 'Thử một hoạt động ngắn hơn trong tuần tới.',
    targetSlotId: 'breathing-core',
    currentResource: {
      resourceId: ids.resource,
      resourceVersion: '1',
      title: 'Thở chậm trong 3 phút',
    },
    proposedResource: {
      resourceId: ids.alternative,
      resourceVersion: '2',
      title: 'Thư giãn có hướng dẫn',
    },
    currentSupportPlanId: ids.currentPlan,
    currentSupportPlanVersion: 3,
    replacementSupportPlanId: null,
    replacementSupportPlanVersion: null,
    reviewedAt: '2026-10-07T01:00:00.000Z',
    decidedAt: null,
    createdAt: '2026-10-07T01:00:00.000Z',
    updatedAt: '2026-10-07T01:00:00.000Z',
    ...overrides,
  }
}

export function makeReassessmentSummary() {
  return {
    summaryId: ids.summary,
    summaryVersion: 'reassessment-summary-v2' as const,
    composedAt: '2026-10-07T01:00:00.000Z',
    previousPeriod: {
      startAt: '2026-09-09T00:00:00.000Z',
      endAt: '2026-09-23T00:00:00.000Z',
    },
    currentPeriod: {
      startAt: '2026-09-23T00:00:00.000Z',
      endAt: '2026-10-07T00:00:00.000Z',
    },
    screening: {
      state: 'AVAILABLE' as const,
      trends: [{ instrument: 'PHQ9' }, { instrument: 'GAD7' }],
    },
    journalContext: {
      state: 'INSUFFICIENT_DATA' as const,
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
      dataCoverage: null,
      provenance: null,
    },
    supportPlanEngagement: {
      state: 'AVAILABLE' as const,
      previousPeriod: { completedCount: 1, skippedCount: 0 },
      currentPeriod: { completedCount: 2, skippedCount: 1 },
      sources: [],
    },
    disclaimerCode: 'FOUR_DIMENSIONS_NOT_COMBINED' as const,
  }
}

export { ids as supportPlanFixtureIds }
