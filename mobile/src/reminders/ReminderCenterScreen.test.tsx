import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { ApiError } from '@/api/api-error'
import type { AppSession } from '@/auth/session'
import { ReminderCenterScreen } from './ReminderCenterScreen'
import type { ReminderOverview, ReminderSource } from './reminder-model'
import {
  reminderUiFixtureAction,
  reminderUiFixtureOverview,
  reminderUiFixtureSource,
  reminderUiFixtureSubject,
} from './reminder-test-fixtures'

let mockSession: AppSession | null = {
  subject: reminderUiFixtureSubject,
  role: 'USER',
}
let mockFocus: (() => void) | undefined
jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ session: mockSession }),
}))
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => {
    mockFocus = callback
  },
}))

beforeEach(() => {
  mockSession = { subject: reminderUiFixtureSubject, role: 'USER' }
  onlineManager.setOnline(true)
})
afterEach(() => {
  onlineManager.setOnline(true)
})

async function mount(source: ReminderSource = reminderUiFixtureSource()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  const onOpen = jest.fn(),
    onInbox = jest.fn(),
    onPreferences = jest.fn(),
    onBack = jest.fn()
  const tree = () => (
    <QueryClientProvider client={client}>
      <ReminderCenterScreen
        source={source}
        onOpen={onOpen}
        onInbox={onInbox}
        onPreferences={onPreferences}
        onBack={onBack}
      />
    </QueryClientProvider>
  )
  return {
    client,
    source,
    onOpen,
    onInbox,
    onPreferences,
    onBack,
    tree,
    view: await render(tree()),
  }
}

const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }))

it('renders due facts, category and selected date and opens the installed destination', async () => {
  const value = await mount()
  await screen.findByText('Cảm xúc · Cần làm')
  expect(screen.getByText(/22 tháng 10.*Asia\/Ho_Chi_Minh/)).toBeOnTheScreen()
  expect(screen.getByRole('tab', { name: 'Hôm nay' })).toBeSelected()
  await press('Mở: Ghi nhận cảm xúc')
  expect(value.onOpen).toHaveBeenCalledWith({ pathname: '/(user)/emotion' })
})

it('switches to upcoming owner rows without generating new due dates', async () => {
  await mount()
  await screen.findByText('Ghi nhận cảm xúc')
  await fireEvent.press(screen.getByRole('tab', { name: 'Sắp tới' }))
  expect(screen.getByText('Hoạt động ngày mai')).toBeOnTheScreen()
  expect(screen.queryByText('Ghi nhận cảm xúc')).toBeNull()
  expect(screen.getByRole('tab', { name: 'Sắp tới' })).toBeSelected()
})

it.each([
  ['completed', 'Đã hoàn thành'],
  ['skipped', 'Đã bỏ qua'],
  ['rescheduled', 'Đã đổi lịch'],
  ['unavailable', 'Chưa khả dụng'],
] as const)(
  'keeps owner %s facts and never provides a local completion command',
  async (status, label) => {
    const value = await mount(
      reminderUiFixtureSource(
        reminderUiFixtureOverview({
          today: [reminderUiFixtureAction({ status })],
        }),
      ),
    )
    await screen.findByText(`Cảm xúc · ${label}`)
    expect(
      screen.queryByRole('button', { name: 'Đánh dấu hoàn thành' }),
    ).toBeNull()
    if (status === 'unavailable')
      expect(
        screen.queryByRole('button', { name: 'Mở: Ghi nhận cảm xúc' }),
      ).toBeNull()
    expect(value.onOpen).not.toHaveBeenCalled()
  },
)

it.each([
  [
    { state: 'paused' },
    'Lời nhắc đang tạm dừng. Các hoạt động vẫn được giữ nguyên.',
  ],
  [
    { state: 'quiet-hours', start: '22:00', end: '07:00' },
    /giờ yên tĩnh.*22:00–07:00.*Thời điểm gửi lời nhắc có thể thay đổi/,
  ],
  [
    { state: 'available', nextEligibleAt: '2026-10-22T10:00:00+07:00' },
    /Đây không phải xác nhận đã gửi/,
  ],
  [{ state: 'unavailable' }, 'Chưa có thông tin về thời điểm gửi lời nhắc.'],
] as const)(
  'describes delivery fact %j without guaranteeing a send',
  async (delivery, message) => {
    await mount(
      reminderUiFixtureSource(reminderUiFixtureOverview({ delivery })),
    )
    expect(await screen.findByText(message)).toBeOnTheScreen()
  },
)

it('distinguishes empty today and next from completion and unavailable schedule', async () => {
  await mount(
    reminderUiFixtureSource(
      reminderUiFixtureOverview({ today: [], upcoming: [] }),
    ),
  )
  await screen.findByText('Chưa có hoạt động nào trong hôm nay.')
  await fireEvent.press(screen.getByRole('tab', { name: 'Sắp tới' }))
  expect(screen.getByText('Chưa có hoạt động sắp tới.')).toBeOnTheScreen()
  expect(screen.queryByText(/Chưa thể hiển thị lịch nhắc/)).toBeNull()
  expect(screen.queryByText(/Đã hoàn thành/)).toBeNull()
})

it('keeps inbox and preferences usable when schedule is unavailable', async () => {
  const value = await mount(reminderUiFixtureSource({ state: 'unavailable' }))
  await screen.findByText(/Chưa thể hiển thị lịch nhắc/)
  expect(screen.queryByText(/Chưa có hoạt động nào/)).toBeNull()
  await press('Xem thông báo')
  await press('Tùy chọn lời nhắc')
  await press('Về không gian của bạn')
  expect(value.onInbox).toHaveBeenCalledTimes(1)
  expect(value.onPreferences).toHaveBeenCalledTimes(1)
  expect(value.onBack).toHaveBeenCalledTimes(1)
})

