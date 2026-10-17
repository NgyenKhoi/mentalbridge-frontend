import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'
import { ApiError } from '@/lib/api/api-error'

const contentMocks = vi.hoisted(() => ({ preview: vi.fn() }))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/content/content-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/content/content-client')>()),
  contentWellbeingDigestClient: contentMocks,
}))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { GET } from './route'

function request(authenticated = true) {
  return new NextRequest(
    'http://localhost/api/notifications/wellbeing-digest/preview',
    authenticated
      ? { headers: { cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret` } }
      : undefined,
  )
}

describe('/api/notifications/wellbeing-digest/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: '10000000-0000-4000-8000-000000000009',
        roles: ['USER'],
      },
    })
  })

  it('returns the authenticated owner preview without caching it publicly', async () => {
    contentMocks.preview.mockResolvedValue({
      localDate: '2026-09-30',
      timeZone: 'Asia/Ho_Chi_Minh',
      scheduledTime: '19:00',
      eligibleNow: false,
      resourceItems: [],
      includeJournalPrompt: true,
      includeEmotionPrompt: false,
      empty: false,
    })

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(contentMocks.preview).toHaveBeenCalledWith(
      'identity-access-secret',
      expect.any(String),
    )
    expect(sessionMocks.ensureRole).toHaveBeenCalledWith(expect.any(Object), [
      'USER',
    ])
  })

  it('does not call Content without an authenticated session', async () => {
    sessionMocks.resolveSession.mockRejectedValue(
      new ApiError({
        message: 'Authentication required.',
        code: 'AUTHENTICATION_REQUIRED',
        status: 401,
      }),
    )
    const response = await GET(request(false))

    expect(response.status).toBe(401)
    expect(contentMocks.preview).not.toHaveBeenCalled()
  })
})
