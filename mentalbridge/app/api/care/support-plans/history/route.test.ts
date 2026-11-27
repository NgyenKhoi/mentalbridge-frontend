import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { supportPlanFixture } from '@/features/support-plan/testing/support-plan-fixture'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({ supportPlanHistory: vi.fn() }))
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

function request(query = '') {
  return new NextRequest(
    `http://localhost/api/care/support-plans/history${query}`,
    {
      headers: { cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret` },
    },
  )
}

describe('GET /api/care/support-plans/history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: { accountId: crypto.randomUUID(), roles: ['USER'] },
    })
  })

  it('forwards a bounded owner history query', async () => {
    careMocks.supportPlanHistory.mockResolvedValue({
      items: [
        {
          ...supportPlanFixture(),
          status: 'DISCARDED',
          version: 1,
          discardedAt: '2026-09-21T05:00:00Z',
        },
      ],
      nextCursor: 'next-page',
      hasMore: true,
    })

    const response = await GET(request('?limit=5&cursor=first-page'))

    expect(response.status).toBe(200)
    expect(careMocks.supportPlanHistory).toHaveBeenCalledWith(
      'identity-access-secret',
      5,
      'first-page',
      expect.any(String),
    )
  })

  it('rejects an out-of-range page before calling Care', async () => {
    const response = await GET(request('?limit=51'))

    expect(response.status).toBe(400)
    expect(careMocks.supportPlanHistory).not.toHaveBeenCalled()
  })
})
