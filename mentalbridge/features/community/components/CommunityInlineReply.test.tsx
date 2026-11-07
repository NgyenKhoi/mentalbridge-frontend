import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CommunityInlineReply from './CommunityInlineReply'

const create = vi.hoisted(() => vi.fn())
vi.mock('../api/browser-community', () => ({ createCommunityComment: create }))

describe('CommunityInlineReply', () => {
  beforeEach(() => create.mockReset())
  it('sends a real root comment and updates the count only after success', async () => {
    create.mockResolvedValue({})
    const onCreated = vi.fn()
    const user = userEvent.setup()
    render(
      <CommunityInlineReply
        postId="post-1"
        authorName="Lá Nhỏ"
        onCreated={onCreated}
      />,
    )
    await user.type(screen.getByRole('textbox'), 'Mình đang lắng nghe bạn.')
    await user.click(
      screen.getByRole('button', { name: 'Gửi bình luận cho Lá Nhỏ' }),
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Đã gửi lời nhắn.',
    )
    expect(create).toHaveBeenCalledWith(
      'post-1',
      { content: 'Mình đang lắng nghe bạn.', parentCommentId: null },
      expect.any(String),
    )
    expect(onCreated).toHaveBeenCalledOnce()
    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(screen.getByRole('link', { name: 'Xem bình luận' })).toHaveAttribute(
      'href',
      '/community/post-1#comments-title',
    )
  })
  it('preserves the draft and reuses the command key after an uncertain failure', async () => {
    create.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({})
    const onCreated = vi.fn()
    const user = userEvent.setup()
    render(
      <CommunityInlineReply
        postId="post-1"
        authorName="Lá Nhỏ"
        onCreated={onCreated}
      />,
    )
    await user.type(screen.getByRole('textbox'), 'Một lời động viên')
    await user.click(screen.getByRole('button'))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nội dung của bạn vẫn được giữ',
    )
    expect(screen.getByRole('textbox')).toHaveValue('Một lời động viên')
    expect(onCreated).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button'))
    await screen.findByRole('status')
    expect(create.mock.calls[0][2]).toBe(create.mock.calls[1][2])
    expect(onCreated).toHaveBeenCalledOnce()
  })
  it('keeps the existing 2000 character limit without sending an invalid comment', async () => {
    render(
      <CommunityInlineReply
        postId="post-1"
        authorName="Lá Nhỏ"
        onCreated={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'a'.repeat(2001) },
    })
    fireEvent.click(screen.getByRole('button'))
    expect(await screen.findByRole('alert')).toHaveTextContent('2.000 ký tự')
    expect(create).not.toHaveBeenCalled()
  })
})
