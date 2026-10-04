import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'

const api = vi.hoisted(() => ({
  post: vi.fn(),
  topics: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  push: vi.fn(),
  confirm: vi.fn(),
  toast: vi.fn(),
  catalogue: vi.fn(),
  resource: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: api.push }),
}))
vi.mock('@/components/ui/FeedbackProvider', () => ({
  useFeedback: () => ({ confirm: api.confirm, showActionToast: api.toast }),
}))
vi.mock('@/features/community/api/browser-community', () => ({
  getCommunityPost: api.post,
  getCommunityTopics: api.topics,
  updateCommunityPost: api.update,
  deleteCommunityPost: api.remove,
}))
vi.mock('@/features/resources/api/browser-resources', () => ({
  getResourceCatalogue: api.catalogue,
  getResourceDetail: api.resource,
}))
vi.mock('./CommunityComments', () => ({
  default: () => <section aria-label="Bình luận hỗ trợ" />,
}))

import CommunityPostDetail from './CommunityPostDetail'

const post = {
  postId: '20000000-0000-4000-8000-000000000009',
  author: {
    communityProfileId: '10000000-0000-4000-8000-000000000002',
    avatarPreset: 'LEAF',
    displayName: 'Minh An',
    state: 'ACTIVE',
  },
  content: 'Nội dung đầy đủ của câu chuyện cá nhân.',
  topics: ['MY_STORY'],
  media: [],
  mediaAvailability: 'UNAVAILABLE',
  counts: { comments: 2, reactions: 3 },
  viewerState: { reaction: null, bookmarked: false },
  publishedAt: '2026-09-29T05:00:00Z',
  updatedAt: '2026-09-29T05:00:00Z',
}

describe('CommunityPostDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.post.mockResolvedValue({ post, version: null })
    api.topics.mockResolvedValue([
      { code: 'MY_STORY', label: 'Câu chuyện của tôi', description: 'Mô tả' },
    ])
    api.confirm.mockResolvedValue(true)
    api.catalogue.mockResolvedValue({ items: [], hasMore: false })
  })

  it('sends the authoritative owner version when editing and deleting', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValue({ post, version: 7 })
    api.update.mockResolvedValue({
      post: { ...post, content: 'Nội dung đã cập nhật.' },
      version: 8,
    })
    render(<CommunityPostDetail postId={post.postId} />)

    await user.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }))
    const textarea = screen.getByLabelText('Nội dung')
    await user.clear(textarea)
    await user.type(textarea, 'Nội dung đã cập nhật.')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    expect(api.update).toHaveBeenCalledWith(
      post.postId,
      {
        content: 'Nội dung đã cập nhật.',
        topics: ['MY_STORY'],
        mediaIds: [],
        authorMode: 'PROFILE',
        resourceId: null,
      },
      7,
    )
    expect(await screen.findByText('Nội dung đã cập nhật.')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Xóa' }))
    expect(api.confirm).toHaveBeenCalled()
    expect(api.remove).toHaveBeenCalledWith(post.postId, 8)
    expect(api.push).toHaveBeenCalledWith('/community')
  })

  it('lets the owner replace and remove a resource attachment', async () => {
    const user = userEvent.setup()
    const first = '40000000-0000-4000-8000-000000000001'
    const replacement = '40000000-0000-4000-8000-000000000002'
    api.post.mockResolvedValue({
      post: { ...post, resourceAttachment: { resourceId: first } },
      version: 2,
    })
    api.catalogue.mockResolvedValue({
      items: [
        { id: first, title: 'Tài nguyên đầu tiên' },
        { id: replacement, title: 'Tài nguyên thay thế' },
      ],
      hasMore: false,
    })
    api.resource.mockResolvedValue({
      id: first,
      title: 'Tài nguyên đầu tiên',
      resourceKind: 'PRACTICE',
    })
    api.update
      .mockResolvedValueOnce({
        post: { ...post, resourceAttachment: { resourceId: replacement } },
        version: 3,
      })
      .mockResolvedValueOnce({
        post: { ...post, resourceAttachment: null },
        version: 4,
      })
    render(<CommunityPostDetail postId={post.postId} />)

    await user.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }))
    await user.selectOptions(
      await screen.findByLabelText(/Tài nguyên MentalBridge/),
      replacement,
    )
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(api.update).toHaveBeenLastCalledWith(
      post.postId,
      expect.objectContaining({ resourceId: replacement }),
      2,
    )

    await user.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }))
    await user.selectOptions(
      await screen.findByLabelText(/Tài nguyên MentalBridge/),
      '',
    )
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(api.update).toHaveBeenLastCalledWith(
      post.postId,
      expect.objectContaining({ resourceId: null }),
      3,
    )
  })

  it('lets the owner change identity mode for this post only', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValue({ post, version: 4 })
    api.update.mockResolvedValue({
      post: {
        ...post,
        author: {
          communityProfileId: null,
          avatarPreset: null,
          displayName: 'Thành viên ẩn danh',
          state: 'ANONYMOUS',
        },
      },
      version: 5,
    })
    render(<CommunityPostDetail postId={post.postId} />)

    await user.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }))
    await user.click(screen.getByRole('radio', { name: /Đăng ẩn danh/ }))
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    expect(api.update).toHaveBeenCalledWith(
      post.postId,
      expect.objectContaining({ authorMode: 'ANONYMOUS' }),
      4,
    )
    expect(await screen.findByText('Thành viên ẩn danh')).toBeVisible()
  })

  it('reloads authoritative content after a stale edit', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValueOnce({ post, version: 3 }).mockResolvedValueOnce({
      post: { ...post, content: 'Nội dung mới từ nơi khác.' },
      version: 4,
    })
    api.update.mockRejectedValueOnce(
      new ApiError({ message: 'stale', code: 'STALE', status: 412 }),
    )
    render(<CommunityPostDetail postId={post.postId} />)

    await user.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }))
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    expect(await screen.findByText('Nội dung mới từ nơi khác.')).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Nội dung mới nhất đã được tải lại.',
    )
  })

  it('renders full content, safe state and community-context disclaimer', async () => {
    render(<CommunityPostDetail postId={post.postId} />)

    expect(await screen.findByText(post.content)).toBeVisible()
    expect(screen.getByText('Câu chuyện của tôi')).toBeVisible()
    expect(screen.getByText(/hiện chưa khả dụng/)).toBeVisible()
    expect(screen.getByText(/không thay thế tư vấn chuyên môn/)).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Cần hỗ trợ ngay' }),
    ).toHaveAttribute('href', '/safety-directory')
  })

  it('keeps interaction controls hidden for a legacy v1.5 detail response', async () => {
    const legacyPost = { ...post }
    Reflect.deleteProperty(legacyPost, 'viewerState')
    api.post.mockResolvedValueOnce({ post: legacyPost, version: null })

    render(<CommunityPostDetail postId={post.postId} />)

    expect(await screen.findByText(/♡ 3/)).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Äá»“ng hĂ nh/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'LÆ°u bĂ i' }),
    ).not.toBeInTheDocument()
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
