import type {
  ConsultationBrief,
  ConsultationBriefScreeningContextChoice,
  ConsultationBriefScreeningContextList,
} from './consultation-brief-contract'

export const appointmentId = '11111111-1111-4111-8111-111111111111'
export const otherAppointmentId = '55555555-5555-4555-8555-555555555555'
export const supportEvaluationId = '33333333-3333-4333-8333-333333333333'

export const screeningChoice: ConsultationBriefScreeningContextChoice = {
  supportEvaluationId,
  evaluatedAt: '2026-10-10T08:00:00Z',
  screeningContext: [
    {
      instrument: 'PHQ9',
      domain: 'DEPRESSIVE_SYMPTOMS',
      screeningLevel: 'MILD',
      questionnaireVersion: 'phq9-v1',
      scoringVersion: 'phq9-score-v1',
      evaluatedAt: '2026-10-10T08:00:00Z',
      policyVersion: 'screening-context-v1',
    },
    {
      instrument: 'GAD7',
      domain: 'ANXIETY_SYMPTOMS',
      screeningLevel: 'MILD',
      questionnaireVersion: 'gad7-v1',
      scoringVersion: 'gad7-score-v1',
      evaluatedAt: '2026-10-10T08:00:00Z',
      policyVersion: 'screening-context-v1',
    },
  ],
}

export const screeningChoices: ConsultationBriefScreeningContextList = {
  items: [screeningChoice],
  count: 1,
}

export const draftBrief: ConsultationBrief = {
  id: '22222222-2222-4222-8222-222222222222',
  appointmentId,
  status: 'DRAFT',
  currentSituation:
    'Tôi muốn trao đổi về nhịp sinh hoạt và cách sắp xếp thời gian nghỉ.',
  supportEvaluationId,
  screeningContext: screeningChoice.screeningContext,
  userGoals: [
    'Chọn một bước nhỏ có thể thực hiện trong tuần.',
    'Thống nhất cách theo dõi sau buổi trao đổi.',
  ],
  approvedSnapshotId: null,
  sharingStatus: 'NONE',
  accessStartAt: null,
  accessEndAt: null,
  version: 1,
  updatedAt: '2026-10-10T09:00:00Z',
}

export const activeBrief: ConsultationBrief = {
  ...draftBrief,
  status: 'APPROVED',
  approvedSnapshotId: '44444444-4444-4444-8444-444444444444',
  sharingStatus: 'ACTIVE',
  accessStartAt: '2026-10-14T09:00:00Z',
  accessEndAt: '2026-10-16T09:00:00Z',
  version: 2,
  updatedAt: '2026-10-10T09:05:00Z',
}

export const revokedBrief: ConsultationBrief = {
  ...activeBrief,
  sharingStatus: 'REVOKED',
  version: 3,
  updatedAt: '2026-10-10T09:10:00Z',
}
