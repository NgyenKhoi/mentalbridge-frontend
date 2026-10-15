import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { AppSession } from '@/auth/session'
import { fixtureApi, page, subject, targetId } from './notification-fixtures'
import { NotificationRoute } from './NotificationRoute'
const mockApi = fixtureApi()
let mockSession: AppSession | null = { subject, role: 'USER' }
let mockFocus: (() => void) | undefined
const mockAbort = jest.fn(),
  mockEject = jest.fn(),
  mockPush = jest.fn()
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), back: jest.fn() },
  useFocusEffect: (callback: () => void) => {
    mockFocus = callback
  },
}))
jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ session: mockSession }),
}))
jest.mock('@/config/runtime-config-context', () => ({
  useRuntimeConfig: () => ({
    apiBaseUrl: 'https://edge.invalid',
    apiTimeoutMs: 5000,
  }),
}))
jest.mock('@/api/api-client', () => ({
  createApiClient: () => ({
    interceptors: {
      request: {
        use: (callback: (request: { signal?: AbortSignal }) => unknown) => {
          const request: { signal?: AbortSignal } = {}
          callback(request)
          request.signal?.addEventListener('abort', mockAbort)
          return 1
        },
        eject: (...args: unknown[]) => mockEject(...args),
      },
    },
  }),
}))
jest.mock('./notification-api', () => ({
  createNotificationApi: () => mockApi,
}))
beforeEach(() => {
  mockSession = { subject, role: 'USER' }
  jest.clearAllMocks()
  jest.mocked(mockApi.list).mockResolvedValue(page())
})
async function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  const tree = () => (
    <QueryClientProvider client={client}>
      <NotificationRoute />
    </QueryClientProvider>
  )
  return { view: await render(tree()), tree }
}
it('refetches persisted inbox when returning to the focused route without a remount', async () => {
  await mount()
  await screen.findByText('1 thông báo chưa đọc')
  jest.mocked(mockApi.list).mockResolvedValue(page([]))
  await act(async () => mockFocus?.())
  expect(await screen.findByText(/Chưa có thông báo/)).toBeOnTheScreen()
  expect(mockApi.list).toHaveBeenCalledTimes(2)
})
it('aborts old-subject requests and detaches credentials on identity change and unmount', async () => {
  const value = await mount()
  await screen.findByText('1 thông báo chưa đọc')
  mockSession = { subject: targetId, role: 'USER' }
  await value.view.rerender(value.tree())
  expect(mockAbort).toHaveBeenCalledTimes(1)
  expect(mockEject).toHaveBeenCalledWith(1)
  await value.view.unmount()
  expect(mockAbort).toHaveBeenCalledTimes(2)
})
it('opens preferences without leaking a service URL or notification payload into navigation', async () => {
  await mount()
  await fireEvent.press(
    screen.getByRole('button', { name: 'Tùy chọn nhận thông báo' }),
  )
  expect(mockPush).toHaveBeenCalledWith('./notification-preferences')
})
