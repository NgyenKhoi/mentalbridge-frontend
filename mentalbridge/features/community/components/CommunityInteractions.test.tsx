import { act, fireEvent, render, screen } from '@testing-library/react'
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
  beforeEach(() => vi.resetAllMocks())

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
    expect(support).not.toHaveAttribute('data-reaction-feedback')
    expect(screen.getByText('3 lượt')).toBeVisible()
    expect(onChange).not.toHaveBeenCalled()

    await user.click(support)
    expect(api.putReaction).toHaveBeenCalledTimes(2)
    expect(api.putReaction).toHaveBeenNthCalledWith(1, 'post-1', 'SUPPORT')
    expect(api.putReaction).toHaveBeenNthCalledWith(2, 'post-1', 'SUPPORT')
    expect(support).toHaveAttribute('aria-pressed', 'true')
    expect(support).toHaveAttribute('data-reaction-feedback', 'committed')
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
    expect(
      screen.getByRole('button', { name: /Mình cũng vậy/ }),
    ).not.toHaveAttribute('data-reaction-feedback')

    await user.click(screen.getByRole('button', { name: 'Lưu bài' }))
    expect(api.putBookmark).toHaveBeenCalledWith('post-1')
    expect(screen.getByRole('button', { name: 'Đã lưu' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('replaces the selected reaction without incrementing the count', async () => {
    const user = userEvent.setup()
    api.putReaction.mockResolvedValue({
      postId: 'post-1',
      reaction: 'THANK_YOU',
    })
    render(
      <CommunityInteractions
        postId="post-1"
        viewerState={{ reaction: 'SUPPORT', bookmarked: true }}
        reactionCount={3}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Đồng hành' }),
    ).not.toHaveAttribute('data-reaction-feedback')
    const thanks = screen.getByRole('button', { name: 'Cảm ơn bạn' })
    await user.click(thanks)
    expect(api.putReaction).toHaveBeenCalledWith('post-1', 'THANK_YOU')
    expect(thanks).toHaveAttribute('aria-pressed', 'true')
    expect(thanks).toHaveAttribute('data-reaction-feedback', 'committed')
    expect(screen.getByRole('button', { name: 'Đồng hành' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByText('3 lượt')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Đã lưu' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.animationEnd(thanks.querySelector('span')!)
    expect(thanks).not.toHaveAttribute('data-reaction-feedback')
  })

  it('prevents duplicate commands while pending and keeps the previous count', async () => {
    const user = userEvent.setup()
    let finishRequest:
      ((value: { postId: string; reaction: 'SUPPORT' }) => void) | undefined
    api.putReaction.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRequest = resolve
        }),
    )
    render(
      <CommunityInteractions
        postId="post-1"
        viewerState={{ reaction: null, bookmarked: false }}
        reactionCount={3}
      />,
    )

    const support = screen.getByRole('button', { name: 'Đồng hành' })
    await user.click(support)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Đang gửi lời đồng hành',
    )
    expect(screen.getByText('3 lượt')).toBeVisible()
    expect(support).toHaveAttribute('aria-pressed', 'false')
    expect(support).not.toHaveAttribute('data-reaction-feedback')
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled()
      await user.click(button)
    }
    expect(api.putReaction).toHaveBeenCalledTimes(1)
    expect(api.putBookmark).not.toHaveBeenCalled()
    await act(async () =>
      finishRequest?.({ postId: 'post-1', reaction: 'SUPPORT' }),
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText('4 lượt')).toBeVisible()
    expect(support).toBeEnabled()
  })

  it('keeps the prior selection and bookmark when commands fail', async () => {
    const user = userEvent.setup()
    api.putReaction.mockRejectedValue(new Error('unavailable'))
    api.deleteBookmark.mockRejectedValue(new Error('unavailable'))
    render(
      <CommunityInteractions
        postId="post-1"
        viewerState={{ reaction: 'SUPPORT', bookmarked: true }}
        reactionCount={3}
      />,
    )

    const thanks = screen.getByRole('button', { name: 'Cảm ơn bạn' })
    await user.click(thanks)
    expect(screen.getByRole('alert')).toHaveTextContent('gửi lời đồng hành')
    expect(screen.getByRole('button', { name: 'Đồng hành' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(thanks).not.toHaveAttribute('data-reaction-feedback')
    await user.click(screen.getByRole('button', { name: 'Đã lưu' }))
    expect(screen.getByRole('alert')).toHaveTextContent('cập nhật bài đã lưu')
    expect(screen.getByRole('button', { name: 'Đã lưu' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('3 lượt')).toBeVisible()
  })

  it('reconciles authoritative scalar updates without replaying a reaction', () => {
    const { rerender } = render(
      <CommunityInteractions
        postId="post-1"
        viewerState={{ reaction: null, bookmarked: false }}
        reactionCount={3}
      />,
    )
    rerender(
      <CommunityInteractions
        postId="post-1"
        viewerState={{ reaction: 'RELATE', bookmarked: true }}
        reactionCount={7}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Mình cũng vậy' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Mình cũng vậy' }),
    ).not.toHaveAttribute('data-reaction-feedback')
    expect(screen.getByRole('button', { name: 'Đã lưu' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('7 lượt')).toBeVisible()
  })

  it('does not reset a committed local choice on object identity churn or an onChange echo', async () => {
    const user = userEvent.setup()
    api.putReaction.mockResolvedValue({ postId: 'post-1', reaction: 'SUPPORT' })
    const { rerender } = render(
      <CommunityInteractions
        postId="post-1"
        viewerState={{ reaction: null, bookmarked: false }}
        reactionCount={3}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Đồng hành' }))
    rerender(
      <CommunityInteractions
        postId="post-1"
        viewerState={{ reaction: null, bookmarked: false }}
        reactionCount={3}
      />,
    )
    expect(screen.getByText('4 lượt')).toBeVisible()
    rerender(
      <CommunityInteractions
        postId="post-1"
        viewerState={{ reaction: 'SUPPORT', bookmarked: false }}
        reactionCount={4}
      />,
    )
    expect(screen.getByRole('button', { name: 'Đồng hành' })).toHaveAttribute(
      'data-reaction-feedback',
      'committed',
    )
  })

  it('isolates a late command response when the rendered post changes', async () => {
    const user = userEvent.setup()
    let finishRequest:
      ((value: { postId: string; reaction: 'SUPPORT' }) => void) | undefined
    api.putReaction.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRequest = resolve
        }),
    )
    const { rerender } = render(
      <CommunityInteractions
        postId="post-1"
        viewerState={{ reaction: null, bookmarked: false }}
        reactionCount={3}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Đồng hành' }))
    rerender(
      <CommunityInteractions
        postId="post-2"
        viewerState={{ reaction: 'RELATE', bookmarked: false }}
        reactionCount={7}
      />,
    )
    await act(async () =>
      finishRequest?.({ postId: 'post-1', reaction: 'SUPPORT' }),
    )
    expect(screen.getByText('7 lượt')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Mình cũng vậy' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Đồng hành' }),
    ).not.toHaveAttribute('data-reaction-feedback')
  })

  it('supports keyboard activation with the same committed feedback', async () => {
    const user = userEvent.setup()
    api.putReaction.mockResolvedValue({ postId: 'post-1', reaction: 'SUPPORT' })
    render(
      <CommunityInteractions
        postId="post-1"
        viewerState={{ reaction: null, bookmarked: false }}
        reactionCount={0}
      />,
    )
    await user.tab()
    expect(screen.getByRole('button', { name: 'Đồng hành' })).toHaveFocus()
    await user.keyboard('[Space]')
    expect(screen.getByText('1 lượt')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Đồng hành' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
