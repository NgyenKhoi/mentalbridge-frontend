import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
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

import { MotionGlobalConfig } from 'framer-motion'

import CommunityInteractions from './CommunityInteractions'

MotionGlobalConfig.skipAnimations = true

const trayName = 'Chọn cảm xúc'

async function pickFromTray(
  user: ReturnType<typeof userEvent.setup>,
  main: string,
  name: string,
) {
  screen.getByRole('button', { name: main }).focus()
  await user.keyboard('{ArrowUp}')
  await user.click(
    within(screen.getByRole('group', { name: trayName })).getByRole('button', {
      name,
    }),
  )
}

describe('CommunityInteractions', () => {
  beforeEach(() => vi.resetAllMocks())

  it('opens the seven-emoji tray from the keyboard, Like first, and sends a new kind', async () => {
    const user = userEvent.setup()
    api.putReaction.mockResolvedValue({ postId: 'post-1', reaction: 'GROWTH' })
    render(
      <CommunityInteractions
        postId="post-1"
        viewerState={{ reaction: null, bookmarked: false }}
        reactionCount={3}
      />,
    )

    expect(screen.queryByRole('group', { name: trayName })).toBeNull()
    screen.getByRole('button', { name: 'Thương' }).focus()
    await user.keyboard('{ArrowUp}')
    const tray = screen.getByRole('group', { name: trayName })
    expect(
      within(tray)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual([
      'Thích',
      'Thương',
      'Cảm ơn',
      'Ôm',
      'Đồng cảm',
      'Cố lên',
      'Đang lớn lên',
    ])
    expect(within(tray).getByRole('button', { name: 'Thích' })).toHaveFocus()
    await user.keyboard('{End}')
    expect(
      within(tray).getByRole('button', { name: 'Đang lớn lên' }),
    ).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(api.putReaction).toHaveBeenCalledWith('post-1', 'GROWTH')
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: trayName })).toBeNull(),
    )
    const main = screen.getByRole('button', { name: 'Đang lớn lên' })
    expect(main).toHaveFocus()
    expect(main).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('4 lượt')).toBeVisible()
  })

  it('opens on mouse hover and closes with Escape', async () => {
    const user = userEvent.setup()
    render(
      <CommunityInteractions
        postId="post-1"
        viewerState={{ reaction: null, bookmarked: false }}
        reactionCount={3}
      />,
    )

    await user.hover(screen.getByRole('button', { name: 'Thương' }))
    const tray = await screen.findByRole('group', { name: trayName })
    within(tray).getByRole('button', { name: 'Ôm' }).focus()
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: trayName })).toBeNull(),
    )
    expect(screen.getByRole('button', { name: 'Thương' })).toHaveFocus()
    expect(api.putReaction).not.toHaveBeenCalled()
  })

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

    const support = screen.getByRole('button', { name: /Thương/ })
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

    await user.click(screen.getByRole('button', { name: /Ôm/ }))
    expect(api.deleteReaction).toHaveBeenCalledWith('post-1')
    expect(screen.getByText('0 lượt')).toBeVisible()
    const main = screen.getByRole('button', { name: 'Thương' })
    expect(main).toHaveAttribute('aria-pressed', 'false')
    expect(main).not.toHaveAttribute('data-reaction-feedback')

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

    expect(screen.getByRole('button', { name: 'Thương' })).not.toHaveAttribute(
      'data-reaction-feedback',
    )
    await pickFromTray(user, 'Thương', 'Cảm ơn')
    expect(api.putReaction).toHaveBeenCalledWith('post-1', 'THANK_YOU')
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: trayName })).toBeNull(),
    )
    const thanks = screen.getByRole('button', { name: 'Cảm ơn' })
    expect(thanks).toHaveAttribute('aria-pressed', 'true')
    expect(thanks).toHaveAttribute('data-reaction-feedback', 'committed')
    expect(screen.queryByRole('button', { name: 'Thương' })).toBeNull()
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

    const support = screen.getByRole('button', { name: 'Thương' })
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

    await pickFromTray(user, 'Thương', 'Cảm ơn')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'gửi lời đồng hành',
    )
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: trayName })).toBeNull(),
    )
    const main = screen.getByRole('button', { name: 'Thương' })
    expect(main).toHaveAttribute('aria-pressed', 'true')
    expect(main).not.toHaveAttribute('data-reaction-feedback')
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
    expect(screen.getByRole('button', { name: 'Ôm' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Ôm' })).not.toHaveAttribute(
      'data-reaction-feedback',
    )
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
    await user.click(screen.getByRole('button', { name: 'Thương' }))
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
    expect(screen.getByRole('button', { name: 'Thương' })).toHaveAttribute(
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
    await user.click(screen.getByRole('button', { name: 'Thương' }))
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
    expect(screen.getByRole('button', { name: 'Ôm' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Ôm' })).not.toHaveAttribute(
      'data-reaction-feedback',
    )
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
    expect(screen.getByRole('button', { name: 'Thương' })).toHaveFocus()
    await user.keyboard('[Space]')
    expect(screen.getByText('1 lượt')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Thương' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
