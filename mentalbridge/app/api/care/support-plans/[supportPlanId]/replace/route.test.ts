import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({ replaceSupportPlan: vi.fn() }))
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

const draftId = '10000000-0000-4000-8000-000000000375'
const currentId = '10000000-0000-4000-8000-000000000374'
const summaryId = '40000000-0000-4000-8000-000000000375'
const context = {
  params: Promise.resolve({ supportPlanId: draftId }),
} as RouteContext<'/api/care/support-plans/[supportPlanId]/replace'>

function request(headers: Record<string, string> = {}) {
  return new NextRequest(
    `http://localhost/api/care/support-plans/${draftId}/replace`,
    {
      method: 'POST',
      headers: {
        cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret`,
        'content-type': 'application/json',
        'if-match': '"2"',
        'idempotency-key': 'support-plan-replace-browser-0375',
        ...headers,
      },
      body: JSON.stringify({
        currentSupportPlanId: currentId,
        currentVersion: 4,
        reassessmentSummaryId: summaryId,
      }),
    },
  )
}

describe('POST /api/care/support-plans/[supportPlanId]/replace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: { accountId: crypto.randomUUID(), roles: ['USER'] },
    })
  })

  it('forwards the versioned and idempotent confirmation', async () => {
    careMocks.replaceSupportPlan.mockResolvedValue({
      supportPlanId: draftId,
      version: 3,
    })

    const response = await POST(request(), context)

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"3"')
    expect(careMocks.replaceSupportPlan).toHaveBeenCalledWith(
      'identity-access-secret',
      draftId,
      2,
      {
        currentSupportPlanId: currentId,
        currentVersion: 4,
        reassessmentSummaryId: summaryId,
      },
      'support-plan-replace-browser-0375',
      expect.any(String),
    )
  })

  it('preserves a stale-summary conflict without synthesizing a result', async () => {
    careMocks.replaceSupportPlan.mockRejectedValue(
      new ApiError({
        message: 'stale',
        code: 'REASSESSMENT_SUMMARY_STALE',
        status: 409,
      }),
    )

    const response = await POST(request(), context)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'REASSESSMENT_SUMMARY_STALE',
    })
  })

  it('requires the idempotency key', async () => {
    const response = await POST(request({ 'idempotency-key': '' }), context)

    expect(response.status).toBe(400)
    expect(careMocks.replaceSupportPlan).not.toHaveBeenCalled()
  })
})
