import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/lib/api/browser-client', () => ({ browserApiClient: api }))

import {
  createCommunityComment,
  deleteCommunityComment,
  getCommunityComments,
  updateCommunityComment,
  uploadCommunityMedia,
  putCommunityReaction,
  deleteCommunityReaction,
  putCommunityBookmark,
  deleteCommunityBookmark,
  getCommunityFeed,
  getCommunitySavedPosts,
} from './browser-community'

describe('Community feed browser API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('serializes one to three explicit topic filters as repeated query values', async () => {
    api.get.mockResolvedValue({
      data: { items: [], nextCursor: null, hasMore: false },
    })

    await getCommunityFeed(['MY_STORY', 'SMALL_MILESTONE'], 'opaque-cursor')

    expect(api.get).toHaveBeenCalledWith('/community/feed', {
      params: expect.any(URLSearchParams),
    })
    expect(api.get.mock.calls[0][1].params.toString()).toBe(
      'limit=12&topic=MY_STORY&topic=SMALL_MILESTONE&cursor=opaque-cursor',
    )
  })

  it('requests the private saved-post collection with an opaque cursor', async () => {
    api.get.mockResolvedValue({
      data: { items: [], nextCursor: null, hasMore: false },
    })

    await getCommunitySavedPosts('opaque-saved-cursor')

    expect(api.get).toHaveBeenCalledWith('/community/saved-posts', {
      params: expect.any(URLSearchParams),
    })
    expect(api.get.mock.calls[0][1].params.toString()).toBe(
      'limit=12&cursor=opaque-saved-cursor',
    )
  })
})

describe('uploadCommunityMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('copies only signed intent fields into the direct provider upload then finalizes', async () => {
    const mediaId = '30000000-0000-4000-8000-000000000001'
    api.post
      .mockResolvedValueOnce({
        data: {
          mediaId,
          state: 'PENDING',
          uploadUrl: 'https://api.cloudinary.com/v1_1/test/image/upload',
          expiresAt: '2026-09-30T08:30:00Z',
          uploadFields: {
            api_key: 'public-key',
            public_id: 'owner-scoped-key',
            signature: 'signed-value',
            timestamp: '1790756400',
          },
          version: 0,
        },
      })
      .mockResolvedValueOnce({
        data: {
          mediaId,
          mediaType: 'IMAGE',
          state: 'READY',
          version: 1,
          createdAt: '2026-09-30T08:20:00Z',
          updatedAt: '2026-09-30T08:21:00Z',
        },
      })
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 200 }))
    const file = new File(['safe-image'], 'story.webp', {
      type: 'image/webp',
    })

    const result = await uploadCommunityMedia(file)

    expect(result).toMatchObject({ mediaId, state: 'READY' })
    expect(api.post).toHaveBeenNthCalledWith(
      1,
      '/community/media/upload-intents',
      {
        fileName: 'story.webp',
        mediaType: 'IMAGE',
        mimeType: 'image/webp',
        sizeBytes: file.size,
      },
      { headers: { 'Idempotency-Key': expect.any(String) } },
    )
    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://api.cloudinary.com/v1_1/test/image/upload')
    const form = options?.body as FormData
    expect(form.get('api_key')).toBe('public-key')
    expect(form.get('public_id')).toBe('owner-scoped-key')
    expect(form.get('signature')).toBe('signed-value')
    expect(form.get('file')).toBeInstanceOf(File)
    expect(api.post).toHaveBeenNthCalledWith(
      2,
      `/community/media/${mediaId}/finalize`,
    )
  })

  it('does not finalize when the provider rejects the upload', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        mediaId: '30000000-0000-4000-8000-000000000001',
        state: 'PENDING',
        uploadUrl: 'https://api.cloudinary.com/v1_1/test/video/upload',
        expiresAt: '2026-09-30T08:30:00Z',
        uploadFields: { signature: 'signed-value' },
        version: 0,
      },
    })
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 400 }))

    await expect(
      uploadCommunityMedia(
        new File(['video'], 'story.mp4', { type: 'video/mp4' }),
      ),
    ).rejects.toThrow('COMMUNITY_PROVIDER_UPLOAD_FAILED')
    expect(api.post).toHaveBeenCalledTimes(1)
  })
})

describe('Community comment browser API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses bounded pagination, idempotency and exact comment versions', async () => {
    const postId = '20000000-0000-4000-8000-000000000009'
    const commentId = '40000000-0000-4000-8000-000000000001'
    const comment = {
      commentId,
      postId,
      parentCommentId: null,
      author: {
        communityProfileId: '10000000-0000-4000-8000-000000000002',
        displayName: 'Mầm Xanh',
        avatarPreset: 'LEAF',
        state: 'ACTIVE',
      },
      content: 'Mình đang lắng nghe bạn.',
      state: 'ACTIVE',
      version: 0,
      createdAt: '2026-10-01T05:00:00Z',
      updatedAt: '2026-10-01T05:00:00Z',
    }
    api.get.mockResolvedValue({
      data: { items: [comment], nextCursor: null, hasMore: false },
    })
    api.post.mockResolvedValue({ data: comment, headers: { etag: '"0"' } })
    api.patch.mockResolvedValue({
      data: { ...comment, content: 'Mình vẫn ở đây.', version: 1 },
      headers: { etag: '"1"' },
    })
    api.delete.mockResolvedValue(undefined)

    await getCommunityComments(postId, 'opaque-cursor')
    await createCommunityComment(
      postId,
      { content: comment.content, parentCommentId: null },
      'browser-comment-key-0001',
    )
    await updateCommunityComment(commentId, { content: 'Mình vẫn ở đây.' }, 0)
    await deleteCommunityComment(commentId, 1)

    expect(api.get).toHaveBeenCalledWith(
      `/community/posts/${postId}/comments`,
      { params: { limit: 20, cursor: 'opaque-cursor' } },
    )
    expect(api.post).toHaveBeenCalledWith(
      `/community/posts/${postId}/comments`,
      { content: comment.content, parentCommentId: null },
      { headers: { 'Idempotency-Key': 'browser-comment-key-0001' } },
    )
    expect(api.patch).toHaveBeenCalledWith(
      `/community/comments/${commentId}`,
      { content: 'Mình vẫn ở đây.' },
      { headers: { 'If-Match': '"0"' } },
    )
    expect(api.delete).toHaveBeenCalledWith(
      `/community/comments/${commentId}`,
      { headers: { 'If-Match': '"1"' } },
    )
  })
})

describe('Community interaction browser API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses naturally idempotent replacement and removal endpoints', async () => {
    const postId = '20000000-0000-4000-8000-000000000009'
    api.put.mockResolvedValue({ data: { postId, reaction: 'RELATE' } })
    api.delete.mockResolvedValue(undefined)

    await expect(putCommunityReaction(postId, 'RELATE')).resolves.toEqual({
      postId,
      reaction: 'RELATE',
    })
    await deleteCommunityReaction(postId)
    await putCommunityBookmark(postId)
    await deleteCommunityBookmark(postId)

    expect(api.put).toHaveBeenNthCalledWith(
      1,
      `/community/posts/${postId}/reaction`,
      { reaction: 'RELATE' },
    )
    expect(api.delete).toHaveBeenNthCalledWith(
      1,
      `/community/posts/${postId}/reaction`,
    )
    expect(api.put).toHaveBeenNthCalledWith(
      2,
      `/community/posts/${postId}/bookmark`,
    )
    expect(api.delete).toHaveBeenNthCalledWith(
      2,
      `/community/posts/${postId}/bookmark`,
    )
  })
})
