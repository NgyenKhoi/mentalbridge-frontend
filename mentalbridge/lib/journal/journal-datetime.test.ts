import { describe, expect, it, vi } from 'vitest'

import {
  formatJournalLocalDateTime,
  journalLocalDateTimeToIso,
} from './journal-datetime'

describe('journal local occurrence time', () => {
  it('formats a UTC instant with the browser non-UTC offset for datetime-local', () => {
    const instant = new Date('2026-09-11T03:15:00.000Z')
    vi.spyOn(instant, 'getTimezoneOffset').mockReturnValue(-420)

    expect(formatJournalLocalDateTime(instant)).toBe('2026-09-11T10:15')
  })

  it('rejects an invalid local calendar value before ISO conversion', () => {
    expect(journalLocalDateTimeToIso('2026-02-30T10:15')).toBeNull()
    expect(journalLocalDateTimeToIso('not-a-local-time')).toBeNull()
  })
})
