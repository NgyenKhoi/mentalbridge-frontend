import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({
  reviewSupportPlanReplacement: vi.fn(),
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

const draftId = '10000000-0000-4000-8000-000000000375'
const body = {
  currentSupportPlanId: '10000000-0000-4000-8000-000000000374',
  currentVersion: 4,
  reassessmentSummaryId: '40000000-0000-4000-8000-000000000375',
}
const context = {
  params: Promise.resolve({ supportPlanId: draftId }),
} as RouteContext<'/api/care/support-plans/[supportPlanId]/replacement-review'>

describe('POST /api/care/support-plans/[supportPlanId]/replacement-review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: { accountId: crypto.randomUUID(), roles: ['USER'] },
    })
  })

  it('forwards the persisted identifiers and versions to Care', async () => {
    careMocks.reviewSupportPlanReplacement.mockResolvedValue({
      outcome: 'CURRENT_PLAN_VALID_ALTERNATIVES_AVAILABLE',
    })
    const request = new NextRequest(
      `http://localhost/api/care/support-plans/${draftId}/replacement-review`,
      {
        method: 'POST',
        headers: {
          cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret`,
          'content-type': 'application/json',
          'if-match': '"2"',
        },
        body: JSON.stringify(body),
      },
    )

    const response = await POST(request, context)

    expect(response.status).toBe(200)
    expect(careMocks.reviewSupportPlanReplacement).toHaveBeenCalledWith(
      'identity-access-secret',
      draftId,
      2,
      body,
      expect.any(String),
    )
  })
})
