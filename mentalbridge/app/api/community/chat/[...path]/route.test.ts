import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CommunityServiceError } from '@/lib/community/community-client'

const upstream = vi.hoisted(() => vi.fn())
vi.mock('@/features/community-chat/server/community-chat-client', () => ({
  communityChatRequest: upstream,
}))
vi.mock('@/lib/community/authenticated-user', () => ({
  authenticatedCommunityUser: vi
    .fn()
    .mockResolvedValue({ accessToken: 'access-token' }),
  carryCommunitySession: (response: Response) => response,
  communityAuthenticationFailure: vi.fn(),
}))

import { GET, POST } from './route'

const conversationId = '20000000-0000-4000-8000-000000000001'
const messageId = '40000000-0000-4000-8000-000000000001'
const reportKey = '50000000-0000-4000-8000-000000000001'

describe('/api/community/chat BFF', () => {
  beforeEach(() => {
    upstream.mockReset()
  })

  it('forwards only bounded owner-scoped pagination', async () => {
    upstream.mockResolvedValue({
      data: { items: [], nextCursor: null },
      status: 200,
      etag: null,
    })
    const response = await GET(
      new NextRequest(
        'http://localhost/api/community/chat/conversations?limit=20&cursor=opaque%2Bcursor',
      ),
      { params: Promise.resolve({ path: ['conversations'] }) },
    )

    expect(response.status).toBe(200)
    expect(upstream).toHaveBeenCalledWith(
      '/api/v1/community/chat/conversations?limit=20&cursor=opaque%2Bcursor',
      'access-token',
      expect.any(String),
      expect.any(Function),
    )
  })

  it('preserves the UUID idempotency key for message retry', async () => {
    upstream.mockResolvedValue({
      data: {
        message: {},
        persistence: 'SAVED',
        delivery: 'UNCONFIRMED',
      },
      status: 201,
      etag: null,
    })
    const clientMessageId = '50000000-0000-4000-8000-000000000001'
    const response = await POST(
      new NextRequest(
        `http://localhost/api/community/chat/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': clientMessageId,
          },
          body: JSON.stringify({ clientMessageId, content: 'Một lời chào.' }),
        },
      ),
      {
        params: Promise.resolve({
          path: ['conversations', conversationId, 'messages'],
        }),
      },
    )

    expect(response.status).toBe(201)
    expect(upstream.mock.calls[0][4]).toMatchObject({
      headers: { 'Idempotency-Key': clientMessageId },
      body: { clientMessageId, content: 'Một lời chào.' },
    })
  })

  it('forwards an exact-message report with its idempotency key', async () => {
    upstream.mockResolvedValue({
      data: {
        caseId: '60000000-0000-4000-8000-000000000001',
        state: 'RECEIVED',
      },
      status: 201,
      etag: null,
    })
    const response = await POST(
      new NextRequest('http://localhost/api/community/chat/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': reportKey,
        },
        body: JSON.stringify({
          messageId,
          reasonCode: 'PRIVACY_CONCERN',
          details: 'Contains identifying information.',
        }),
      }),
      { params: Promise.resolve({ path: ['reports'] }) },
    )

    expect(response.status).toBe(201)
    expect(upstream).toHaveBeenCalledWith(
      '/api/v1/community/chat/reports',
      'access-token',
      expect.any(String),
      expect.any(Function),
      {
        method: 'POST',
        body: {
          messageId,
          reasonCode: 'PRIVACY_CONCERN',
          details: 'Contains identifying information.',
        },
        headers: { 'Idempotency-Key': reportKey },
        expectedStatus: 201,
      },
    )
  })

  it('rejects report actor injection before upstream', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/community/chat/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': reportKey,
        },
        body: JSON.stringify({
          messageId,
          reasonCode: 'SPAM',
          reporterId: '10000000-0000-4000-8000-000000000099',
        }),
      }),
      { params: Promise.resolve({ path: ['reports'] }) },
    )

    expect(response.status).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('preserves an upstream report authorization denial', async () => {
    upstream.mockRejectedValue(
      new CommunityServiceError({
        type: '/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        code: 'FORBIDDEN',
      }),
    )
    const response = await POST(
      new NextRequest('http://localhost/api/community/chat/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': reportKey,
        },
        body: JSON.stringify({ messageId, reasonCode: 'HARASSMENT' }),
      }),
      { params: Promise.resolve({ path: ['reports'] }) },
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects malformed identifiers and unknown query keys before upstream', async () => {
    const invalidId = await GET(
      new NextRequest(
        'http://localhost/api/community/chat/conversations/not-a-uuid',
      ),
      { params: Promise.resolve({ path: ['conversations', 'not-a-uuid'] }) },
    )
    const invalidQuery = await GET(
      new NextRequest(
        'http://localhost/api/community/chat/conversations?ownerId=other',
      ),
      { params: Promise.resolve({ path: ['conversations'] }) },
    )

    expect(invalidId.status).toBe(400)
    expect(invalidQuery.status).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('keeps inaccessible chat targets uniform instead of naming another resource', async () => {
    upstream.mockRejectedValue(
      new CommunityServiceError({
        type: '/problems/target-unavailable',
        title: 'Hidden provider detail',
        status: 404,
        code: 'TARGET_UNAVAILABLE',
      }),
    )

    const response = await GET(
      new NextRequest(
        `http://localhost/api/community/chat/conversations/${conversationId}`,
      ),
      {
        params: Promise.resolve({ path: ['conversations', conversationId] }),
      },
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({
      code: 'TARGET_UNAVAILABLE',
      title: 'Community chat target is unavailable.',
    })
  })
})
