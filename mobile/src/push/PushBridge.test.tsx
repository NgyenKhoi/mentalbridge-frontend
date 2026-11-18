import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, waitFor } from '@testing-library/react-native'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { AppState } from 'react-native'

import { RuntimeConfigProvider } from '@/config/runtime-config-context'

import { PushBridge } from './PushBridge'
import { PUSH_STATE_KEY } from './push-constants'
import { refreshPushOnStart } from './push-registration'

const mockSession = {
  status: 'restoring' as string,
  session: null as { subject: string; role: 'USER' | 'SPECIALIST' } | null,
}
jest.mock('@/auth/session-context', () => ({
  useSession: () => mockSession,
}))
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }))
const mockMarkRead = jest.fn()
jest.mock('@/notifications/notification-api', () => ({
  createNotificationApi: () => ({
    markRead: (id: string) => mockMarkRead(id),
  }),
}))
jest.mock('./push-registration', () => ({
  ensurePushChannel: jest.fn(async () => undefined),
  refreshPushOnStart: jest.fn(async () => 'ENABLED'),
}))

const notificationId = '3f1c8a52-4a5b-4a3e-9d2e-0c6f4f0a1b11'
const config = { apiBaseUrl: 'https://api.test', apiTimeoutMs: 1000 }
const push = jest.mocked(router.navigate)
const lastResponse = jest.mocked(Notifications.getLastNotificationResponse)
const addResponseListener = jest.mocked(
  Notifications.addNotificationResponseReceivedListener,
)
const addTokenListener = jest.mocked(Notifications.addPushTokenListener)

const appointmentId = '9b2f6d1e-7c3a-4e58-8a41-5d0e2b7c9f33'
const tap = (data: unknown, identifier = 'n-1') =>
  ({
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    notification: { date: 0, request: { identifier, content: { data } } },
  }) as unknown as Notifications.NotificationResponse
const emotionTap = tap({
  notificationId,
  kind: 'EMOTION_CHECKIN_REMINDER',
  action: null,
})

