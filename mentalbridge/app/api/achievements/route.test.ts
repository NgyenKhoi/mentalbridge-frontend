import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const contentMocks = vi.hoisted(() => ({
  get: vi.fn(),
  setVisibility: vi.fn(),
}))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/content/content-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/content/content-client')>()),
  contentAchievementClient: contentMocks,
}))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { GET, PUT } from './route'

function request(method: 'GET' | 'PUT', body?: unknown, etag?: string) {
  return new NextRequest(
    'http://localhost/api/achievements?timezone=Asia%2FHo_Chi_Minh',
    {
      method,
      headers: {
        cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(etag ? { 'If-Match': etag } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  )
}

describe('/api/achievements BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: '10000000-0000-4000-8000-000000000009',
        roles: ['USER'],
      },
    })
  })

  it('forwards the authenticated token and preserves the collection ETag', async () => {
    contentMocks.get.mockResolvedValue({
      collection: { items: [] },
      etag: '"0"',
    })
    const response = await GET(request('GET'))
    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"0"')
    expect(contentMocks.get).toHaveBeenCalledWith(
      'identity-access-secret',
      'Asia/Ho_Chi_Minh',
      expect.any(String),
    )
  })

  it('forwards an exact privacy replacement and strong version', async () => {
    contentMocks.setVisibility.mockResolvedValue({
      collection: { visibilityState: 'HIDDEN' },
      etag: '"1"',
    })
    const response = await PUT(
      request('PUT', { visibilityState: 'HIDDEN' }, '"0"'),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"1"')
    expect(contentMocks.setVisibility).toHaveBeenCalledWith(
      'identity-access-secret',
      'Asia/Ho_Chi_Minh',
      { visibilityState: 'HIDDEN' },
      '"0"',
      expect.any(String),
    )
  })

  it.each([
    [undefined, '"0"'],
    [{ visibilityState: 'PUBLIC' }, '"0"'],
    [{ visibilityState: 'HIDDEN', clinicalScore: 7 }, '"0"'],
    [{ visibilityState: 'HIDDEN' }, 'W/"0"'],
  ])(
    'rejects malformed preferences before Content is called',
    async (body, etag) => {
      const response = await PUT(request('PUT', body, etag))
      expect(response.status).toBeGreaterThanOrEqual(400)
      expect(contentMocks.setVisibility).not.toHaveBeenCalled()
    },
  )
})
