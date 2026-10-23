import { describe, expect, it } from 'vitest'
import { HOME_JOURNAL_PROMPTS, homeJournalPrompt } from './journal-prompts'

describe('homeJournalPrompt', () => {
  it('rotates through seven distinct neutral prompts and repeats after seven local dates', () => {
    expect(HOME_JOURNAL_PROMPTS).toHaveLength(7)
    const week = Array.from({ length: 7 }, (_, offset) =>
      homeJournalPrompt(new Date(2026, 9, 22 + offset, 12)),
    )
    expect(new Set(week).size).toBe(7)
    expect(week.every((prompt) => HOME_JOURNAL_PROMPTS.includes(prompt))).toBe(
      true,
    )
    expect(homeJournalPrompt(new Date(2026, 9, 29, 12))).toBe(week[0])
  })

  it('keeps the same prompt across a local day and changes at local midnight', () => {
    const morning = homeJournalPrompt(new Date(2026, 9, 22, 0, 0))
    const evening = homeJournalPrompt(new Date(2026, 9, 22, 23, 59, 59))
    expect(morning).toBe(evening)
    expect(homeJournalPrompt(new Date(2026, 9, 23, 0, 0))).not.toBe(evening)
  })

  it('uses the local calendar fields rather than the UTC date and handles dates before the epoch', () => {
    const displayedDate = new Date('2026-10-21T23:30:00Z')
    displayedDate.getFullYear = () => 2026
    displayedDate.getMonth = () => 9
    displayedDate.getDate = () => 22
    expect(homeJournalPrompt(displayedDate)).toBe(
      homeJournalPrompt(new Date(2026, 9, 22, 12)),
    )
    expect(HOME_JOURNAL_PROMPTS).toContain(
      homeJournalPrompt(new Date(1969, 11, 31, 12)),
    )
  })
})
