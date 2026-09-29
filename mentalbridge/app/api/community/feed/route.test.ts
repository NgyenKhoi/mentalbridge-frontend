import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'
import { CommunityServiceError } from '@/lib/community/community-client'

const communityMocks = vi.hoisted(() => ({
  feed: vi.fn(),
  detail: vi.fn(),
  topics: vi.fn(),
}))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/community/community-client', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/lib/community/community-client')
  >()),
  communityClient: communityMocks,
}))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { GET as getPost } from '../posts/[postId]/route'
import { GET as getTopics } from '../topics/route'
import { GET as getFeed } from './route'

const postId = '20000000-0000-4000-8000-000000000009'
const authorId = '10000000-0000-4000-8000-000000000002'
const post = {
  postId,
  author: {
    communityProfileId: authorId,
    displayName: 'Minh An',
    state: 'ACTIVE' as const,
  },
  content: 'Một chia sẻ có chủ đích.',
  topics: ['MY_STORY' as const],
  media: [],
  mediaAvailability: 'NONE' as const,
  counts: { comments: 2, reactions: 3 },
  publishedAt: '2026-09-29T05:00:00Z',
  updatedAt: '2026-09-29T05:00:00Z',
}

function request(url: string) {
  return new NextRequest(url, {
    headers: { cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret` },
  })
}

describe('/api/community read BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: '00000000-0000-4000-8000-000000000001',
        roles: ['USER'],
      },
    })
  })

  it('forwards only bounded feed filters with the authenticated USER token', async () => {
    communityMocks.feed.mockResolvedValue({
      items: [{ ...post, contentPreview: post.content }],
      nextCursor: 'opaque-next',
      hasMore: true,
    })
    const response = await getFeed(
      request(
        'http://localhost/api/community/feed?topic=MY_STORY&limit=12&cursor=opaque-current',
      ),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ hasMore: true })
    expect(communityMocks.feed).toHaveBeenCalledWith(
      'identity-access-secret',
      expect.any(URLSearchParams),
      expect.any(String),
    )
    expect(communityMocks.feed.mock.calls[0][1].toString()).toBe(
      'topic=MY_STORY&limit=12&cursor=opaque-current',
    )
    expect(sessionMocks.ensureRole).toHaveBeenCalledWith(expect.any(Object), [
      'USER',
    ])
  })

  it('rejects profiling and malformed feed parameters before calling Community', async () => {
    for (const query of [
      'topic=PHQ9_MODERATE',
      'limit=51',
      'cursor=https://bad',
      'emotion=SAD',
      'ownerId=other',
    ]) {
      const response = await getFeed(
        request(`http://localhost/api/community/feed?${query}`),
      )
      expect(response.status).toBe(400)
      expect((await response.json()).code).toBe('VALIDATION_FAILED')
    }
    expect(communityMocks.feed).not.toHaveBeenCalled()
  })

  it('loads post detail and governed topics without accepting an owner identity', async () => {
    communityMocks.detail.mockResolvedValue(post)
    communityMocks.topics.mockResolvedValue([
      { code: 'MY_STORY', label: 'Câu chuyện của tôi', description: 'Mô tả' },
    ])

    const detail = await getPost(
      request(`http://localhost/api/community/posts/${postId}`),
      { params: Promise.resolve({ postId }) },
    )
    const topics = await getTopics(
      request('http://localhost/api/community/topics'),
    )

    expect(detail.status).toBe(200)
    expect((await detail.json()).postId).toBe(postId)
    expect(topics.status).toBe(200)
    expect(communityMocks.detail).toHaveBeenCalledWith(
      'identity-access-secret',
      postId,
      expect.any(String),
    )
  })

  it('fails closed for hidden, removed, blocked and unknown posts', async () => {
    communityMocks.detail.mockRejectedValue(
      new CommunityServiceError({
        type: '/problems/community-post-not-found',
        title: 'Post not found',
        status: 404,
        code: 'COMMUNITY_POST_NOT_FOUND',
        correlationId: '00000000-0000-4000-8000-000000000001',
      }),
    )
    const response = await getPost(
      request(`http://localhost/api/community/posts/${postId}`),
      { params: Promise.resolve({ postId }) },
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({
      code: 'COMMUNITY_POST_NOT_FOUND',
      title: 'Community post was not found.',
    })
  })

  it('bounds invalid identifiers and dependency details', async () => {
    const invalid = await getPost(
      request('http://localhost/api/community/posts/not-a-uuid'),
      { params: Promise.resolve({ postId: 'not-a-uuid' }) },
    )
    expect(invalid.status).toBe(400)
    expect(communityMocks.detail).not.toHaveBeenCalled()

    communityMocks.feed.mockRejectedValueOnce(
      new Error('private infrastructure detail'),
    )
    const unavailable = await getFeed(
      request('http://localhost/api/community/feed'),
    )
    expect(unavailable.status).toBe(502)
    expect(JSON.stringify(await unavailable.json())).not.toContain(
      'private infrastructure detail',
    )
  })
})
