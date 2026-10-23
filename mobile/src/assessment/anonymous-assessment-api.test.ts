import {
  create,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios'

import { createAnonymousAssessmentApi } from './anonymous-assessment-api'

const session = {
  sessionId: '10000000-0000-4000-8000-000000000721',
  sessionToken: 'a'.repeat(43),
  expiresAt: '2026-10-23T10:30:00.000Z',
}

const assessment = {
  assessmentId: '20000000-0000-4000-8000-000000000721',
  questionnaireDefinitionId: '30000000-0000-4000-8000-000000000721',
  instrument: 'PHQ9',
  questionnaireVersion: 'phq9-vi-vn-v1',
  privacyPolicyVersion: 'privacy-capstone-v3',
  submittedAt: '2026-10-23T10:05:00.000Z',
  expiresAt: '2026-10-23T10:35:00.000Z',
  result: {
    totalScore: 1,
    screeningLevel: 'MINIMAL',
    scoringVersion: 'phq9-standard-v1',
    safetyStatus: 'NEGATIVE_SAFETY_SCREEN',
    safetyPolicyVersion: 'phq9-item9-v1',
    disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
  },
}

describe('Care mobile anonymous assessment API contract', () => {
  it('uses the anonymous token and idempotency key without bearer or client scoring', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      return {
        config: request,
        data: assessment,
        headers: {},
        status: 201,
        statusText: 'Created',
      }
    }
    const api = createAnonymousAssessmentApi(create({ adapter }))

    await api.submitAssessment(
      session,
      {
        questionnaireDefinitionId: assessment.questionnaireDefinitionId,
        privacyPolicyVersion: 'privacy-capstone-v3',
        privacyDisclosureAcknowledged: true,
        answers: [
          {
            questionId: '40000000-0000-4000-8000-000000000721',
            value: 1,
          },
        ],
      },
      '50000000-0000-4000-8000-000000000721',
    )

    expect(requests[0]?.url).toBe(
      `/api/v1/anonymous-assessment-sessions/${session.sessionId}/assessments`,
    )
    expect(requests[0]?.headers.get('X-Anonymous-Session-Token')).toBe(
      session.sessionToken,
    )
    expect(requests[0]?.headers.get('Idempotency-Key')).toBe(
      '50000000-0000-4000-8000-000000000721',
    )
    expect(requests[0]?.headers.get('Authorization')).toBeUndefined()
    const body = JSON.parse(String(requests[0]?.data))
    expect(body).not.toHaveProperty('score')
    expect(body).not.toHaveProperty('safetyStatus')
    expect(body).not.toHaveProperty('accountId')
  })

  it('creates a session and reads a result only through its ownership token', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      return {
        config: request,
        data: request.method === 'post' ? session : assessment,
        headers: {},
        status: request.method === 'post' ? 201 : 200,
        statusText: 'OK',
      }
    }
    const api = createAnonymousAssessmentApi(create({ adapter }))

    await expect(api.createSession()).resolves.toEqual(session)
    await expect(
      api.getAssessment(session, assessment.assessmentId),
    ).resolves.toEqual(assessment)

    expect(requests[0]?.url).toBe('/api/v1/anonymous-assessment-sessions')
    expect(requests[1]?.url).toBe(
      `/api/v1/anonymous-assessment-sessions/${session.sessionId}/assessments/${assessment.assessmentId}`,
    )
    expect(requests[1]?.headers.get('X-Anonymous-Session-Token')).toBe(
      session.sessionToken,
    )
  })

  it('rejects malformed session and result payloads instead of fabricating state', async () => {
    let payload: unknown = { ...session, sessionToken: 'short' }
    const adapter: AxiosAdapter = async (request) => ({
      config: request,
      data: payload,
      headers: {},
      status: 200,
      statusText: 'OK',
    })
    const api = createAnonymousAssessmentApi(create({ adapter }))

    await expect(api.createSession()).rejects.toBeDefined()
    payload = { ...assessment, history: [] }
    await expect(
      api.getAssessment(session, assessment.assessmentId),
    ).rejects.toBeDefined()
  })
})
