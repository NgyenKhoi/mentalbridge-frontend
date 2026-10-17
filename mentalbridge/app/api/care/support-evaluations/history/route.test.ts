import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({ supportEvaluationHistory: vi.fn() }))
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
    `http://localhost/api/care/support-evaluations/history${query}`,
    { headers: { cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret` } },
  )
}

describe('GET /api/care/support-evaluations/history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: { accountId: crypto.randomUUID(), roles: ['USER'] },
    })
  })

  it('forwards a bounded owner history query', async () => {
    careMocks.supportEvaluationHistory.mockResolvedValue({
      items: [],
      nextCursor: 'next-page',
      hasMore: true,
    })

    const response = await GET(request('?limit=5&cursor=first-page'))

    expect(response.status).toBe(200)
    expect(careMocks.supportEvaluationHistory).toHaveBeenCalledWith(
      'identity-access-secret',
      'first-page',
      5,
      expect.any(String),
    )
  })

  it('rejects an invalid page before calling Care', async () => {
    const response = await GET(request('?limit=51'))

    expect(response.status).toBe(400)
    expect(careMocks.supportEvaluationHistory).not.toHaveBeenCalled()
  })
})
