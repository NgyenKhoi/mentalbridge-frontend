import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({ screeningEpisodeHistory: vi.fn() }))
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
    `http://localhost/api/care/screening-episodes/history${query}`,
    { headers: { cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret` } },
  )
}

describe('GET /api/care/screening-episodes/history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: { accountId: crypto.randomUUID(), roles: ['USER'] },
    })
  })

  it('forwards a bounded owner history query', async () => {
    careMocks.screeningEpisodeHistory.mockResolvedValue({
      items: [],
      nextCursor: 'next-page',
      hasMore: true,
    })

    const response = await GET(request('?limit=5&cursor=first-page'))

    expect(response.status).toBe(200)
    expect(careMocks.screeningEpisodeHistory).toHaveBeenCalledWith(
      'identity-access-secret',
      'first-page',
      5,
      expect.any(String),
    )
  })

  it('rejects an invalid page before calling Care', async () => {
    const response = await GET(request('?limit=51'))

    expect(response.status).toBe(400)
    expect(careMocks.screeningEpisodeHistory).not.toHaveBeenCalled()
  })

  it('rejects a non-USER session before provider access', async () => {
    sessionMocks.ensureRole.mockImplementation(() => {
      throw new ApiError({ code: 'FORBIDDEN', status: 403, message: 'private' })
    })

    const response = await GET(request())

    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe('FORBIDDEN')
    expect(careMocks.screeningEpisodeHistory).not.toHaveBeenCalled()
  })
})
