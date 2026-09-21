import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'
import {
  INITIAL_CHECK_GAD7_COOKIE,
  INITIAL_CHECK_PHQ9_COOKIE,
} from '@/lib/care/guided-initial-check-cookies'

const careMocks = vi.hoisted(() => ({
  evaluateSupportV2: vi.fn(),
  proposeSupportPlanDraft: vi.fn(),
  currentSupportPlanDraft: vi.fn(),
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

import { GET, POST } from './route'

const phq9 = '10000000-0000-4000-8000-000000000372'
const gad7 = '20000000-0000-4000-8000-000000000372'
const evaluationId = '30000000-0000-4000-8000-000000000372'

function request(method: 'GET' | 'POST', journey = true) {
  const cookies = [`${ACCESS_COOKIE_NAME}=identity-access-secret`]
  if (journey) {
    cookies.push(
      `${INITIAL_CHECK_PHQ9_COOKIE}=${phq9}`,
      `${INITIAL_CHECK_GAD7_COOKIE}=${gad7}`,
    )
  }
  return new NextRequest('http://localhost/api/care/support-plans', {
    method,
    headers: {
      cookie: cookies.join('; '),
      ...(method === 'POST'
        ? { 'idempotency-key': 'support-plan-browser-0372' }
        : {}),
    },
  })
}

describe('/api/care/support-plans', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: '40000000-0000-4000-8000-000000000372',
        status: 'ACTIVE',
        roles: ['USER'],
        emailVerified: true,
      },
    })
  })

  it('derives a v2 evaluation from server-held assessment references', async () => {
    careMocks.evaluateSupportV2.mockResolvedValue({
      supportEvaluationId: evaluationId,
    })
    careMocks.proposeSupportPlanDraft.mockResolvedValue({
      supportPlanId: '50000000-0000-4000-8000-000000000372',
    })

    const response = await POST(request('POST'))

    expect(response.status).toBe(201)
    expect(careMocks.evaluateSupportV2).toHaveBeenCalledWith(
      'identity-access-secret',
      { phq9AssessmentId: phq9, gad7AssessmentId: gad7 },
      `support-plan-evaluation:${phq9}:${gad7}`,
      expect.any(String),
    )
    expect(careMocks.proposeSupportPlanDraft).toHaveBeenCalledWith(
      'identity-access-secret',
      { sourceSupportEvaluationId: evaluationId },
      'support-plan-browser-0372',
      expect.any(String),
    )
  })

  it('fails closed without both server-held assessment references', async () => {
    const response = await POST(request('POST', false))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'INITIAL_CHECK_INCOMPLETE',
    })
    expect(careMocks.evaluateSupportV2).not.toHaveBeenCalled()
    expect(careMocks.proposeSupportPlanDraft).not.toHaveBeenCalled()
  })

  it('reloads the persisted current draft without creating dependencies', async () => {
    careMocks.currentSupportPlanDraft.mockResolvedValue({
      supportPlanId: '50000000-0000-4000-8000-000000000372',
    })

    const response = await GET(request('GET'))

    expect(response.status).toBe(200)
    expect(careMocks.currentSupportPlanDraft).toHaveBeenCalledWith(
      'identity-access-secret',
      expect.any(String),
    )
    expect(careMocks.evaluateSupportV2).not.toHaveBeenCalled()
    expect(careMocks.proposeSupportPlanDraft).not.toHaveBeenCalled()
  })
})
