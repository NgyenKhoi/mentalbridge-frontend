import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'
import { ApiError } from '@/lib/api/api-error'
import { ContentServiceError } from '@/lib/content/content-client'

const contentMocks = vi.hoisted(() => ({
  list: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
  delete: vi.fn(),
}))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
}))

vi.mock('@/lib/content/content-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/content/content-client')>()),
  contentNotificationClient: contentMocks,
}))
vi.mock('@/lib/auth/session-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/session-service')>()),
  resolveSession: sessionMocks.resolveSession,
}))

import { DELETE } from './[id]/route'
import { PATCH } from './[id]/read/route'
import { POST } from './mark-all-read/route'
import { GET } from './route'

const id = 'c13e4567-e89b-42d3-a456-426614174000'
const notification = {
  id,
  kind: 'MESSAGE' as const,
  title: 'Tin nhắn mới',
  body: 'Bạn có một tin nhắn mới.',
  priority: 'NORMAL' as const,
  occurredAt: '2026-09-26T01:00:00.000Z',
  createdAt: '2026-09-26T01:00:01.000Z',
  read: false,
  readAt: null,
  action: { type: 'OPEN_MESSAGES' as const, targetId: null, href: '/messages' },
  lifecycleState: 'ACTIVE' as const,
  expiresAt: '2026-12-25T01:00:01.000Z',
}

function authenticatedRequest(url: string, method: string) {
  return new NextRequest(url, {
    method,
    headers: { cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret` },
  })
}

describe('/api/notifications owner BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: '10000000-0000-4000-8000-000000000009',
        roles: ['USER'],
      },
    })
  })

  it('forwards only bounded list pagination with the authenticated session', async () => {
    contentMocks.list.mockResolvedValue({
      items: [notification],
      nextCursor: 'next-page',
      hasMore: true,
      unreadCount: 1,
    })
    const response = await GET(
      authenticatedRequest(
        'http://localhost/api/notifications?limit=20&cursor=current-page',
        'GET',
      ),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ unreadCount: 1 })
    expect(contentMocks.list).toHaveBeenCalledWith(
      'identity-access-secret',
      expect.objectContaining({}),
      expect.any(String),
    )
    const query = contentMocks.list.mock.calls[0][1] as URLSearchParams
    expect(query.toString()).toBe('limit=20&cursor=current-page')
  })

  it('allows a specialist to use every owner-scoped inbox mutation', async () => {
    sessionMocks.resolveSession.mockResolvedValue({
      account: { accountId: id, roles: ['SPECIALIST'] },
    })
    contentMocks.list.mockResolvedValue({
      items: [notification],
      nextCursor: null,
      hasMore: false,
      unreadCount: 1,
    })
    contentMocks.markRead.mockResolvedValue({ ...notification, read: true })
    contentMocks.markAllRead.mockResolvedValue({ updatedCount: 1 })
    contentMocks.delete.mockResolvedValue(undefined)
    const context = { params: Promise.resolve({ id }) }

    expect(
      (
        await GET(
          authenticatedRequest('http://localhost/api/notifications', 'GET'),
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await PATCH(
          authenticatedRequest(
            `http://localhost/api/notifications/${id}/read`,
            'PATCH',
          ),
          context,
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await POST(
          authenticatedRequest(
            'http://localhost/api/notifications/mark-all-read',
            'POST',
          ),
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await DELETE(
          authenticatedRequest(
            `http://localhost/api/notifications/${id}`,
            'DELETE',
          ),
          context,
        )
      ).status,
    ).toBe(204)
  })

  it('rejects unauthenticated and ADMIN principals at the real owner role boundary', async () => {
    sessionMocks.resolveSession.mockRejectedValueOnce(
      new ApiError({
        message: 'Authentication is required.',
        code: 'SESSION_REQUIRED',
        status: 401,
      }),
    )
    const unauthenticated = await GET(
      new NextRequest('http://localhost/api/notifications'),
    )
    expect(unauthenticated.status).toBe(401)

    sessionMocks.resolveSession.mockResolvedValueOnce({
      account: { accountId: id, roles: ['ADMIN'] },
    })
    const admin = await GET(
      authenticatedRequest('http://localhost/api/notifications', 'GET'),
    )
    expect(admin.status).toBe(403)
    expect(contentMocks.list).not.toHaveBeenCalled()
  })

  it('rejects unknown, malformed and oversized pagination before Content is called', async () => {
    for (const query of [
      'limit=0',
      'limit=51',
      'cursor=https://bad',
      'ownerId=other',
    ]) {
      const response = await GET(
        authenticatedRequest(
          `http://localhost/api/notifications?${query}`,
          'GET',
        ),
      )
      expect(response.status).toBe(400)
    }
    expect(contentMocks.list).not.toHaveBeenCalled()
  })

  it('forwards single read, bulk read and deletion without accepting an owner id', async () => {
    contentMocks.markRead.mockResolvedValue({
      ...notification,
      read: true,
      readAt: '2026-09-26T02:00:00.000Z',
    })
    contentMocks.markAllRead.mockResolvedValue({ updatedCount: 1 })
    contentMocks.delete.mockResolvedValue(undefined)
    const context = { params: Promise.resolve({ id }) }

    const read = await PATCH(
      authenticatedRequest(
        `http://localhost/api/notifications/${id}/read`,
        'PATCH',
      ),
      context,
    )
    const readAll = await POST(
      authenticatedRequest(
        'http://localhost/api/notifications/mark-all-read',
        'POST',
      ),
    )
    const remove = await DELETE(
      authenticatedRequest(
        `http://localhost/api/notifications/${id}`,
        'DELETE',
      ),
      context,
    )

    expect(read.status).toBe(200)
    expect(readAll.status).toBe(200)
    expect(remove.status).toBe(204)
    expect(contentMocks.markRead).toHaveBeenCalledWith(
      'identity-access-secret',
      id,
      expect.any(String),
    )
    expect(contentMocks.markAllRead).toHaveBeenCalledWith(
      'identity-access-secret',
      expect.any(String),
    )
    expect(contentMocks.delete).toHaveBeenCalledWith(
      'identity-access-secret',
      id,
      expect.any(String),
    )
  })

  it('preserves deleted/expired and dependency failures as bounded responses', async () => {
    contentMocks.markRead.mockRejectedValueOnce(
      new ContentServiceError({
        type: 'https://mentalbridge.io/errors/NOTIFICATION_GONE',
        title: 'Notification is gone',
        status: 410,
        code: 'NOTIFICATION_GONE',
      }),
    )
    const gone = await PATCH(
      authenticatedRequest(
        `http://localhost/api/notifications/${id}/read`,
        'PATCH',
      ),
      { params: Promise.resolve({ id }) },
    )
    expect(gone.status).toBe(410)
    expect((await gone.json()).code).toBe('NOTIFICATION_GONE')

    contentMocks.list.mockRejectedValueOnce(
      new Error('private dependency detail'),
    )
    const unavailable = await GET(
      authenticatedRequest('http://localhost/api/notifications', 'GET'),
    )
    expect(unavailable.status).toBe(502)
    expect(JSON.stringify(await unavailable.json())).not.toContain(
      'private dependency detail',
    )
  })
})
