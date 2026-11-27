import { describe, expect, it, vi } from 'vitest'
import { businessDateRange } from './business-date-range'

describe('Vietnam business date range', () => {
  it('uses local midnight and includes the last fractional second before the next day', () => {
    expect(businessDateRange('2026-10-23', '2026-10-23')).toEqual({
      error: null,
      query: {
        from: '2026-10-22T17:00:00.000Z',
        toExclusive: '2026-10-23T17:00:00.000Z',
      },
    })
    const { query } = businessDateRange('2026-10-23', '2026-10-23')
    expect('2026-10-23T16:59:59.999Z' < query.toExclusive).toBe(true)
    expect('2026-10-23T17:00:00.000Z' < query.toExclusive).toBe(false)
  })

  it('crosses month and year boundaries without browser timezone dependence', () => {
    const expected = businessDateRange('2026-12-31', '2027-01-01')
    expect(expected.query).toEqual({
      from: '2026-12-30T17:00:00.000Z',
      toExclusive: '2027-01-01T17:00:00.000Z',
    })
    for (const timezone of ['UTC', 'America/New_York', 'Asia/Ho_Chi_Minh']) {
      vi.stubEnv('TZ', timezone)
      expect(businessDateRange('2026-12-31', '2027-01-01')).toEqual(expected)
    }
    vi.unstubAllEnvs()
  })

  it('rejects reversed, malformed, and nonexistent calendar dates', () => {
    expect(businessDateRange('2026-10-24', '2026-10-23').error).toBeTruthy()
    expect(businessDateRange('2026-02-30', '').error).toBeTruthy()
    expect(businessDateRange('', '2026-13-01').error).toBeTruthy()
    expect(businessDateRange('2024-02-29', '').error).toBeNull()
  })
})
