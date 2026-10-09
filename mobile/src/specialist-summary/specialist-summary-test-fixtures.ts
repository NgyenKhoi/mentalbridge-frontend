import {
  APPOINTMENT_ID,
  SPECIALIST_ID,
  USER_ID,
} from '@/specialist-appointments/specialist-appointment-test-fixtures'

import type {
  SessionSummary,
  SessionSummaryList,
} from './specialist-summary-contract'

export function makeSessionSummary(
  overrides: Partial<SessionSummary> = {},
): SessionSummary {
  return {
    id: '88888888-8888-4888-8888-888888888888',
    appointmentId: APPOINTMENT_ID,
    userAccountId: USER_ID,
    specialistAccountId: SPECIALIST_ID,
    version: 1,
    schemaVersion: 'session-summary-v1',
    topicsDiscussed: ['Nhịp ngủ'],
    progressSummary: 'Đã cùng nhìn lại nhịp ngủ gần đây.',
    specialistNoteForUser: 'Bắt đầu từ một thay đổi nhỏ.',
    followUpSuggested: true,
    amendsSummaryId: null,
    publishedAt: '2030-10-15T04:00:00.000Z',
    reuseConsent: null,
    agreedNextSteps: [
      {
        id: '99999999-9999-4999-8999-999999999999',
        type: 'JOURNAL',
        title: 'Ghi lại giờ ngủ trong ba ngày',
        details: null,
        resourceId: null,
        resourceVersion: null,
        resourceProposalReasonCode: null,
        state: null,
        hidden: false,
        stateVersion: null,
        stateUpdatedAt: null,
      },
    ],
    ...overrides,
  }
}

export function makeSessionSummaryList(
  items: SessionSummary[] = [makeSessionSummary()],
): SessionSummaryList {
  return {
    items,
    count: items.length,
    generatedAt: '2030-10-15T04:01:00.000Z',
  }
}
