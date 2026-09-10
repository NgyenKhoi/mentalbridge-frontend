import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'
import {
  INITIAL_CHECK_EVALUATION_COOKIE,
  INITIAL_CHECK_GAD7_COOKIE,
  INITIAL_CHECK_PHQ9_COOKIE,
} from '@/lib/care/guided-initial-check-cookies'

const careMocks = vi.hoisted(() => ({ evaluateSupport: vi.fn() }))
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
const gad7AssessmentId = '10000000-0000-4000-8000-000000000102'
const supportEvaluationId = '20000000-0000-4000-8000-000000000101'

function request(cookies: string[] = []) {
  return new NextRequest('http://localhost/api/care/initial-check/evaluation', {
    method: 'POST',
    headers: {
      cookie: [`${ACCESS_COOKIE_NAME}=identity-access-secret`, ...cookies].join(
        '; ',
      ),
    },
  })
}

describe('POST /api/care/initial-check/evaluation', () => {
  beforeEach(() => {
    careMocks.evaluateSupport.mockReset()
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

  it('sends the exact server-held pair with a deterministic retry key', async () => {
    careMocks.evaluateSupport.mockResolvedValue({
      supportEvaluationId,
    })

    const response = await POST(
      request([
        `${INITIAL_CHECK_PHQ9_COOKIE}=${phq9AssessmentId}`,
        `${INITIAL_CHECK_GAD7_COOKIE}=${gad7AssessmentId}`,
      ]),
    )

    expect(careMocks.evaluateSupport).toHaveBeenCalledWith(
      'identity-access-secret',
      { phq9AssessmentId, gad7AssessmentId },
      `initial-check:${phq9AssessmentId}:${gad7AssessmentId}`,
      expect.any(String),
    )
    expect(response.headers.get('set-cookie')).toContain(
      `${INITIAL_CHECK_EVALUATION_COOKIE}=${supportEvaluationId}`,
    )
  })

  it('does not accept a browser body as a substitute for missing journey IDs', async () => {
    const response = await POST(request())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'INITIAL_CHECK_INCOMPLETE',
    })
    expect(careMocks.evaluateSupport).not.toHaveBeenCalled()
  })
})
