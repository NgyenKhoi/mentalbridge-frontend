import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'
import {
  INITIAL_CHECK_EVALUATION_COOKIE,
  INITIAL_CHECK_GAD7_COOKIE,
  INITIAL_CHECK_PHQ9_COOKIE,
} from '@/lib/care/guided-initial-check-cookies'

const careMocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  currentPrivacyDisclosure: vi.fn(),
  getConsents: vi.fn(),
  getAuthenticated: vi.fn(),
  getSupportEvaluation: vi.fn(),
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

import { GET } from './route'

const phq9AssessmentId = '10000000-0000-4000-8000-000000000101'
const gad7AssessmentId = '10000000-0000-4000-8000-000000000102'
const supportEvaluationId = '20000000-0000-4000-8000-000000000101'

function assessment(instrument: 'PHQ9' | 'GAD7') {
  const phq9 = instrument === 'PHQ9'
  return {
    assessmentId: phq9 ? phq9AssessmentId : gad7AssessmentId,
    questionnaireDefinitionId: phq9
      ? '30000000-0000-4000-8000-000000000101'
      : '30000000-0000-4000-8000-000000000102',
    instrument,
    questionnaireVersion: phq9
      ? 'phq9-vi-vn-capstone-v2'
      : 'gad7-vi-vn-adult-v1',
    privacyPolicyVersion: 'privacy-capstone-v3',
    submittedAt: '2026-09-10T08:00:00Z',
    voidedAt: null,
    result: {
      totalScore: phq9 ? 5 : 4,
      screeningLevel: phq9 ? 'MILD' : 'MINIMAL',
      scoringVersion: phq9
        ? 'phq9-standard-bands-v1'
        : 'gad7-standard-bands-v1',
      safetyStatus: phq9 ? 'NEGATIVE_SAFETY_SCREEN' : 'NOT_APPLICABLE',
      safetyPolicyVersion: phq9 ? 'MB-SAFETY-PHQ9-001/1.0-capstone' : null,
      disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
    },
  }
}

function request(cookies: string[] = []) {
  return new NextRequest('http://localhost/api/care/initial-check', {
    headers: {
      cookie: [`${ACCESS_COOKIE_NAME}=identity-access-secret`, ...cookies].join(
        '; ',
      ),
    },
  })
}

describe('GET /api/care/initial-check', () => {
  beforeEach(() => {
    Object.values(careMocks).forEach((mock) => mock.mockReset())
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
    careMocks.getProfile.mockResolvedValue({ displayName: 'Nguyễn An' })
    careMocks.currentPrivacyDisclosure.mockResolvedValue({
      version: 'privacy-capstone-v3',
    })
    careMocks.getConsents.mockResolvedValue({
      decisions: [
        {
          policyVersion: 'privacy-capstone-v3',
          granted: true,
        },
      ],
    })
  })

  it('returns the profile completion step without exposing account data', async () => {
    careMocks.getProfile.mockRejectedValue(
      new ApiError({
        message: 'Profile not found',
        code: 'PROFILE_NOT_FOUND',
        status: 404,
      }),
    )

    const response = await GET(request())

    expect(await response.json()).toEqual({ phase: 'PROFILE_REQUIRED' })
    expect(careMocks.currentPrivacyDisclosure).not.toHaveBeenCalled()
  })

  it('starts with PHQ-9 and clears untrusted downstream journey cookies', async () => {
    const response = await GET(
      request([`${INITIAL_CHECK_GAD7_COOKIE}=${gad7AssessmentId}`]),
    )

    expect(await response.json()).toEqual({ phase: 'PHQ9' })
    expect(response.headers.get('set-cookie')).toContain(
      INITIAL_CHECK_GAD7_COOKIE,
    )
  })

  it('resumes at GAD-7 only after re-reading the exact owned PHQ-9 result', async () => {
    const phq9 = assessment('PHQ9')
    careMocks.getAuthenticated.mockResolvedValue(phq9)

    const response = await GET(
      request([`${INITIAL_CHECK_PHQ9_COOKIE}=${phq9AssessmentId}`]),
    )

    expect(await response.json()).toEqual({ phase: 'GAD7', phq9 })
    expect(careMocks.getAuthenticated).toHaveBeenCalledWith(
      'identity-access-secret',
      phq9AssessmentId,
      expect.any(String),
    )
  })

  it('reopens a completed result only when its evidence matches both saved assessments', async () => {
    const phq9 = assessment('PHQ9')
    const gad7 = assessment('GAD7')
    careMocks.getAuthenticated
      .mockResolvedValueOnce(phq9)
      .mockResolvedValueOnce(gad7)
    careMocks.getSupportEvaluation.mockResolvedValue({
      supportEvaluationId,
      evidence: [
        {
          assessmentId: phq9AssessmentId,
          instrument: 'PHQ9',
          questionnaireVersion: phq9.questionnaireVersion,
          scoringVersion: phq9.result.scoringVersion,
          screeningLevel: phq9.result.screeningLevel,
          safetyStatus: phq9.result.safetyStatus,
        },
        {
          assessmentId: gad7AssessmentId,
          instrument: 'GAD7',
          questionnaireVersion: gad7.questionnaireVersion,
          scoringVersion: gad7.result.scoringVersion,
          screeningLevel: gad7.result.screeningLevel,
          safetyStatus: gad7.result.safetyStatus,
        },
      ],
    })

    const response = await GET(
      request([
        `${INITIAL_CHECK_PHQ9_COOKIE}=${phq9AssessmentId}`,
        `${INITIAL_CHECK_GAD7_COOKIE}=${gad7AssessmentId}`,
        `${INITIAL_CHECK_EVALUATION_COOKIE}=${supportEvaluationId}`,
      ]),
    )

    await expect(response.json()).resolves.toMatchObject({
      phase: 'COMPLETED',
      phq9: { assessmentId: phq9AssessmentId },
      gad7: { assessmentId: gad7AssessmentId },
      evaluation: { supportEvaluationId },
    })
  })
})
