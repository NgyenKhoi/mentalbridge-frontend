import {
  create,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios'

import { createAssessmentApi } from './assessment-api'

const assessment = {
  assessmentId: '10000000-0000-4000-8000-000000000101',
  questionnaireDefinitionId: '20000000-0000-4000-8000-000000000101',
  instrument: 'PHQ9',
  questionnaireVersion: 'phq9-vi-vn-capstone-v2',
  privacyPolicyVersion: 'privacy-capstone-v3',
  submittedAt: '2026-10-06T08:00:00.000Z',
  result: {
    totalScore: 4,
    screeningLevel: 'MINIMAL',
    scoringVersion: 'phq9-standard-v1',
    safetyStatus: 'NEGATIVE_SAFETY_SCREEN',
    safetyPolicyVersion: 'phq9-item9-v1',
    disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
  },
}

const guide = {
  supportGuideId: '30000000-0000-4000-8000-000000000101',
  guideVersion: 1,
  guidePolicyVersion: 'mb-support-guide-capstone-v1',
  supportEvaluationId: '40000000-0000-4000-8000-000000000101',
  generatedAt: '2026-10-06T08:05:00.000Z',
  guideType: 'ONE_TIME_SUPPORT_GUIDE',
  explanation: { code: 'SELF_GUIDED', text: 'Duy trì chăm sóc bản thân.' },
  safety: {
    status: 'NEGATIVE_SAFETY_SCREEN',
    reasonCode: 'PHQ9_ITEM9_NEGATIVE',
    policyVersion: 'phq9-item9-v1',
    guidanceCode: 'STANDARD',
    guidance: 'Bạn có thể chủ động tìm hỗ trợ khi cần.',
  },
  resourceResolution: {
    status: 'EMPTY',
    policyVersion: 'resource-v1',
    resolvedAt: '2026-10-06T08:05:00.000Z',
  },
  resources: [],
  provenance: {
    supportEvaluationPolicyVersion: 'mb-support-routing-capstone-v1',
    assessmentResults: [
      {
        assessmentId: '10000000-0000-4000-8000-000000000101',
        instrument: 'PHQ9',
        questionnaireVersion: 'phq9-vi-vn-capstone-v2',
        scoringVersion: 'phq9-standard-v1',
        screeningLevel: 'MINIMAL',
      },
      {
        assessmentId: '10000000-0000-4000-8000-000000000102',
        instrument: 'GAD7',
        questionnaireVersion: 'gad7-vi-vn-adult-v1',
        scoringVersion: 'gad7-standard-v1',
        screeningLevel: 'MILD',
      },
    ],
  },
  phrasing: { source: 'CARE_APPROVED_STANDARD', status: 'STANDARD' },
}

describe('Care mobile assessment API contract', () => {
  it('submits only the selected definition and answers to the owner-scoped episode', async () => {
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
    const api = createAssessmentApi(create({ adapter }))

    await api.submitEpisodeAssessment(
      '50000000-0000-4000-8000-000000000101',
      'PHQ9',
      {
        questionnaireDefinitionId: '20000000-0000-4000-8000-000000000101',
        privacyPolicyVersion: 'privacy-capstone-v3',
        privacyDisclosureAcknowledged: true,
        answers: [
          {
            questionId: '60000000-0000-4000-8000-000000000101',
            value: 1,
          },
        ],
      },
      '70000000-0000-4000-8000-000000000101',
    )

    expect(requests[0]?.url).toBe(
      '/api/v1/screening-episodes/50000000-0000-4000-8000-000000000101/assessments/PHQ9',
    )
    expect(requests[0]?.headers.get('Idempotency-Key')).toBe(
      '70000000-0000-4000-8000-000000000101',
    )
    const body = JSON.parse(String(requests[0]?.data))
    expect(body).toEqual({
      questionnaireDefinitionId: '20000000-0000-4000-8000-000000000101',
      privacyPolicyVersion: 'privacy-capstone-v3',
      privacyDisclosureAcknowledged: true,
      answers: [
        {
          questionId: '60000000-0000-4000-8000-000000000101',
          value: 1,
        },
      ],
    })
    expect(body).not.toHaveProperty('accountId')
    expect(body).not.toHaveProperty('instrument')
    expect(body).not.toHaveProperty('score')
    expect(body).not.toHaveProperty('safetyStatus')
  })

  it('generates a guide from the exact owned pair without creating a plan', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      return {
        config: request,
        data: guide,
        headers: {},
        status: 201,
        statusText: 'Created',
      }
    }
    const api = createAssessmentApi(create({ adapter }))

    await api.generateSupportGuide(
      '10000000-0000-4000-8000-000000000101',
      '10000000-0000-4000-8000-000000000102',
      '70000000-0000-4000-8000-000000000102',
    )

    expect(requests[0]?.url).toBe('/api/v1/support-guides')
    expect(JSON.parse(String(requests[0]?.data))).toEqual({
      phq9AssessmentId: '10000000-0000-4000-8000-000000000101',
      gad7AssessmentId: '10000000-0000-4000-8000-000000000102',
    })
    expect(requests.some(({ url }) => url?.includes('support-plans'))).toBe(
      false,
    )
  })

  it('rejects guide payloads that do not match the immutable snapshot contract', async () => {
    const adapter: AxiosAdapter = async (request) => ({
      config: request,
      data: { ...guide, guideVersion: 2 },
      headers: {},
      status: 200,
      statusText: 'OK',
    })

    await expect(
      createAssessmentApi(create({ adapter })).getSupportGuide(
        '30000000-0000-4000-8000-000000000101',
      ),
    ).rejects.toBeDefined()
  })
})
