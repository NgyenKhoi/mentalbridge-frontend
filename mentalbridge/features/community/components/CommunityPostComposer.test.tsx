import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ create: vi.fn(), push: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}))
vi.mock('@/features/community/api/browser-community', () => ({
  createCommunityPost: mocks.create,
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
  beforeEach(() => vi.clearAllMocks())

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
})
