import { describe, expect, it } from 'vitest'

import { makeSummary } from '@/tests/fixtures/reassessment-review'

import {
  parseReassessmentSummary,
  parseReassessmentSummaryHistoryPage,
} from './care-validation'

const journal = () => makeSummary().journalContext as Record<string, unknown>

function withJournal(changes: Record<string, unknown>) {
  return makeSummary({ journalContext: { ...journal(), ...changes } })
}

describe('parseReassessmentSummary (fields the review renders)', () => {
  it('accepts a complete summary', () => {
    expect(parseReassessmentSummary(makeSummary())).not.toBeNull()
  })

  it.each([
    ['missing recurringThemes', withJournal({ recurringThemes: undefined })],
    ['missing helpfulPatterns', withJournal({ helpfulPatterns: undefined })],
    ['non-string theme', withJournal({ recurringThemes: [3] })],
    [
      'unknown change direction',
      withJournal({
        changesComparedWithPreviousPeriod: [
          { signal: 'Giấc ngủ', direction: 'BETTER' },
        ],
      }),
    ],
    [
      'malformed coverage',
      withJournal({ dataCoverage: { currentPeriodJournalEntryCount: 'x' } }),
    ],
    [
      'engagement source without an occurrence id',
      makeSummary({
        supportPlanEngagement: {
          ...(makeSummary().supportPlanEngagement as object),
          sources: [{ period: 'CURRENT', state: 'COMPLETED' }],
        },
      }),
    ],
    [
      'reflection source with an unknown helpfulness',
      makeSummary({
        activityReflection: {
          state: 'AVAILABLE',
          sources: [
            {
              occurrenceId: '70000000-0000-4000-8000-000000000001',
              period: 'CURRENT',
              helpfulness: 'AMAZING',
              reflection: null,
              engagementUpdatedAt: '2026-11-01T00:00:00Z',
            },
          ],
        },
      }),
    ],
  ])('rejects %s', (_name, payload) => {
    expect(parseReassessmentSummary(payload)).toBeNull()
  })

  it('rejects a history page that contains one malformed snapshot', () => {
    const page = (items: unknown[]) => ({
      items,
      nextCursor: null,
      hasMore: false,
    })
    expect(
      parseReassessmentSummaryHistoryPage(page([makeSummary()])),
    ).not.toBeNull()
    expect(
      parseReassessmentSummaryHistoryPage(
        page([makeSummary(), withJournal({ recurringThemes: undefined })]),
      ),
    ).toBeNull()
  })
})
