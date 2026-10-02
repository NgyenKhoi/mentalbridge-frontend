import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  profile: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  confirm: vi.fn(),
  toast: vi.fn(),
}))

vi.mock('@/components/ui/FeedbackProvider', () => ({
  useFeedback: () => ({ confirm: api.confirm, showActionToast: api.toast }),
}))
vi.mock('@/features/community/api/browser-community', () => ({
  getCommunityComments: api.list,
  getCommunityProfile: api.profile,
  createCommunityComment: api.create,
  updateCommunityComment: api.update,
  deleteCommunityComment: api.remove,
}))

import CommunityComments from './CommunityComments'

const postId = '20000000-0000-4000-8000-000000000009'
const profileId = '10000000-0000-4000-8000-000000000002'
const root = {
  commentId: '40000000-0000-4000-8000-000000000001',
  postId,
  parentCommentId: null,
  author: {
    communityProfileId: profileId,
    avatarPreset: 'LEAF' as const,
    displayName: 'Mầm Xanh',
    state: 'ACTIVE' as const,
  },
  content: 'Mình đang lắng nghe bạn.',
  state: 'ACTIVE' as const,
  version: 0,
  createdAt: '2026-10-01T05:00:00Z',
  updatedAt: '2026-10-01T05:00:00Z',
}

