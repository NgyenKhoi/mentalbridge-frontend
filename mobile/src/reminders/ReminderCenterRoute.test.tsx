import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { ApiError } from '@/api/api-error'
import { reminderUiFixtureResponse } from './reminder-test-fixtures'
import { ReminderCenterEntry, ReminderCenterRoute } from './ReminderCenterRoute'

const mockPush = jest.fn(),
  mockBack = jest.fn()
const mockGet = jest.fn()
jest.mock('@/config/runtime-config-context', () => ({
  useRuntimeConfig: () => ({
    apiBaseUrl: 'https://edge.test.invalid',
    apiTimeoutMs: 5000,
  }),
}))
jest.mock('@/api/api-client', () => ({
  createApiClient: () => ({ get: (...args: unknown[]) => mockGet(...args) }),
}))
jest.mock('@/security/credential-store', () => ({
  secureCredentialStore: { getAccessToken: jest.fn() },
}))
jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    back: () => mockBack(),
  },
  useFocusEffect: jest.fn(),
}))
jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ session: { subject: 'user-a', role: 'USER' } }),
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockRejectedValue(
    new ApiError({ code: 'HTTP_404', status: 404, message: 'not deployed' }),
  )
})

it('reads A2 and shows factual delivery history separately from activity completion', async () => {
  mockGet.mockResolvedValue({ data: reminderUiFixtureResponse() })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  await render(
    <QueryClientProvider client={client}>
      <ReminderCenterRoute />
    </QueryClientProvider>,
  )
  await screen.findByText('Nhật ký · Cần làm')
  expect(mockGet).toHaveBeenCalledWith('/api/v1/reminder-overview', {
    signal: expect.any(AbortSignal),
  })
  await fireEvent.press(
    screen.getByRole('button', { name: 'Mở: Viết nhật ký' }),
  )
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(user)/journal' })
  await fireEvent.press(screen.getByRole('tab', { name: 'Sắp tới' }))
  expect(screen.getByText('Tổng hợp việc hôm nay')).toBeOnTheScreen()
  expect(
    screen.getByText(/Ghi nhận gần nhất: Gửi chưa thành công/),
  ).toBeOnTheScreen()
  expect(
    screen.getByText(/Lịch nhắc chưa hỗ trợ: Kế hoạch hỗ trợ/),
  ).toBeOnTheScreen()
  expect(screen.queryByText('Chưa có hoạt động sắp tới.')).toBeNull()
})

it('opens the protected reminder route from the feature-local Home entry', async () => {
  await render(<ReminderCenterEntry />)
  await fireEvent.press(
    screen.getByRole('button', { name: 'Hôm nay và lời nhắc' }),
  )
  expect(mockPush).toHaveBeenCalledWith('/(user)/reminders')
})

it('ships no demonstration rows and reuses existing inbox/preferences navigation', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  await render(
    <QueryClientProvider client={client}>
      <ReminderCenterRoute />
    </QueryClientProvider>,
  )
  await screen.findByText(/Chưa thể hiển thị lịch nhắc/)
  expect(screen.queryByText('Ghi nhận cảm xúc')).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Xem thông báo' }))
  await fireEvent.press(
    screen.getByRole('button', { name: 'Tùy chọn lời nhắc' }),
  )
  await fireEvent.press(
    screen.getByRole('button', { name: 'Về không gian của bạn' }),
  )
  expect(mockPush.mock.calls).toEqual([
    ['/(user)/notifications'],
    ['/(user)/notification-preferences'],
  ])
  expect(mockBack).toHaveBeenCalledTimes(1)
})
