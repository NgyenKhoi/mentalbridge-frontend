import { describe, expect, it, afterEach } from 'vitest'
import { evaluateSourceFreshness } from './source-freshness'

describe('evaluateSourceFreshness', () => {
  const baseTime = 1_700_000_000_000 // Fixed epoch for reproducible tests

  it('classifies timestamp within maxAge as AVAILABLE', () => {
    // 2 minutes ago (120_000 ms < 300_000 ms)
    const asOf = new Date(baseTime - 120_000).toISOString()
    const result = evaluateSourceFreshness(asOf, 'IDENTITY', { now: baseTime })

    expect(result.status).toBe('AVAILABLE')
    expect(result.ageMs).toBe(120_000)
    expect(result.rationale).toBeUndefined()
  })

  it('classifies timestamp older than default 5 minutes as STALE with real age and rationale', () => {
    // 6 minutes ago (360_000 ms > 300_000 ms)
    const asOf = new Date(baseTime - 360_000).toISOString()
    const result = evaluateSourceFreshness(asOf, 'CONSULTATION', {
      now: baseTime,
    })

    expect(result.status).toBe('STALE')
    expect(result.ageMs).toBe(360_000)
    expect(result.rationale).toContain('exceeds max-age threshold of 300000ms')
    expect(result.rationale).toContain('CONSULTATION')
  })

  it('respects explicitly provided maxAgeMs option', () => {
    // 30 seconds ago
    const asOf = new Date(baseTime - 30_000).toISOString()

    // With 20s maxAge, 30s is STALE
    const staleResult = evaluateSourceFreshness(asOf, 'IDENTITY', {
      now: baseTime,
      maxAgeMs: 20_000,
    })
    expect(staleResult.status).toBe('STALE')
    expect(staleResult.rationale).toContain(
      'exceeds max-age threshold of 20000ms',
    )

    // With 60s maxAge, 30s is AVAILABLE
    const availableResult = evaluateSourceFreshness(asOf, 'IDENTITY', {
      now: baseTime,
      maxAgeMs: 60_000,
    })
    expect(availableResult.status).toBe('AVAILABLE')
  })

  describe('environment variable overrides', () => {
    const envKey = 'OPERATIONS_DASHBOARD_COMMUNITY_MAX_AGE_MS'
    const originalVal = process.env[envKey]

    afterEach(() => {
      if (originalVal !== undefined) {
        process.env[envKey] = originalVal
      } else {
        delete process.env[envKey]
      }
    })

    it('uses environment variable max-age override when present', () => {
      process.env[envKey] = '600000' // 10 minutes

      // 7 minutes ago (420_000 ms)
      const asOf = new Date(baseTime - 420_000).toISOString()
      const result = evaluateSourceFreshness(asOf, 'COMMUNITY', {
        now: baseTime,
      })

      expect(result.status).toBe('AVAILABLE')
      expect(result.ageMs).toBe(420_000)
    })

    it('falls back to default if environment variable is invalid NaN or <= 0', () => {
      process.env[envKey] = 'invalid-number'

      // 6 minutes ago (360_000 ms > 300_000 ms)
      const asOf = new Date(baseTime - 360_000).toISOString()
      const result = evaluateSourceFreshness(asOf, 'COMMUNITY', {
        now: baseTime,
      })

      expect(result.status).toBe('STALE')
    })
  })

  describe('clock skew handling', () => {
    it('tolerates small future clock skew within DEFAULT_MAX_CLOCK_SKEW_MS (60s) as age 0 AVAILABLE', () => {
      // 30 seconds into the future (within 60_000 ms tolerance)
      const asOf = new Date(baseTime + 30_000).toISOString()
      const result = evaluateSourceFreshness(asOf, 'CONTENT_NOTIFICATION', {
        now: baseTime,
      })

      expect(result.status).toBe('AVAILABLE')
      expect(result.ageMs).toBe(0)
    })

    it('classifies implausible future timestamps (> 60s ahead) as STALE fail-closed', () => {
      // 70 seconds into the future (> 60_000 ms tolerance)
      const asOf = new Date(baseTime + 70_000).toISOString()
      const result = evaluateSourceFreshness(asOf, 'CONTENT_NOTIFICATION', {
        now: baseTime,
      })

      expect(result.status).toBe('STALE')
      expect(result.rationale).toContain('implausibly in the future')
      expect(result.rationale).toContain('Classified STALE fail-closed')
    })

    it('respects custom maxClockSkewMs option', () => {
      // 10 seconds into future
      const asOf = new Date(baseTime + 10_000).toISOString()

      // Tight tolerance 5s
      const tightResult = evaluateSourceFreshness(asOf, 'IDENTITY', {
        now: baseTime,
        maxClockSkewMs: 5_000,
      })
      expect(tightResult.status).toBe('STALE')

      // Relaxed tolerance 15s
      const relaxedResult = evaluateSourceFreshness(asOf, 'IDENTITY', {
        now: baseTime,
        maxClockSkewMs: 15_000,
      })
      expect(relaxedResult.status).toBe('AVAILABLE')
    })
  })

  describe('fail-closed invalid / missing timestamps', () => {
    it('classifies null or undefined asOf as STALE fail-closed', () => {
      const nullResult = evaluateSourceFreshness(null, 'IDENTITY', {
        now: baseTime,
      })
      expect(nullResult.status).toBe('STALE')
      expect(nullResult.ageMs).toBeNull()
      expect(nullResult.rationale).toContain('missing or empty asOf timestamp')

      const undefResult = evaluateSourceFreshness(undefined, 'IDENTITY', {
        now: baseTime,
      })
      expect(undefResult.status).toBe('STALE')
      expect(undefResult.ageMs).toBeNull()
      expect(undefResult.rationale).toContain('missing or empty asOf timestamp')
    })

    it('classifies empty or whitespace string as STALE fail-closed', () => {
      const emptyResult = evaluateSourceFreshness('   ', 'CONSULTATION', {
        now: baseTime,
      })
      expect(emptyResult.status).toBe('STALE')
      expect(emptyResult.ageMs).toBeNull()
      expect(emptyResult.rationale).toContain('missing or empty asOf timestamp')
    })

    it('classifies unparseable garbage timestamp as STALE fail-closed', () => {
      const invalidResult = evaluateSourceFreshness(
        'not-a-timestamp',
        'COMMUNITY',
        { now: baseTime },
      )
      expect(invalidResult.status).toBe('STALE')
      expect(invalidResult.ageMs).toBeNull()
      expect(invalidResult.rationale).toContain(
        'invalid unparseable asOf timestamp',
      )
    })
  })
})