describe('CommunityComments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.list.mockResolvedValue({
      items: [root],
      nextCursor: null,
      hasMore: false,
    })
    api.profile.mockResolvedValue({
      data: { communityProfileId: profileId },
      etag: '"0"',
    })
    api.confirm.mockResolvedValue(true)
  })

  it('creates a one-level reply with supportive composer guidance', async () => {
    const user = userEvent.setup()
    const onCountChange = vi.fn()
    const reply = {
      ...root,
      commentId: '40000000-0000-4000-8000-000000000002',
      parentCommentId: root.commentId,
      content: 'Cảm ơn bạn đã chia sẻ.',
    }
    api.create.mockResolvedValue({ comment: reply, version: 0 })
    render(<CommunityComments postId={postId} onCountChange={onCountChange} />)

    expect(await screen.findByText(root.content)).toBeVisible()
    expect(screen.getByText(/Tránh chẩn đoán/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Phản hồi' }))
    await user.type(
      screen.getByLabelText('Lời phản hồi của bạn'),
      reply.content,
    )
    await user.click(screen.getByRole('button', { name: 'Gửi phản hồi' }))

    expect(api.create).toHaveBeenCalledWith(
      postId,
      { content: reply.content, parentCommentId: root.commentId },
      expect.any(String),
    )
    expect(await screen.findByText(reply.content)).toBeVisible()
    expect(onCountChange).toHaveBeenCalledWith(1)
  })

  it('reuses the create idempotency key after a committed request loses its response', async () => {
    const user = userEvent.setup()
    const onCountChange = vi.fn()
    const created = {
      ...root,
      commentId: '40000000-0000-4000-8000-000000000003',
      content: 'Mình ở đây và đang lắng nghe bạn.',
    }
    api.create
      .mockRejectedValueOnce(new TypeError('response lost'))
      .mockResolvedValueOnce({ comment: created, version: 0 })
    render(<CommunityComments postId={postId} onCountChange={onCountChange} />)

    expect(await screen.findByText(root.content)).toBeVisible()
    await user.type(
      screen.getByLabelText('Bạn muốn chia sẻ điều gì?'),
      created.content,
    )
    await user.click(screen.getByRole('button', { name: 'Gửi bình luận' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nội dung vẫn còn ở đây để bạn thử lại.',
    )
    await user.click(screen.getByRole('button', { name: 'Gửi bình luận' }))

    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(2))
    expect(api.create.mock.calls[0]?.[2]).toBe(api.create.mock.calls[1]?.[2])
    expect(await screen.findByText(created.content)).toBeVisible()
    expect(onCountChange).toHaveBeenCalledTimes(1)
    expect(onCountChange).toHaveBeenCalledWith(1)
  })

  it('accepts 2,000 astral emoji code points when creating a comment', async () => {
    const user = userEvent.setup()
    const boundaryContent = '🙂'.repeat(2000)
    const created = {
      ...root,
      commentId: '40000000-0000-4000-8000-000000000004',
      content: boundaryContent,
    }
    api.create.mockResolvedValue({ comment: created, version: 0 })
    render(<CommunityComments postId={postId} onCountChange={vi.fn()} />)

    expect(await screen.findByText(root.content)).toBeVisible()
    const composer = screen.getByLabelText('Bạn muốn chia sẻ điều gì?')
    expect(composer).toHaveAttribute('maxlength', '4000')
    fireEvent.change(composer, { target: { value: boundaryContent } })
    expect(screen.getByText('2000/2000')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Gửi bình luận' }))

    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith(
        postId,
        { content: boundaryContent, parentCommentId: null },
        expect.any(String),
      ),
    )
  })

  it('accepts 2,000 astral emoji code points when editing a comment', async () => {
    const user = userEvent.setup()
    const boundaryContent = '🙂'.repeat(2000)
    api.update.mockResolvedValue({
      comment: { ...root, content: boundaryContent, version: 1 },
      version: 1,
    })
    render(<CommunityComments postId={postId} onCountChange={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }))
    const editor = screen.getByLabelText('Chỉnh sửa bình luận')
    expect(editor).toHaveAttribute('maxlength', '4000')
    fireEvent.change(editor, { target: { value: boundaryContent } })
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(
        root.commentId,
        { content: boundaryContent },
        0,
      ),
    )
  })

  it('rejects more than 2,000 code points for create and edit', async () => {
    const user = userEvent.setup()
    const oversizedContent = 'a'.repeat(2001)
    render(<CommunityComments postId={postId} onCountChange={vi.fn()} />)

    expect(await screen.findByText(root.content)).toBeVisible()
    fireEvent.change(screen.getByLabelText('Bạn muốn chia sẻ điều gì?'), {
      target: { value: oversizedContent },
    })
    await user.click(screen.getByRole('button', { name: 'Gửi bình luận' }))
    expect(api.create).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('2.000')

    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa' }))
    fireEvent.change(screen.getByLabelText('Chỉnh sửa bình luận'), {
      target: { value: oversizedContent },
    })
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(api.update).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('2.000')
  })

  it('edits an owned comment with its exact version', async () => {
    const user = userEvent.setup()
    api.update.mockResolvedValue({
      comment: { ...root, content: 'Mình vẫn ở đây.', version: 1 },
      version: 1,
    })
    render(<CommunityComments postId={postId} onCountChange={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }))
    const editor = screen.getByLabelText('Chỉnh sửa bình luận')
    await user.clear(editor)
    await user.type(editor, 'Mình vẫn ở đây.')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    expect(api.update).toHaveBeenCalledWith(
      root.commentId,
      { content: 'Mình vẫn ở đây.' },
      0,
    )
    expect(await screen.findByText('Mình vẫn ở đây.')).toBeVisible()
  })

  it('tombstones deletion and decrements the visible count once', async () => {
    const user = userEvent.setup()
    const onCountChange = vi.fn()
    api.remove.mockResolvedValue(undefined)
    render(<CommunityComments postId={postId} onCountChange={onCountChange} />)

    await user.click(await screen.findByRole('button', { name: 'Xóa' }))
    await waitFor(() =>
      expect(api.remove).toHaveBeenCalledWith(root.commentId, 0),
    )
    expect(
      await screen.findByText('Bình luận đã được người viết xóa.'),
    ).toBeVisible()
    expect(onCountChange).toHaveBeenCalledWith(-1)
  })

  it('reloads comments after a stale edit', async () => {
    const user = userEvent.setup()
    api.update.mockRejectedValue(
      new ApiError({ message: 'stale', code: 'STALE', status: 412 }),
    )
    api.list
      .mockResolvedValueOnce({
        items: [root],
        nextCursor: null,
        hasMore: false,
      })
      .mockResolvedValueOnce({
        items: [{ ...root, content: 'Nội dung mới nhất', version: 1 }],
        nextCursor: null,
        hasMore: false,
      })
    render(<CommunityComments postId={postId} onCountChange={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }))
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    expect(await screen.findByText('Nội dung mới nhất')).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Nội dung mới nhất đã được tải lại.',
    )
  })
})
