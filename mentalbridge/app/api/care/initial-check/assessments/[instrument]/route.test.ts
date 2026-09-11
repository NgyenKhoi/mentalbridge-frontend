import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'
import {
  INITIAL_CHECK_GAD7_COOKIE,
  INITIAL_CHECK_PHQ9_COOKIE,
} from '@/lib/care/guided-initial-check-cookies'

const careMocks = vi.hoisted(() => ({
  submitAuthenticated: vi.fn(),
  getAuthenticated: vi.fn(),
  questionnaireDefinition: vi.fn(),
}))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/care/care-client', () => ({ careClient: careMocks }))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { POST } from './route'

const phq9AssessmentId = '10000000-0000-4000-8000-000000000101'
const definitionId = '20000000-0000-4000-8000-000000000101'
const questionId = '30000000-0000-4000-8000-000000000101'
const submission = {
  questionnaireDefinitionId: definitionId,
  privacyPolicyVersion: 'privacy-capstone-v3',
  privacyDisclosureAcknowledged: true,
  answers: [{ questionId, value: 0 }],
}

function request(extraCookies: string[] = []) {
  return new NextRequest(
    'http://localhost/api/care/initial-check/assessments/phq9',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'guided-assessment-request-0001',
        cookie: [
          `${ACCESS_COOKIE_NAME}=identity-access-secret`,
          ...extraCookies,
        ].join('; '),
      },
      body: JSON.stringify(submission),
    },
  )
}

function context(instrument: string) {
  return { params: Promise.resolve({ instrument }) }
}

describe('POST /api/care/initial-check/assessments/[instrument]', () => {
  beforeEach(() => {
    careMocks.submitAuthenticated.mockReset()
    careMocks.getAuthenticated.mockReset()
    careMocks.questionnaireDefinition.mockReset()
    careMocks.questionnaireDefinition.mockResolvedValue({ instrument: 'PHQ9' })
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

  it('stores only the returned PHQ-9 identifier in HttpOnly journey cookies', async () => {
    careMocks.submitAuthenticated.mockResolvedValue({
      assessmentId: phq9AssessmentId,
      instrument: 'PHQ9',
      voidedAt: null,
    })

    const response = await POST(request(), context('phq9'))

    expect(response.status).toBe(201)
    expect(careMocks.submitAuthenticated).toHaveBeenCalledWith(
      'identity-access-secret',
      submission,
      'guided-assessment-request-0001',
      expect.any(String),
    )
    const cookieHeader = response.headers.get('set-cookie') ?? ''
    expect(cookieHeader).toContain(
      `${INITIAL_CHECK_PHQ9_COOKIE}=${phq9AssessmentId}`,
    )
    expect(cookieHeader).toContain('HttpOnly')
    expect(cookieHeader).toContain('SameSite=lax')
    expect(cookieHeader).toContain(`${INITIAL_CHECK_GAD7_COOKIE}=`)
    expect(cookieHeader).not.toContain('identity-access-secret')
  })

  it('rejects GAD-7 before PHQ-9 without calling Care submission', async () => {
    const response = await POST(request(), context('gad7'))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'INITIAL_CHECK_ORDER_REQUIRED',
    })
    expect(careMocks.submitAuthenticated).not.toHaveBeenCalled()
  })

  it('rejects a definition for another instrument before creating an assessment', async () => {
    careMocks.questionnaireDefinition.mockResolvedValue({ instrument: 'GAD7' })

    const response = await POST(request(), context('phq9'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: 'VALIDATION_FAILED',
      violations: [
        {
          field: 'questionnaireDefinitionId',
          code: 'INSTRUMENT_MISMATCH',
        },
      ],
    })
    expect(careMocks.submitAuthenticated).not.toHaveBeenCalled()
  })
})
