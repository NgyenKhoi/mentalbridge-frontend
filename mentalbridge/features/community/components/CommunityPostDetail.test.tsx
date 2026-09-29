import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'

const api = vi.hoisted(() => ({
  post: vi.fn(),
  topics: vi.fn(),
}))
vi.mock('@/features/community/api/browser-community', () => ({
  getCommunityPost: api.post,
  getCommunityTopics: api.topics,
}))

import CommunityPostDetail from './CommunityPostDetail'

const post = {
  postId: '20000000-0000-4000-8000-000000000009',
  author: {
    communityProfileId: '10000000-0000-4000-8000-000000000002',
    displayName: 'Minh An',
    state: 'ACTIVE',
  },
  content: 'Nội dung đầy đủ của câu chuyện cá nhân.',
  topics: ['MY_STORY'],
  media: [],
  mediaAvailability: 'UNAVAILABLE',
  counts: { comments: 2, reactions: 3 },
  publishedAt: '2026-09-29T05:00:00Z',
  updatedAt: '2026-09-29T05:00:00Z',
}

describe('CommunityPostDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.post.mockResolvedValue(post)
    api.topics.mockResolvedValue([
      { code: 'MY_STORY', label: 'Câu chuyện của tôi', description: 'Mô tả' },
    ])
  })

  it('renders full content, safe state and community-context disclaimer', async () => {
    render(<CommunityPostDetail postId={post.postId} />)

    expect(await screen.findByText(post.content)).toBeVisible()
    expect(screen.getByText('Câu chuyện của tôi')).toBeVisible()
    expect(screen.getByText(/hiện chưa khả dụng/)).toBeVisible()
    expect(screen.getByText(/không thay thế tư vấn chuyên môn/)).toBeVisible()
  })

  it('uses the same unavailable state for hidden, removed, blocked and unknown posts', async () => {
    api.post.mockRejectedValueOnce(
      new ApiError({
        message: 'not found',
        code: 'COMMUNITY_POST_NOT_FOUND',
        status: 404,
      }),
    )
    render(<CommunityPostDetail postId={post.postId} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bài viết này không còn khả dụng.',
    )
    expect(
      screen.getByRole('link', { name: 'Trở về bảng tin' }),
    ).toHaveAttribute('href', '/community')
  })
})
