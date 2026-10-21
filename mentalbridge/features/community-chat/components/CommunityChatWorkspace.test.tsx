import { act, render, screen, waitFor } from '@testing-library/react'
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
import { ApiError } from '@/lib/api/api-error'

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

function id(namespace: number, index: number) {
  return `${namespace}0000000-0000-4000-8000-${String(index).padStart(12, '0')}`
}

function conversationAt(index: number) {
  return {
    ...conversation,
    conversationId: id(2, index),
    peers: [conversation.peers[0], { ...peer, displayName: `Bạn ${index}` }],
  }
}

function requestAt(index: number) {
  return {
    requestId: id(3, index),
    requester: { ...peer, displayName: `Người gửi ${index}` },
    state: 'PENDING' as const,
    createdAt: '2026-10-20T07:00:00Z',
    expiresAt: '2026-10-27T07:00:00Z',
    version: '1',
  }
}

function messageAt(index: number, owner = conversationId) {
  return {
    ...message,
    messageId: id(4, index),
    clientMessageId: id(5, index),
    conversationId: owner,
    content: `Tin nhắn ${index}`,
    createdAt: new Date(Date.UTC(2026, 9, 20, 8, index)).toISOString(),
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
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

  it('continues conversation and request cursors with stable-order deduplication', async () => {
    const conversations = Array.from({ length: 25 }, (_, index) =>
      conversationAt(index + 1),
    )
    const requests = Array.from({ length: 25 }, (_, index) =>
      requestAt(index + 1),
    )
    let requestContinuationAttempts = 0
    api.getChatConversations.mockImplementation(async (cursor?: string) =>
      cursor
        ? {
            items: [conversations[19], ...conversations.slice(20)],
            nextCursor: null,
          }
        : {
            items: conversations.slice(0, 20),
            nextCursor: 'conversation-page-2',
          },
    )
    api.getChatRequests.mockImplementation(async (cursor?: string) => {
      if (!cursor)
        return { items: requests.slice(0, 20), nextCursor: 'request-page-2' }
      requestContinuationAttempts += 1
      if (requestContinuationAttempts === 1)
        throw new ApiError({
          message: 'temporarily unavailable',
          code: 'UNAVAILABLE',
          status: 503,
        })
      return { items: [requests[19], ...requests.slice(20)], nextCursor: null }
    })
    const user = userEvent.setup()
    render(<CommunityChatWorkspace initialConversationId={conversationId} />)

    await screen.findByText('Bạn 20')
    await user.click(
      screen.getByRole('button', { name: 'Tải thêm cuộc trò chuyện' }),
    )
    expect(await screen.findByText('Bạn 25')).toBeVisible()
    expect(screen.getAllByText('Bạn 20')).toHaveLength(1)
    expect(api.getChatConversations).toHaveBeenLastCalledWith(
      'conversation-page-2',
    )

    await user.click(screen.getByRole('tab', { name: /Lời mời/ }))
    await user.click(screen.getByRole('button', { name: 'Tải thêm lời mời' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Kết nối trò chuyện đang gián đoạn.',
    )
    expect(screen.getByText('Người gửi 20')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Người gửi 25')).toBeVisible()
    expect(screen.getAllByText('Người gửi 20')).toHaveLength(1)
    expect(api.getChatRequests).toHaveBeenLastCalledWith('request-page-2')
  })

  it('renders all 80 ordered messages and advances read state only through viewed pages', async () => {
    const messages = Array.from({ length: 80 }, (_, index) =>
      messageAt(index + 1),
    )
    api.getChatMessages.mockImplementation(
      async (_id: string, cursor?: string) =>
        cursor
          ? { items: [messages[49], ...messages.slice(50)], nextCursor: null }
          : { items: messages.slice(0, 50), nextCursor: 'message-page-2' },
    )
    api.advanceChatReadCursor.mockImplementation(
      async (_id: string, lastReadMessageId: string) => ({
        lastReadMessageId,
        unreadCount: 0,
      }),
    )
    const user = userEvent.setup()
    render(<CommunityChatWorkspace initialConversationId={conversationId} />)

    expect(await screen.findByText('Tin nhắn 50')).toBeVisible()
    await waitFor(() =>
      expect(api.advanceChatReadCursor).toHaveBeenCalledWith(
        conversationId,
        messages[49].messageId,
      ),
    )
    expect(screen.queryByText('Tin nhắn 80')).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Tải tin nhắn tiếp theo' }),
    )
    const first = screen.getByText('Tin nhắn 1')
    const last = await screen.findByText('Tin nhắn 80')
    expect(first.compareDocumentPosition(last)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(screen.getAllByText('Tin nhắn 50')).toHaveLength(1)
    await waitFor(() =>
      expect(api.advanceChatReadCursor).toHaveBeenLastCalledWith(
        conversationId,
        messages[79].messageId,
      ),
    )
  })

  it('keeps viewed messages and retries the same cursor when a later page is revoked', async () => {
    api.getChatMessages
      .mockResolvedValueOnce({
        items: [messageAt(1)],
        nextCursor: 'stale-page',
      })
      .mockRejectedValueOnce(
        new ApiError({ message: 'gone', code: 'NOT_FOUND', status: 404 }),
      )
      .mockResolvedValueOnce({ items: [messageAt(2)], nextCursor: null })
    const user = userEvent.setup()
    render(<CommunityChatWorkspace initialConversationId={conversationId} />)
    await screen.findByText('Tin nhắn 1')

    await user.click(
      screen.getByRole('button', { name: 'Tải tin nhắn tiếp theo' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cuộc trò chuyện này không còn khả dụng.',
    )
    expect(screen.getByText('Tin nhắn 1')).toBeVisible()
    expect(api.advanceChatReadCursor).toHaveBeenCalledTimes(1)

    await user.click(
      screen.getByRole('button', { name: 'Thử tải lại tin nhắn' }),
    )
    expect(await screen.findByText('Tin nhắn 2')).toBeVisible()
    expect(api.getChatMessages).toHaveBeenNthCalledWith(
      3,
      conversationId,
      'stale-page',
    )
  })

  it('ignores an older conversation response after selection changes', async () => {
    const conversationB = conversationAt(2)
    const messageB = messageAt(2, conversationB.conversationId)
    const conversationAResult = deferred<typeof conversation>()
    const messagesAResult = deferred<{
      items: (typeof message)[]
      nextCursor: null
    }>()
    api.getChatConversation.mockImplementation((id: string) =>
      id === conversationId
        ? conversationAResult.promise
        : Promise.resolve(conversationB),
    )
    api.getChatMessages.mockImplementation((id: string) =>
      id === conversationId
        ? messagesAResult.promise
        : Promise.resolve({ items: [messageB], nextCursor: null }),
    )
    const { rerender } = render(
      <CommunityChatWorkspace initialConversationId={conversationId} />,
    )
    await waitFor(() =>
      expect(api.getChatMessages).toHaveBeenCalledWith(conversationId),
    )

    rerender(
      <CommunityChatWorkspace
        initialConversationId={conversationB.conversationId}
      />,
    )
    expect(await screen.findByText('Tin nhắn 2')).toBeVisible()

    await act(async () => {
      conversationAResult.resolve(conversation)
      messagesAResult.resolve({ items: [messageAt(1)], nextCursor: null })
      await Promise.resolve()
    })
    expect(screen.getByText('Tin nhắn 2')).toBeVisible()
    expect(screen.queryByText('Tin nhắn 1')).not.toBeInTheDocument()
    expect(api.advanceChatReadCursor).not.toHaveBeenCalledWith(
      conversationId,
      expect.any(String),
    )
  })
})
