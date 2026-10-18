import { describe, expect, it } from 'vitest'
import type { ActionOccurrence } from '../api/support-plan-contract'
import {
  emotionCompletionFixture,
  emotionOccurrenceFixture,
  nativeSupportPlanFixture,
} from '../testing/native-support-plan-fixture'
import { acceptedJournalHref } from './TodayPanel'
import { planActions, type PlannedOccurrence } from './workspace-model'

const journalId = '70000000-0000-4000-8000-000000000642'

function journalItem(overrides: Partial<ActionOccurrence> = {}) {
  return {
    action: planActions(nativeSupportPlanFixture())[0],
    occurrence: {
      ...emotionOccurrenceFixture(),
      actionType: 'JOURNAL',
      state: 'COMPLETED',
      displayState: 'COMPLETED',
      completionEvidence: {
        ...emotionCompletionFixture(),
        kind: 'JOURNAL_ENTRY',
        factId: journalId,
      },
      ...overrides,
    },
  } as PlannedOccurrence
}

describe('accepted Journal entry link', () => {
  it('opens the stored accepted entry read-only', () => {
    const href = acceptedJournalHref(journalItem())
    expect(href).toMatch(/^\/journal\?/)
    expect(new URLSearchParams(href!.split('?')[1]).get('journalId')).toBe(
      journalId,
    )
  })

  it('offers nothing without accepted Journal evidence', () => {
    expect(
      acceptedJournalHref(
        journalItem({
          completionEvidence: {
            ...emotionCompletionFixture(),
            kind: 'JOURNAL_ENTRY',
            ownerDomain: 'CARE',
          } as ActionOccurrence['completionEvidence'],
        }),
      ),
    ).toBeUndefined()
    expect(
      acceptedJournalHref(
        journalItem({ completionEvidence: emotionCompletionFixture() }),
      ),
    ).toBeUndefined()
    expect(
      acceptedJournalHref(
        journalItem({ state: 'SKIPPED', displayState: 'SKIPPED' }),
      ),
    ).toBeUndefined()
  })
})
