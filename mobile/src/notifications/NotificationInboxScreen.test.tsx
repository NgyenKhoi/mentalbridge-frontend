import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { ApiError } from '@/api/api-error'
import type { AppSession } from '@/auth/session'
import { NotificationInboxScreen } from './NotificationInboxScreen'
import {
  date,
  fixtureApi,
  notification,
  notificationId,
  page,
  subject,
  targetId,
} from './notification-fixtures'
import type { NotificationApi } from './notification-api'
let mockSession: AppSession | null = { subject, role: 'USER' }
jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ session: mockSession }),
}))
beforeEach(() => {
  mockSession = { subject, role: 'USER' }
})
async function mount(
  api = fixtureApi(),
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  }),
) {
  const onOpen = jest.fn(),
    onBack = jest.fn(),
    onPreferences = jest.fn()
  const tree = () => (
    <QueryClientProvider client={client}>
      <NotificationInboxScreen
        api={api}
        onOpen={onOpen}
        onBack={onBack}
        onPreferences={onPreferences}
      />
    </QueryClientProvider>
  )
  return {
    view: await render(tree()),
    client,
    tree,
    onOpen,
    onBack,
    onPreferences,
  }
}
const press = (label: string) =>
  fireEvent.press(screen.getByRole('button', { name: label }))
