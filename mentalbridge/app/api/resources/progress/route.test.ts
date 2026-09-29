import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const contentMocks = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn() }))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/content/content-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/content/content-client')>()),
  contentResourceProgressClient: contentMocks,
}))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { PUT } from './[resourceId]/[localDate]/route'
import { GET } from './route'

const resourceId = '00000000-0000-4000-8000-000000000213'
const localDate = '2026-09-29'
const progress = {
  resourceId,
  localDate,
  contentVersion: '4',
  status: 'COMPLETED',
  completedActionIds: ['read', 'takeaway'],
  completedAt: '2026-09-29T02:00:00.000Z',
  updatedAt: '2026-09-29T02:00:00.000Z',
  version: '1',
}

function request(path: string, method: 'GET' | 'PUT', body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

describe('/api/resources/progress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: '10000000-0000-4000-8000-000000000009',
        roles: ['USER'],
      },
    })
  })

  it('loads owner-scoped progress for a bounded date range', async () => {
    contentMocks.list.mockResolvedValue({ items: [progress] })

    const response = await GET(
      request('/api/resources/progress?from=2026-09-23&to=2026-09-29', 'GET'),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ items: [progress] })
    expect(contentMocks.list).toHaveBeenCalledWith(
      'identity-access-secret',
      '2026-09-23',
      '2026-09-29',
      expect.any(String),
    )
  })

  it('rejects an invalid or excessive date range before Content is called', async () => {
    const response = await GET(
      request('/api/resources/progress?from=2026-01-01&to=2026-09-29', 'GET'),
    )

    expect(response.status).toBe(400)
    expect(contentMocks.list).not.toHaveBeenCalled()
  })

  it('saves an exact progress replacement for the authenticated owner', async () => {
    const update = {
      status: 'COMPLETED',
      completedActionIds: ['read', 'takeaway'],
    }
    contentMocks.save.mockResolvedValue(progress)
    const context = {
      params: Promise.resolve({ resourceId, localDate }),
    } as Parameters<typeof PUT>[1]

    const response = await PUT(
      request(
        `/api/resources/progress/${resourceId}/${localDate}`,
        'PUT',
        update,
      ),
      context,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(progress)
    expect(contentMocks.save).toHaveBeenCalledWith(
      'identity-access-secret',
      resourceId,
      localDate,
      update,
      expect.any(String),
    )
  })

  it('rejects an open or inconsistent progress payload', async () => {
    const context = {
      params: Promise.resolve({ resourceId, localDate }),
    } as Parameters<typeof PUT>[1]
    const response = await PUT(
      request(`/api/resources/progress/${resourceId}/${localDate}`, 'PUT', {
        status: 'IN_PROGRESS',
        completedActionIds: [],
        privateNote: 'must not cross the boundary',
      }),
      context,
    )

    expect(response.status).toBe(400)
    expect(contentMocks.save).not.toHaveBeenCalled()
  })
})
