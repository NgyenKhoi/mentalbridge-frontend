import { describe, expect, it } from 'vitest'
import {
  parseAccountPage,
  parseApplyHoldRequest,
  parseAdministrationAuditEventPage,
  parseDeletionOwnerFact,
  parseDeletionRequest,
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
	it('accepts only contract-defined retention hold reason codes', () => {
		expect(
			parseApplyHoldRequest({
				holdType: 'OPERATIONAL_HOLD',
				holdReason: 'AUDIT_COMPLIANCE_HOLD',
			}),
		).toEqual({
			holdType: 'OPERATIONAL_HOLD',
			holdReason: 'AUDIT_COMPLIANCE_HOLD',
		})
		expect(
			parseApplyHoldRequest({
				holdType: 'OPERATIONAL_HOLD',
				holdReason: 'arbitrary free text',
			}),
		).toBeNull()
	})

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

  it('parses deleted admin actors and nullable targets safely', () => {
    const page = {
      items: [
        {
          eventId: '94464b2b-a7fd-46fd-9310-64ef4eac7de7',
          occurredAt: '2026-10-01T00:00:00Z',
          actorType: 'ADMIN',
          actorIdentifier: 'tombstone:' + 'a'.repeat(64),
          action: 'RESOURCE_ARCHIVED',
          result: 'SUCCEEDED',
          reasonCode: null,
          correlationId: '94464b2b-a7fd-46fd-9310-64ef4eac7de7',
          sourceService: 'CONTENT',
          domain: 'RESOURCE_MANAGEMENT',
          targetIdentifier: null,
        },
      ],
      nextCursor: null,
      effectiveFrom: '2026-09-01T00:00:00Z',
      effectiveTo: '2026-10-01T00:00:00Z',
      retentionCutoff: '2025-10-01T00:00:00Z',
    }
    expect(parseAdministrationAuditEventPage(page)).toEqual(page)
  })

  it('rejects invalid actor, target, or correlationId in audit events', () => {
    const baseEvent = {
      eventId: '94464b2b-a7fd-46fd-9310-64ef4eac7de7',
      occurredAt: '2026-10-01T00:00:00Z',
      actorType: 'ADMIN',
      actorIdentifier: 'account:94464b2b-a7fd-46fd-9310-64ef4eac7de7',
      action: 'RESOURCE_ARCHIVED',
      result: 'SUCCEEDED',
      reasonCode: null,
      correlationId: '94464b2b-a7fd-46fd-9310-64ef4eac7de7',
      sourceService: 'CONTENT',
      domain: 'RESOURCE_MANAGEMENT',
      targetIdentifier: null,
    }
    const wrap = (item: unknown) => ({
      items: [item],
      nextCursor: null,
      effectiveFrom: '2026-09-01T00:00:00Z',
      effectiveTo: '2026-10-01T00:00:00Z',
      retentionCutoff: '2025-10-01T00:00:00Z',
    })

    // invalid actorType
    expect(
      parseAdministrationAuditEventPage(
        wrap({ ...baseEvent, actorType: 'STAFF' }),
      ),
    ).toBeNull()

    // SYSTEM actor with accountIdentifier
    expect(
      parseAdministrationAuditEventPage(
        wrap({
          ...baseEvent,
          actorType: 'SYSTEM',
          actorIdentifier: 'account:94464b2b-a7fd-46fd-9310-64ef4eac7de7',
        }),
      ),
    ).toBeNull()

    // ADMIN actor with 'system'
    expect(
      parseAdministrationAuditEventPage(
        wrap({ ...baseEvent, actorType: 'ADMIN', actorIdentifier: 'system' }),
      ),
    ).toBeNull()

    // Actor with raw email (PII)
    expect(
      parseAdministrationAuditEventPage(
        wrap({ ...baseEvent, actorIdentifier: 'admin@example.com' }),
      ),
    ).toBeNull()

    // Malformed correlationId
    expect(
      parseAdministrationAuditEventPage(
        wrap({ ...baseEvent, correlationId: 'not-a-uuid' }),
      ),
    ).toBeNull()

    // Invalid targetIdentifier format
    expect(
      parseAdministrationAuditEventPage(
        wrap({ ...baseEvent, targetIdentifier: 'invalid-target' }),
      ),
    ).toBeNull()
  })
})

