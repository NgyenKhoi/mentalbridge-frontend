import {
  APPOINTMENT_ID,
  USER_ID,
} from '@/specialist-appointments/specialist-appointment-test-fixtures'

import type {
  SpecialistClientContinuityItem,
  SpecialistClientContinuityList,
  SpecialistConsultationBrief,
} from './specialist-continuity-contract'

export function makeContinuityItem(
  overrides: Partial<SpecialistClientContinuityItem> = {},
): SpecialistClientContinuityItem {
  return {
    appointmentId: APPOINTMENT_ID,
    userAccountId: USER_ID,
    userDisplayName: 'Người dùng thử nghiệm',
    status: 'CONFIRMED',
    modality: 'IN_APP_CHAT',
    scheduledStartAt: '2030-10-15T02:00:00.000Z',
    scheduledEndAt: '2030-10-15T03:00:00.000Z',
    appointmentVersion: 2,
    briefAccessState: 'AVAILABLE',
    briefSnapshotVersion: 1,
    briefAccessStartAt: '2030-10-14T02:00:00.000Z',
    briefAccessEndAt: '2030-10-16T02:00:00.000Z',
    ...overrides,
  }
}

export function makeContinuityList(
  items: SpecialistClientContinuityItem[] = [makeContinuityItem()],
): SpecialistClientContinuityList {
  return {
    items,
    count: items.length,
    generatedAt: '2030-10-15T01:00:00.000Z',
    recentSince: '2030-07-17T01:00:00.000Z',
    policyVersion: 'specialist-client-continuity-v1',
  }
}

export function makeConsultationBrief(
  overrides: Partial<SpecialistConsultationBrief> = {},
): SpecialistConsultationBrief {
  return {
    snapshotId: '66666666-6666-4666-8666-666666666666',
    appointmentId: APPOINTMENT_ID,
    currentSituation: 'Gần đây tôi khó giữ nhịp ngủ ổn định.',
    supportEvaluationId: '77777777-7777-4777-8777-777777777777',
    screeningContext: [
      {
        instrument: 'PHQ9',
        domain: 'DEPRESSIVE_SYMPTOMS',
        screeningLevel: 'MILD',
        questionnaireVersion: 'phq9-v1',
        scoringVersion: 'phq9-score-v1',
        evaluatedAt: '2030-10-01T00:00:00.000Z',
        policyVersion: 'support-v1',
      },
      {
        instrument: 'GAD7',
        domain: 'ANXIETY_SYMPTOMS',
        screeningLevel: 'MODERATE',
        questionnaireVersion: 'gad7-v1',
        scoringVersion: 'gad7-score-v1',
        evaluatedAt: '2030-10-01T00:00:00.000Z',
        policyVersion: 'support-v1',
      },
    ],
    userGoals: ['Thống nhất một bước nhỏ cho tuần tới'],
    snapshotVersion: 1,
    approvedAt: '2030-10-14T02:00:00.000Z',
    accessStartAt: '2030-10-14T02:00:00.000Z',
    accessEndAt: '2030-10-16T02:00:00.000Z',
    sourceType: 'CONSULTATION_BRIEF',
    ...overrides,
  }
}