let queryClient: QueryClient
function wrapper({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <RuntimeConfigProvider value={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </RuntimeConfigProvider>
  )
}
function signIn(role: 'USER' | 'SPECIALIST' = 'USER') {
  mockSession.status = 'authenticated'
  mockSession.session = { subject: 'account-1', role }
}
const emitTap = (response: Notifications.NotificationResponse) =>
  act(() => {
    addResponseListener.mock.calls.at(-1)?.[0](response)
  })

beforeEach(() => {
  jest.clearAllMocks()
  jest.useRealTimers()
  queryClient = new QueryClient()
  mockSession.status = 'restoring'
  mockSession.session = null
  lastResponse.mockReturnValue(null)
  mockMarkRead.mockResolvedValue({})
})

afterEach(() => queryClient.clear())

describe('PushBridge', () => {
  it('holds a cold-start tap until the session is authenticated, then routes and marks read', async () => {
    lastResponse.mockReturnValue(emotionTap)
    const view = await render(<PushBridge />, { wrapper })

    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()

    signIn()
    await view.rerender(<PushBridge />)

    expect(push).toHaveBeenCalledWith({
      pathname: '/(user)/user',
      params: { focus: 'emotion' },
    })
    expect(mockMarkRead).toHaveBeenCalledWith(notificationId)
  })

  it('routes an appointment reminder tap to appointments and marks it read', async () => {
    signIn()
    await render(<PushBridge />, { wrapper })
    await emitTap(
      tap({
        notificationId,
        kind: 'APPOINTMENT',
        action: {
          type: 'OPEN_APPOINTMENT',
          targetId: appointmentId,
          href: `/appointments/${appointmentId}`,
        },
      }),
    )

    expect(push).toHaveBeenCalledWith({
      pathname: '/(user)/appointments',
      params: { appointmentId },
    })
    expect(mockMarkRead).toHaveBeenCalledWith(notificationId)
  })

  it('drops a tap that arrives while signed out', async () => {
    mockSession.status = 'unauthenticated'
    const view = await render(<PushBridge />, { wrapper })
    await emitTap(emotionTap)

    signIn()
    await view.rerender(<PushBridge />)

    expect(push).not.toHaveBeenCalled()
    expect(mockMarkRead).not.toHaveBeenCalled()
  })

  it('opens the inbox for malformed data without marking anything read', async () => {
    signIn('SPECIALIST')
    await render(<PushBridge />, { wrapper })
    await emitTap(tap({ nope: true }))

    expect(push).toHaveBeenCalledWith({
      pathname: '/(specialist)/notifications',
    })
    expect(mockMarkRead).not.toHaveBeenCalled()
  })

  it('routes one tap once even if cold start and listener both deliver it', async () => {
    signIn()
    lastResponse.mockReturnValue(emotionTap)
    await render(<PushBridge />, { wrapper })
    await emitTap(emotionTap)

    expect(push).toHaveBeenCalledTimes(1)
    expect(mockMarkRead).toHaveBeenCalledTimes(1)
  })

  it('retries navigation until the root navigator is ready', async () => {
    jest.useFakeTimers()
    signIn()
    push.mockImplementationOnce(() => {
      throw new Error('Attempted to navigate before mounting the Root Layout')
    })
    lastResponse.mockReturnValue(emotionTap)
    await render(<PushBridge />, { wrapper })
    expect(push).toHaveBeenCalledTimes(1)

    await act(async () => {
      jest.advanceTimersByTime(100)
    })
    expect(push).toHaveBeenCalledTimes(2)
  })

  it('refreshes the device on start and on token rotation, caching the state', async () => {
    signIn()
    jest.mocked(refreshPushOnStart).mockResolvedValue('DENIED')
    await render(<PushBridge />, { wrapper })

    await waitFor(() =>
      expect(queryClient.getQueryData(PUSH_STATE_KEY)).toBe('DENIED'),
    )
    expect(refreshPushOnStart).toHaveBeenCalledTimes(1)

    await act(async () => {
      addTokenListener.mock.calls.at(-1)?.[0]({
        type: 'android',
        data: 'token-a',
      })
    })
    expect(refreshPushOnStart).toHaveBeenCalledTimes(2)
  })

  // Android emits the token event on every token fetch, including the fetch inside registration.
  it('does not re-register when the token event repeats the same token', async () => {
    signIn()
    await render(<PushBridge />, { wrapper })
    await waitFor(() => expect(refreshPushOnStart).toHaveBeenCalledTimes(1))
    const emit = (data: string) =>
      act(async () => {
        addTokenListener.mock.calls.at(-1)?.[0]({ type: 'android', data })
      })

    await emit('token-a')
    await emit('token-a')
    await emit('token-a')
    expect(refreshPushOnStart).toHaveBeenCalledTimes(2)

    await emit('token-b')
    expect(refreshPushOnStart).toHaveBeenCalledTimes(3)
  })

  it('re-checks the device once per return to the foreground', async () => {
    signIn()
    const listener = jest.spyOn(AppState, 'addEventListener')
    jest.mocked(refreshPushOnStart).mockResolvedValue('ENABLED')
    await render(<PushBridge />, { wrapper })
    await waitFor(() => expect(refreshPushOnStart).toHaveBeenCalledTimes(1))
    const change = listener.mock.calls.at(-1)?.[1] as (state: string) => void
    const emit = (state: string) => act(async () => change(state))

    jest.mocked(refreshPushOnStart).mockResolvedValue('DENIED')
    await emit('background')
    await emit('active')
    await emit('active')

    expect(refreshPushOnStart).toHaveBeenCalledTimes(2)
    await waitFor(() =>
      expect(queryClient.getQueryData(PUSH_STATE_KEY)).toBe('DENIED'),
    )
    listener.mockRestore()
  })

  it('does not touch the device while signed out', async () => {
    mockSession.status = 'unauthenticated'
    await render(<PushBridge />, { wrapper })
    expect(refreshPushOnStart).not.toHaveBeenCalled()
  })
})
