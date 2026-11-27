import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { AppState, BackHandler, type AppStateStatus } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { z } from 'zod'
import { ApiError } from '@/api/api-error'
import type { CommunityApi } from '@/community/community-api'
import { router } from 'expo-router'
import { communityColors } from '@/community/community-theme'
import { CommunityChatInbox } from './CommunityChatInbox'
import { goCommunityTab } from './community-chat-ui'
import { CommunityChatPrivacy } from './CommunityChatPrivacy'
import { CommunityGroupPanel } from './CommunityGroupPanel'
import { CommunityConversationScreen } from './CommunityConversationScreen'
import type { CommunityMessage as ChatMessage } from './community-chat-contract'
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

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn() },
}))

async function mount(element: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>{element}</QueryClientProvider>,
  )
}
const subject = 'account-subject-not-community-profile'
const openMenu = () =>
  fireEvent.press(
    screen.getByRole('button', { name: 'Tùy chọn cuộc trò chuyện' }),
  )
function foreground() {
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'active',
  })
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({
    remove: jest.fn(),
  })
}
const inbox = (api: ReturnType<typeof chatFixtureApi>, onOpen = jest.fn()) =>
  mount(
    <CommunityChatInbox
      api={api}
      subject={subject}
      ownId={ownId}
      target={{}}
      onOpen={onOpen}
      onBack={jest.fn()}
      onPrivacy={jest.fn()}
      onTab={jest.fn()}
    />,
  )
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
      onTab={jest.fn()}
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
      onTab={jest.fn()}
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
      onTab={jest.fn()}
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
      onTab={jest.fn()}
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
      onTab={jest.fn()}
    />,
  )
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
  await screen.findByRole('switch', { name: 'Hiển thị hoạt động: Tắt' })
  await fireEvent.press(
    screen.getByRole('radio', { name: 'Cho phép nhắn trực tiếp' }),
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
    await screen.findByRole('switch', { name: 'Chế độ ẩn: Tắt' }),
  )
  await fireEvent.press(
    screen.getByRole('button', { name: 'Lưu quyền riêng tư' }),
  )
  await screen.findByText(
    'Nội dung đã thay đổi. Tải lại bản mới trước khi sửa tiếp; bản nháp chưa được lưu.',
  )
  expect(api.savePrivacy).toHaveBeenCalledTimes(1)
  expect(
    screen.getByRole('switch', { name: 'Chế độ ẩn: Bật' }),
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
  await fireEvent(screen.getByTestId('community-chat-message'), 'longPress')
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
  await openMenu()
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
  await openMenu()
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
  await openMenu()
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
it('shows skeleton rows while the inbox loads', async () => {
  const api = chatFixtureApi()
  const never = new Promise<never>(() => {})
  jest.mocked(api.conversations).mockReturnValue(never)
  jest.mocked(api.requests).mockReturnValue(never)
  jest.mocked(api.invitations).mockReturnValue(never)
  await inbox(api)
  expect(
    screen.getByRole('progressbar', { name: 'Đang kiểm tra hộp trò chuyện…' }),
  ).toBeOnTheScreen()
  expect(screen.queryByText('Mây')).toBeNull()
})
it('lists a conversation as one pressable row with an unread badge and opens it', async () => {
  const api = chatFixtureApi(),
    onOpen = jest.fn()
  await inbox(api, onOpen)
  await screen.findByText('Mây')
  expect(screen.getByText('Mở cuộc trò chuyện')).toBeOnTheScreen()
  expect(
    screen.getByText('2', { includeHiddenElements: true }),
  ).toBeOnTheScreen()
  expect(
    screen.getByTestId('community-avatar-initial', {
      includeHiddenElements: true,
    }),
  ).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: /^Mở Mây/ }))
  expect(onOpen).toHaveBeenCalledWith(id)
})
it('shows an empty state card when there are no conversations', async () => {
  const api = chatFixtureApi()
  jest
    .mocked(api.conversations)
    .mockResolvedValue({ items: [], nextCursor: null })
  await inbox(api)
  await screen.findByText('Chưa có cuộc trò chuyện')
  expect(
    screen.getByText(
      'Bạn có thể nhắn từ một bài viết dùng danh tính cộng đồng.',
    ),
  ).toBeOnTheScreen()
})
it('shows the unavailable state card and retries the load', async () => {
  const api = chatFixtureApi()
  jest.mocked(api.conversations).mockRejectedValueOnce(new Error('down'))
  await inbox(api)
  await screen.findByText('Tin nhắn hiện chưa khả dụng')
  await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }))
  await screen.findByText('Mây')
  expect(api.conversations).toHaveBeenCalledTimes(2)
})
const ownMessage = {
  ...chatFixtureMessage,
  messageId: '44444444-4444-4444-8444-444444444444',
  sender: {
    state: 'AVAILABLE' as const,
    communityProfileId: ownId,
    displayName: 'Tôi',
  },
  content: 'Mình ở đây',
}
it('draws own and other bubbles differently and keeps message text plain', async () => {
  foreground()
  const api = chatFixtureApi()
  jest.mocked(api.messages).mockResolvedValue({
    items: [chatFixtureMessage, ownMessage],
    nextCursor: null,
  })
  await mount(
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
  const [other, own] = screen.getAllByTestId('community-chat-message')
  expect(own).toHaveStyle({ backgroundColor: communityColors.primaryDeep })
  expect(other).toHaveStyle({ backgroundColor: communityColors.background })
  expect(screen.getByText('Mình ở đây')).toHaveStyle({
    color: communityColors.white,
  })
  jest.restoreAllMocks()
})
it('renders a retracted message as a dashed placeholder without its content', async () => {
  foreground()
  const api = chatFixtureApi()
  jest.mocked(api.messages).mockResolvedValue({
    items: [
      {
        messageId: chatFixtureMessage.messageId,
        conversationId: chatFixtureMessage.conversationId,
        clientMessageId: chatFixtureMessage.clientMessageId,
        sender: chatFixtureMessage.sender,
        state: 'RETRACTED',
        createdAt: chatFixtureMessage.createdAt,
        retractedAt: '2026-10-21T01:01:00Z',
      },
    ],
    nextCursor: null,
  })
  await mount(
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
  await screen.findByText('Mây đã gỡ tin nhắn')
  expect(screen.getByTestId('community-chat-message')).toHaveStyle({
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  })
  expect(screen.getByText('Mây đã gỡ tin nhắn')).toHaveStyle({
    color: communityColors.inkSoft,
  })
  expect(screen.queryByRole('button', { name: /Báo cáo tin nhắn/ })).toBeNull()
  jest.restoreAllMocks()
})
it('shows the gentle empty state and keeps send disabled until there is text', async () => {
  foreground()
  const api = chatFixtureApi()
  jest.mocked(api.messages).mockResolvedValue({ items: [], nextCursor: null })
  await mount(
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
  await screen.findByText('Bắt đầu thật nhẹ nhàng')
  expect(
    screen.getByText(
      'Chỉ chia sẻ điều bạn thấy an toàn. Bạn có thể chặn và rời đi bất cứ lúc nào.',
    ),
  ).toBeOnTheScreen()
  const send = screen.getByTestId('community-chat-send')
  expect(send).toBeDisabled()
  await fireEvent.changeText(
    screen.getByTestId('community-chat-composer'),
    '   ',
  )
  expect(send).toBeDisabled()
  await fireEvent.changeText(
    screen.getByTestId('community-chat-composer'),
    'Xin chào',
  )
  expect(send).toBeEnabled()
  jest.restoreAllMocks()
})

const other = (index: number) => ({
  ...chatFixtureConversation,
  conversationId: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${index}`,
  unreadCount: 0,
  peers: [
    {
      state: 'AVAILABLE' as const,
      communityProfileId: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${index}`,
      displayName: `Bạn ${index}`,
    },
  ],
})
it('routes each tab-bar tab to its Community panel and leaves chat in place', async () => {
  const api = chatFixtureApi(),
    onTab = jest.fn()
  await mount(
    <CommunityChatInbox
      api={api}
      subject={subject}
      ownId={ownId}
      target={{}}
      onOpen={jest.fn()}
      onBack={jest.fn()}
      onPrivacy={jest.fn()}
      onTab={onTab}
    />,
  )
  await screen.findByText('Mây')
  expect(screen.getByRole('tab', { name: 'Tin nhắn' })).toBeSelected()
  await fireEvent.press(screen.getByRole('tab', { name: 'Bảng tin' }))
  await fireEvent.press(screen.getByRole('tab', { name: 'Viết' }))
  expect(onTab.mock.calls).toEqual([['feed'], ['compose']])
  for (const tab of ['feed', 'moments', 'me', 'compose', 'chat'] as const)
    goCommunityTab(tab)
  expect(jest.mocked(router.replace).mock.calls).toEqual([
    [{ pathname: '/(user)/community', params: { panel: 'feed' } }],
    [{ pathname: '/(user)/community', params: { panel: 'moments' } }],
    [{ pathname: '/(user)/community', params: { panel: 'me' } }],
    [{ pathname: '/(user)/community', params: { panel: 'composer' } }],
  ])
})
it('sends the empty inbox action to the feed tab', async () => {
  const api = chatFixtureApi(),
    onTab = jest.fn()
  jest
    .mocked(api.conversations)
    .mockResolvedValue({ items: [], nextCursor: null })
  await mount(
    <CommunityChatInbox
      api={api}
      subject={subject}
      ownId={ownId}
      target={{}}
      onOpen={jest.fn()}
      onBack={jest.fn()}
      onPrivacy={jest.fn()}
      onTab={onTab}
    />,
  )
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Khám phá bảng tin' }),
  )
  expect(onTab).toHaveBeenCalledWith('feed')
})
it('folds requests and invitations into one strip that opens their cards', async () => {
  const api = chatFixtureApi()
  await inbox(api)
  const strip = await screen.findByRole('button', {
    name: '2 lời mời đang chờ bạn xem',
  })
  expect(
    screen.queryByRole('button', { name: 'Chấp nhận trò chuyện' }),
  ).toBeNull()
  await fireEvent.press(strip)
  expect(
    screen.getByRole('button', { name: 'Chấp nhận trò chuyện' }),
  ).toBeOnTheScreen()
  expect(
    screen.getByRole('button', { name: 'Tham gia nhóm' }),
  ).toBeOnTheScreen()
  expect(
    screen.getAllByText(/Lời mời không chứa nội dung tin nhắn/),
  ).toHaveLength(1)
  await fireEvent.press(screen.getByRole('button', { name: 'Về tin nhắn' }))
  expect(screen.getByRole('button', { name: /^Mở Mây/ })).toBeOnTheScreen()
})
it('hides the pending strip when nothing is waiting', async () => {
  const api = chatFixtureApi()
  jest.mocked(api.requests).mockResolvedValue({ items: [], nextCursor: null })
  jest
    .mocked(api.invitations)
    .mockResolvedValue({ items: [], nextCursor: null })
  await inbox(api)
  await screen.findByText('Mây')
  expect(screen.queryByText(/lời mời đang chờ bạn xem/)).toBeNull()
})
it('omits search for a short list', async () => {
  await inbox(chatFixtureApi())
  await screen.findByText('Mây')
  expect(screen.queryByLabelText('Tìm người hoặc nhóm')).toBeNull()
})
it('filters the loaded rows by kind and by name', async () => {
  const api = chatFixtureApi()
  jest.mocked(api.conversations).mockResolvedValue({
    items: [
      chatFixtureConversation,
      {
        conversationId: other(0).conversationId,
        kind: 'GROUP' as const,
        state: 'ACTIVE' as const,
        groupName: 'Khoảng xanh',
        viewerRole: 'MEMBER' as const,
        peers: [],
        unreadCount: 0,
        version: '1',
      },
      other(1),
      other(2),
      other(3),
      other(4),
    ],
    nextCursor: null,
  })
  await inbox(api)
  await screen.findByText('Khoảng xanh')
  await fireEvent.press(screen.getByRole('button', { name: 'Nhóm' }))
  expect(screen.getByText('Khoảng xanh')).toBeOnTheScreen()
  expect(screen.queryByText('Mây')).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Cá nhân' }))
  expect(screen.queryByText('Khoảng xanh')).toBeNull()
  expect(screen.getByText('Bạn 3')).toBeOnTheScreen()
  await fireEvent.changeText(
    screen.getByLabelText('Tìm người hoặc nhóm'),
    'bạn 3',
  )
  expect(screen.getByText('Bạn 3')).toBeOnTheScreen()
  expect(screen.queryByText('Bạn 2')).toBeNull()
  await fireEvent.changeText(
    screen.getByLabelText('Tìm người hoặc nhóm'),
    'zzz',
  )
  expect(
    screen.getByText(
      'Không có cuộc trò chuyện phù hợp trong danh sách đã tải.',
    ),
  ).toBeOnTheScreen()
})
function conversation(
  api: ReturnType<typeof chatFixtureApi>,
  items: ChatMessage[],
) {
  jest.mocked(api.messages).mockResolvedValue({ items, nextCursor: null })
  return mount(
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
}
it('opens the retract and report sheets on long-press and through the accessibility action', async () => {
  foreground()
  const api = chatFixtureApi()
  await conversation(api, [chatFixtureMessage, ownMessage])
  await screen.findByText('<b>Lời chào an toàn</b>')
  expect(screen.queryByRole('button', { name: 'Gỡ tin nhắn' })).toBeNull()
  const [theirs, mine] = screen.getAllByTestId('community-chat-message')
  await fireEvent(theirs!, 'longPress')
  await fireEvent.press(
    screen.getByRole('button', { name: 'Báo cáo tin nhắn của Mây' }),
  )
  expect(screen.getByText('Lý do báo cáo tin nhắn')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Tin rác' }))
  await waitFor(() =>
    expect(api.report).toHaveBeenCalledWith(id, 'SPAM', expect.any(String)),
  )
  const pressable = (element: typeof mine) => {
    let node = element?.parent
    while (node && !node.props.accessibilityActions) node = node.parent
    return node
  }
  expect(pressable(mine)?.props.accessibilityActions).toEqual([
    { name: 'message-actions', label: 'Gỡ tin nhắn' },
  ])
  expect(pressable(theirs)?.props.accessibilityActions).toEqual([
    { name: 'message-actions', label: 'Báo cáo tin nhắn của Mây' },
  ])
  await fireEvent(mine!, 'accessibilityAction', {
    nativeEvent: { actionName: 'message-actions' },
  })
  expect(screen.getByRole('button', { name: 'Gỡ tin nhắn' })).toBeOnTheScreen()
  jest.restoreAllMocks()
})
it('enters only the message the user just sent, and nothing under reduced motion', async () => {
  foreground()
  const reduce = jest.mocked(useReducedMotion)
  for (const reduced of [false, true]) {
    reduce.mockReturnValue(reduced)
    const api = chatFixtureApi()
    const sent = {
      ...ownMessage,
      messageId: '55555555-5555-4555-8555-555555555555',
      content: 'Vừa gửi',
    }
    jest
      .mocked(api.messages)
      .mockResolvedValueOnce({ items: [chatFixtureMessage], nextCursor: null })
      .mockResolvedValue({
        items: [chatFixtureMessage, sent],
        nextCursor: null,
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
    expect(
      screen.getAllByTestId('community-chat-message-row')[0]?.props.entering,
    ).toBeUndefined()
    await fireEvent.changeText(
      screen.getByTestId('community-chat-composer'),
      'Vừa gửi',
    )
    await fireEvent.press(screen.getByTestId('community-chat-send'))
    await screen.findByText('Vừa gửi')
    const rows = screen.getAllByTestId('community-chat-message-row')
    expect(rows[0]?.props.entering).toBeUndefined()
    if (reduced) expect(rows[1]?.props.entering).toBeUndefined()
    else expect(rows[1]?.props.entering).toBeDefined()
    await view.unmount()
  }
  reduce.mockReturnValue(false)
  jest.restoreAllMocks()
})
it('closes a pending sub-screen on hardware back, then leaves the inbox for the feed', async () => {
  const handlers: Parameters<typeof BackHandler.addEventListener>[1][] = []
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_e, handler) => {
      handlers.push(handler)
      return { remove: jest.fn() }
    })
  const onBack = jest.fn()
  await mount(
    <CommunityChatInbox
      api={chatFixtureApi()}
      subject={subject}
      ownId={ownId}
      target={{}}
      onOpen={jest.fn()}
      onBack={onBack}
      onPrivacy={jest.fn()}
      onTab={jest.fn()}
    />,
  )
  await fireEvent.press(
    await screen.findByRole('button', { name: '2 lời mời đang chờ bạn xem' }),
  )
  expect(screen.getByText('Lời mời đang chờ')).toBeOnTheScreen()
  await act(async () => {
    handlers.at(-1)?.({} as never)
  })
  expect(onBack).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: /^Mở Mây/ })).toBeOnTheScreen()
  await act(async () => {
    handlers.at(-1)?.({} as never)
  })
  expect(onBack).toHaveBeenCalledTimes(1)
  jest.restoreAllMocks()
})
