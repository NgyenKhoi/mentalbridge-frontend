import { describe, expect, it } from 'vitest'

import {
  parseConsultationBrief,
  parseConsultationBriefAiDraftJob,
  parseConsultationBriefDraftRequest,
  parseSpecialistConsultationBrief,
  parseSpecialistClientContinuityList,
} from './consultation-brief-validation'

const screening = [
  {
    instrument: 'PHQ9',
    domain: 'DEPRESSIVE_SYMPTOMS',
    screeningLevel: 'MILD',
    questionnaireVersion: 'phq9-v2',
    scoringVersion: 'phq9-bands-v1',
    evaluatedAt: '2026-09-28T10:00:00Z',
    policyVersion: 'routing-v2',
  },
  {
    instrument: 'GAD7',
    domain: 'ANXIETY_SYMPTOMS',
    screeningLevel: 'MODERATE',
    questionnaireVersion: 'gad7-v1',
    scoringVersion: 'gad7-bands-v1',
    evaluatedAt: '2026-09-28T10:00:00Z',
    policyVersion: 'routing-v2',
  },
]

const ids = {
  brief: '10000000-0000-4000-8000-000000000001',
  appointment: '10000000-0000-4000-8000-000000000002',
  evaluation: '10000000-0000-4000-8000-000000000003',
  snapshot: '10000000-0000-4000-8000-000000000004',
}

describe('consultation brief runtime contract', () => {
  it('accepts exact successful AI provenance and rejects private or partial output', () => {
    const value = {
      jobId: ids.snapshot,
      appointmentId: ids.appointment,
      consultationBriefId: ids.brief,
      consultationBriefVersion: 3,
      supportEvaluationId: ids.evaluation,
      sourceSetVersion: 'consultation-brief-ai-source-v1',
      status: 'SUCCEEDED',
      attemptCount: 1,
      terminalReason: null,
      currentSituation: 'Editable suggestion',
      userGoals: ['Discuss one next step'],
      consentPolicyVersion: 'ai-processing-capstone-v2',
      servicePlan: 'PLUS',
      entitlementSource: 'SUBSCRIPTION',
      entitlementPolicyVersion: 'service-entitlement-v1',
      entitlementVersion: 4,
      routingPolicyVersion: 'exact-revision-routing-v1',
      providerApprovalVersion: 'benchmark-approval-v1',
      provider: 'GEMINI',
      model: 'gemini-approved',
      promptVersion: 'consultation-brief-draft-v1',
      schemaVersion: 1,
      createdAt: '2026-10-10T10:00:00Z',
      updatedAt: '2026-10-10T10:00:01Z',
      completedAt: '2026-10-10T10:00:01Z',
    }
    expect(parseConsultationBriefAiDraftJob(value)).not.toBeNull()
    expect(
      parseConsultationBriefAiDraftJob({ ...value, journalContent: 'private' }),
    ).toBeNull()
    expect(
      parseConsultationBriefAiDraftJob({ ...value, currentSituation: null }),
    ).toBeNull()
  })

  it('accepts only the three minimized draft fields', () => {
    expect(
      parseConsultationBriefDraftRequest({
        currentSituation: 'Áp lực công việc trong tuần này',
        supportEvaluationId: ids.evaluation,
        userGoals: ['Tìm một bước tiếp theo phù hợp'],
      }),
    ).not.toBeNull()
    expect(
      parseConsultationBriefDraftRequest({
        currentSituation: 'Áp lực công việc trong tuần này',
        supportEvaluationId: ids.evaluation,
        userGoals: ['Tìm một bước tiếp theo phù hợp'],
        journalContent: 'private raw journal',
      }),
    ).toBeNull()
    expect(
      parseConsultationBriefDraftRequest({
        currentSituation: '   ',
        supportEvaluationId: ids.evaluation,
        userGoals: ['   '],
      }),
    ).toBeNull()
  })

  it('accepts the owner state and rejects raw answers added by an upstream', () => {
    const value = {
      id: ids.brief,
      appointmentId: ids.appointment,
      status: 'APPROVED',
      currentSituation: 'Áp lực công việc trong tuần này',
      supportEvaluationId: ids.evaluation,
      screeningContext: screening,
      userGoals: ['Tìm một bước tiếp theo phù hợp'],
      approvedSnapshotId: ids.snapshot,
      sharingStatus: 'ACTIVE',
      accessStartAt: '2026-09-28T09:00:00Z',
      accessEndAt: '2026-09-30T09:00:00Z',
      version: 1,
      updatedAt: '2026-09-28T10:00:00Z',
    }
    expect(parseConsultationBrief(value)).not.toBeNull()
    expect(
      parseConsultationBrief({ ...value, assessmentAnswers: [] }),
    ).toBeNull()
    expect(
      parseConsultationBrief({
        ...value,
        status: 'DRAFT',
        sharingStatus: 'ACTIVE',
      }),
    ).toBeNull()
  })

  it('accepts only an exact immutable specialist snapshot', () => {
    const value = {
      snapshotId: ids.snapshot,
      appointmentId: ids.appointment,
      currentSituation: 'Áp lực công việc trong tuần này',
      supportEvaluationId: ids.evaluation,
      screeningContext: screening,
      userGoals: ['Tìm một bước tiếp theo phù hợp'],
      snapshotVersion: 1,
      approvedAt: '2026-09-28T10:00:00Z',
      accessStartAt: '2026-09-28T09:00:00Z',
      accessEndAt: '2026-09-30T09:00:00Z',
      sourceType: 'CONSULTATION_BRIEF',
    }
    expect(parseSpecialistConsultationBrief(value)).not.toBeNull()
    expect(
      parseSpecialistConsultationBrief({ ...value, diagnosis: 'x' }),
    ).toBeNull()
  })

  it('accepts only bounded continuity rows without private content', () => {
    const value = {
      items: [
        {
          appointmentId: ids.appointment,
          userAccountId: ids.brief,
          userDisplayName: 'Nguyễn Minh Anh',
          status: 'CONFIRMED',
          modality: 'IN_APP_CHAT',
          scheduledStartAt: '2026-10-04T10:00:00Z',
          scheduledEndAt: '2026-10-04T11:00:00Z',
          appointmentVersion: 1,
          briefAccessState: 'AVAILABLE',
          briefSnapshotVersion: 1,
          briefAccessStartAt: '2026-10-03T10:00:00Z',
          briefAccessEndAt: '2026-10-05T10:00:00Z',
        },
      ],
      count: 1,
      generatedAt: '2026-10-04T09:00:00Z',
      recentSince: '2026-07-06T09:00:00Z',
      policyVersion: 'specialist-client-continuity-v1',
    }
    expect(parseSpecialistClientContinuityList(value)).not.toBeNull()
    expect(
      parseSpecialistClientContinuityList({
        ...value,
        items: [{ ...value.items[0], journalEntries: [] }],
      }),
    ).toBeNull()
  })
})
