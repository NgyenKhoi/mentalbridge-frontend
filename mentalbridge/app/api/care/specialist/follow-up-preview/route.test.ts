import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const session = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: session.resolveSession,
  ensureRole: session.ensureRole,
}))

import { GET } from './route'

function request() {
  return new NextRequest(
    'http://localhost/api/care/specialist/follow-up-preview?mock=true',
    { headers: { cookie: `${ACCESS_COOKIE_NAME}=access-token` } },
  )
}

describe('specialist follow-up preview BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('USE_MOCK_SPECIALIST', 'true')
    session.resolveSession.mockResolvedValue({
      account: {
        accountId: '9e3a8903-3d31-48d0-bf1a-4d81bbcef4b8',
        status: 'ACTIVE',
        roles: ['SPECIALIST'],
        emailVerified: true,
      },
    })
  })

  afterEach(() => vi.unstubAllEnvs())

  it('rejects unauthenticated requests even when mock is requested', async () => {
    session.resolveSession.mockRejectedValueOnce(
      new ApiError({
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'Session expired',
      }),
    )

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(session.ensureRole).not.toHaveBeenCalled()
  })

  it('keeps preview data disabled outside development', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ enabled: false })
    expect(session.ensureRole).toHaveBeenCalledWith(expect.anything(), [
      'SPECIALIST',
    ])
  })

  it('serves preview data only to authenticated specialists in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.enabled).toBe(true)
    expect(body.board).toBeDefined()
    expect(session.ensureRole).toHaveBeenCalledWith(expect.anything(), [
      'SPECIALIST',
    ])
  })
})
