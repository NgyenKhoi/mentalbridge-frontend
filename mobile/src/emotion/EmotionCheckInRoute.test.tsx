import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { EmotionCheckInRoute } from './EmotionCheckInRoute'
import {
  nativeIds,
  nativeOccurrence,
  nativePlan,
} from '@/support-plan/native-plan-test-fixtures'

const mockPush = jest.fn(),
  mockCurrent = jest.fn(),
  mockOccurrences = jest.fn()
let mockParams: Record<string, unknown> = {}
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  router: { push: (x: unknown) => mockPush(x) },
}))
jest.mock('@/auth/session-context', () => ({
  useSession: () => ({
    session: { subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role: 'USER' },
  }),
}))
jest.mock('@/config/runtime-config-context', () => ({
  useRuntimeConfig: () => ({
    apiBaseUrl: 'http://localhost',
    apiTimeoutMs: 1000,
  }),
}))
jest.mock('@/api/api-client', () => ({ createApiClient: () => ({}) }))
jest.mock('@/security/credential-store', () => ({
  secureCredentialStore: { getAccessToken: jest.fn() },
}))
jest.mock('@/support-plan/support-plan-action-api', () => ({
  createSupportPlanActionApi: () => ({
    getCurrent: () => mockCurrent(),
    getOccurrences: (a: string, b: string) => mockOccurrences(a, b),
  }),
}))
jest.mock('./emotion-api', () => ({ createEmotionApi: () => ({}) }))
jest.mock('./EmotionCheckInScreen', () => ({
  EmotionCheckInScreen: ({
    timezone,
    planOrigin,
  }: {
    timezone?: string
    planOrigin?: { title: string }
  }) => {
    const { Text } = jest.requireActual('react-native')
    return (
      <Text>
        {planOrigin
          ? `Canonical form · ${timezone} · ${planOrigin.title}`
          : 'Canonical ordinary form'}
      </Text>
    )
  },
}))
async function mount() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: Infinity } },
        })
      }
    >
      <EmotionCheckInRoute />
    </QueryClientProvider>,
  )
}
beforeEach(() => {
  jest.clearAllMocks()
  mockParams = {}
  mockCurrent.mockResolvedValue(nativePlan())
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  mockOccurrences.mockResolvedValue({
    supportPlanId: nativeIds.plan,
    supportPlanStatus: 'ACTIVE',
    representationMode: 'NATIVE_V3',
    occurrences: [nativeOccurrence({ localDate })],
  })
})
it('keeps the ordinary canonical route independent of plan reads', async () => {
  await mount()
  await screen.findByText('Canonical ordinary form')
  expect(mockCurrent).not.toHaveBeenCalled()
})
it('uses authenticated owner schedule zone, never supplied query timezone/day', async () => {
  mockParams = {
    occurrenceId: nativeIds.occurrence,
    actionId: nativeIds.action,
    timezone: 'Invalid/Injected',
    localDate: '1900-01-01',
  }
  await mount()
  await screen.findByText(
    'Canonical form · Asia/Ho_Chi_Minh · Dành một phút nhìn lại cảm xúc',
  )
})
it('rejects malformed origin and returns safely without calling owner lookup', async () => {
  mockParams = {
    occurrenceId: [nativeIds.occurrence],
    actionId: nativeIds.action,
  }
  await mount()
  await screen.findByText(/Không xác định được hoạt động vừa mở/)
  expect(mockCurrent).not.toHaveBeenCalled()
  await fireEvent.press(
    screen.getByRole('button', { name: 'Quay lại kế hoạch' }),
  )
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(user)/support-plan',
    params: {},
  })
})
it('blocks non-today origin without backdating and keeps exact return IDs', async () => {
  mockParams = {
    occurrenceId: nativeIds.occurrence,
    actionId: nativeIds.action,
  }
  mockOccurrences.mockResolvedValue({
    supportPlanId: nativeIds.plan,
    supportPlanStatus: 'ACTIVE',
    representationMode: 'NATIVE_V3',
    occurrences: [nativeOccurrence({ localDate: '1900-01-01' })],
  })
  await mount()
  await screen.findByText(/Hoạt động này không thuộc hôm nay/)
  await fireEvent.press(
    screen.getByRole('button', { name: 'Quay lại kế hoạch' }),
  )
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(user)/support-plan',
    params: mockParams,
  })
})
it('dependency outage is not reported as a missing check-in and has local retry', async () => {
  mockParams = {
    occurrenceId: nativeIds.occurrence,
    actionId: nativeIds.action,
  }
  mockCurrent.mockRejectedValue(new Error('Unavailable'))
  await mount()
  await screen.findByText(/Chưa thể xác nhận hoạt động vừa mở/)
  expect(
    screen.getByRole('button', { name: 'Thử tải lại hoạt động' }),
  ).toBeTruthy()
  expect(screen.queryByText(/Canonical form/)).toBeNull()
})
