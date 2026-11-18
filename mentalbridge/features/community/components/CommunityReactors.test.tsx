import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MotionGlobalConfig } from 'framer-motion'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ reactions: vi.fn() }))

vi.mock('@/features/community/api/browser-community', () => ({
  getCommunityPostReactions: api.reactions,
}))

import CommunityReactors from './CommunityReactors'

MotionGlobalConfig.skipAnimations = true

const reactor = {
  communityProfileId: '10000000-0000-4000-8000-000000000002',
  displayName: 'Minh An',
  avatarPreset: 'LEAF' as const,
  reaction: 'EMPATHY' as const,
  reactedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  self: false,
}

describe('CommunityReactors', () => {
  beforeEach(() => vi.resetAllMocks())

  it('lists reactors with name, kind and time, and names the viewer "Bạn"', async () => {
    api.reactions.mockResolvedValue({
      items: [
        reactor,
        {
          ...reactor,
          communityProfileId: '10000000-0000-4000-8000-000000000003',
          displayName: 'Tên thật của tôi',
          reaction: 'CHEER',
          self: true,
        },
      ],
      count: 2,
    })
    render(<CommunityReactors postId="post-1" onClose={vi.fn()} />)

    expect(screen.getByRole('status', { name: 'Đang tải' })).toBeInTheDocument()
    const rows = await screen.findAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Minh An')
    expect(rows[0]).toHaveTextContent('Đồng cảm')
    expect(rows[0]).toHaveTextContent('5 phút trước')
    expect(rows[1]).toHaveTextContent('Bạn')
    expect(rows[1]).not.toHaveTextContent('Tên thật của tôi')
    expect(rows[1]).toHaveTextContent('Cố lên')
    expect(api.reactions).toHaveBeenCalledWith('post-1')
  })

  it('shows the empty state', async () => {
    api.reactions.mockResolvedValue({ items: [], count: 0 })
    render(<CommunityReactors postId="post-1" onClose={vi.fn()} />)

    // The popover fades in from opacity 0; visibility is animation, not state.
    expect(
      await screen.findByText('Chưa có ai bày tỏ cảm xúc'),
    ).toBeInTheDocument()
  })

  it('shows an error and retries', async () => {
    const user = userEvent.setup()
    api.reactions
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ items: [reactor], count: 1 })
    render(<CommunityReactors postId="post-1" onClose={vi.fn()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa tải được danh sách',
    )
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))

    expect(await screen.findByText('Minh An')).toBeInTheDocument()
    expect(api.reactions).toHaveBeenCalledTimes(2)
  })

  it('takes focus and closes on Escape or the close button', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    api.reactions.mockResolvedValue({ items: [], count: 0 })
    render(<CommunityReactors postId="post-1" onClose={onClose} />)

    expect(
      screen.getByRole('dialog', { name: 'Những người đã bày tỏ cảm xúc' }),
    ).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
