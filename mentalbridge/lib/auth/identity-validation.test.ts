import { describe, expect, it } from 'vitest'
import {
  parseAccountPage,
  parseApplyHoldRequest,
  parseAdministrationAuditEventPage,
  parseDeletionOwnerFact,
  parseDeletionRequest,
  parseRetentionExecutionRecord,
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
  it('accepts approved safe codes and the producer-backed Identity UUID reference', () => {
    const fact = parseDeletionOwnerFact({
      ownerService: 'IDENTITY',
      status: 'COMPLETED',
      completedAt: '2026-10-18T10:00:00Z',
      evidenceReference:
        'audit:identity:account-deleted:948f9e80-d3bc-45aa-91f6-044dd5afbf71',
      failureReason: null,
    })
    expect(fact).toEqual({
      ownerService: 'IDENTITY',
      status: 'COMPLETED',
      completedAt: '2026-10-18T10:00:00Z',
      evidenceReference:
        'audit:identity:account-deleted:948f9e80-d3bc-45aa-91f6-044dd5afbf71',
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

    // Unapproved or uncontracted failure reasons must fail closed to null
    const timeoutFact = parseDeletionOwnerFact({
      ownerService: 'COMMUNITY',
      status: 'FAILED',
      failureReason: 'COMMUNITY_TIMEOUT',
    })
    expect(timeoutFact?.failureReason).toBeNull()

    const holdFact = parseDeletionOwnerFact({
      ownerService: 'IDENTITY',
      status: 'HELD',
      failureReason: 'LEGAL_HOLD_ACTIVE',
    })
    expect(holdFact?.failureReason).toBeNull()

    const uppercaseFact = parseDeletionOwnerFact({
      ownerService: 'CARE',
      status: 'FAILED',
      failureReason: 'PATIENT_EVALUATION_HIGH_SUICIDE_RISK',
    })
    expect(uppercaseFact?.failureReason).toBeNull()
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

  it('keeps only the producer-backed Identity UUID evidence format', () => {
    // Bare JWT on IDENTITY -> null
    const jwtFact = parseDeletionOwnerFact({
      ownerService: 'IDENTITY',
      status: 'FAILED',
      evidenceReference:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJl',
    })
    expect(jwtFact?.evidenceReference).toBeNull()

    // API-key-like token on IDENTITY -> null
    const apiKeyFact = parseDeletionOwnerFact({
      ownerService: 'IDENTITY',
      status: 'FAILED',
      evidenceReference: 'opaque_api_key_token_mock_12345',
    })
    expect(apiKeyFact?.evidenceReference).toBeNull()

    // Malformed UUID under the approved prefix -> null
    const malformedUuidFact = parseDeletionOwnerFact({
      ownerService: 'IDENTITY',
      status: 'FAILED',
      evidenceReference: 'audit:identity:account-deleted:not-a-uuid',
    })
    expect(malformedUuidFact?.evidenceReference).toBeNull()

    // Secret disguised under the approved prefix -> null
    const disguisedSecretFact = parseDeletionOwnerFact({
      ownerService: 'IDENTITY',
      status: 'FAILED',
      evidenceReference:
        'audit:identity:account-deleted:opaque_secret_key_12345',
    })
    expect(disguisedSecretFact?.evidenceReference).toBeNull()

    // Valid approved audit reference on IDENTITY -> preserved
    const validIdFact = parseDeletionOwnerFact({
      ownerService: 'IDENTITY',
      status: 'COMPLETED',
      evidenceReference:
        'audit:identity:account-deleted:948f9e80-d3bc-45aa-91f6-044dd5afbf71',
    })
    expect(validIdFact?.evidenceReference).toBe(
      'audit:identity:account-deleted:948f9e80-d3bc-45aa-91f6-044dd5afbf71',
    )

    // Legacy format without a production producer -> null
    const legacyFormatFact = parseDeletionOwnerFact({
      ownerService: 'IDENTITY',
      status: 'COMPLETED',
      evidenceReference: 'audit:del:identity:001',
    })
    expect(legacyFormatFact?.evidenceReference).toBeNull()

    // External owner evidence remains null even when the string matches Identity's format
    const unapprovedOwnerFact = parseDeletionOwnerFact({
      ownerService: 'CARE',
      status: 'COMPLETED',
      evidenceReference:
        'audit:identity:account-deleted:948f9e80-d3bc-45aa-91f6-044dd5afbf71',
    })
    expect(unapprovedOwnerFact?.evidenceReference).toBeNull()
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

  it('sanitizes facts and failureCode inside parseDeletionRequest', () => {
    const requestWithLeaks = parseDeletionRequest({
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
      failureCode: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token.leak',
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

    expect(requestWithLeaks).not.toBeNull()
    // failureCode containing bare JWT must be sanitized to null
    expect(requestWithLeaks?.failureCode).toBeNull()
    expect(requestWithLeaks?.ownerFacts[0].evidenceReference).toBeNull()
    expect(requestWithLeaks?.ownerFacts[0].failureReason).toBeNull()

    // Unapproved uppercase underscore sensitive string must fail closed to null
    const requestWithUppercaseLeak = parseDeletionRequest({
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
      failureCode: 'PATIENT_DIAGNOSED_WITH_SEVERE_DEPRESSION',
      requestedAt: '2026-10-18T10:00:00Z',
      scheduledExecutionAt: '2026-10-18T10:00:00Z',
      ownerFacts: [
        {
          ownerService: 'CARE',
          status: 'FAILED',
          evidenceReference: null,
          failureReason: 'CONFIDENTIAL_CHAT_TRANSCRIPT_LEAK',
        },
      ],
    })
    expect(requestWithUppercaseLeak?.failureCode).toBeNull()
    expect(requestWithUppercaseLeak?.ownerFacts[0].failureReason).toBeNull()

    const requestWithValidCode = parseDeletionRequest({
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
      failureCode: 'ACCOUNT_NOT_FOUND',
      requestedAt: '2026-10-18T10:00:00Z',
      scheduledExecutionAt: '2026-10-18T10:00:00Z',
      ownerFacts: [],
    })

    expect(requestWithValidCode?.failureCode).toBe('ACCOUNT_NOT_FOUND')

    const requestWithRetryExhausted = parseDeletionRequest({
      requestId: '948f9e80-d3bc-45aa-91f6-044dd5afbf71',
      subjectReference:
        'tombstone:aaaa9e80d3bc45aa91f6044dd5afbf78abcdef1234567890abcdef1234567890',
      status: 'FAILED',
      holdType: 'NONE',
      holdReason: null,
      retryCount: 3,
      maxRetries: 3,
      escalationState: 'RETRY_EXHAUSTED',
      accountStatus: 'DELETION_PENDING',
      failureCode: 'RETRY_LIMIT_EXHAUSTED',
      requestedAt: '2026-10-18T10:00:00Z',
      scheduledExecutionAt: '2026-10-18T10:00:00Z',
      ownerFacts: [],
    })
    expect(requestWithRetryExhausted?.failureCode).toBe('RETRY_LIMIT_EXHAUSTED')

    // Cross-domain retention code inside deletion request must fail closed to null
    const requestWithRetentionCode = parseDeletionRequest({
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
      failureCode: 'SWEEP_EXECUTION_FAILED',
      requestedAt: '2026-10-18T10:00:00Z',
      scheduledExecutionAt: '2026-10-18T10:00:00Z',
      ownerFacts: [],
    })
    expect(requestWithRetentionCode?.failureCode).toBeNull()
  })

  it('validates retention execution failureCode against narrowed producer allowlist', () => {
    const validStale = parseRetentionExecutionRecord({
      executionId: '948f9e80-d3bc-45aa-91f6-044dd5afbf81',
      policyId: 'MB-IDENTITY-REPORTING-001',
      ownerService: 'IDENTITY',
      jobName: 'REPORT_ARTIFACT_RETENTION_SWEEP',
      jobStatus: 'FAILED',
      startedAt: '2026-10-19T02:00:00Z',
      completedAt: '2026-10-19T02:05:00Z',
      itemsEvaluated: 10,
      recordsPurged: 0,
      tombstonesCreated: 0,
      holdsHonored: 0,
      failureCode: 'PRIOR_EXECUTION_STALE',
    })
    expect(validStale?.failureCode).toBe('PRIOR_EXECUTION_STALE')

    const validSweepFailed = parseRetentionExecutionRecord({
      executionId: '948f9e80-d3bc-45aa-91f6-044dd5afbf81',
      policyId: 'MB-IDENTITY-REPORTING-001',
      ownerService: 'IDENTITY',
      jobName: 'REPORT_ARTIFACT_RETENTION_SWEEP',
      jobStatus: 'FAILED',
      startedAt: '2026-10-19T02:00:00Z',
      completedAt: '2026-10-19T02:05:00Z',
      itemsEvaluated: 10,
      recordsPurged: 0,
      tombstonesCreated: 0,
      holdsHonored: 0,
      failureCode: 'SWEEP_EXECUTION_FAILED',
    })
    expect(validSweepFailed?.failureCode).toBe('SWEEP_EXECUTION_FAILED')

    // Deletion code inside retention execution must fail closed to null
    const crossDomainCode = parseRetentionExecutionRecord({
      executionId: '948f9e80-d3bc-45aa-91f6-044dd5afbf81',
      policyId: 'MB-IDENTITY-REPORTING-001',
      ownerService: 'IDENTITY',
      jobName: 'REPORT_ARTIFACT_RETENTION_SWEEP',
      jobStatus: 'FAILED',
      startedAt: '2026-10-19T02:00:00Z',
      completedAt: '2026-10-19T02:05:00Z',
      itemsEvaluated: 10,
      recordsPurged: 0,
      tombstonesCreated: 0,
      holdsHonored: 0,
      failureCode: 'ACCOUNT_NOT_FOUND',
    })
    expect(crossDomainCode?.failureCode).toBeNull()

    // Random uppercase code fails closed to null
    const unapprovedCode = parseRetentionExecutionRecord({
      executionId: '948f9e80-d3bc-45aa-91f6-044dd5afbf81',
      policyId: 'MB-IDENTITY-REPORTING-001',
      ownerService: 'IDENTITY',
      jobName: 'REPORT_ARTIFACT_RETENTION_SWEEP',
      jobStatus: 'FAILED',
      startedAt: '2026-10-19T02:00:00Z',
      completedAt: '2026-10-19T02:05:00Z',
      itemsEvaluated: 10,
      recordsPurged: 0,
      tombstonesCreated: 0,
      holdsHonored: 0,
      failureCode: 'UNKNOWN_AUDIT_ERROR',
    })
    expect(unapprovedCode?.failureCode).toBeNull()
  })
})