it('shows loading without cached rows and replaces state only after the source resolves', async () => {
  let finish!: (overview: ReminderOverview) => void
  const source = {
    read: jest
      .fn()
      .mockResolvedValueOnce(reminderUiFixtureOverview())
      .mockImplementationOnce(
        () =>
          new Promise<ReminderOverview>((resolve) => {
            finish = resolve
          }),
      ),
  }
  await mount(source)
  await screen.findByText('Ghi nhận cảm xúc')
  await press('Tải lại lịch')
  expect(await screen.findByText('Đang tải lịch…')).toBeOnTheScreen()
  expect(screen.queryByText('Ghi nhận cảm xúc')).toBeNull()
  expect(screen.getByRole('button', { name: 'Tải lại lịch' })).toBeDisabled()
  await act(async () =>
    finish(
      reminderUiFixtureOverview({
        today: [reminderUiFixtureAction({ status: 'completed' })],
      }),
    ),
  )
  expect(await screen.findByText('Cảm xúc · Đã hoàn thành')).toBeOnTheScreen()
})

it('hides stale facts after failed refresh and retries explicitly', async () => {
  const source = {
    read: jest
      .fn()
      .mockResolvedValueOnce(reminderUiFixtureOverview())
      .mockRejectedValueOnce(new Error('private provider payload'))
      .mockResolvedValueOnce(reminderUiFixtureOverview({ today: [] })),
  }
  await mount(source)
  await screen.findByText('Ghi nhận cảm xúc')
  await press('Tải lại lịch')
  await screen.findByText('Chưa thể tải lịch của bạn. Vui lòng thử lại.')
  expect(screen.queryByText('Ghi nhận cảm xúc')).toBeNull()
  expect(screen.queryByText('private provider payload')).toBeNull()
  await press('Tải lại lịch')
  await screen.findByText('Chưa có hoạt động nào trong hôm nay.')
  expect(source.read).toHaveBeenCalledTimes(3)
})

it.each([
  [401, 'UNAUTHORIZED', /Phiên đăng nhập đã hết hạn/],
  [403, 'FORBIDDEN', /Tài khoản này chưa thể/],
  [undefined, 'REQUEST_TIMEOUT', /mất quá nhiều thời gian/],
  [undefined, 'NETWORK_ERROR', /Kiểm tra mạng/],
] as const)(
  'handles %s/%s without rendering owner data',
  async (status, code, message) => {
    const source = {
      read: jest.fn().mockRejectedValue(
        new ApiError({
          code,
          message: 'private',
          ...(status ? { status } : {}),
        }),
      ),
    }
    await mount(source)
    expect(await screen.findByText(message)).toBeOnTheScreen()
    expect(screen.queryByText('private')).toBeNull()
    expect(source.read).toHaveBeenCalledTimes(1)
  },
)

it('hides cached actions and disables refresh immediately when offline', async () => {
  await mount()
  await screen.findByText('Ghi nhận cảm xúc')
  await act(async () => onlineManager.setOnline(false))
  expect(screen.getByText(/Bạn đang ngoại tuyến/)).toBeOnTheScreen()
  expect(screen.queryByText('Ghi nhận cảm xúc')).toBeNull()
  expect(screen.getByRole('button', { name: 'Tải lại lịch' })).toBeDisabled()
})

it('does not start a read when initially offline', async () => {
  onlineManager.setOnline(false)
  const value = await mount()
  expect(screen.getByText(/Bạn đang ngoại tuyến/)).toBeOnTheScreen()
  expect(value.source.read).not.toHaveBeenCalled()
})

it('refetches owner facts after returning from an activity', async () => {
  const value = await mount()
  await screen.findByText('Ghi nhận cảm xúc')
  jest.mocked(value.source.read).mockResolvedValue(
    reminderUiFixtureOverview({
      today: [reminderUiFixtureAction({ status: 'completed' })],
    }),
  )
  await act(async () => mockFocus?.())
  expect(await screen.findByText('Cảm xúc · Đã hoàn thành')).toBeOnTheScreen()
})

it.each([
  null,
  { subject: reminderUiFixtureSubject, role: 'SPECIALIST' as const },
])(
  'does not read or display private data for a non-USER session',
  async (session) => {
    mockSession = session
    const value = await mount()
    expect(
      screen.getByText(/Đăng nhập bằng tài khoản cá nhân/),
    ).toBeOnTheScreen()
    expect(value.source.read).not.toHaveBeenCalled()
  },
)

it('cancels an old account read and never shows its late response for another account', async () => {
  let finish!: (overview: ReminderOverview) => void
  let signal: AbortSignal | undefined
  const source = {
    read: jest
      .fn()
      .mockImplementationOnce((value: AbortSignal) => {
        signal = value
        return new Promise<ReminderOverview>((resolve) => {
          finish = resolve
        })
      })
      .mockResolvedValueOnce({ state: 'unavailable' }),
  }
  const value = await mount(source)
  mockSession = {
    subject: '22222222-2222-4222-8222-222222222222',
    role: 'USER',
  }
  await value.view.rerender(value.tree())
  await screen.findByText(/Chưa thể hiển thị lịch nhắc/)
  expect(signal?.aborted).toBe(true)
  await act(async () => finish(reminderUiFixtureOverview()))
  expect(screen.queryByText('Ghi nhận cảm xúc')).toBeNull()
})

it('aborts an in-flight read on unmount', async () => {
  const signals: AbortSignal[] = []
  const value = await mount({
    read: (signal) => {
      signals.push(signal)
      return new Promise(() => {})
    },
  })
  await waitFor(() => expect(signals).toHaveLength(1))
  await value.view.unmount()
  expect(signals[0]?.aborted).toBe(true)
})