it('opens a fresh Community conversation descriptor after Content confirms mark-read', async () => {
  const item = notification({
    kind: 'COMMUNITY_MESSAGE',
    title: 'Cập nhật cộng đồng',
    action: {
      type: 'OPEN_COMMUNITY_CONVERSATION',
      targetId,
      href: `/community/chat/conversations/${targetId}`,
    },
  })
  const read = { ...item, read: true, readAt: date }
  const api = fixtureApi({
    list: jest
      .fn()
      .mockResolvedValueOnce(page([item]))
      .mockResolvedValue(page([read])),
    markRead: jest.fn().mockResolvedValue(read),
  })
  const value = await mount(api)
  await screen.findByText('1 thông báo chưa đọc')
  await press('Mở: Cập nhật cộng đồng')
  await waitFor(() =>
    expect(value.onOpen).toHaveBeenCalledWith({
      pathname: '/(user)/community-chat',
      params: { conversationId: targetId },
    }),
  )
  await screen.findByText('0 thông báo chưa đọc')
})
it('opens only the fresh mark-read action, persists read and reloads the server inbox', async () => {
  const read = notification({
    read: true,
    readAt: date,
    action: {
      type: 'OPEN_APPOINTMENTS',
      href: '/appointments',
      targetId: null,
    },
  })
  const api = fixtureApi({
    list: jest
      .fn()
      .mockResolvedValueOnce(page())
      .mockResolvedValue(page([read])),
    markRead: jest.fn().mockResolvedValue(read),
  })
  const value = await mount(api)
  await screen.findByText('1 thông báo chưa đọc')
  await press('Mở: Lời nhắc của bạn')
  await waitFor(() =>
    expect(value.onOpen).toHaveBeenCalledWith({
      pathname: '/(user)/appointments',
    }),
  )
  expect(api.markRead).toHaveBeenCalledWith(notificationId)
  expect(await screen.findByText('0 thông báo chưa đọc')).toBeOnTheScreen()
  await value.view.unmount()
  await mount(api)
  expect(await screen.findByText('0 thông báo chưa đọc')).toBeOnTheScreen()
})
it('marks all read only after server command and refresh', async () => {
  const api = fixtureApi({
    list: jest
      .fn()
      .mockResolvedValueOnce(page())
      .mockResolvedValue(page([notification({ read: true, readAt: date })])),
  })
  await mount(api)
  await screen.findByText('1 thông báo chưa đọc')
  await press('Đánh dấu tất cả đã đọc')
  expect(await screen.findByText('0 thông báo chưa đọc')).toBeOnTheScreen()
  expect(api.markAllRead).toHaveBeenCalledTimes(1)
})
it('requests the next server page only on explicit pagination', async () => {
  const api = fixtureApi({
    list: jest
      .fn()
      .mockResolvedValueOnce(page([notification()], 'opaque_next'))
      .mockResolvedValueOnce(
        page([notification({ id: targetId, title: 'Cập nhật cũ' })]),
      ),
  })
  await mount(api)
  await screen.findByText('1 thông báo chưa đọc')
  expect(api.list).toHaveBeenCalledTimes(1)
  await press('Xem thông báo cũ hơn')
  expect(await screen.findByText('Cập nhật cũ')).toBeOnTheScreen()
  expect(api.list).toHaveBeenLastCalledWith('opaque_next')
})
it('does not open a gone notification and removes its stale content after refresh', async () => {
  const api = fixtureApi({
    list: jest.fn().mockResolvedValueOnce(page()).mockResolvedValue(page([])),
    markRead: jest.fn().mockRejectedValue(
      new ApiError({
        code: 'NOTIFICATION_GONE',
        status: 410,
        message: 'gone',
      }),
    ),
  })
  const value = await mount(api)
  await screen.findByText('1 thông báo chưa đọc')
  await press('Mở: Lời nhắc của bạn')
  expect(
    await screen.findByText('Thông báo hoặc nội dung này không còn khả dụng.'),
  ).toBeOnTheScreen()
  expect(screen.queryByText('Lời nhắc của bạn')).toBeNull()
  expect(value.onOpen).not.toHaveBeenCalled()
})
it('keeps malformed links inert while still supporting mark-read', async () => {
  const api = fixtureApi({
    list: jest.fn().mockResolvedValue(
      page([
        notification({
          action: {
            type: 'OPEN_JOURNAL',
            targetId: null,
            href: '//evil.invalid',
          },
        }),
      ]),
    ),
  })
  const value = await mount(api)
  expect(
    await screen.findByText('Liên kết này chưa khả dụng trong ứng dụng.'),
  ).toBeOnTheScreen()
  expect(
    screen.queryByRole('button', { name: 'Mở: Lời nhắc của bạn' }),
  ).toBeNull()
  expect(value.onOpen).not.toHaveBeenCalled()
})
it.each([401, 403, 503])(
  'hides cached inbox after authoritative failure %s and allows safe retry',
  async (status) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    })
    client.setQueryData(['notifications', subject, 'inbox'], {
      pages: [page()],
      pageParams: [undefined],
    })
    const api = fixtureApi({
      list: jest
        .fn()
        .mockRejectedValueOnce(
          new ApiError({ code: 'FAILED', status, message: 'failure' }),
        )
        .mockResolvedValueOnce(page([])),
    })
    await mount(api, client)
    await screen.findByRole('alert')
    expect(screen.queryByText('Lời nhắc của bạn')).toBeNull()
    await press('Tải lại thông báo')
    expect(await screen.findByText(/Chưa có thông báo/)).toBeOnTheScreen()
  },
)
it('does not mark read optimistically after dependency failure', async () => {
  const api = fixtureApi({
    markAllRead: jest.fn().mockRejectedValue(new Error('down')),
  })
  await mount(api)
  await screen.findByText('1 thông báo chưa đọc')
  await press('Đánh dấu tất cả đã đọc')
  await screen.findByText(/Chưa thể hoàn tất thao tác/)
  expect(screen.getByText('1 thông báo chưa đọc')).toBeOnTheScreen()
})
it('prevents a late old-account action from navigating after subject changes', async () => {
  let complete!: (
    item: Awaited<ReturnType<NotificationApi['markRead']>>,
  ) => void
  const result = new Promise<Awaited<ReturnType<NotificationApi['markRead']>>>(
    (resolve) => {
      complete = resolve
    },
  )
  const api = fixtureApi({
    markRead: jest.fn().mockReturnValue(result),
    list: jest.fn().mockResolvedValueOnce(page()).mockResolvedValue(page([])),
  })
  const value = await mount(api)
  await screen.findByText('1 thông báo chưa đọc')
  await press('Mở: Lời nhắc của bạn')
  mockSession = { subject: targetId, role: 'USER' }
  await value.view.rerender(value.tree())
  await screen.findByText(/Chưa có thông báo/)
  await act(async () => complete(notification({ read: true, readAt: date })))
  expect(value.onOpen).not.toHaveBeenCalled()
})
it('keeps preference and back navigation usable for an empty inbox', async () => {
  const value = await mount(
    fixtureApi({ list: jest.fn().mockResolvedValue(page([])) }),
  )
  await screen.findByText(/Chưa có thông báo/)
  await press('Tùy chọn nhận thông báo')
  await press('Về không gian của bạn')
  expect(value.onPreferences).toHaveBeenCalled()
  expect(value.onBack).toHaveBeenCalled()
})
