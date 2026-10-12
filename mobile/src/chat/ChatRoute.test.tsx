import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { AppState } from 'react-native'
import type { AppSession } from '@/auth/session'
import { ChatRoute } from './ChatRoute'
import {
  appointmentId,
  eligibility,
  fixtureApi,
  TestSocket as MockTestSocket,
  user,
  specialist,
  uuid,
} from './chat-fixtures'
const mockApi = fixtureApi()
const mockSockets: MockTestSocket[] = []
let mockSession: AppSession | null = { subject: user, role: 'USER' }
let mockParams: { appointmentId?: string } = { appointmentId }
const mockAbort = jest.fn()
const mockEject = jest.fn()
const mockList = jest.fn().mockResolvedValue({
  items: [],
  count: 0,
  generatedAt: eligibility.serverTime,
})
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => mockParams,
}))
jest.mock('@/auth/session-context', () => ({
  useSession: () => ({
    session: mockSession,
    status: mockSession ? 'authenticated' : 'unauthenticated',
  }),
}))
jest.mock('@/config/runtime-config-context', () => ({
  useRuntimeConfig: () => ({
    apiBaseUrl: 'https://edge.test',
    apiTimeoutMs: 5000,
  }),
}))
jest.mock('@/api/api-client', () => ({
  createApiClient: () => ({
    interceptors: {
      request: {
        use: (listener: (request: { signal?: AbortSignal }) => unknown) => {
          const request: { signal?: AbortSignal } = {}
          listener(request)
          request.signal?.addEventListener('abort', mockAbort)
          return 1
        },
        eject: mockEject,
      },
    },
  }),
}))
jest.mock('./chat-api', () => ({
  createChatApi: () => mockApi,
  createChatAppointmentsApi: () => ({ list: mockList }),
}))
jest.mock('./chat-socket', () => ({
  createChatSocketFactory: () => () => {
    const socket = new MockTestSocket()
    mockSockets.push(socket)
    return socket
  },
}))
beforeEach(() => {
  mockSession = { subject: user, role: 'USER' }
  mockParams = { appointmentId }
  mockSockets.length = 0
  jest.clearAllMocks()
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'active',
  })
  jest.mocked(mockApi.eligibility).mockResolvedValue({ ...eligibility })
  jest
    .mocked(mockApi.history)
    .mockResolvedValue({ items: [], nextCursor: null, hasMore: false })
})
async function route() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const element = () => (
    <QueryClientProvider client={client}>
      <ChatRoute />
    </QueryClientProvider>
  )
  return { view: await render(element()), element }
}
it('identity change on the mounted route releases old socket/HTTP and clears draft', async () => {
  const value = await route()
  await waitFor(() => expect(mockSockets).toHaveLength(1))
  await act(async () => {
    mockSockets[0]!.ready()
  })
  await fireEvent.changeText(
    await screen.findByLabelText('Tin nhắn tư vấn'),
    'old account draft',
  )
  mockSession = { subject: specialist, role: 'SPECIALIST' }
  await value.view.rerender(value.element())
  await waitFor(() => expect(mockSockets).toHaveLength(2))
  await act(async () => {
    mockSockets[1]!.ready(specialist, 'SPECIALIST')
  })
  expect(await screen.findByLabelText('Tin nhắn tư vấn')).toHaveDisplayValue('')
  expect(mockSockets[0]!.disconnect).toHaveBeenCalled()
  expect(mockAbort).toHaveBeenCalled()
  expect(mockEject).toHaveBeenCalled()
  await value.view.unmount()
})
it('appointment change remounts volatile state; foreign late frames cannot populate new route', async () => {
  const value = await route()
  await waitFor(() => expect(mockSockets).toHaveLength(1))
  mockParams = { appointmentId: uuid() }
  jest.mocked(mockApi.eligibility).mockResolvedValue({
    ...eligibility,
    appointmentId: mockParams.appointmentId!,
    conversationId: mockParams.appointmentId!,
  })
  await value.view.rerender(value.element())
  await waitFor(() => expect(mockSockets).toHaveLength(2))
  expect(mockSockets[0]!.disconnect).toHaveBeenCalled()
  mockSockets[0]!.ready()
  await act(async () => {
    mockSockets[1]!.ready()
  })
  expect(await screen.findByLabelText('Tin nhắn tư vấn')).toHaveDisplayValue('')
  await value.view.unmount()
})
it('missing session and malformed link never open socket or private list', async () => {
  mockSession = null
  const value = await route()
  expect(screen.getByText(/Vui lòng đăng nhập/)).toBeTruthy()
  expect(mockSockets).toHaveLength(0)
  mockSession = { subject: user, role: 'USER' }
  mockParams = { appointmentId: 'invalid' }
  await value.view.rerender(value.element())
  expect(screen.getByText('Liên kết lịch hẹn không hợp lệ.')).toBeTruthy()
  expect(mockList).not.toHaveBeenCalled()
  await value.view.unmount()
})
it('empty owner appointment list is explicit and does not grant a chat session', async () => {
  mockParams = {}
  const value = await route()
  expect(
    await screen.findByText('Chưa có lịch tư vấn qua trò chuyện.'),
  ).toBeTruthy()
  expect(mockSockets).toHaveLength(0)
  await value.view.unmount()
})
