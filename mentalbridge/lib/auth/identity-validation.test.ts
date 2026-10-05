import { describe, expect, it } from 'vitest'
import {
  parseAccountPage,
  parseAdministrationAuditEventPage,
  validateAccountStateChangeRequest,
} from './identity-validation'

const account = {
  accountId: '94464b2b-a7fd-46fd-9310-64ef4eac7de7',
  email: 'member@example.com',
  status: 'ACTIVE',
  roles: ['USER'],
  emailVerified: true,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  version: 2,
}

describe('admin account validation', () => {
  it('parses a bounded account page without accepting extra fields', () => {
    expect(parseAccountPage({ items: [account], nextCursor: null })).toEqual({
      items: [account],
      nextCursor: null,
    })
    expect(
      parseAccountPage({ items: [account], nextCursor: null, secret: 'no' }),
    ).toBeNull()
  })

  it('accepts only approved status and reason combinations at the shape boundary', () => {
    expect(
      validateAccountStateChangeRequest({
        status: 'DISABLED',
        reasonCode: 'SAFETY_CONCERN',
      }).success,
    ).toBe(true)
    expect(
      validateAccountStateChangeRequest({
        status: 'DELETED',
        reasonCode: 'ANY_ARBITRARY_REASON',
      }).success,
    ).toBe(false)
  })

  it('parses multi-service administration audit event pages', () => {
    const page = {
      items: [
        {
          eventId: '94464b2b-a7fd-46fd-9310-64ef4eac7de7',
          occurredAt: '2026-10-01T00:00:00Z',
          actorType: 'ADMIN',
          actorIdentifier: 'account:94464b2b-a7fd-46fd-9310-64ef4eac7de7',
          action: 'SPECIALIST_SUSPENDED',
          result: 'SUCCEEDED',
          reasonCode: 'POLICY_VIOLATION',
          correlationId: '94464b2b-a7fd-46fd-9310-64ef4eac7de7',
          sourceService: 'CONSULTATION',
          domain: 'SPECIALIST_REVIEW',
          targetIdentifier: 'account:94464b2b-a7fd-46fd-9310-64ef4eac7de7',
        },
        {
          eventId: '94464b2b-a7fd-46fd-9310-64ef4eac7de8',
          occurredAt: '2026-10-01T01:00:00Z',
          actorType: 'SYSTEM',
          actorIdentifier: 'system',
          action: 'ACCOUNT_DISABLED',
          result: 'DENIED',
          reasonCode: null,
          correlationId: '94464b2b-a7fd-46fd-9310-64ef4eac7de8',
          sourceService: 'IDENTITY',
          domain: 'ACCOUNT_ADMINISTRATION',
          targetIdentifier: 'tombstone:' + '0'.repeat(64),
        },
      ],
      nextCursor: null,
      effectiveFrom: '2026-09-01T00:00:00Z',
      effectiveTo: '2026-10-01T00:00:00Z',
      retentionCutoff: '2025-10-01T00:00:00Z',
    }
    expect(parseAdministrationAuditEventPage(page)).toEqual(page)
  })
})
