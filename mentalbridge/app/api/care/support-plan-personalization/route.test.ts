import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({
  supportPlanPersonalization: vi.fn(),
  replaceSupportPlanPersonalization: vi.fn(),
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

import { GET, PUT } from './route'

const personalization = {
  personalizationId: '10000000-0000-4000-8000-000000000638',
  schemaVersion: 'support-plan-personalization-v1',
  revision: 2,
  status: 'PROVIDED',
  preferredFocus: 'SLEEP',
  desiredPace: 'GENTLE',
  dailyTimeBudgetMinutes: 10,
  preferredDaypart: 'EVENING',
  preferredActivityModes: ['GUIDED_PRACTICE'],
  commonBarriers: ['LOW_ENERGY'],
  submittedAt: '2026-10-12T08:00:00Z',
  planReview: {
    required: false,
    supportPlanId: null,
    supportPlanVersion: null,
    reasonCode: null,
  },
} as const

function request(method: 'GET' | 'PUT', body?: unknown, ifMatch?: string) {
  return new NextRequest(
    'http://localhost/api/care/support-plan-personalization',
    {
      method,
      headers: {
        cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(ifMatch === undefined ? {} : { 'If-Match': ifMatch }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  )
}

describe('/api/care/support-plan-personalization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: { accountId: crypto.randomUUID(), roles: ['USER'] },
    })
  })

  it('returns the current revision with a strong ETag', async () => {
    careMocks.supportPlanPersonalization.mockResolvedValue(personalization)

    const response = await GET(request('GET'))

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"2"')
    expect(careMocks.supportPlanPersonalization).toHaveBeenCalledWith(
      'identity-access-secret',
      expect.any(String),
    )
  })

  it('forwards the complete optional replacement with If-Match', async () => {
    careMocks.replaceSupportPlanPersonalization.mockResolvedValue({
      ...personalization,
      revision: 3,
    })
    const body = {
      preferredFocus: null,
      desiredPace: 'BALANCED',
      dailyTimeBudgetMinutes: null,
      preferredDaypart: null,
      preferredActivityModes: ['READING', 'ROUTINE'],
      commonBarriers: [],
    }

    const response = await PUT(request('PUT', body, '"2"'))

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"3"')
    expect(careMocks.replaceSupportPlanPersonalization).toHaveBeenCalledWith(
      'identity-access-secret',
      body,
      2,
      expect.any(String),
    )
  })

  it('rejects missing concurrency authority without calling Care', async () => {
    const response = await PUT(
      request('PUT', {
        preferredActivityModes: [],
        commonBarriers: [],
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: 'VALIDATION_FAILED',
      violations: [{ field: 'If-Match', code: 'REQUIRED' }],
    })
    expect(careMocks.replaceSupportPlanPersonalization).not.toHaveBeenCalled()
  })

  it('rejects invalid enum values before calling Care', async () => {
    const response = await PUT(
      request(
        'PUT',
        {
          preferredFocus: 'DIAGNOSIS',
          preferredActivityModes: [],
          commonBarriers: [],
        },
        '"0"',
      ),
    )

    expect(response.status).toBe(400)
    expect(careMocks.replaceSupportPlanPersonalization).not.toHaveBeenCalled()
  })
})
