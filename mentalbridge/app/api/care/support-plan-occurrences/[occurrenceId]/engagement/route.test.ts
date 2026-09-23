import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { supportPlanOccurrenceFixture } from '@/features/support-plan/testing/support-plan-occurrence-fixture'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const occurrenceId = '91000000-0000-4000-8000-000000000513'
const careMocks = vi.hoisted(() => ({
  replaceSupportPlanOccurrenceEngagement: vi.fn(),
  deleteSupportPlanOccurrenceEngagement: vi.fn(),
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

import { DELETE, PUT } from './route'

const context = {
  params: Promise.resolve({ occurrenceId }),
} as RouteContext<'/api/care/support-plan-occurrences/[occurrenceId]/engagement'>

function request(method: 'PUT' | 'DELETE', body?: unknown, ifMatch = '"2"') {
  return new NextRequest(
    `http://localhost/api/care/support-plan-occurrences/${occurrenceId}/engagement`,
    {
      method,
      headers: {
        cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret`,
        'content-type': 'application/json',
        'if-match': ifMatch,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  )
}

describe('support-plan occurrence engagement BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: { accountId: crypto.randomUUID(), roles: ['USER'] },
    })
  })

  it('forwards an exact replacement and returns the new version', async () => {
    const body = {
      state: 'COMPLETED' as const,
      hidden: false,
      helpfulness: 'HELPFUL' as const,
      barrierCode: null,
      reflection: 'Tôi thấy dễ bắt đầu hơn.',
      summaryReuseApproved: true,
    }
    careMocks.replaceSupportPlanOccurrenceEngagement.mockResolvedValue(
      supportPlanOccurrenceFixture({ ...body, version: 3 }),
    )

    const response = await PUT(request('PUT', body), context)

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"3"')
    expect(
      careMocks.replaceSupportPlanOccurrenceEngagement,
    ).toHaveBeenCalledWith(
      'identity-access-secret',
      occurrenceId,
      2,
      body,
      expect.any(String),
    )
  })

  it('rejects details that do not match the chosen state', async () => {
    const response = await PUT(
      request('PUT', {
        state: 'SKIPPED',
        hidden: false,
        helpfulness: 'HELPFUL',
        barrierCode: null,
        reflection: null,
        summaryReuseApproved: false,
      }),
      context,
    )

    expect(response.status).toBe(400)
    expect(
      careMocks.replaceSupportPlanOccurrenceEngagement,
    ).not.toHaveBeenCalled()
  })

  it('rejects partial or client-invented replacement fields', async () => {
    const response = await PUT(
      request('PUT', {
        state: 'COMPLETED',
        hidden: false,
        helpfulness: null,
        barrierCode: null,
        summaryReuseApproved: false,
        adherence: true,
      }),
      context,
    )

    expect(response.status).toBe(400)
    expect(
      careMocks.replaceSupportPlanOccurrenceEngagement,
    ).not.toHaveBeenCalled()
  })

  it('forwards deletion with optimistic concurrency', async () => {
    careMocks.deleteSupportPlanOccurrenceEngagement.mockResolvedValue(
      supportPlanOccurrenceFixture({ version: 3 }),
    )

    const response = await DELETE(request('DELETE'), context)

    expect(response.status).toBe(200)
    expect(
      careMocks.deleteSupportPlanOccurrenceEngagement,
    ).toHaveBeenCalledWith(
      'identity-access-secret',
      occurrenceId,
      2,
      expect.any(String),
    )
  })
})
