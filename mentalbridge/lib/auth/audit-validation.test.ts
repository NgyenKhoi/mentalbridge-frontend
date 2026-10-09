import { describe, expect, it } from 'vitest'
import { administrationAuditSearch } from './audit-validation'

describe('administrationAuditSearch validation', () => {
  const validAccountTarget = 'account:948f9e80-d3bc-45aa-91f6-044dd5afbf78'
  const validTombstoneTarget = 'tombstone:' + 'a'.repeat(64)

  it('accepts valid from and to timestamps and rejects invalid ones', () => {
    const validParams = new URLSearchParams({
      from: '2026-09-01T00:00:00Z',
      to: '2026-10-01T00:00:00.000Z',
    })
    expect(administrationAuditSearch(validParams, true)).toEqual({
      from: '2026-09-01T00:00:00Z',
      to: '2026-10-01T00:00:00.000Z',
    })

    const invalidFrom = new URLSearchParams({ from: 'not-a-datetime' })
    expect(administrationAuditSearch(invalidFrom, true)).toBeNull()

    const invalidTo = new URLSearchParams({ to: 'invalid-date' })
    expect(administrationAuditSearch(invalidTo, true)).toBeNull()

    const tooLongFrom = new URLSearchParams({
      from: '2026-09-01T00:00:00' + '0'.repeat(30),
    })
    expect(administrationAuditSearch(tooLongFrom, true)).toBeNull()
  })

  it('validates sourceService and domain against platform allowed values', () => {
    for (const service of [
      'IDENTITY',
      'CONSULTATION',
      'CONTENT',
      'COMMUNITY',
    ]) {
      const params = new URLSearchParams({ sourceService: service })
      expect(administrationAuditSearch(params, true)).toEqual({
        sourceService: service,
      })
    }

    for (const domain of [
      'ACCOUNT_ADMINISTRATION',
      'SPECIALIST_REVIEW',
      'RESOURCE_MANAGEMENT',
      'COMMUNITY_MODERATION',
    ]) {
      const params = new URLSearchParams({ domain })
      expect(administrationAuditSearch(params, true)).toEqual({ domain })
    }

    const invalidService = new URLSearchParams({
      sourceService: 'UNKNOWN_SERVICE',
    })
    expect(administrationAuditSearch(invalidService, true)).toBeNull()

    const invalidDomain = new URLSearchParams({ domain: 'ARBITRARY_DOMAIN' })
    expect(administrationAuditSearch(invalidDomain, true)).toBeNull()
  })

  it('validates actorType, result, and action', () => {
    expect(
      administrationAuditSearch(
        new URLSearchParams({ actorType: 'ADMIN' }),
        true,
      ),
    ).toEqual({
      actorType: 'ADMIN',
    })
    expect(
      administrationAuditSearch(
        new URLSearchParams({ actorType: 'SYSTEM' }),
        true,
      ),
    ).toEqual({
      actorType: 'SYSTEM',
    })
    expect(
      administrationAuditSearch(
        new URLSearchParams({ actorType: 'USER' }),
        true,
      ),
    ).toBeNull()

    expect(
      administrationAuditSearch(
        new URLSearchParams({ result: 'SUCCEEDED' }),
        true,
      ),
    ).toEqual({
      result: 'SUCCEEDED',
    })
    expect(
      administrationAuditSearch(
        new URLSearchParams({ result: 'DENIED' }),
        true,
      ),
    ).toEqual({
      result: 'DENIED',
    })
    expect(
      administrationAuditSearch(
        new URLSearchParams({ result: 'FAILED' }),
        true,
      ),
    ).toEqual({
      result: 'FAILED',
    })
    expect(
      administrationAuditSearch(
        new URLSearchParams({ result: 'PENDING' }),
        true,
      ),
    ).toBeNull()

    expect(
      administrationAuditSearch(
        new URLSearchParams({ action: 'ACCOUNT_DISABLED' }),
        true,
      ),
    ).toEqual({ action: 'ACCOUNT_DISABLED' })
    expect(
      administrationAuditSearch(
        new URLSearchParams({ action: 'bad action with space' }),
        true,
      ),
    ).toBeNull()
    expect(
      administrationAuditSearch(
        new URLSearchParams({ action: 'lowercase_action' }),
        true,
      ),
    ).toBeNull()
    expect(
      administrationAuditSearch(
        new URLSearchParams({ action: 'A'.repeat(97) }),
        true,
      ),
    ).toBeNull()
    expect(
      administrationAuditSearch(new URLSearchParams({ action: '' }), true),
    ).toBeNull()
  })

  it('validates account UUID target', () => {
    const valid = new URLSearchParams({ targetIdentifier: validAccountTarget })
    expect(administrationAuditSearch(valid, true)).toEqual({
      targetIdentifier: validAccountTarget,
    })

    const invalidUuid = new URLSearchParams({
      targetIdentifier: 'account:not-a-valid-uuid',
    })
    expect(administrationAuditSearch(invalidUuid, true)).toBeNull()

    const missingPrefix = new URLSearchParams({
      targetIdentifier: '948f9e80-d3bc-45aa-91f6-044dd5afbf78',
    })
    expect(administrationAuditSearch(missingPrefix, true)).toBeNull()
  })

  it('validates tombstone target', () => {
    const valid = new URLSearchParams({
      targetIdentifier: validTombstoneTarget,
    })
    expect(administrationAuditSearch(valid, true)).toEqual({
      targetIdentifier: validTombstoneTarget,
    })

    const tooShort = new URLSearchParams({
      targetIdentifier: 'tombstone:' + 'a'.repeat(63),
    })
    expect(administrationAuditSearch(tooShort, true)).toBeNull()

    const nonHex = new URLSearchParams({
      targetIdentifier: 'tombstone:' + 'z'.repeat(64),
    })
    expect(administrationAuditSearch(nonHex, true)).toBeNull()
  })

  it('validates cursor presence and length boundaries', () => {
    expect(
      administrationAuditSearch(
        new URLSearchParams({ cursor: 'valid-cursor' }),
        true,
      ),
    ).toEqual({
      cursor: 'valid-cursor',
    })
    expect(
      administrationAuditSearch(new URLSearchParams({ cursor: '' }), true),
    ).toBeNull()
    expect(
      administrationAuditSearch(
        new URLSearchParams({ cursor: 'c'.repeat(513) }),
        true,
      ),
    ).toBeNull()
  })

  it('validates limit boundaries (rejects < 1 and > 100 or non-integers)', () => {
    expect(
      administrationAuditSearch(new URLSearchParams({ limit: '1' }), true),
    ).toEqual({
      limit: 1,
    })
    expect(
      administrationAuditSearch(new URLSearchParams({ limit: '50' }), true),
    ).toEqual({
      limit: 50,
    })
    expect(
      administrationAuditSearch(new URLSearchParams({ limit: '100' }), true),
    ).toEqual({
      limit: 100,
    })

    expect(
      administrationAuditSearch(new URLSearchParams({ limit: '0' }), true),
    ).toBeNull()
    expect(
      administrationAuditSearch(new URLSearchParams({ limit: '-1' }), true),
    ).toBeNull()
    expect(
      administrationAuditSearch(new URLSearchParams({ limit: '101' }), true),
    ).toBeNull()
    expect(
      administrationAuditSearch(new URLSearchParams({ limit: '50.5' }), true),
    ).toBeNull()
    expect(
      administrationAuditSearch(
        new URLSearchParams({ limit: 'not-a-number' }),
        true,
      ),
    ).toBeNull()
  })

  it('export mode does not accept cursor or limit', () => {
    const validExport = new URLSearchParams({
      from: '2026-09-01T00:00:00Z',
      to: '2026-10-01T00:00:00Z',
      action: 'ACCOUNT_DISABLED',
    })
    expect(administrationAuditSearch(validExport, false)).toEqual({
      from: '2026-09-01T00:00:00Z',
      to: '2026-10-01T00:00:00Z',
      action: 'ACCOUNT_DISABLED',
    })

    const exportWithCursor = new URLSearchParams(validExport)
    exportWithCursor.set('cursor', 'opaque-cursor')
    expect(administrationAuditSearch(exportWithCursor, false)).toBeNull()

    const exportWithLimit = new URLSearchParams(validExport)
    exportWithLimit.set('limit', '50')
    expect(administrationAuditSearch(exportWithLimit, false)).toBeNull()
  })

  it('rejects unknown query parameters', () => {
    const withUnknown = new URLSearchParams({
      action: 'ACCOUNT_DISABLED',
      unknownParam: 'malicious-data',
    })
    expect(administrationAuditSearch(withUnknown, true)).toBeNull()

    const withSecret = new URLSearchParams({
      secret: 'ACCESS_TOKEN_SECRET_123',
    })
    expect(administrationAuditSearch(withSecret, true)).toBeNull()
    expect(administrationAuditSearch(withSecret, false)).toBeNull()
  })
})
