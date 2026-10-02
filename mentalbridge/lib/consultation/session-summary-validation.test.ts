import { describe, expect, it } from 'vitest'
import {
  parsePublishSessionSummaryInput,
  parseSessionSummary,
  parseSessionSummaryList,
  parseUpdateAgreedNextStepInput,
  SessionSummaryInputError,
} from './session-summary-validation'

const summary = {
  id: '10000000-0000-4000-8000-000000000001',
  appointmentId: '10000000-0000-4000-8000-000000000002',
  userAccountId: '10000000-0000-4000-8000-000000000003',
  specialistAccountId: '10000000-0000-4000-8000-000000000004',
  version: 1,
  schemaVersion: 'session-summary-v1',
  topicsDiscussed: ['Giấc ngủ'],
  progressSummary: 'Đã cùng nhìn lại thói quen gần đây.',
  specialistNoteForUser: null,
  followUpSuggested: false,
  amendsSummaryId: null,
  publishedAt: '2026-10-02T02:00:00Z',
  reuseConsent: {
    approved: false,
    version: 0,
    updatedAt: '2026-10-02T02:00:00Z',
  },
  agreedNextSteps: [
    {
      id: '10000000-0000-4000-8000-000000000005',
      type: 'JOURNAL',
      title: 'Viết nhật ký',
      details: null,
      resourceId: null,
      resourceVersion: null,
      state: 'PENDING',
      hidden: false,
      stateVersion: 0,
      stateUpdatedAt: '2026-10-02T02:00:00Z',
    },
  ],
}

describe('session summary contract validation', () => {
  it('accepts the bounded user-owned summary representation', () => {
    expect(parseSessionSummary(summary)).toEqual(summary)
    expect(
      parseSessionSummaryList({
        items: [summary],
        count: 1,
        generatedAt: '2026-10-02T02:01:00Z',
      }),
    ).not.toBeNull()
  })

  it('rejects malformed state instead of trusting a dependency response', () => {
    expect(
      parseSessionSummary({
        ...summary,
        agreedNextSteps: [{ ...summary.agreedNextSteps[0], state: 'DONE' }],
      }),
    ).toBeNull()
  })

  it('uses the 160-character topic limit from the service contract', () => {
    const boundary = 'a'.repeat(160)
    expect(
      parseSessionSummary({ ...summary, topicsDiscussed: [boundary] }),
    ).not.toBeNull()
    expect(
      parseSessionSummary({ ...summary, topicsDiscussed: [`${boundary}a`] }),
    ).toBeNull()
    expect(
      parsePublishSessionSummaryInput({
        topicsDiscussed: [boundary],
        followUpSuggested: false,
        agreedNextSteps: [],
      }).topicsDiscussed,
    ).toEqual([boundary])
    expect(() =>
      parsePublishSessionSummaryInput({
        topicsDiscussed: [`${boundary}a`],
        followUpSuggested: false,
        agreedNextSteps: [],
      }),
    ).toThrow(SessionSummaryInputError)
  })

  it('requires an exact version only for platform resources', () => {
    expect(() =>
      parsePublishSessionSummaryInput({
        topicsDiscussed: ['Giấc ngủ'],
        followUpSuggested: false,
        agreedNextSteps: [
          {
            type: 'PLATFORM_RESOURCE',
            title: 'Bài tập thở',
            resourceId: '10000000-0000-4000-8000-000000000006',
          },
        ],
      }),
    ).toThrow(SessionSummaryInputError)

    expect(
      parsePublishSessionSummaryInput({
        topicsDiscussed: [' Giấc ngủ '],
        followUpSuggested: false,
        agreedNextSteps: [
          {
            type: 'PLATFORM_RESOURCE',
            title: 'Bài tập thở',
            resourceId: '10000000-0000-4000-8000-000000000006',
            resourceVersion: 'resource-v3',
          },
        ],
      }).topicsDiscussed,
    ).toEqual(['Giấc ngủ'])
  })

  it('allows only the user-owned state and visibility fields', () => {
    expect(
      parseUpdateAgreedNextStepInput({ state: 'COMPLETED', hidden: true }),
    ).toEqual({ state: 'COMPLETED', hidden: true })
    expect(() =>
      parseUpdateAgreedNextStepInput({
        state: 'COMPLETED',
        hidden: true,
        title: 'changed by user',
      }),
    ).toThrow(SessionSummaryInputError)
  })
})
