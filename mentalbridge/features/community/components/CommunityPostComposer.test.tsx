import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  push: vi.fn(),
  catalogue: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}))
vi.mock('@/features/community/api/browser-community', () => ({
  createCommunityPost: mocks.create,
  uploadCommunityMedia: mocks.upload,
  deleteCommunityMedia: mocks.remove,
}))
vi.mock('@/features/resources/api/browser-resources', () => ({
  getResourceCatalogue: mocks.catalogue,
}))

import CommunityPostComposer from './CommunityPostComposer'

const topics = [
  {
    code: 'MY_STORY' as const,
    label: 'Câu chuyện của tôi',
    description: 'Mô tả',
  },
  {
    code: 'SMALL_MILESTONE' as const,
    label: 'Bước tiến nhỏ',
    description: 'Mô tả',
  },
]

describe('CommunityPostComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.catalogue.mockResolvedValue({ items: [], hasMore: false })
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:preview'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
  })

  it('accepts 5000 emoji code points and preserves the idempotency key on retry', async () => {
    const user = userEvent.setup()
    mocks.create
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        post: { postId: '20000000-0000-4000-8000-000000000009' },
        version: 1,
      })
    render(<CommunityPostComposer topics={topics} />)
    await user.click(screen.getByRole('button', { name: 'Viết bài' }))
    fireEvent.change(screen.getByLabelText('Nội dung'), {
      target: { value: '🌱'.repeat(5000) },
    })
    await user.click(screen.getByText('Câu chuyện của tôi'))
    await user.click(screen.getByRole('button', { name: 'Đăng câu chuyện' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('thử lại')
    await user.click(screen.getByRole('button', { name: 'Đăng câu chuyện' }))

    expect(mocks.create).toHaveBeenCalledTimes(2)
    expect(mocks.create.mock.calls[0][0].content).toHaveLength(10000)
    expect(mocks.create.mock.calls[0][1]).toBe(mocks.create.mock.calls[1][1])
    expect(mocks.push).toHaveBeenCalledWith(
      '/community/20000000-0000-4000-8000-000000000009',
    )
  })

  it('rejects content over the code-point limit before calling the API', async () => {
    const user = userEvent.setup()
    render(<CommunityPostComposer topics={topics} />)
    await user.click(screen.getByRole('button', { name: 'Viết bài' }))
    fireEvent.change(screen.getByLabelText('Nội dung'), {
      target: { value: '🌱'.repeat(5001) },
    })
    await user.click(screen.getByText('Câu chuyện của tôi'))

    expect(
      screen.getByRole('button', { name: 'Đăng câu chuyện' }),
    ).toBeDisabled()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('sends the per-post anonymous mode to Community', async () => {
    const user = userEvent.setup()
    mocks.create.mockResolvedValue({
      post: { postId: '20000000-0000-4000-8000-000000000009' },
      version: 0,
    })
    render(<CommunityPostComposer topics={topics} />)

    await user.click(screen.getByRole('button', { name: 'Viết bài' }))
    await user.type(screen.getByLabelText('Nội dung'), 'Một chia sẻ riêng tư')
    await user.click(screen.getByText('Câu chuyện của tôi'))
    await user.click(screen.getByRole('radio', { name: /Đăng ẩn danh/ }))
    await user.click(screen.getByRole('button', { name: 'Đăng câu chuyện' }))

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ authorMode: 'ANONYMOUS' }),
      expect.any(String),
    )
  })

  it('sends an explicit sensitive-content warning only when the author selects it', async () => {
    const user = userEvent.setup()
    mocks.create.mockResolvedValue({
      post: { postId: '20000000-0000-4000-8000-000000000009' },
      version: 0,
    })
    render(<CommunityPostComposer topics={topics} />)

    await user.click(screen.getByRole('button', { name: 'Viết bài' }))
    await user.type(
      screen.getByLabelText('Nội dung'),
      'Một chia sẻ cần cảnh báo',
    )
    await user.click(screen.getByText('Câu chuyện của tôi'))
    await user.click(
      screen.getByRole('checkbox', {
        name: /Thêm cảnh báo nội dung nhạy cảm/,
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Đăng câu chuyện' }))

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sensitiveContentWarning: 'SENSITIVE_CONTENT',
      }),
      expect.any(String),
    )
  })

  it('attaches one published MentalBridge resource to the command', async () => {
    const user = userEvent.setup()
    const resourceId = '40000000-0000-4000-8000-000000000001'
    mocks.catalogue.mockResolvedValue({
      items: [{ id: resourceId, title: 'Thở chậm trong hai phút' }],
      hasMore: false,
    })
    mocks.create.mockResolvedValue({
      post: { postId: '20000000-0000-4000-8000-000000000009' },
      version: 0,
    })
    render(<CommunityPostComposer topics={topics} />)

    await user.click(screen.getByRole('button', { name: 'Viết bài' }))
    await user.type(screen.getByLabelText('Nội dung'), 'Một tài nguyên hữu ích')
    await user.click(screen.getByText('Câu chuyện của tôi'))
    await user.selectOptions(
      await screen.findByLabelText(/Tài nguyên MentalBridge/),
      resourceId,
    )
    await user.click(screen.getByRole('button', { name: 'Đăng câu chuyện' }))

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId }),
      expect.any(String),
    )
  })

  it('waits for READY media and attaches its exact id to the new post', async () => {
    const user = userEvent.setup()
    const mediaId = '30000000-0000-4000-8000-000000000001'
    mocks.upload.mockResolvedValue({
      mediaId,
      mediaType: 'IMAGE',
      state: 'READY',
      version: 1,
      createdAt: '2026-09-30T08:20:00Z',
      updatedAt: '2026-09-30T08:21:00Z',
    })
    mocks.create.mockResolvedValue({
      post: { postId: '20000000-0000-4000-8000-000000000009' },
      version: 0,
    })
    render(<CommunityPostComposer topics={topics} />)
    await user.click(screen.getByRole('button', { name: 'Viết bài' }))
    await user.type(screen.getByLabelText('Nội dung'), 'Một chia sẻ có ảnh')
    await user.click(screen.getByText('Câu chuyện của tôi'))
    await user.upload(
      screen.getByLabelText('Thêm tệp'),
      new File(['image'], 'story.webp', { type: 'image/webp' }),
    )
    expect(await screen.findByText('Sẵn sàng đính kèm')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Đăng câu chuyện' }))

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ mediaIds: [mediaId] }),
      expect.any(String),
    )
  })
})
