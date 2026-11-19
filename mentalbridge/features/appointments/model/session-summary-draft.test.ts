import { beforeEach, describe, expect, it } from 'vitest'
import {
  DRAFT_MAX_AGE_MS,
  clearSummaryDraft,
  readSummaryDraft,
  writeSummaryDraft,
} from './session-summary-draft'

const id = 'appointment-1'
const values = { topics: 'a', progress: '', note: '', steps: '' }

describe('session summary draft', () => {
  beforeEach(() => window.localStorage.clear())

  it('round-trips and clears a draft', () => {
    expect(writeSummaryDraft(id, values, 1000)).toBe(true)
    expect(readSummaryDraft(id, 2000)).toEqual({ ...values, savedAt: 1000 })
    clearSummaryDraft(id)
    expect(readSummaryDraft(id, 2000)).toBeNull()
  })

  it('expires after 48 hours and deletes the stale entry', () => {
    writeSummaryDraft(id, values, 0)
    expect(readSummaryDraft(id, DRAFT_MAX_AGE_MS)).not.toBeNull()
    expect(readSummaryDraft(id, DRAFT_MAX_AGE_MS + 1)).toBeNull()
    expect(window.localStorage.getItem(`mb.summaryDraft.${id}`)).toBeNull()
  })

  it('discards malformed storage instead of throwing', () => {
    window.localStorage.setItem(`mb.summaryDraft.${id}`, '{not json')
    expect(readSummaryDraft(id)).toBeNull()
    window.localStorage.setItem(
      `mb.summaryDraft.${id}`,
      JSON.stringify({ topics: 1, savedAt: Date.now() }),
    )
    expect(readSummaryDraft(id)).toBeNull()
    expect(window.localStorage.getItem(`mb.summaryDraft.${id}`)).toBeNull()
  })
})
