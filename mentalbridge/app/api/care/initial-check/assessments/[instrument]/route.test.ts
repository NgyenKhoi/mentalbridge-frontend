import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({
  startScreeningEpisode: vi.fn(),
  submitScreeningEpisodeAssessment: vi.fn(),
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

function request(instrument = 'phq9') {
  return new NextRequest(
    `http://localhost/api/care/initial-check/assessments/${instrument}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'guided-assessment-request-0001',
        cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret`,
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
    careMocks.startScreeningEpisode.mockReset()
    careMocks.submitScreeningEpisodeAssessment.mockReset()
    careMocks.questionnaireDefinition.mockReset()
    careMocks.questionnaireDefinition.mockResolvedValue({ instrument: 'PHQ9' })
    careMocks.startScreeningEpisode.mockResolvedValue({
      episodeId: '40000000-0000-4000-8000-000000000101',
    })
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

  it('submits PHQ-9 directly into the persisted Care episode', async () => {
    careMocks.submitScreeningEpisodeAssessment.mockResolvedValue({
      assessmentId: phq9AssessmentId,
      instrument: 'PHQ9',
      voidedAt: null,
    })

    const response = await POST(request(), context('phq9'))

    expect(response.status).toBe(201)
    expect(careMocks.submitScreeningEpisodeAssessment).toHaveBeenCalledWith(
      'identity-access-secret',
      '40000000-0000-4000-8000-000000000101',
      'PHQ9',
      submission,
      'guided-assessment-request-0001',
      expect.any(String),
    )
    expect(response.headers.get('set-cookie') ?? '').not.toContain(
      'mentalbridge_initial_check',
    )
  })

  it('propagates Care-owned episode ordering for GAD-7', async () => {
    careMocks.questionnaireDefinition.mockResolvedValue({ instrument: 'GAD7' })
    careMocks.submitScreeningEpisodeAssessment.mockRejectedValue(
      new ApiError({
        message: 'PHQ-9 is required first',
        code: 'SCREENING_EPISODE_ORDER_REQUIRED',
        status: 409,
      }),
    )
    const response = await POST(request('gad7'), context('gad7'))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'SCREENING_EPISODE_ORDER_REQUIRED',
    })
    expect(careMocks.submitScreeningEpisodeAssessment).toHaveBeenCalled()
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
    expect(careMocks.submitScreeningEpisodeAssessment).not.toHaveBeenCalled()
  })
})
