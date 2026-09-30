import { describe, expect, it } from 'vitest'

import {
  parseConsultationBrief,
  parseConsultationBriefDraftRequest,
  parseSpecialistConsultationBrief,
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
    }
    expect(parseSpecialistConsultationBrief(value)).not.toBeNull()
    expect(
      parseSpecialistConsultationBrief({ ...value, diagnosis: 'x' }),
    ).toBeNull()
  })
})
