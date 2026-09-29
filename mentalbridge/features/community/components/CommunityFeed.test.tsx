import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CommunityFeedPage } from '@/lib/community/community-validation'

const api = vi.hoisted(() => ({
  feed: vi.fn(),
  topics: vi.fn(),
}))

vi.mock('@/features/community/api/browser-community', () => ({
  getCommunityFeed: api.feed,
  getCommunityTopics: api.topics,
}))

import CommunityFeed from './CommunityFeed'

const topics = [
  { code: 'MY_STORY', label: 'Câu chuyện của tôi', description: 'Mô tả' },
  { code: 'SMALL_MILESTONE', label: 'Bước tiến nhỏ', description: 'Mô tả' },
]
const post: CommunityFeedPage['items'][number] = {
  postId: '20000000-0000-4000-8000-000000000009',
  author: {
    communityProfileId: '10000000-0000-4000-8000-000000000002',
    displayName: 'Thành viên đã rời cộng đồng',
    state: 'DELETED',
  },
  contentPreview: 'Một câu chuyện vẫn còn hữu ích cho cộng đồng.',
  topics: ['MY_STORY'],
  media: [],
  mediaAvailability: 'PARTIAL',
  counts: { comments: 2, reactions: 3 },
  publishedAt: '2026-09-29T05:00:00Z',
  updatedAt: '2026-09-29T05:00:00Z',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('CommunityFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.topics.mockResolvedValue(topics)
    api.feed.mockResolvedValue({
      items: [post],
      nextCursor: null,
      hasMore: false,
    })
  })

  it('shows the chosen identity, explicit topics, counts and partial-media state', async () => {
    render(<CommunityFeed />)

    expect(await screen.findByText('Thành viên đã rời cộng đồng')).toBeVisible()
    expect(screen.getAllByText('Câu chuyện của tôi')).toHaveLength(2)
    expect(screen.getByText(/Một số nội dung đa phương tiện/)).toBeVisible()
    expect(screen.getByText('◇ 2 bình luận')).toBeVisible()
    expect(screen.getByRole('link', { name: /Đọc bài viết/ })).toHaveAttribute(
      'href',
      `/community/${post.postId}`,
    )
  })

  it('reloads newest-first content when a governed topic is selected', async () => {
    const user = userEvent.setup()
    render(<CommunityFeed />)
    await screen.findByText(post.contentPreview)
    await user.click(
      await screen.findByRole('button', { name: 'Bước tiến nhỏ' }),
    )

    await waitFor(() =>
      expect(api.feed).toHaveBeenLastCalledWith('SMALL_MILESTONE'),
    )
  })

  it('appends an opaque cursor page without duplicating existing posts', async () => {
    const user = userEvent.setup()
    api.feed
      .mockResolvedValueOnce({
        items: [post],
        nextCursor: 'next-page',
        hasMore: true,
      })
      .mockResolvedValueOnce({
        items: [
          post,
          {
            ...post,
            postId: '20000000-0000-4000-8000-000000000008',
            author: { ...post.author, displayName: 'Lan' },
            contentPreview: 'Một bước tiến nhỏ.',
          },
        ],
        nextCursor: null,
        hasMore: false,
      })
    render(<CommunityFeed />)

    await user.click(
      await screen.findByRole('button', { name: 'Xem thêm câu chuyện' }),
    )
    expect(await screen.findByText('Một bước tiến nhỏ.')).toBeVisible()
    expect(screen.getAllByText(post.contentPreview)).toHaveLength(1)
    expect(api.feed).toHaveBeenNthCalledWith(2, undefined, 'next-page')
  })

  it('discards an old pagination response after the topic changes', async () => {
    const user = userEvent.setup()
    const oldPage = deferred<CommunityFeedPage>()
    const topicPost: CommunityFeedPage['items'][number] = {
      ...post,
      postId: '20000000-0000-4000-8000-000000000007',
      contentPreview: 'Câu chuyện thuộc chủ đề mới.',
      topics: ['SMALL_MILESTONE'],
    }
    api.feed
      .mockResolvedValueOnce({
        items: [post],
        nextCursor: 'all-next',
        hasMore: true,
      })
      .mockReturnValueOnce(oldPage.promise)
      .mockResolvedValueOnce({
        items: [topicPost],
        nextCursor: 'topic-next',
        hasMore: true,
      })
      .mockResolvedValueOnce({
        items: [topicPost],
        nextCursor: null,
        hasMore: false,
      })
    render(<CommunityFeed />)

    await user.click(
      await screen.findByRole('button', { name: 'Xem thêm câu chuyện' }),
    )
    await user.click(screen.getByRole('button', { name: 'Bước tiến nhỏ' }))
    expect(await screen.findByText(topicPost.contentPreview)).toBeVisible()

    await act(async () => {
      oldPage.resolve({
        items: [
          {
            ...post,
            postId: '20000000-0000-4000-8000-000000000006',
            contentPreview: 'Trang cũ không được trộn vào chủ đề mới.',
          },
        ],
        nextCursor: null,
        hasMore: false,
      })
      await oldPage.promise
    })

    expect(
      screen.queryByText('Trang cũ không được trộn vào chủ đề mới.'),
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Xem thêm câu chuyện' }),
    )
    expect(api.feed).toHaveBeenNthCalledWith(4, 'SMALL_MILESTONE', 'topic-next')
  })

  it('renders recoverable failure and explicit empty states', async () => {
    const user = userEvent.setup()
    api.feed.mockRejectedValueOnce(new Error('offline'))
    render(<CommunityFeed />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bảng tin cộng đồng tạm thời chưa tải được.',
    )
    api.feed.mockResolvedValueOnce({
      items: [],
      nextCursor: null,
      hasMore: false,
    })
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(
      await screen.findByText('Chưa có bài viết trong chủ đề này'),
    ).toBeVisible()
  })
})
