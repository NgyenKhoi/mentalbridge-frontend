import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ANONYMOUS_SESSION_ID_COOKIE,
  ANONYMOUS_SESSION_TOKEN_COOKIE,
} from '@/lib/care/assessment-cookies'

const careMocks = vi.hoisted(() => ({
  submitAnonymous: vi.fn(),
  getAnonymous: vi.fn(),
}))

vi.mock('@/lib/care/care-client', () => ({
  careClient: {
    submitAnonymous: careMocks.submitAnonymous,
    getAnonymous: careMocks.getAnonymous,
  },
}))

import { POST } from './route'

const definitionId = '10000000-0000-4000-8000-000000000001'
const questionId = '10000000-0000-4000-8000-000000000002'
const sessionId = '10000000-0000-4000-8000-000000000003'
const assessmentId = '10000000-0000-4000-8000-000000000004'
const sessionToken = `anonymous-${'t'.repeat(43)}`

function request(body: unknown, withCredentials = true) {
  return new NextRequest(
    'http://localhost/api/care/anonymous-assessments/current',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'assessment-request-0001',
        ...(withCredentials
          ? {
              cookie: `${ANONYMOUS_SESSION_ID_COOKIE}=${sessionId}; ${ANONYMOUS_SESSION_TOKEN_COOKIE}=${sessionToken}`,
            }
          : {}),
      },
      body: JSON.stringify(body),
    },
  )
}

describe('POST /api/care/anonymous-assessments/current', () => {
  beforeEach(() => {
    careMocks.submitAnonymous.mockReset()
    careMocks.getAnonymous.mockReset()
  })

  it('requires a protected anonymous session', async () => {
    const response = await POST(
      request(
        {
          questionnaireDefinitionId: definitionId,
          privacyPolicyVersion: 'privacy-capstone-v1',
          privacyDisclosureAcknowledged: true,
          answers: [{ questionId, value: 1 }],
        },
        false,
      ),
    )

    expect(response.status).toBe(401)
    expect(careMocks.submitAnonymous).not.toHaveBeenCalled()
  })

  it('rejects browser-owned scoring fields before calling Care', async () => {
    const response = await POST(
      request({
        questionnaireDefinitionId: definitionId,
        privacyPolicyVersion: 'privacy-capstone-v1',
        privacyDisclosureAcknowledged: true,
        answers: [{ questionId, value: 1 }],
        totalScore: 1,
      }),
    )

    expect(response.status).toBe(400)
    expect(careMocks.submitAnonymous).not.toHaveBeenCalled()
  })

  it('forwards only validated answers and does not render anonymous credentials', async () => {
    const assessment = {
      assessmentId,
      questionnaireDefinitionId: definitionId,
      instrument: 'PHQ9',
      questionnaireVersion: 'phq9-vi-vn-capstone-v1',
      privacyPolicyVersion: 'privacy-capstone-v1',
      submittedAt: '2026-09-01T00:00:00Z',
      voidedAt: null,
      expiresAt: '2099-01-01T00:30:00Z',
      result: {
        totalScore: 1,
        screeningLevel: 'MINIMAL',
        scoringVersion: 'phq9-standard-v1',
        safetyStatus: 'POSITIVE_SAFETY_SCREEN',
        safetyPolicyVersion: 'MB-SAFETY-PHQ9-001/1.0',
        disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
      },
    }
    careMocks.submitAnonymous.mockResolvedValue(assessment)

    const response = await POST(
      request({
        questionnaireDefinitionId: definitionId,
        privacyPolicyVersion: 'privacy-capstone-v1',
        privacyDisclosureAcknowledged: true,
        answers: [{ questionId, value: 1 }],
      }),
    )

    expect(careMocks.submitAnonymous).toHaveBeenCalledWith(
      sessionId,
      sessionToken,
      {
        questionnaireDefinitionId: definitionId,
        privacyPolicyVersion: 'privacy-capstone-v1',
        privacyDisclosureAcknowledged: true,
        answers: [{ questionId, value: 1 }],
      },
      'assessment-request-0001',
      expect.any(String),
    )
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body).toEqual(assessment)
    expect(JSON.stringify(body)).not.toContain(sessionId)
    expect(JSON.stringify(body)).not.toContain(sessionToken)
  })
})