describe('parseDeletionOwnerFact boundary sanitization', () => {
  it('accepts approved safe codes and opaque references', () => {
    const fact = parseDeletionOwnerFact({
      ownerService: 'IDENTITY',
      status: 'COMPLETED',
      completedAt: '2026-10-18T10:00:00Z',
      evidenceReference: 'audit:del:identity:001',
      failureReason: null,
    })
    expect(fact).toEqual({
      ownerService: 'IDENTITY',
      status: 'COMPLETED',
      completedAt: '2026-10-18T10:00:00Z',
      evidenceReference: 'audit:del:identity:001',
      failureReason: null,
    })

    const failedFact = parseDeletionOwnerFact({
      ownerService: 'CARE',
      status: 'FAILED',
      completedAt: null,
      evidenceReference: null,
      failureReason: 'ACCOUNT_NOT_FOUND',
    })
    expect(failedFact).toEqual({
      ownerService: 'CARE',
      status: 'FAILED',
      completedAt: null,
      evidenceReference: null,
      failureReason: 'ACCOUNT_NOT_FOUND',
    })
  })

  it('sanitizes raw emails, clinical journal notes, chat transcripts and secrets to null', () => {
    const piiFact = parseDeletionOwnerFact({
      ownerService: 'CARE',
      status: 'FAILED',
      completedAt: null,
      evidenceReference: 'member.clinical@example.com',
      failureReason:
        'Patient diagnosed with severe major depressive disorder with suicidal ideation',
    })
    expect(piiFact).toEqual({
      ownerService: 'CARE',
      status: 'FAILED',
      completedAt: null,
      evidenceReference: null,
      failureReason: null,
    })

    const chatAndSecretFact = parseDeletionOwnerFact({
      ownerService: 'CONSULTATION',
      status: 'FAILED',
      completedAt: null,
      evidenceReference:
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.topsecrettoken',
      failureReason:
        'User chat log: my parents must never know about my consultation history',
    })
    expect(chatAndSecretFact).toEqual({
      ownerService: 'CONSULTATION',
      status: 'FAILED',
      completedAt: null,
      evidenceReference: null,
      failureReason: null,
    })
  })

  it('rejects invalid owner service or unknown status', () => {
    expect(
      parseDeletionOwnerFact({
        ownerService: 'EXTERNAL_PAYMENT_SERVICE',
        status: 'COMPLETED',
      }),
    ).toBeNull()

    expect(
      parseDeletionOwnerFact({
        ownerService: 'IDENTITY',
        status: 'UNKNOWN_STATUS',
      }),
    ).toBeNull()
  })

  it('sanitizes facts inside parseDeletionRequest', () => {
    const request = parseDeletionRequest({
      requestId: '948f9e80-d3bc-45aa-91f6-044dd5afbf71',
      subjectReference:
        'tombstone:aaaa9e80d3bc45aa91f6044dd5afbf78abcdef1234567890abcdef1234567890',
      status: 'FAILED',
      holdType: 'NONE',
      holdReason: null,
      retryCount: 1,
      maxRetries: 3,
      escalationState: 'NONE',
      accountStatus: 'DELETION_PENDING',
      requestedAt: '2026-10-18T10:00:00Z',
      scheduledExecutionAt: '2026-10-18T10:00:00Z',
      ownerFacts: [
        {
          ownerService: 'CARE',
          status: 'FAILED',
          evidenceReference: 'leaked.email@example.com',
          failureReason: 'Free-text sensitive clinical observation',
        },
      ],
    })

    expect(request).not.toBeNull()
    expect(request?.ownerFacts[0].evidenceReference).toBeNull()
    expect(request?.ownerFacts[0].failureReason).toBeNull()
  })
})
