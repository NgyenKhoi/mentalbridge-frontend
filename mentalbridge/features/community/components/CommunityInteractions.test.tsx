import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  putReaction: vi.fn(),
  deleteReaction: vi.fn(),
  putBookmark: vi.fn(),
  deleteBookmark: vi.fn(),
}))

vi.mock('@/features/community/api/browser-community', () => ({
  putCommunityReaction: api.putReaction,
  deleteCommunityReaction: api.deleteReaction,
  putCommunityBookmark: api.putBookmark,
  deleteCommunityBookmark: api.deleteBookmark,
}))

import CommunityInteractions from './CommunityInteractions'

describe('CommunityInteractions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps the same logical reaction available after an ambiguous failure retry', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    api.putReaction
      .mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce({ postId: 'post-1', reaction: 'SUPPORT' })
    render(
      <CommunityInteractions
        postId="post-1"
        viewerState={{ reaction: null, bookmarked: false }}
        reactionCount={3}
        onChange={onChange}
      />,
    )

    const support = screen.getByRole('button', { name: /Đồng hành/ })
    await user.click(support)
    expect(await screen.findByRole('alert')).toHaveTextContent('thử lại')
    expect(support).toHaveAttribute('aria-pressed', 'false')

    await user.click(support)
    expect(api.putReaction).toHaveBeenCalledTimes(2)
    expect(api.putReaction).toHaveBeenNthCalledWith(1, 'post-1', 'SUPPORT')
    expect(api.putReaction).toHaveBeenNthCalledWith(2, 'post-1', 'SUPPORT')
    expect(support).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('4 lượt')).toBeVisible()
    expect(onChange).toHaveBeenCalledWith(
      { reaction: 'SUPPORT', bookmarked: false },
      4,
    )
  })

  it('removes an existing reaction and toggles the private bookmark', async () => {
    const user = userEvent.setup()
    api.deleteReaction.mockResolvedValue(undefined)
    api.putBookmark.mockResolvedValue(undefined)
    render(
      <CommunityInteractions
        postId="post-1"
        viewerState={{ reaction: 'RELATE', bookmarked: false }}
        reactionCount={1}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Mình cũng vậy/ }))
    expect(api.deleteReaction).toHaveBeenCalledWith('post-1')
    expect(screen.getByText('0 lượt')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Lưu bài' }))
    expect(api.putBookmark).toHaveBeenCalledWith('post-1')
    expect(screen.getByRole('button', { name: 'Đã lưu' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
