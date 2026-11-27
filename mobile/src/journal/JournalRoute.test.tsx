import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { Alert, type AlertButton } from 'react-native'

import type { JournalPlanOrigin } from '@/support-plan/journal-plan-context'
import type { JournalNavigationState } from './JournalEditor'
import { JournalRoute } from './JournalRoute'

const mockDismiss = jest.fn()
const mockDispatch = jest.fn()
const mockPrevent = jest.fn()
const mockClient = {
  interceptors: { request: { use: jest.fn(() => 1), eject: jest.fn() } },
}
let mockParams: Record<string, unknown> = {}
let mockSubject = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const returned: JournalPlanOrigin = {
  source: 'journal',
  occurrenceId: '30000000-0000-4000-8000-000000000642',
  actionId: '20000000-0000-4000-8000-000000000642',
  localDate: '2026-10-13',
  journalId: '60000000-0000-4000-8000-000000000642',
}

jest.mock('expo-router', () => ({
  router: {
    dismissTo: (value: unknown) => mockDismiss(value),
    back: jest.fn(),
  },
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ dispatch: mockDispatch }),
  Stack: { Screen: () => null },
}))
jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: (active: boolean, callback: unknown) =>
    mockPrevent(active, callback),
}))
jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ session: { subject: mockSubject, role: 'USER' } }),
}))
jest.mock('@/config/runtime-config-context', () => ({
  useRuntimeConfig: () => ({
    apiBaseUrl: 'https://private.test',
    apiTimeoutMs: 5000,
  }),
}))
jest.mock('@/api/api-client', () => ({ createApiClient: () => mockClient }))
jest.mock('@/security/credential-store', () => ({
  secureCredentialStore: { getAccessToken: jest.fn() },
}))
jest.mock('./journal-api', () => ({ createJournalApi: () => ({}) }))
jest.mock('@/support-plan/support-plan-action-api', () => ({
  createSupportPlanActionApi: () => ({}),
}))
jest.mock('./JournalScreen', () => ({
  JournalScreen: (props: {
    onNavigationStateChange: (value: JournalNavigationState) => void
    onReturnToPlan: (value: JournalPlanOrigin) => void
  }) => {
    const { Pressable, Text, View } = jest.requireActual('react-native')
    return (
      <View>
        <Pressable
          onPress={() =>
            props.onNavigationStateChange({
              dirty: true,
              busy: false,
              uncertain: false,
            })
          }
        >
          <Text>Dirty</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            props.onNavigationStateChange({
              dirty: true,
              busy: true,
              uncertain: false,
            })
          }
        >
          <Text>Busy</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            props.onNavigationStateChange({
              dirty: true,
              busy: false,
              uncertain: true,
            })
          }
        >
          <Text>Uncertain</Text>
        </Pressable>
        <Pressable onPress={() => props.onReturnToPlan(returned)}>
          <Text>Return</Text>
        </Pressable>
      </View>
    )
  },
}))

function preventCallback() {
  return mockPrevent.mock.calls.at(-1)![1] as (value: {
    data: { action: { type: string } }
  }) => void
}
beforeEach(() => {
  jest.clearAllMocks()
  mockParams = {}
  mockSubject = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
})
afterEach(() => jest.restoreAllMocks())

it('blocks native stack removal while dirty, asks before discard, and only dispatches the original confirmed action', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  await render(<JournalRoute />)
  await fireEvent.press(screen.getByText('Dirty'))
  expect(mockPrevent.mock.calls.at(-1)![0]).toBe(true)
  const action = { type: 'GO_BACK' }
  preventCallback()({ data: { action } })
  expect(mockDispatch).not.toHaveBeenCalled()
  const buttons = alert.mock.calls.at(-1)![2] as AlertButton[]
  expect(buttons[0]!.style).toBe('cancel')
  buttons[1]!.onPress?.()
  expect(mockDispatch).toHaveBeenCalledWith(action)
})
it('a pending save cannot dispatch a discard action and uncertain saves keep the navigation guard', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  await render(<JournalRoute />)
  await fireEvent.press(screen.getByText('Busy'))
  preventCallback()({ data: { action: { type: 'GO_BACK' } } })
  expect(alert).toHaveBeenLastCalledWith(
    'Đang lưu hoặc kiểm tra',
    expect.any(String),
  )
  expect(mockDispatch).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByText('Uncertain'))
  expect(mockPrevent.mock.calls.at(-1)![0]).toBe(true)
  preventCallback()({ data: { action: { type: 'GO_BACK' } } })
  expect(alert).toHaveBeenLastCalledWith(
    'Rời bài viết?',
    expect.stringContaining('Lần lưu chưa được xác nhận'),
    expect.any(Array),
  )
})
it('an explicit checked return dismisses to the fixed plan route with metadata only', async () => {
  await render(<JournalRoute />)
  await fireEvent.press(screen.getByText('Return'))
  await waitFor(() =>
    expect(mockDismiss).toHaveBeenCalledWith({
      pathname: '/(user)/support-plan',
      params: returned,
    }),
  )
  expect(mockPrevent.mock.calls.at(-1)![0]).toBe(false)
})
