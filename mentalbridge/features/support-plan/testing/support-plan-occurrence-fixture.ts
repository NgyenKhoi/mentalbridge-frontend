import type {
  SupportPlanOccurrence,
  SupportPlanOccurrenceList,
} from '../api/support-plan-contract'

export function supportPlanOccurrenceFixture(
  changes: Partial<SupportPlanOccurrence> = {},
): SupportPlanOccurrence {
  return {
    occurrenceId: '91000000-0000-4000-8000-000000000513',
    supportPlanId: '10000000-0000-4000-8000-000000000373',
    scheduleId: '92000000-0000-4000-8000-000000000513',
    scheduleVersion: 1,
    localDate: '2026-09-21',
    localTime: '08:00:00',
    timezone: 'Asia/Ho_Chi_Minh',
    scheduledAt: '2026-09-21T01:00:00Z',
    state: 'SCHEDULED',
    displayState: 'SCHEDULED',
    stateReason: null,
    version: 0,
    source: {
      type: 'RESOURCE',
      supportPlanVersion: 1,
      slotId: 'depressive-psychoeducation',
      resourceId: '30000000-0000-4000-8000-000000000372',
      contentVersion: '4',
      title: 'Reviewed primary resource',
    },
    updatedAt: '2026-09-21T00:00:00Z',
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
    ...changes,
  }
}

export function supportPlanOccurrenceListFixture(
  occurrences: SupportPlanOccurrence[] = [supportPlanOccurrenceFixture()],
): SupportPlanOccurrenceList {
  return {
    supportPlanId: '10000000-0000-4000-8000-000000000373',
    supportPlanStatus: 'ACTIVE',
    schedulePolicyVersion: 'support-plan-activity-schedule-v1',
    from: '2026-09-21',
    through: '2026-10-04',
    occurrences,
    interpretationCode:
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
  }
}
