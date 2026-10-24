import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getChatConversations: vi.fn(),
  getChatRequests: vi.fn(),
  getChatGroupInvitations: vi.fn(),
  getChatGroupMembers: vi.fn(),
  createChatGroup: vi.fn(),
  decideChatGroupInvitation: vi.fn(),
  inviteChatGroupMember: vi.fn(),
  setChatGroupMemberRole: vi.fn(),
  removeChatGroupMember: vi.fn(),
  transferChatGroupOwnership: vi.fn(),
  archiveChatGroup: vi.fn(),
  getChatPrivacy: vi.fn(),
  getChatConversation: vi.fn(),
  clearChatConversation: vi.fn(),
  getChatMessages: vi.fn(),
  advanceChatReadCursor: vi.fn(),
  sendChatMessage: vi.fn(),
  retractChatMessage: vi.fn(),
  reportChatMessage: vi.fn(),
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
  state: 'ACTIVE' as const,
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
const groupConversation = {
  conversationId: '20000000-0000-4000-8000-000000000099',
  kind: 'GROUP' as const,
  state: 'ACTIVE' as const,
  groupName: 'Nhóm đồng hành',
  viewerRole: 'MEMBER' as const,
  peers: [peer],
  unreadCount: 3,
  version: '1',
}
const ownerGroupConversation = {
  ...groupConversation,
  viewerRole: 'OWNER' as const,
  version: '7',
  peers: [conversation.peers[0], peer],
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
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((next, fail) => {
    resolve = next
    reject = fail
  })
  return { promise, resolve, reject }
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
    api.getChatGroupInvitations.mockResolvedValue({
      items: [],
      nextCursor: null,
    })
    api.getChatGroupMembers.mockResolvedValue({
      items: [],
      nextCursor: null,
    })
    api.getChatPrivacy.mockResolvedValue(privacy)
    api.getCommunityProfile.mockResolvedValue({
      data: { communityProfileId: selfId },
      etag: '"1"',
    })
    api.getChatConversation.mockResolvedValue(conversation)
    api.clearChatConversation.mockResolvedValue(undefined)
    api.getChatMessages.mockResolvedValue({
      items: [message],
      nextCursor: null,
    })
    api.advanceChatReadCursor.mockResolvedValue({
      lastReadMessageId: message.messageId,
      unreadCount: 0,
    })
    api.reportChatMessage.mockResolvedValue({
      caseId: '60000000-0000-4000-8000-000000000001',
      state: 'RECEIVED',
    })
  })

  it('opens notification consent targets without granting transcript access', async () => {
    render(<CommunityChatWorkspace initialTab="requests" />)
    await expect(screen.findByText('Mầm Nắng')).resolves.toBeVisible()
    expect(screen.getByRole('tab', { name: /Lời mời/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(api.getChatConversation).not.toHaveBeenCalled()
    expect(api.getChatMessages).not.toHaveBeenCalled()
    expect(api.advanceChatReadCursor).not.toHaveBeenCalled()
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

  it('confirms own-message retraction and replaces the same cell with a tombstone', async () => {
    const own = {
      ...message,
      sender: conversation.peers[0],
      content: 'Nội dung riêng cần gỡ.',
    }
    api.getChatMessages.mockResolvedValue({ items: [own], nextCursor: null })
    api.retractChatMessage.mockResolvedValue({
      messageId: own.messageId,
      conversationId,
      clientMessageId: own.clientMessageId,
      sender: own.sender,
      state: 'RETRACTED',
      createdAt: own.createdAt,
      retractedAt: '2026-10-20T08:01:00Z',
    })
    const user = userEvent.setup()
    render(<CommunityChatWorkspace initialConversationId={conversationId} />)

    expect(await screen.findByText('Nội dung riêng cần gỡ.')).toBeVisible()
    await user.click(
      screen.getByRole('button', {
        name: 'Gỡ tin nhắn này cho mọi người',
      }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Gỡ tin nhắn cho mọi người?',
    })
    await user.click(
      within(dialog).getByRole('button', { name: 'Gỡ tin nhắn' }),
    )

    expect(await screen.findByText('Bạn đã gỡ tin nhắn')).toBeVisible()
    expect(screen.queryByText('Nội dung riêng cần gỡ.')).not.toBeInTheDocument()
    expect(api.retractChatMessage).toHaveBeenCalledWith(
      conversationId,
      own.messageId,
    )
  })

  it('retracts exactly once after selecting a thread from the inbox route', async () => {
    const own = {
      ...message,
      sender: conversation.peers[0],
      content: 'Inbox message to retract.',
    }
    api.getChatMessages.mockResolvedValue({ items: [own], nextCursor: null })
    api.retractChatMessage.mockResolvedValue({
      messageId: own.messageId,
      conversationId,
      clientMessageId: own.clientMessageId,
      sender: own.sender,
      state: 'RETRACTED',
      createdAt: own.createdAt,
      retractedAt: '2026-10-20T08:01:00Z',
    })
    const user = userEvent.setup()
    render(<CommunityChatWorkspace />)

    const conversationLink = await screen.findByRole('link', {
      name: new RegExp(peer.displayName),
    })
    conversationLink.addEventListener('click', (event) =>
      event.preventDefault(),
    )
    await user.click(conversationLink)
    const messageContent = await screen.findByText(own.content)
    expect(messageContent).toBeVisible()

    await user.click(
      within(messageContent.parentElement as HTMLElement).getByRole('button'),
    )
    let dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getAllByRole('button')[0])
    expect(api.retractChatMessage).not.toHaveBeenCalled()

    await user.click(
      within(messageContent.parentElement as HTMLElement).getByRole('button'),
    )
    dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getAllByRole('button')[1])

    await waitFor(() =>
      expect(screen.queryByText(own.content)).not.toBeInTheDocument(),
    )
    expect(api.retractChatMessage).toHaveBeenCalledTimes(1)
    expect(api.retractChatMessage).toHaveBeenCalledWith(
      conversationId,
      own.messageId,
    )
  })

  it('clears an unconfirmed retraction across A to B to A navigation', async () => {
    const conversationB = conversationAt(2)
    const ownMessageA = {
      ...messageAt(11, conversationId),
      sender: conversation.peers[0],
      content: 'Tin nhắn riêng ở cuộc trò chuyện A.',
    }
    const messageB = messageAt(12, conversationB.conversationId)
    api.getChatConversation.mockImplementation((id: string) =>
      Promise.resolve(id === conversationId ? conversation : conversationB),
    )
    api.getChatMessages.mockImplementation((id: string) =>
      Promise.resolve({
        items: [id === conversationId ? ownMessageA : messageB],
        nextCursor: null,
      }),
    )
    const user = userEvent.setup()
    const { rerender } = render(
      <CommunityChatWorkspace initialConversationId={conversationId} />,
    )

    await screen.findByText(ownMessageA.content)
    await user.click(
      screen.getByRole('button', { name: 'Gỡ tin nhắn này cho mọi người' }),
    )
    expect(
      screen.getByRole('heading', { name: 'Gỡ tin nhắn cho mọi người?' }),
    ).toBeVisible()

    rerender(
      <CommunityChatWorkspace
        initialConversationId={conversationB.conversationId}
      />,
    )
    await screen.findByText(messageB.content)
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )

    rerender(<CommunityChatWorkspace initialConversationId={conversationId} />)
    await screen.findByText(ownMessageA.content)
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(api.retractChatMessage).not.toHaveBeenCalled()
  })

  it('confirms a personal conversation clear and removes only the local row', async () => {
    const user = userEvent.setup()
    render(<CommunityChatWorkspace initialConversationId={conversationId} />)

    await screen.findByText(message.content)
    await user.click(screen.getByRole('button', { name: 'Xóa phía tôi' }))

    const dialog = screen.getByRole('dialog', {
      name: 'Xóa cuộc trò chuyện phía bạn?',
    })
    expect(dialog).toHaveTextContent('Những người khác vẫn giữ nguyên lịch sử')
    await user.click(
      within(dialog).getByRole('button', { name: 'Xóa phía tôi' }),
    )

    await waitFor(() =>
      expect(api.clearChatConversation).toHaveBeenCalledWith(
        conversationId,
        expect.stringMatching(/^[\da-f-]{36}$/i),
      ),
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(router.replace).toHaveBeenCalledWith('/community/messages')
    expect(screen.queryByText(message.content)).not.toBeInTheDocument()
  })

  it('reconciles an unknown clear outcome before showing success', async () => {
    api.clearChatConversation.mockRejectedValue(
      new ApiError({ message: 'timeout', code: 'TIMEOUT', status: 504 }),
    )
    api.getChatConversations.mockImplementation(() =>
      Promise.resolve({
        items: api.clearChatConversation.mock.calls.length
          ? []
          : [conversation],
        nextCursor: null,
      }),
    )
    const user = userEvent.setup()
    render(<CommunityChatWorkspace initialConversationId={conversationId} />)

    await screen.findByText(message.content)
    await user.click(screen.getByRole('button', { name: 'Xóa phía tôi' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Xóa phía tôi',
      }),
    )

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(router.replace).toHaveBeenCalledWith('/community/messages')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps the dialog on an unconfirmed failure and reuses its idempotency key', async () => {
    api.clearChatConversation
      .mockRejectedValueOnce(
        new ApiError({ message: 'timeout', code: 'TIMEOUT', status: 504 }),
      )
      .mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    render(<CommunityChatWorkspace initialConversationId={conversationId} />)

    await screen.findByText(message.content)
    await user.click(screen.getByRole('button', { name: 'Xóa phía tôi' }))
    const dialog = screen.getByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', { name: 'Xóa phía tôi' }),
    )
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Chưa xác nhận đã xóa',
    )
    expect(screen.getByText(message.content)).toBeVisible()

    await user.click(
      within(dialog).getByRole('button', { name: 'Xóa phía tôi' }),
    )
    await waitFor(() =>
      expect(api.clearChatConversation).toHaveBeenCalledTimes(2),
    )
    expect(api.clearChatConversation.mock.calls[1][1]).toBe(
      api.clearChatConversation.mock.calls[0][1],
    )
  })

  it('clears an unconfirmed personal-clear dialog across A to B to A navigation', async () => {
    const conversationB = conversationAt(2)
    const messageB = messageAt(2, conversationB.conversationId)
    api.getChatConversation.mockImplementation((id: string) =>
      Promise.resolve(id === conversationId ? conversation : conversationB),
    )
    api.getChatMessages.mockImplementation((id: string) =>
      Promise.resolve({
        items: [id === conversationId ? message : messageB],
        nextCursor: null,
      }),
    )
    const user = userEvent.setup()
    const { rerender } = render(
      <CommunityChatWorkspace initialConversationId={conversationId} />,
    )

    await screen.findByText(message.content)
    await user.click(screen.getByRole('button', { name: 'Xóa phía tôi' }))
    expect(screen.getByRole('dialog')).toBeVisible()

    rerender(
      <CommunityChatWorkspace
        initialConversationId={conversationB.conversationId}
      />,
    )
    await screen.findByText(messageB.content)
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )

    rerender(<CommunityChatWorkspace initialConversationId={conversationId} />)
    await screen.findByText(message.content)
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(api.clearChatConversation).not.toHaveBeenCalled()
  })

  it('keeps unread state on the list-only route until a thread is explicitly opened', async () => {
    render(<CommunityChatWorkspace />)

    expect(await screen.findByText('1 tin chưa đọc')).toBeVisible()
    expect(api.getChatConversation).not.toHaveBeenCalled()
    expect(api.getChatMessages).not.toHaveBeenCalled()
    expect(api.advanceChatReadCursor).not.toHaveBeenCalled()
  })

  it('renders group items while preserving a group-only page cursor', async () => {
    const directA = conversationAt(1)
    const directB = conversationAt(2)
    api.getChatConversations.mockImplementation(async (cursor?: string) =>
      cursor
        ? { items: [directA, groupConversation, directB], nextCursor: null }
        : { items: [groupConversation], nextCursor: 'after-groups' },
    )
    const user = userEvent.setup()
    render(<CommunityChatWorkspace />)

    expect(await screen.findByText(groupConversation.groupName)).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: 'Tải thêm cuộc trò chuyện' }),
    )
    expect(await screen.findByText('Bạn 1')).toBeVisible()
    expect(screen.getByText('Bạn 2')).toBeVisible()
    expect(screen.getByText(groupConversation.groupName)).toBeVisible()
    expect(api.getChatConversations).toHaveBeenLastCalledWith('after-groups')
  })

  it('opens an authorized group deep link with messages and management', async () => {
    api.getChatConversation.mockResolvedValue(groupConversation)
    render(
      <CommunityChatWorkspace
        initialConversationId={groupConversation.conversationId}
      />,
    )

    expect(await screen.findByText(groupConversation.groupName)).toBeVisible()
    expect(screen.getByText(/Nhóm riêng/)).toBeVisible()
    expect(api.getChatMessages).toHaveBeenCalledWith(
      groupConversation.conversationId,
    )
    expect(screen.getByRole('textbox', { name: 'Tin nhắn' })).toBeVisible()
    expect(screen.getByRole('button', { name: /Thành viên/ })).toBeVisible()
  })

  it('creates a private group with the authoritative provider result', async () => {
    api.createChatGroup.mockResolvedValue({
      conversationId: groupConversation.conversationId,
      kind: 'GROUP',
      name: groupConversation.groupName,
      state: 'ACTIVE',
      memberLimit: 30,
      version: '1',
    })
    const user = userEvent.setup()
    render(<CommunityChatWorkspace />)
    await screen.findByText('Mầm Nắng')

    await user.click(screen.getByRole('button', { name: /Tạo nhóm riêng/ }))
    await user.type(screen.getByLabelText('Tên nhóm'), 'Góc bình yên')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Tạo nhóm',
      }),
    )

    await waitFor(() =>
      expect(api.createChatGroup).toHaveBeenCalledWith(
        'Góc bình yên',
        expect.stringMatching(/^[\da-f-]{36}$/i),
      ),
    )
    expect(router.push).toHaveBeenCalledWith(
      `/community/messages/${groupConversation.conversationId}`,
    )
  })

  it('accepts a group invitation with its own revision before opening the group', async () => {
    const invitation = {
      invitationId: '30000000-0000-4000-8000-000000000099',
      conversationId: groupConversation.conversationId,
      groupName: 'Bước chậm lại',
      inviter: peer,
      state: 'PENDING' as const,
      expiresAt: '2026-10-28T00:00:00Z',
      version: '3',
    }
    api.getChatGroupInvitations.mockResolvedValue({
      items: [invitation],
      nextCursor: null,
    })
    api.decideChatGroupInvitation.mockResolvedValue({
      conversationId: groupConversation.conversationId,
      kind: 'GROUP',
      name: invitation.groupName,
      state: 'ACTIVE',
      memberLimit: 30,
      version: '4',
    })
    const user = userEvent.setup()
    render(<CommunityChatWorkspace />)

    await user.click(await screen.findByRole('tab', { name: /Lời mời/ }))
    expect(await screen.findByText(invitation.groupName)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Tham gia' }))

    expect(api.decideChatGroupInvitation).toHaveBeenCalledWith(
      invitation.invitationId,
      'ACCEPT',
      '3',
    )
    expect(router.push).toHaveBeenCalledWith(
      `/community/messages/${groupConversation.conversationId}`,
    )
  })

  it('shows owner-only member controls and confirms archive', async () => {
    const admin = {
      peer,
      role: 'ADMIN' as const,
      joinedAt: '2026-10-20T00:00:00Z',
    }
    api.getChatConversation.mockResolvedValue(ownerGroupConversation)
    api.getChatGroupMembers.mockResolvedValue({
      items: [
        {
          peer: conversation.peers[0],
          role: 'OWNER',
          joinedAt: '2026-10-19T00:00:00Z',
        },
        admin,
      ],
      nextCursor: null,
    })
    api.setChatGroupMemberRole.mockResolvedValue({
      member: { ...admin, role: 'MEMBER' },
      version: '"8"',
    })
    api.archiveChatGroup.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <CommunityChatWorkspace
        initialConversationId={ownerGroupConversation.conversationId}
      />,
    )

    await user.click(
      await screen.findByRole('button', { name: /Thành viên · Chủ nhóm/ }),
    )
    await user.click(await screen.findByRole('button', { name: 'Hạ quyền' }))
    expect(api.setChatGroupMemberRole).toHaveBeenCalledWith(
      ownerGroupConversation.conversationId,
      peerId,
      'MEMBER',
      '7',
    )

    await user.click(screen.getByRole('button', { name: 'Lưu trữ nhóm' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Xác nhận',
      }),
    )
    expect(api.archiveChatGroup).toHaveBeenCalledWith(
      ownerGroupConversation.conversationId,
      '8',
    )
  })

  it('reloads the authoritative viewer role after ownership transfer', async () => {
    const admin = {
      peer,
      role: 'ADMIN' as const,
      joinedAt: '2026-10-20T00:00:00Z',
    }
    api.getChatConversation
      .mockResolvedValueOnce(ownerGroupConversation)
      .mockResolvedValue({
        ...ownerGroupConversation,
        viewerRole: 'ADMIN',
        version: '8',
      })
    api.getChatGroupMembers.mockResolvedValue({
      items: [admin],
      nextCursor: null,
    })
    api.transferChatGroupOwnership.mockResolvedValue({
      conversationId: ownerGroupConversation.conversationId,
      kind: 'GROUP',
      name: ownerGroupConversation.groupName,
      memberLimit: 50,
      state: 'ACTIVE',
      version: '8',
    })
    const user = userEvent.setup()
    render(
      <CommunityChatWorkspace
        initialConversationId={ownerGroupConversation.conversationId}
      />,
    )
    await user.click(
      await screen.findByRole('button', { name: /Thành viên · Chủ nhóm/ }),
    )
    await user.click(
      await screen.findByRole('button', { name: 'Chuyển quyền chủ nhóm' }),
    )
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Xác nhận',
      }),
    )
    expect(api.transferChatGroupOwnership).toHaveBeenCalledWith(
      ownerGroupConversation.conversationId,
      peerId,
      '7',
    )
    await screen.findByText('Đã chuyển quyền chủ nhóm.')
    expect(
      screen.queryByRole('button', { name: 'Lưu trữ nhóm' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Chuyển quyền chủ nhóm' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Đóng quản lý nhóm' }))
    expect(
      screen.getByRole('button', { name: /Thành viên · Quản trị viên/ }),
    ).toBeInTheDocument()
  })

  it('invites a peer selected from private conversations without exposing profile ids', async () => {
    const invitePeer = {
      ...peer,
      communityProfileId: '10000000-0000-4000-8000-000000000004',
      displayName: 'Chồi Xanh',
    }
    api.getChatConversations.mockResolvedValue({
      items: [
        conversation,
        {
          ...conversation,
          conversationId: '20000000-0000-4000-8000-000000000004',
          peers: [conversation.peers[0], invitePeer],
          unreadCount: 0,
        },
      ],
      nextCursor: null,
    })
    api.getChatConversation.mockResolvedValue(ownerGroupConversation)
    api.getChatGroupMembers.mockResolvedValue({
      items: [
        {
          peer: conversation.peers[0],
          role: 'OWNER',
          joinedAt: '2026-10-19T00:00:00Z',
        },
      ],
      nextCursor: null,
    })
    api.inviteChatGroupMember.mockResolvedValue({
      invitation: {
        invitationId: '30000000-0000-4000-8000-000000000088',
        conversationId: ownerGroupConversation.conversationId,
        groupName: ownerGroupConversation.groupName,
        inviter: conversation.peers[0],
        state: 'PENDING',
        expiresAt: '2026-10-29T00:00:00Z',
        version: '1',
      },
      version: '"8"',
    })
    const user = userEvent.setup()
    render(
      <CommunityChatWorkspace
        initialConversationId={ownerGroupConversation.conversationId}
      />,
    )

    await user.click(
      await screen.findByRole('button', { name: /Thành viên · Chủ nhóm/ }),
    )
    expect(
      screen.queryByText(invitePeer.communityProfileId),
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('combobox', {
        name: 'Chọn người từ trò chuyện riêng',
      }),
    )
    await user.click(
      screen.getByRole('option', { name: invitePeer.displayName }),
    )
    await user.click(screen.getByRole('button', { name: 'Mời thành viên' }))

    expect(api.inviteChatGroupMember).toHaveBeenCalledWith(
      ownerGroupConversation.conversationId,
      invitePeer.communityProfileId,
      '7',
      expect.stringMatching(/^[\da-f-]{36}$/i),
    )
    expect(
      await screen.findByText(/Người nhận phải tự chấp thuận/),
    ).toBeVisible()
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

  it('does not leak a delayed send success into a newly selected conversation', async () => {
    const conversationB = conversationAt(2)
    const messageB = messageAt(2, conversationB.conversationId)
    const pendingSend = deferred<{
      message: typeof message
      persistence: 'SAVED'
      delivery: 'UNCONFIRMED'
    }>()
    api.getChatConversation.mockImplementation((id: string) =>
      Promise.resolve(id === conversationId ? conversation : conversationB),
    )
    api.getChatMessages.mockImplementation((id: string) =>
      Promise.resolve({
        items: [id === conversationId ? message : messageB],
        nextCursor: null,
      }),
    )
    api.sendChatMessage.mockReturnValue(pendingSend.promise)
    const user = userEvent.setup()
    const { rerender } = render(
      <CommunityChatWorkspace initialConversationId={conversationId} />,
    )
    await screen.findByText(message.content)
    await user.type(screen.getByRole('textbox', { name: 'Tin nhắn' }), 'Từ A')
    await user.click(screen.getByRole('button', { name: 'Gửi' }))

    rerender(
      <CommunityChatWorkspace
        initialConversationId={conversationB.conversationId}
      />,
    )
    expect(await screen.findByText(messageB.content)).toBeVisible()
    await act(async () => {
      pendingSend.resolve({
        message: { ...messageAt(81), content: 'Từ A' },
        persistence: 'SAVED',
        delivery: 'UNCONFIRMED',
      })
      await Promise.resolve()
    })

    expect(screen.queryByText('Từ A')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Tin nhắn' })).toHaveValue('')
  })

  it('drops delayed send failure and retry state across A to B to A navigation', async () => {
    const conversationB = conversationAt(2)
    const messageB = messageAt(2, conversationB.conversationId)
    const pendingSend = deferred<never>()
    api.getChatConversation.mockImplementation((id: string) =>
      Promise.resolve(id === conversationId ? conversation : conversationB),
    )
    api.getChatMessages.mockImplementation((id: string) =>
      Promise.resolve({
        items: [id === conversationId ? message : messageB],
        nextCursor: null,
      }),
    )
    api.sendChatMessage.mockReturnValue(pendingSend.promise)
    const user = userEvent.setup()
    const { rerender } = render(
      <CommunityChatWorkspace initialConversationId={conversationId} />,
    )
    await screen.findByText(message.content)
    await user.type(screen.getByRole('textbox', { name: 'Tin nhắn' }), 'Lỗi A')
    await user.click(screen.getByRole('button', { name: 'Gửi' }))
    rerender(
      <CommunityChatWorkspace
        initialConversationId={conversationB.conversationId}
      />,
    )
    await screen.findByText(messageB.content)
    await act(async () => {
      pendingSend.reject(new Error('network uncertain'))
      await Promise.resolve()
    })
    expect(
      screen.queryByRole('button', { name: 'Gửi lại' }),
    ).not.toBeInTheDocument()

    rerender(<CommunityChatWorkspace initialConversationId={conversationId} />)
    await screen.findByText(message.content)
    expect(
      screen.queryByRole('button', { name: 'Gửi lại' }),
    ).not.toBeInTheDocument()
    expect(api.sendChatMessage).toHaveBeenCalledTimes(1)
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

  it('places a sent message after unfinished history without timestamp sorting', async () => {
    const messages = Array.from({ length: 80 }, (_, index) =>
      messageAt(index + 1),
    )
    const sent = { ...messageAt(81), content: 'Tin vừa gửi 81' }
    api.getChatMessages.mockImplementation(
      async (_id: string, cursor?: string) =>
        cursor
          ? { items: messages.slice(50), nextCursor: null }
          : { items: messages.slice(0, 50), nextCursor: 'message-page-2' },
    )
    api.sendChatMessage.mockResolvedValue({
      message: sent,
      persistence: 'SAVED',
      delivery: 'UNCONFIRMED',
    })
    const user = userEvent.setup()
    render(<CommunityChatWorkspace initialConversationId={conversationId} />)
    await screen.findByText('Tin nhắn 50')
    await user.type(
      screen.getByRole('textbox', { name: 'Tin nhắn' }),
      sent.content,
    )
    await user.click(screen.getByRole('button', { name: 'Gửi' }))
    await waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(sent.content)).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Tải tin nhắn tiếp theo' }),
    )
    const historyTail = await screen.findByText('Tin nhắn 80')
    const sentNode = await screen.findByText(sent.content)
    expect(historyTail.compareDocumentPosition(sentNode)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it('fails closed without retry when access is revoked during continuation', async () => {
    api.getChatMessages
      .mockResolvedValueOnce({
        items: [messageAt(1)],
        nextCursor: 'stale-page',
      })
      .mockRejectedValueOnce(
        new ApiError({ message: 'gone', code: 'NOT_FOUND', status: 404 }),
      )
    const user = userEvent.setup()
    render(<CommunityChatWorkspace initialConversationId={conversationId} />)
    await screen.findByText('Tin nhắn 1')

    await user.click(
      screen.getByRole('button', { name: 'Tải tin nhắn tiếp theo' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cuộc trò chuyện này không còn khả dụng.',
    )
    expect(screen.queryByText('Tin nhắn 1')).not.toBeInTheDocument()
    expect(api.advanceChatReadCursor).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByRole('button', { name: 'Thử tải lại tin nhắn' }),
    ).not.toBeInTheDocument()
    expect(api.getChatMessages).toHaveBeenCalledTimes(2)
  })

  it('keeps messages and retries the same cursor after a transient continuation failure', async () => {
    api.getChatMessages
      .mockResolvedValueOnce({ items: [messageAt(1)], nextCursor: 'page-2' })
      .mockRejectedValueOnce(
        new ApiError({ message: 'down', code: 'UNAVAILABLE', status: 503 }),
      )
      .mockResolvedValueOnce({ items: [messageAt(2)], nextCursor: null })
    const user = userEvent.setup()
    render(<CommunityChatWorkspace initialConversationId={conversationId} />)
    await screen.findByText('Tin nhắn 1')

    await user.click(
      screen.getByRole('button', { name: 'Tải tin nhắn tiếp theo' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Kết nối trò chuyện đang gián đoạn.',
    )
    expect(screen.getByText('Tin nhắn 1')).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: 'Thử tải lại tin nhắn' }),
    )
    expect(await screen.findByText('Tin nhắn 2')).toBeVisible()
    expect(api.getChatMessages).toHaveBeenNthCalledWith(
      3,
      conversationId,
      'page-2',
    )
  })

  it('reports exactly one visible message with an idempotency key', async () => {
    const user = userEvent.setup()
    render(<CommunityChatWorkspace initialConversationId={conversationId} />)
    await screen.findByText(message.content)
    await user.click(
      screen.getByRole('button', {
        name: `Báo cáo tin nhắn: ${message.content}`,
      }),
    )
    expect(
      screen.getByText(/Chỉ tin nhắn này được gửi để đội ngũ kiểm duyệt/),
    ).toBeVisible()
    await user.type(
      screen.getByRole('textbox', {
        name: 'Chi tiết bổ sung (không bắt buộc)',
      }),
      'Nội dung nhắm vào cá nhân.',
    )
    await user.click(
      screen.getByRole('button', { name: 'Xác nhận gửi báo cáo' }),
    )

    await waitFor(() =>
      expect(api.reportChatMessage).toHaveBeenCalledWith(
        {
          messageId: message.messageId,
          reasonCode: 'HARASSMENT',
          details: 'Nội dung nhắm vào cá nhân.',
        },
        expect.stringMatching(/^[\da-f-]{36}$/i),
      ),
    )
    expect(
      await screen.findByText('Đã gửi báo cáo cho riêng tin nhắn đã chọn.'),
    ).toBeVisible()
  })

  it('shows a safe denial when a message report is unauthorized', async () => {
    api.reportChatMessage.mockRejectedValue(
      new ApiError({ message: 'forbidden', code: 'FORBIDDEN', status: 403 }),
    )
    const user = userEvent.setup()
    render(<CommunityChatWorkspace initialConversationId={conversationId} />)
    await screen.findByText(message.content)
    await user.click(
      screen.getByRole('button', {
        name: `Báo cáo tin nhắn: ${message.content}`,
      }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Xác nhận gửi báo cáo' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bạn không thể báo cáo tin nhắn này',
    )
    expect(
      screen.getByRole('heading', { name: 'Báo cáo tin nhắn' }),
    ).toBeVisible()
  })

  it('clears report target, form and error across A to B to A navigation', async () => {
    const conversationB = conversationAt(2)
    const messageB = messageAt(2, conversationB.conversationId)
    api.getChatConversation.mockImplementation((id: string) =>
      Promise.resolve(id === conversationId ? conversation : conversationB),
    )
    api.getChatMessages.mockImplementation((id: string) =>
      Promise.resolve({
        items: [id === conversationId ? message : messageB],
        nextCursor: null,
      }),
    )
    api.reportChatMessage.mockRejectedValue(
      new ApiError({ message: 'down', code: 'UNAVAILABLE', status: 503 }),
    )
    const user = userEvent.setup()
    const { rerender } = render(
      <CommunityChatWorkspace initialConversationId={conversationId} />,
    )

    await screen.findByText(message.content)
    await user.click(
      screen.getByRole('button', {
        name: `Báo cáo tin nhắn: ${message.content}`,
      }),
    )
    await user.type(
      screen.getByRole('textbox', {
        name: 'Chi tiết bổ sung (không bắt buộc)',
      }),
      'Chi tiết không được giữ lại.',
    )
    await user.click(
      screen.getByRole('button', { name: 'Xác nhận gửi báo cáo' }),
    )
    expect(await screen.findByRole('alert')).toBeVisible()
    expect(api.reportChatMessage).toHaveBeenCalledTimes(1)

    rerender(
      <CommunityChatWorkspace
        initialConversationId={conversationB.conversationId}
      />,
    )
    await screen.findByText(messageB.content)
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )

    rerender(<CommunityChatWorkspace initialConversationId={conversationId} />)
    await screen.findByText(message.content)
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(api.reportChatMessage).toHaveBeenCalledTimes(1)

    await user.click(
      screen.getByRole('button', {
        name: `Báo cáo tin nhắn: ${message.content}`,
      }),
    )
    expect(
      screen.getByRole('textbox', {
        name: 'Chi tiết bổ sung (không bắt buộc)',
      }),
    ).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(api.reportChatMessage).toHaveBeenCalledTimes(1)
  })

  it('ignores an older conversation response after selection changes', async () => {
    const conversationB = conversationAt(2)
    const messageB = messageAt(2, conversationB.conversationId)
    const conversationAResult = deferred<typeof conversation>()
    api.getChatConversation.mockImplementation((id: string) =>
      id === conversationId
        ? conversationAResult.promise
        : Promise.resolve(conversationB),
    )
    api.getChatMessages.mockImplementation((id: string) =>
      Promise.resolve({
        items: [id === conversationId ? message : messageB],
        nextCursor: null,
      }),
    )
    const { rerender } = render(
      <CommunityChatWorkspace initialConversationId={conversationId} />,
    )
    await waitFor(() =>
      expect(api.getChatConversation).toHaveBeenCalledWith(conversationId),
    )

    rerender(
      <CommunityChatWorkspace
        initialConversationId={conversationB.conversationId}
      />,
    )
    expect(await screen.findByText('Tin nhắn 2')).toBeVisible()

    await act(async () => {
      conversationAResult.resolve(conversation)
      await Promise.resolve()
    })
    expect(screen.getByText('Tin nhắn 2')).toBeVisible()
    expect(screen.queryByText('Tin nhắn 1')).not.toBeInTheDocument()
    expect(api.advanceChatReadCursor).not.toHaveBeenCalledWith(
      conversationId,
      expect.any(String),
    )
    expect(api.getChatMessages).not.toHaveBeenCalledWith(conversationId)
  })
})
