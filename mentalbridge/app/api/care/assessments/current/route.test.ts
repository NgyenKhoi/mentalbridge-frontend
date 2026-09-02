import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({
  submitAuthenticated: vi.fn(),
  getAuthenticated: vi.fn(),
}))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/care/care-client', () => ({
  careClient: {
    submitAuthenticated: careMocks.submitAuthenticated,
    getAuthenticated: careMocks.getAuthenticated,
  },
}))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { POST } from './route'

const definitionId = '10000000-0000-4000-8000-000000000001'
const questionId = '10000000-0000-4000-8000-000000000002'
const assessmentId = '10000000-0000-4000-8000-000000000003'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/care/assessments/current', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': 'authenticated-request-0001',
      cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret`,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/care/assessments/current', () => {
  beforeEach(() => {
    careMocks.submitAuthenticated.mockReset()
    careMocks.getAuthenticated.mockReset()
    sessionMocks.resolveSession.mockReset()
    sessionMocks.ensureRole.mockReset()
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: '10000000-0000-4000-8000-000000000009',
        status: 'ACTIVE',
        roles: ['USER'],
        emailVerified: true,
      },
    })
  })

  it('uses the server-side Identity credential and returns only Care data', async () => {
    const assessment = {
      assessmentId,
      questionnaireDefinitionId: definitionId,
      instrument: 'PHQ9',
      questionnaireVersion: 'phq9-vi-vn-capstone-v1',
      privacyPolicyVersion: 'privacy-capstone-v1',
      submittedAt: '2026-09-01T00:00:00Z',
      voidedAt: null,
      result: {
        totalScore: 0,
        screeningLevel: 'MINIMAL',
        scoringVersion: 'phq9-standard-v1',
        safetyStatus: 'NEGATIVE_SAFETY_SCREEN',
        safetyPolicyVersion: 'MB-SAFETY-PHQ9-001/1.0',
        disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
      },
    }
    careMocks.submitAuthenticated.mockResolvedValue(assessment)

    const response = await POST(
      request({
        questionnaireDefinitionId: definitionId,
        privacyPolicyVersion: 'privacy-capstone-v1',
        privacyDisclosureAcknowledged: true,
        answers: [{ questionId, value: 0 }],
      }),
    )

    expect(sessionMocks.ensureRole).toHaveBeenCalledWith(
      expect.objectContaining({ roles: ['USER'] }),
      ['USER'],
    )
    expect(careMocks.submitAuthenticated).toHaveBeenCalledWith(
      'identity-access-secret',
      {
        questionnaireDefinitionId: definitionId,
        privacyPolicyVersion: 'privacy-capstone-v1',
        privacyDisclosureAcknowledged: true,
        answers: [{ questionId, value: 0 }],
      },
      'authenticated-request-0001',
      expect.any(String),
    )
    const body = await response.json()
    expect(body).toEqual(assessment)
    expect(JSON.stringify(body)).not.toContain('identity-access-secret')
  })
})
