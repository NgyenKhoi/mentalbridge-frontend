import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'
import { CommunityServiceError } from '@/lib/community/community-client'

const communityMocks = vi.hoisted(() => ({
  feed: vi.fn(),
  detail: vi.fn(),
  topics: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  profile: vi.fn(),
  putProfile: vi.fn(),
  createMediaIntent: vi.fn(),
  finalizeMedia: vi.fn(),
  deleteMedia: vi.fn(),
  comments: vi.fn(),
  createComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
  putReaction: vi.fn(),
  deleteReaction: vi.fn(),
  putBookmark: vi.fn(),
  deleteBookmark: vi.fn(),
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

import {
  DELETE as deletePost,
  GET as getPost,
  PATCH as patchPost,
} from '../posts/[postId]/route'
import { POST as createPost } from '../posts/route'
import { GET as getProfile, PUT as putProfile } from '../profile/route'
import { GET as getTopics } from '../topics/route'
import { POST as createMediaIntent } from '../media/upload-intents/route'
import { POST as finalizeMedia } from '../media/[mediaId]/finalize/route'
import { DELETE as deleteMedia } from '../media/[mediaId]/route'
import {
  GET as getComments,
  POST as createComment,
} from '../posts/[postId]/comments/route'
import {
  DELETE as deleteComment,
  PATCH as patchComment,
} from '../comments/[commentId]/route'
import {
  DELETE as deleteReaction,
  PUT as putReaction,
} from '../posts/[postId]/reaction/route'
import {
  DELETE as deleteBookmark,
  PUT as putBookmark,
} from '../posts/[postId]/bookmark/route'
import { GET as getFeed } from './route'

const postId = '20000000-0000-4000-8000-000000000009'
const authorId = '10000000-0000-4000-8000-000000000002'
const commentId = '40000000-0000-4000-8000-000000000001'
const post = {
  postId,
  author: {
    communityProfileId: authorId,
    avatarPreset: null,
    displayName: 'Minh An',
    state: 'ACTIVE' as const,
  },
  content: 'Một chia sẻ có chủ đích.',
  topics: ['MY_STORY' as const],
  media: [],
  mediaAvailability: 'NONE' as const,
  counts: { comments: 2, reactions: 3 },
  viewerState: { reaction: null, bookmarked: false },
  publishedAt: '2026-09-29T05:00:00Z',
  updatedAt: '2026-09-29T05:00:00Z',
}

function request(
  url: string,
  init: ConstructorParameters<typeof NextRequest>[1] = {},
) {
  return new NextRequest(url, {
    ...init,
    headers: {
      cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret`,
      ...Object.fromEntries(new Headers(init.headers).entries()),
    },
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
        'http://localhost/api/community/feed?topic=MY_STORY&topic=SMALL_MILESTONE&limit=12&cursor=opaque-current',
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
      'topic=MY_STORY&topic=SMALL_MILESTONE&limit=12&cursor=opaque-current',
    )
    expect(sessionMocks.ensureRole).toHaveBeenCalledWith(expect.any(Object), [
      'USER',
    ])
  })

  it('rejects profiling and malformed feed parameters before calling Community', async () => {
    for (const query of [
      'topic=PHQ9_MODERATE',
      'topic=MY_STORY&topic=MY_STORY',
      'topic=MY_STORY&topic=SMALL_MILESTONE&topic=PEER_QUESTION&topic=HELPFUL_RESOURCE',
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
    communityMocks.detail.mockResolvedValue({ post, version: null })
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

  it('forwards idempotency and exact owner versions for post commands', async () => {
    communityMocks.create.mockResolvedValue({ post, version: 1 })
    communityMocks.update.mockResolvedValue({
      post: { ...post, content: 'Nội dung mới.' },
      version: 2,
    })
    communityMocks.delete.mockResolvedValue(undefined)
    const body = JSON.stringify({
      content: post.content,
      topics: ['MY_STORY'],
      mediaIds: [],
      authorMode: 'ANONYMOUS',
    })

    const created = await createPost(
      request('http://localhost/api/community/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'browser-create-key-0001',
        },
        body,
      }),
    )
    expect(created.status).toBe(201)
    expect(created.headers.get('etag')).toBe('"1"')
    expect(communityMocks.create).toHaveBeenCalledWith(
      'identity-access-secret',
      expect.objectContaining({ mediaIds: [], authorMode: 'ANONYMOUS' }),
      'browser-create-key-0001',
      expect.any(String),
    )

    const updated = await patchPost(
      request(`http://localhost/api/community/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'If-Match': '"1"' },
        body: JSON.stringify({
          content: 'Nội dung mới.',
          topics: ['MY_STORY'],
          mediaIds: [],
        }),
      }),
      { params: Promise.resolve({ postId }) },
    )
    expect(updated.status).toBe(200)
    expect(updated.headers.get('etag')).toBe('"2"')
    expect(communityMocks.update).toHaveBeenCalledWith(
      'identity-access-secret',
      postId,
      expect.objectContaining({ content: 'Nội dung mới.' }),
      '"1"',
      expect.any(String),
    )

    const removed = await deletePost(
      request(`http://localhost/api/community/posts/${postId}`, {
        method: 'DELETE',
        headers: { 'If-Match': '"2"' },
      }),
      { params: Promise.resolve({ postId }) },
    )
    expect(removed.status).toBe(204)
    expect(communityMocks.delete).toHaveBeenCalledWith(
      'identity-access-secret',
      postId,
      '"2"',
      expect.any(String),
    )
  })

  it('rejects malformed post commands before calling Community', async () => {
    const response = await createPost(
      request('http://localhost/api/community/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'too-short',
        },
        body: JSON.stringify({ content: '', topics: [], mediaIds: [] }),
      }),
    )
    expect(response.status).toBe(400)
    expect(communityMocks.create).not.toHaveBeenCalled()

    const staleShape = await patchPost(
      request(`http://localhost/api/community/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'If-Match': '1' },
        body: JSON.stringify({
          content: post.content,
          topics: ['MY_STORY'],
          mediaIds: [],
        }),
      }),
      { params: Promise.resolve({ postId }) },
    )
    expect(staleShape.status).toBe(400)
    expect(communityMocks.update).not.toHaveBeenCalled()
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

  it('proxies only the owner-scoped Community profile and preserves ETag', async () => {
    const profile = {
      communityProfileId: authorId,
      displayName: 'Mầm Xanh',
      avatarPreset: 'SPROUT' as const,
      status: 'ACTIVE' as const,
      version: 2,
      createdAt: '2026-09-29T05:00:00Z',
      updatedAt: '2026-09-29T05:10:00Z',
    }
    communityMocks.profile.mockResolvedValue({ data: profile, etag: '"2"' })
    communityMocks.putProfile.mockResolvedValue({
      data: { ...profile, displayName: 'Lá Nhỏ', version: 3 },
      etag: '"3"',
    })

    const loaded = await getProfile(
      request('http://localhost/api/community/profile'),
    )
    expect(loaded.status).toBe(200)
    expect(loaded.headers.get('etag')).toBe('"2"')

    const saved = await putProfile(
      new NextRequest('http://localhost/api/community/profile', {
        method: 'PUT',
        headers: {
          cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret`,
          'content-type': 'application/json',
          'if-match': '"2"',
        },
        body: JSON.stringify({
          displayName: 'Lá Nhỏ',
          avatarPreset: 'LEAF',
        }),
      }),
    )
    expect(saved.status).toBe(200)
    expect(saved.headers.get('etag')).toBe('"3"')
    expect(communityMocks.putProfile).toHaveBeenCalledWith(
      'identity-access-secret',
      expect.any(String),
      { displayName: 'Lá Nhỏ', avatarPreset: 'LEAF' },
      '"2"',
    )
  })

  it('rejects account identity and arbitrary avatar fields at the BFF', async () => {
    for (const body of [
      {
        displayName: 'Ẩn danh',
        avatarPreset: null,
        accountSubject: '00000000-0000-4000-8000-000000000001',
      },
      { displayName: 'Ẩn danh', avatarPreset: 'https://example.test/me.png' },
    ]) {
      const response = await putProfile(
        new NextRequest('http://localhost/api/community/profile', {
          method: 'PUT',
          headers: {
            cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
        }),
      )
      expect(response.status).toBe(400)
      expect((await response.json()).code).toBe('VALIDATION_FAILED')
    }
    expect(communityMocks.putProfile).not.toHaveBeenCalled()
  })

  it('proxies only bounded owner media lifecycle commands', async () => {
    const mediaId = '30000000-0000-4000-8000-000000000001'
    communityMocks.createMediaIntent.mockResolvedValue({
      mediaId,
      state: 'PENDING',
      uploadUrl: 'https://api.cloudinary.com/v1_1/test/image/upload',
      expiresAt: '2026-09-30T08:30:00Z',
      uploadFields: { api_key: 'public-key', signature: 'signed-value' },
      version: 0,
    })
    communityMocks.finalizeMedia.mockResolvedValue({
      mediaId,
      mediaType: 'IMAGE',
      state: 'READY',
      version: 1,
      createdAt: '2026-09-30T08:20:00Z',
      updatedAt: '2026-09-30T08:21:00Z',
    })
    communityMocks.deleteMedia.mockResolvedValue(undefined)

    const intent = await createMediaIntent(
      request('http://localhost/api/community/media/upload-intents', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'browser-media-key-0001',
        },
        body: JSON.stringify({
          fileName: 'photo.webp',
          mediaType: 'IMAGE',
          mimeType: 'image/webp',
          sizeBytes: 1234,
        }),
      }),
    )
    expect(intent.status).toBe(201)
    expect(communityMocks.createMediaIntent).toHaveBeenCalledWith(
      'identity-access-secret',
      expect.objectContaining({ mimeType: 'image/webp', sizeBytes: 1234 }),
      'browser-media-key-0001',
      expect.any(String),
    )

    const finalized = await finalizeMedia(
      request(`http://localhost/api/community/media/${mediaId}/finalize`, {
        method: 'POST',
      }),
      { params: Promise.resolve({ mediaId }) },
    )
    expect(finalized.status).toBe(200)
    expect(communityMocks.finalizeMedia).toHaveBeenCalledWith(
      'identity-access-secret',
      mediaId,
      expect.any(String),
    )

    const removed = await deleteMedia(
      request(`http://localhost/api/community/media/${mediaId}`, {
        method: 'DELETE',
        headers: { 'if-match': '"1"' },
      }),
      { params: Promise.resolve({ mediaId }) },
    )
    expect(removed.status).toBe(204)
    expect(communityMocks.deleteMedia).toHaveBeenCalledWith(
      'identity-access-secret',
      mediaId,
      '"1"',
      expect.any(String),
    )
  })

  it('rejects oversized and unsafe media commands before the provider boundary', async () => {
    for (const body of [
      {
        fileName: 'large.png',
        mediaType: 'IMAGE',
        mimeType: 'image/png',
        sizeBytes: 10_485_761,
      },
      {
        fileName: 'vector.svg',
        mediaType: 'IMAGE',
        mimeType: 'image/svg+xml',
        sizeBytes: 100,
      },
    ]) {
      const response = await createMediaIntent(
        request('http://localhost/api/community/media/upload-intents', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'idempotency-key': 'browser-media-key-0002',
          },
          body: JSON.stringify(body),
        }),
      )
      expect(response.status).toBe(400)
    }
    expect(communityMocks.createMediaIntent).not.toHaveBeenCalled()
  })

  it('proxies bounded comment reads, creates, edits and owner deletion', async () => {
    const comment = {
      commentId,
      postId,
      parentCommentId: null,
      author: post.author,
      content: 'Mình đang lắng nghe bạn.',
      state: 'ACTIVE' as const,
      version: 0,
      createdAt: post.publishedAt,
      updatedAt: post.updatedAt,
    }
    communityMocks.comments.mockResolvedValue({
      items: [comment],
      nextCursor: null,
      hasMore: false,
    })
    communityMocks.createComment.mockResolvedValue({
      data: comment,
      etag: '"0"',
    })
    communityMocks.updateComment.mockResolvedValue({
      data: { ...comment, content: 'Mình vẫn ở đây.', version: 1 },
      etag: '"1"',
    })
    communityMocks.deleteComment.mockResolvedValue(undefined)

    const listed = await getComments(
      request(
        `http://localhost/api/community/posts/${postId}/comments?limit=20`,
      ),
      { params: Promise.resolve({ postId }) },
    )
    expect(listed.status).toBe(200)
    expect(communityMocks.comments).toHaveBeenCalledWith(
      'identity-access-secret',
      postId,
      expect.any(URLSearchParams),
      expect.any(String),
    )

    const created = await createComment(
      request(`http://localhost/api/community/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'browser-comment-key-0001',
        },
        body: JSON.stringify({
          content: comment.content,
          parentCommentId: null,
        }),
      }),
      { params: Promise.resolve({ postId }) },
    )
    expect(created.status).toBe(201)
    expect(created.headers.get('etag')).toBe('"0"')

    const updated = await patchComment(
      request(`http://localhost/api/community/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'if-match': '"0"' },
        body: JSON.stringify({ content: 'Mình vẫn ở đây.' }),
      }),
      { params: Promise.resolve({ commentId }) },
    )
    expect(updated.status).toBe(200)
    expect(updated.headers.get('etag')).toBe('"1"')
    expect(communityMocks.updateComment).toHaveBeenCalledWith(
      'identity-access-secret',
      commentId,
      { content: 'Mình vẫn ở đây.' },
      '"0"',
      expect.any(String),
    )

    const removed = await deleteComment(
      request(`http://localhost/api/community/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'if-match': '"1"' },
      }),
      { params: Promise.resolve({ commentId }) },
    )
    expect(removed.status).toBe(204)
    expect(communityMocks.deleteComment).toHaveBeenCalledWith(
      'identity-access-secret',
      commentId,
      '"1"',
      expect.any(String),
    )
  })

  it('rejects malformed comment pagination and commands at the BFF', async () => {
    const invalidPage = await getComments(
      request(
        `http://localhost/api/community/posts/${postId}/comments?limit=51&emotion=SAD`,
      ),
      { params: Promise.resolve({ postId }) },
    )
    expect(invalidPage.status).toBe(400)

    const invalidCreate = await createComment(
      request(`http://localhost/api/community/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'short',
        },
        body: JSON.stringify({ content: '', parentCommentId: null }),
      }),
      { params: Promise.resolve({ postId }) },
    )
    expect(invalidCreate.status).toBe(400)

    const invalidPatch = await patchComment(
      request(`http://localhost/api/community/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'if-match': '0' },
        body: JSON.stringify({ content: 'Nội dung' }),
      }),
      { params: Promise.resolve({ commentId }) },
    )
    expect(invalidPatch.status).toBe(400)
    expect(communityMocks.comments).not.toHaveBeenCalled()
    expect(communityMocks.createComment).not.toHaveBeenCalled()
    expect(communityMocks.updateComment).not.toHaveBeenCalled()
  })

  it('proxies bounded reaction and private bookmark commands', async () => {
    communityMocks.putReaction.mockResolvedValue({
      postId,
      reaction: 'SUPPORT',
    })
    communityMocks.deleteReaction.mockResolvedValue(undefined)
    communityMocks.putBookmark.mockResolvedValue(undefined)
    communityMocks.deleteBookmark.mockResolvedValue(undefined)

    const reacted = await putReaction(
      request(`http://localhost/api/community/posts/${postId}/reaction`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reaction: 'SUPPORT' }),
      }),
      { params: Promise.resolve({ postId }) },
    )
    expect(reacted.status).toBe(200)
    expect(communityMocks.putReaction).toHaveBeenCalledWith(
      'identity-access-secret',
      postId,
      { reaction: 'SUPPORT' },
      expect.any(String),
    )

    const removedReaction = await deleteReaction(
      request(`http://localhost/api/community/posts/${postId}/reaction`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ postId }) },
    )
    const bookmarked = await putBookmark(
      request(`http://localhost/api/community/posts/${postId}/bookmark`, {
        method: 'PUT',
      }),
      { params: Promise.resolve({ postId }) },
    )
    const unbookmarked = await deleteBookmark(
      request(`http://localhost/api/community/posts/${postId}/bookmark`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ postId }) },
    )
    expect(removedReaction.status).toBe(204)
    expect(bookmarked.status).toBe(204)
    expect(unbookmarked.status).toBe(204)
  })

  it('rejects unsupported reactions at the BFF boundary', async () => {
    const response = await putReaction(
      request(`http://localhost/api/community/posts/${postId}/reaction`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reaction: 'LIKE' }),
      }),
      { params: Promise.resolve({ postId }) },
    )

    expect(response.status).toBe(400)
    expect(communityMocks.putReaction).not.toHaveBeenCalled()
  })
})
