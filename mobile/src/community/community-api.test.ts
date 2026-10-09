import type { AxiosInstance } from 'axios'
import { ApiError } from '@/api/api-error'
import { createCommunityApi } from './community-api'
import {
  fixturePost,
  fixturePostId,
  fixtureProfile,
  fixtureSummary,
} from './community-fixtures'

function setup() {
  const methods = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  }
  const client = methods as unknown as AxiosInstance
  return { ...methods, api: createCommunityApi(client) }
}
const body = {
  content: 'Một bước nhỏ',
  topics: ['MY_STORY'] as const,
  mediaIds: [],
  authorMode: 'ANONYMOUS' as const,
  resourceId: null,
  sensitiveContentWarning: null,
}
const key = 'community-command-123456'

describe('direct public Community API', () => {
  it('uses cursor and repeated governed topic parameters, not BFF or health ranking selectors', async () => {
    const { api, get } = setup()
    get.mockResolvedValue({
      data: { items: [fixtureSummary], nextCursor: null, hasMore: false },
    })
    await api.feed(['MY_STORY', 'SMALL_MILESTONE'], 'opaque')
    expect(get.mock.calls[0]?.[0]).toBe('/api/v1/community/feed')
    expect(String(get.mock.calls[0]?.[1].params)).toBe(
      'limit=20&topic=MY_STORY&topic=SMALL_MILESTONE&cursor=opaque',
    )
    await api.saved()
    expect(get).toHaveBeenLastCalledWith('/api/v1/community/saved-posts', {
      params: { limit: 20 },
    })
  })
  it('uses owner ETag alone for anonymous edit eligibility and exact If-Match writes', async () => {
    const { api, get, post, patch, delete: remove } = setup()
    get.mockResolvedValue({ data: fixturePost, headers: {} })
    expect((await api.detail(fixturePostId)).etag).toBeNull()
    post.mockResolvedValue({ data: fixturePost, headers: { etag: '"0"' } })
    await api.create({ ...body, topics: ['MY_STORY'] }, key)
    expect(post).toHaveBeenCalledWith(
      '/api/v1/community/posts',
      expect.objectContaining({ authorMode: 'ANONYMOUS' }),
      { headers: { 'Idempotency-Key': key } },
    )
    patch.mockResolvedValue({ data: fixturePost, headers: { etag: '"1"' } })
    await api.update(fixturePostId, '"0"', { ...body, topics: ['MY_STORY'] })
    expect(patch.mock.calls[0]?.[2]).toEqual({ headers: { 'If-Match': '"0"' } })
    await api.remove(fixturePostId, '"1"')
    expect(remove.mock.calls[0]?.[1]).toEqual({
      headers: { 'If-Match': '"1"' },
    })
    get.mockResolvedValue({
      data: { ...fixturePost, postId: '33333333-3333-4333-8333-333333333333' },
      headers: {},
    })
    await expect(api.detail(fixturePostId)).rejects.toMatchObject({
      code: 'COMMUNITY_CONTRACT_MISMATCH',
    })
  })
  it('requires profile ETag matching its returned version and treats only authoritative 404 as missing', async () => {
    const { api, get, put } = setup()
    get.mockRejectedValue(
      new ApiError({ message: 'missing', code: 'NOT_FOUND', status: 404 }),
    )
    expect(await api.profile()).toBeNull()
    get.mockRejectedValue(
      new ApiError({ message: 'down', code: 'UNAVAILABLE', status: 503 }),
    )
    await expect(api.profile()).rejects.toMatchObject({ status: 503 })
    put.mockResolvedValue({
      data: fixtureProfile.profile,
      headers: { etag: '"0"' },
    })
    await api.saveProfile({ displayName: 'Bạn', avatarPreset: null }, null)
    expect(put.mock.calls[0]?.[1]).toEqual({
      displayName: 'Bạn',
      avatarPreset: null,
    })
    put.mockResolvedValue({
      data: fixtureProfile.profile,
      headers: { etag: '"9"' },
    })
    await expect(
      api.saveProfile({ displayName: 'Bạn', avatarPreset: null }, '"0"'),
    ).rejects.toThrow()
  })
  it('uses natural reaction/bookmark/block commands and stable idempotent reports without owner selectors', async () => {
    const { api, post, put, delete: remove } = setup()
    put.mockResolvedValue({
      data: { postId: fixturePostId, reaction: 'SUPPORT' },
    })
    await api.react(fixturePostId, 'SUPPORT')
    await api.react(fixturePostId, null)
    await api.bookmark(fixturePostId, true)
    await api.block(fixtureProfile.profile.communityProfileId)
    await api.report(
      {
        targetType: 'POST',
        targetId: fixturePostId,
        reason: 'SPAM',
        details: null,
      },
      key,
    )
    expect(put).toHaveBeenCalledWith(
      `/api/v1/community/posts/${fixturePostId}/reaction`,
      { reaction: 'SUPPORT' },
    )
    expect(remove).toHaveBeenCalledWith(
      `/api/v1/community/posts/${fixturePostId}/reaction`,
    )
    expect(post).toHaveBeenCalledWith(
      '/api/v1/community/reports',
      {
        targetType: 'POST',
        targetId: fixturePostId,
        reason: 'SPAM',
        details: null,
      },
      { headers: { 'Idempotency-Key': key } },
    )
  })
})
