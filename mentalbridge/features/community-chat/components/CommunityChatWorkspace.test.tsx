import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getChatConversations: vi.fn(),
  getChatRequests: vi.fn(),
  getChatPrivacy: vi.fn(),
  getChatConversation: vi.fn(),
  getChatMessages: vi.fn(),
  advanceChatReadCursor: vi.fn(),
  sendChatMessage: vi.fn(),
  decideChatRequest: vi.fn(),
  putChatPrivacy: vi.fn(),
  startDirectConversation: vi.fn(),
  getCommunityProfile: vi.fn(),
  blockCommunityProfile: vi.fn(),
}))
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('../api/browser-community-chat', () => api)
vi.mock('@/features/community/api/browser-community', () => ({
  getCommunityProfile: api.getCommunityProfile,
  blockCommunityProfile: api.blockCommunityProfile,
}))

import CommunityChatWorkspace from './CommunityChatWorkspace'

const selfId = '10000000-0000-4000-8000-000000000001'
const peerId = '10000000-0000-4000-8000-000000000002'
const conversationId = '20000000-0000-4000-8000-000000000001'
const requestId = '30000000-0000-4000-8000-000000000001'
const peer = {
  state: 'AVAILABLE' as const,
  communityProfileId: peerId,
  displayName: 'Mầm Nắng',
}
const conversation = {
  conversationId,
  kind: 'DIRECT' as const,
  state: 'ACTIVE' as const,
  peers: [
    {
      state: 'AVAILABLE' as const,
      communityProfileId: selfId,
      displayName: 'Lá Nhỏ',
    },
    peer,
  ],
  unreadCount: 1,
  version: '1',
}
const message = {
  messageId: '40000000-0000-4000-8000-000000000001',
  conversationId,
  clientMessageId: '50000000-0000-4000-8000-000000000001',
  sender: peer,
  content: 'Hôm nay bạn thế nào?',
  createdAt: '2026-10-20T08:00:00Z',
}
const privacy = {
  version: '1',
  preferences: {
    directMessagePolicy: 'APPROVAL_REQUIRED' as const,
    presenceVisible: false,
    invisible: false,
    typingVisible: false,
    readReceiptsVisible: false,
  },
}

describe('CommunityChatWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getChatConversations.mockResolvedValue({
      items: [conversation],
      nextCursor: null,
    })
    api.getChatRequests.mockResolvedValue({
      items: [
        {
          requestId,
          requester: peer,
          state: 'PENDING',
          createdAt: '2026-10-20T07:00:00Z',
          expiresAt: '2026-10-27T07:00:00Z',
          version: '1',
        },
      ],
      nextCursor: null,
    })
    api.getChatPrivacy.mockResolvedValue(privacy)
    api.getCommunityProfile.mockResolvedValue({
      data: { communityProfileId: selfId },
      etag: '"1"',
    })
    api.getChatConversation.mockResolvedValue(conversation)
    api.getChatMessages.mockResolvedValue({
      items: [message],
      nextCursor: null,
    })
    api.advanceChatReadCursor.mockResolvedValue({
      lastReadMessageId: message.messageId,
      unreadCount: 0,
    })
  })

  it('loads the inbox and thread, advances unread state and sends a durable message', async () => {
    api.sendChatMessage.mockImplementation(
      async (
        _conversationId: string,
        content: string,
        clientMessageId: string,
      ) => ({
        message: {
          ...message,
          messageId: '40000000-0000-4000-8000-000000000002',
          clientMessageId,
          sender: {
            state: 'AVAILABLE',
            communityProfileId: selfId,
            displayName: 'Lá Nhỏ',
          },
          content,
        },
        persistence: 'SAVED',
        delivery: 'UNCONFIRMED',
      }),
    )
    const user = userEvent.setup()
    render(<CommunityChatWorkspace initialConversationId={conversationId} />)

    expect(await screen.findByText('Hôm nay bạn thế nào?')).toBeVisible()
    await waitFor(() =>
      expect(api.advanceChatReadCursor).toHaveBeenCalledWith(
        conversationId,
        message.messageId,
      ),
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Tin nhắn' }),
      'Mình ổn hơn rồi.',
    )
    await user.click(screen.getByRole('button', { name: 'Gửi' }))

    expect(await screen.findByText('Mình ổn hơn rồi.')).toBeVisible()
    expect(api.sendChatMessage).toHaveBeenCalledWith(
      conversationId,
      'Mình ổn hơn rồi.',
      expect.stringMatching(/^[\da-f-]{36}$/i),
    )
    expect(screen.getByText(/không đồng nghĩa người nhận/)).toBeVisible()
  })

  it('keeps the same message id for an explicit retry after an uncertain failure', async () => {
    api.sendChatMessage
      .mockRejectedValueOnce(new Error('network uncertain'))
      .mockResolvedValueOnce({
        message: { ...message, content: 'Xin chào lại.' },
        persistence: 'SAVED',
        delivery: 'UNCONFIRMED',
      })
    const user = userEvent.setup()
    render(<CommunityChatWorkspace initialConversationId={conversationId} />)
    await screen.findByText('Hôm nay bạn thế nào?')
    await user.type(
      screen.getByRole('textbox', { name: 'Tin nhắn' }),
      'Xin chào lại.',
    )
    await user.click(screen.getByRole('button', { name: 'Gửi' }))
    await user.click(await screen.findByRole('button', { name: 'Gửi lại' }))

    await waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(2))
    expect(api.sendChatMessage.mock.calls[0][2]).toBe(
      api.sendChatMessage.mock.calls[1][2],
    )
  })

  it('shows text-free requests and only opens a thread after acceptance', async () => {
    api.decideChatRequest.mockResolvedValue({ state: 'ACTIVE', conversationId })
    const user = userEvent.setup()
    render(<CommunityChatWorkspace />)
    await user.click(await screen.findByRole('tab', { name: /Lời mời/ }))

    expect(screen.getByText(/Lời mời không chứa nội dung/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Chấp thuận' }))
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        `/community/messages/${conversationId}`,
      ),
    )
  })
})
