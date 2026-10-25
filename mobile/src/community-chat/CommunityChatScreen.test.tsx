import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { AppState, type AppStateStatus } from 'react-native'
import { z } from 'zod'
import { ApiError } from '@/api/api-error'
import type { CommunityApi } from '@/community/community-api'
import { CommunityChatInbox } from './CommunityChatInbox'
import { CommunityChatPrivacy } from './CommunityChatPrivacy'
import { CommunityGroupPanel } from './CommunityGroupPanel'
import { CommunityConversationScreen } from './CommunityConversationScreen'
import type { CommunitySocket } from './community-chat-socket'
import {
  chatFixtureApi,
  chatFixtureConversation,
  chatFixtureDate,
  chatFixtureId as id,
  chatFixtureMessage,
  chatFixtureOwnId as ownId,
  chatFixturePeerId as peerId,
  chatFixturePrivacy,
} from './community-chat-test-fixtures'

async function mount(element: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>{element}</QueryClientProvider>,
  )
}
const subject = 'account-subject-not-community-profile'
it('keeps pending requests separate from history/presence and uses the request revision', async () => {
  const api = chatFixtureApi(),
    onOpen = jest.fn()
  jest
    .mocked(api.decideRequest)
    .mockResolvedValue({ state: 'ACTIVE', conversationId: id })
  await mount(
    <CommunityChatInbox
      api={api}
      subject={subject}
      ownId={ownId}
      target={{ requestId: id }}
      onOpen={onOpen}
      onBack={jest.fn()}
      onPrivacy={jest.fn()}
    />,
  )
  await screen.findByText('Mây')
  expect(screen.queryByLabelText('Nội dung tin nhắn cộng đồng')).toBeNull()
  expect(api.messages).not.toHaveBeenCalled()
  expect(api.credential).not.toHaveBeenCalled()
  await fireEvent.press(
    screen.getByRole('button', { name: 'Chấp nhận trò chuyện' }),
  )
  await waitFor(() => expect(onOpen).toHaveBeenCalledWith(id))
  expect(api.decideRequest).toHaveBeenCalledWith(id, 'ACCEPT', '"17"')
})
it('resolves an invitation link against the current recipient list, then applies its own revision', async () => {
  const api = chatFixtureApi()
  await mount(
    <CommunityChatInbox
      api={api}
      subject={subject}
      ownId={ownId}
      target={{ invitationId: id }}
      onOpen={jest.fn()}
      onBack={jest.fn()}
      onPrivacy={jest.fn()}
    />,
  )
  await screen.findByText('Khoảng xanh')
  await fireEvent.press(screen.getByRole('button', { name: 'Từ chối lời mời' }))
  await waitFor(() =>
    expect(api.decideInvitation).toHaveBeenCalledWith(
      id,
      id,
      'DECLINE',
      '"24"',
    ),
  )
  expect(api.messages).not.toHaveBeenCalled()
})
it('does not open an unrelated request when a notification target is gone', async () => {
  const api = chatFixtureApi()
  await mount(
    <CommunityChatInbox
      api={api}
      subject={subject}
      ownId={ownId}
      target={{ requestId: peerId }}
      onOpen={jest.fn()}
      onBack={jest.fn()}
      onPrivacy={jest.fn()}
    />,
  )
  await screen.findByText(
    'Yêu cầu hoặc lời mời không còn khả dụng. Nội dung có thể đã thay đổi.',
  )
  expect(screen.queryByText('Mây')).toBeNull()
  expect(
    screen.queryByRole('button', { name: 'Chấp nhận trò chuyện' }),
  ).toBeNull()
})
it('supports approval and open direct outcomes without treating a pending request as a conversation', async () => {
  const api = chatFixtureApi(),
    onOpen = jest.fn()
  await mount(
    <CommunityChatInbox
      api={api}
      subject={subject}
      ownId={ownId}
      target={{ peerId }}
      onOpen={onOpen}
      onBack={jest.fn()}
      onPrivacy={jest.fn()}
    />,
  )
  await screen.findByRole('button', { name: 'Bắt đầu trò chuyện' })
  await fireEvent.press(
    screen.getByRole('button', { name: 'Bắt đầu trò chuyện' }),
  )
  await screen.findByText(
    'Đã gửi yêu cầu. Chờ người nhận chấp nhận để bắt đầu trò chuyện.',
  )
  expect(onOpen).not.toHaveBeenCalled()
  expect(api.startDirect).toHaveBeenCalledWith(peerId, expect.any(String))
})
it('opens an ANYONE direct only after the authoritative ACTIVE response', async () => {
  const api = chatFixtureApi(),
    onOpen = jest.fn()
  jest
    .mocked(api.startDirect)
    .mockResolvedValue({ state: 'ACTIVE', conversationId: id })
  await mount(
    <CommunityChatInbox
      api={api}
      subject={subject}
      ownId={ownId}
      target={{ peerId }}
      onOpen={onOpen}
      onBack={jest.fn()}
      onPrivacy={jest.fn()}
    />,
  )
  await screen.findByText('Mây')
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Bắt đầu trò chuyện' }),
  )
  await waitFor(() => expect(onOpen).toHaveBeenCalledWith(id))
  expect(api.credential).not.toHaveBeenCalled()
})
it('keeps presence opt-out and preserves unsupported typing/receipt preferences on a privacy save', async () => {
  const api = chatFixtureApi()
  await mount(
    <CommunityChatPrivacy api={api} subject={subject} onBack={jest.fn()} />,
  )
  await screen.findByRole('button', { name: 'Hiển thị hoạt động: Tắt' })
  await fireEvent.press(
    screen.getByRole('button', { name: 'Cho phép nhắn trực tiếp' }),
  )
  await fireEvent.press(
    screen.getByRole('button', { name: 'Lưu quyền riêng tư' }),
  )
  await waitFor(() =>
    expect(api.savePrivacy).toHaveBeenCalledWith(
      { ...chatFixturePrivacy, directMessagePolicy: 'ANYONE' },
      '"9007199254740993"',
    ),
  )
})
it('retains a privacy draft on a stale revision and never retries the overwrite automatically', async () => {
  const api = chatFixtureApi()
  jest
    .mocked(api.savePrivacy)
    .mockRejectedValue(
      new ApiError({ code: 'VERSION_CONFLICT', status: 412, message: 'Stale' }),
    )
  await mount(
    <CommunityChatPrivacy api={api} subject={subject} onBack={jest.fn()} />,
  )
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Chế độ ẩn: Tắt' }),
  )
  await fireEvent.press(
    screen.getByRole('button', { name: 'Lưu quyền riêng tư' }),
  )
  await screen.findByText(
    'Nội dung đã thay đổi. Tải lại bản mới trước khi sửa tiếp; bản nháp chưa được lưu.',
  )
  expect(api.savePrivacy).toHaveBeenCalledTimes(1)
  expect(
    screen.getByRole('button', { name: 'Chế độ ẩn: Bật' }),
  ).toBeOnTheScreen()
})
function groupApi(
  role: 'OWNER' | 'ADMIN' | 'MEMBER',
  state: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE',
) {
  const api = chatFixtureApi()
  jest.mocked(api.conversation).mockResolvedValue({
    value: {
      ...chatFixtureConversation,
      kind: 'GROUP',
      groupName: 'Khoảng xanh',
      viewerRole: role,
      state,
    },
    etag: '"9007199254740993"',
  })
  return api
}
it.each(['ADMIN', 'MEMBER'] as const)(
  'hides owner operations for %s and offers explicit self-leave',
  async (role) => {
    const api = groupApi(role)
    await mount(
      <CommunityGroupPanel
        api={api}
        subject={subject}
        ownId={ownId}
        conversationId={id}
        onBack={jest.fn()}
        onExit={jest.fn()}
        onChanged={async () => {}}
      />,
    )
    await screen.findByText('Khoảng xanh')
    expect(
      screen.queryByRole('button', { name: 'Chuyển quyền chủ nhóm' }),
    ).toBeNull()
    expect(screen.queryByRole('button', { name: 'Lưu trữ nhóm' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Rời nhóm' })).toBeOnTheScreen()
  },
)
it('confirms owner archive with current group revision and reloads after 204', async () => {
  const api = groupApi('OWNER'),
    changed = jest.fn(async () => {})
  await mount(
    <CommunityGroupPanel
      api={api}
      subject={subject}
      ownId={ownId}
      conversationId={id}
      onBack={jest.fn()}
      onExit={jest.fn()}
      onChanged={changed}
    />,
  )
  await screen.findByText('Khoảng xanh')
  await fireEvent.press(screen.getByRole('button', { name: 'Lưu trữ nhóm' }))
  expect(api.archive).not.toHaveBeenCalled()
  await fireEvent.press(
    screen.getByRole('button', { name: 'Xác nhận thay đổi' }),
  )
  await waitFor(() => expect(changed).toHaveBeenCalled())
  expect(api.archive).toHaveBeenCalledWith(id, '"9007199254740993"')
  expect(api.conversation).toHaveBeenCalledTimes(2)
})
class Socket implements CommunitySocket {
  listeners = new Map<string, (value?: unknown) => void>()
  disconnect = jest.fn()
  removeAllListeners = () => this.listeners.clear()
  connect = () => this.listeners.get('connect')?.()
  on = (name: string, callback: (value?: unknown) => void) => {
    this.listeners.set(name, callback)
  }
  emit = (_name: string, wire: unknown, ack: (value: unknown) => void) => {
    const command = z.object({ commandId: z.uuid() }).parse(wire)
    ack({
      schemaVersion: 1,
      eventId: id,
      correlationId: id,
      occurredAt: chatFixtureDate,
      eventType: 'community.command.ack',
      payload: { commandId: command.commandId, status: 'ACCEPTED' },
    })
  }
}
it('renders plain text, never invents presence, stops in background and reconnects with a fresh ticket', async () => {
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'active',
  })
  const listeners: ((state: AppStateStatus) => void)[] = []
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      listeners.push(callback)
      return { remove: jest.fn() }
    })
  const api = chatFixtureApi(),
    sockets: Socket[] = []
  const community = { block: jest.fn() } as unknown as CommunityApi
  const view = await mount(
    <CommunityConversationScreen
      api={api}
      community={community}
      factory={() => {
        const socket = new Socket()
        sockets.push(socket)
        return socket
      }}
      subject={subject}
      ownId={ownId}
      conversationId={id}
      onBack={jest.fn()}
    />,
  )
  await screen.findByText('<b>Lời chào an toàn</b>')
  expect(screen.queryByText('Đang hoạt động')).toBeNull()
  await fireEvent.changeText(
    screen.getByLabelText('Nội dung tin nhắn cộng đồng'),
    'Bản nháp',
  )
  await act(async () => {
    listeners.forEach((callback) => callback('background'))
  })
  expect(screen.queryByText('<b>Lời chào an toàn</b>')).toBeNull()
  expect(sockets[0]?.disconnect).toHaveBeenCalled()
  await act(async () => {
    listeners.forEach((callback) => callback('active'))
  })
  await screen.findByText('<b>Lời chào an toàn</b>')
  expect(api.credential).toHaveBeenCalledTimes(2)
  expect(api.send).not.toHaveBeenCalled()
  await view.unmount()
  jest.restoreAllMocks()
})
it('confirms own-message retraction and replaces content with an in-place tombstone', async () => {
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'active',
  })
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({
    remove: jest.fn(),
  })
  const api = chatFixtureApi()
  const ownMessage = {
    ...chatFixtureMessage,
    sender: {
      state: 'AVAILABLE' as const,
      communityProfileId: ownId,
      displayName: 'Tôi',
    },
  }
  jest
    .mocked(api.messages)
    .mockResolvedValue({ items: [ownMessage], nextCursor: null })
  jest.mocked(api.retract).mockResolvedValue({
    messageId: ownMessage.messageId,
    conversationId: ownMessage.conversationId,
    clientMessageId: ownMessage.clientMessageId,
    sender: ownMessage.sender,
    state: 'RETRACTED',
    createdAt: ownMessage.createdAt,
    retractedAt: '2026-10-21T01:01:00Z',
  })
  const view = await mount(
    <CommunityConversationScreen
      api={api}
      community={{} as CommunityApi}
      factory={() => new Socket()}
      subject={subject}
      ownId={ownId}
      conversationId={id}
      onBack={jest.fn()}
    />,
  )

  await screen.findByText('<b>Lời chào an toàn</b>')
  await fireEvent.press(screen.getByRole('button', { name: 'Gỡ tin nhắn' }))
  expect(screen.getByText('Gỡ tin nhắn cho mọi người?')).toBeTruthy()
  await fireEvent.press(
    screen.getByRole('button', { name: 'Xác nhận gỡ tin nhắn' }),
  )
  await screen.findByText('Bạn đã gỡ tin nhắn')
  expect(screen.queryByText('<b>Lời chào an toàn</b>')).toBeNull()
  expect(api.retract).toHaveBeenCalledWith(id, ownMessage.messageId)

  await view.unmount()
  jest.restoreAllMocks()
})
it('confirms a personal clear, keeps peers unchanged and returns to the inbox', async () => {
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'active',
  })
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({
    remove: jest.fn(),
  })
  const api = chatFixtureApi()
  const onBack = jest.fn()
  const view = await mount(
    <CommunityConversationScreen
      api={api}
      community={{} as CommunityApi}
      factory={() => new Socket()}
      subject={subject}
      ownId={ownId}
      conversationId={id}
      onBack={onBack}
    />,
  )

  await screen.findByText('<b>Lời chào an toàn</b>')
  await fireEvent.press(
    screen.getByRole('button', { name: 'Xóa cuộc trò chuyện phía tôi' }),
  )
  expect(screen.getByText('Xóa cuộc trò chuyện phía bạn?')).toBeOnTheScreen()
  expect(
    screen.getByText(/Những người khác vẫn giữ nguyên lịch sử/),
  ).toBeOnTheScreen()
  await fireEvent.press(
    screen.getByRole('button', { name: 'Xác nhận xóa phía tôi' }),
  )

  await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1))
  expect(api.clearConversation).toHaveBeenCalledWith(id, expect.any(String))
  expect(api.clearConversation).toHaveBeenCalledTimes(1)

  await view.unmount()
  jest.restoreAllMocks()
})
it('keeps a failed personal clear visible and reuses its command key on retry', async () => {
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'active',
  })
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({
    remove: jest.fn(),
  })
  const api = chatFixtureApi()
  jest
    .mocked(api.clearConversation)
    .mockRejectedValueOnce(new Error('timeout'))
    .mockResolvedValueOnce(undefined)
  const onBack = jest.fn()
  const view = await mount(
    <CommunityConversationScreen
      api={api}
      community={{} as CommunityApi}
      factory={() => new Socket()}
      subject={subject}
      ownId={ownId}
      conversationId={id}
      onBack={onBack}
    />,
  )

  await screen.findByText('<b>Lời chào an toàn</b>')
  await fireEvent.press(
    screen.getByRole('button', { name: 'Xóa cuộc trò chuyện phía tôi' }),
  )
  await fireEvent.press(
    screen.getByRole('button', { name: 'Xác nhận xóa phía tôi' }),
  )
  await screen.findByText(/Chưa xác nhận đã xóa/)
  expect(onBack).not.toHaveBeenCalled()
  expect(screen.getByText('<b>Lời chào an toàn</b>')).toBeOnTheScreen()

  await fireEvent.press(
    screen.getByRole('button', { name: 'Xác nhận xóa phía tôi' }),
  )
  await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1))
  expect(api.clearConversation).toHaveBeenCalledTimes(2)
  expect(jest.mocked(api.clearConversation).mock.calls[1]?.[1]).toBe(
    jest.mocked(api.clearConversation).mock.calls[0]?.[1],
  )

  await view.unmount()
  jest.restoreAllMocks()
})
it('reconciles a timed-out personal clear before leaving the thread', async () => {
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'active',
  })
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({
    remove: jest.fn(),
  })
  const api = chatFixtureApi()
  jest.mocked(api.clearConversation).mockRejectedValue(new Error('timeout'))
  jest.mocked(api.conversations).mockResolvedValue({
    items: [],
    nextCursor: null,
  })
  const onBack = jest.fn()
  const view = await mount(
    <CommunityConversationScreen
      api={api}
      community={{} as CommunityApi}
      factory={() => new Socket()}
      subject={subject}
      ownId={ownId}
      conversationId={id}
      onBack={onBack}
    />,
  )

  await screen.findByText('<b>Lời chào an toàn</b>')
  await fireEvent.press(
    screen.getByRole('button', { name: 'Xóa cuộc trò chuyện phía tôi' }),
  )
  await fireEvent.press(
    screen.getByRole('button', { name: 'Xác nhận xóa phía tôi' }),
  )

  await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1))
  expect(screen.queryByText(/Chưa xác nhận đã xóa/)).toBeNull()

  await view.unmount()
  jest.restoreAllMocks()
})
it('renders archived history without a composer and hides history on permission failure', async () => {
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'active',
  })
  const api = groupApi('MEMBER', 'ARCHIVED'),
    socket = new Socket()
  const view = await mount(
    <CommunityConversationScreen
      api={api}
      community={{} as CommunityApi}
      factory={() => socket}
      subject={subject}
      ownId={ownId}
      conversationId={id}
      onBack={jest.fn()}
    />,
  )
  await screen.findByText('<b>Lời chào an toàn</b>')
  expect(screen.queryByLabelText('Nội dung tin nhắn cộng đồng')).toBeNull()
  jest.mocked(api.conversation).mockRejectedValue(
    new ApiError({
      code: 'TARGET_UNAVAILABLE',
      status: 404,
      message: 'Unavailable',
    }),
  )
  await act(async () => {
    socket.listeners.get('community.event')?.({
      schemaVersion: 1,
      eventId: id,
      correlationId: id,
      occurredAt: chatFixtureDate,
      eventType: 'community.conversation.invalidated',
      payload: { conversationId: id },
    })
  })
  await waitFor(() =>
    expect(screen.queryByText('<b>Lời chào an toàn</b>')).toBeNull(),
  )
  await view.unmount()
  jest.restoreAllMocks()
})
