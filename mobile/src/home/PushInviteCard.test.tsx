import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { useReducedMotion, withTiming } from 'react-native-reanimated'

import {
  PUSH_INVITE_DISMISSED_KEY,
  PUSH_STATE_KEY,
} from '@/push/push-constants'
import { isPushEnabledOnDevice } from '@/push/push-registration'

import { PushInviteCard } from './PushInviteCard'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  router: { push: (href: unknown) => mockPush(href) },
}))
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(async () => undefined),
}))
jest.mock('@/push/push-registration', () => ({
  isPushEnabledOnDevice: jest.fn(),
}))

const getItem = jest.mocked(SecureStore.getItemAsync)
const setItem = jest.mocked(SecureStore.setItemAsync)
const deviceOn = jest.mocked(isPushEnabledOnDevice)

let client: QueryClient
function renderCard() {
  return render(
    <QueryClientProvider client={client}>
      <PushInviteCard />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  client = new QueryClient()
  getItem.mockResolvedValue(null)
  deviceOn.mockResolvedValue(false)
})

afterEach(() => client.clear())

describe('PushInviteCard', () => {
  it('shows when device push is off and the invite was not dismissed', async () => {
    await renderCard()

    expect(
      await screen.findByText('Nhận nhắc nhở trên điện thoại'),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bật thông báo' })).toBeTruthy()
  })

  it('renders nothing until both reads resolve', async () => {
    let finish: (value: boolean) => void = () => undefined
    deviceOn.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    await renderCard()
    await act(async () => undefined)
    expect(screen.queryByTestId('push-invite-card')).toBeNull()

    await act(async () => finish(false))
    expect(await screen.findByTestId('push-invite-card')).toBeTruthy()
  })

  it('stays hidden after Để sau was pressed before', async () => {
    getItem.mockResolvedValue('1')
    await renderCard()
    await waitFor(() => expect(getItem).toHaveBeenCalled())
    await act(async () => undefined)

    expect(screen.queryByTestId('push-invite-card')).toBeNull()
  })

  it('stays hidden when this device already has push on', async () => {
    deviceOn.mockResolvedValue(true)
    await renderCard()
    await act(async () => undefined)

    expect(screen.queryByTestId('push-invite-card')).toBeNull()
  })

  it('hides when the cached push state is ENABLED', async () => {
    client.setQueryData(PUSH_STATE_KEY, 'ENABLED')
    await renderCard()
    await act(async () => undefined)

    expect(screen.queryByTestId('push-invite-card')).toBeNull()
  })

  it('Để sau stores the dismissal and hides the card', async () => {
    await renderCard()
    fireEvent.press(await screen.findByRole('button', { name: 'Để sau' }))

    expect(setItem).toHaveBeenCalledWith(PUSH_INVITE_DISMISSED_KEY, '1')
    await waitFor(() =>
      expect(screen.queryByTestId('push-invite-card')).toBeNull(),
    )
  })

  it('Để sau collapses the measured card, then unmounts it', async () => {
    await renderCard()
    const card = await screen.findByTestId('push-invite-card')
    await fireEvent(card, 'layout', {
      nativeEvent: { layout: { height: 160 } },
    })
    jest.mocked(withTiming).mockClear()
    await fireEvent.press(screen.getByRole('button', { name: 'Để sau' }))

    expect(setItem).toHaveBeenCalledWith(PUSH_INVITE_DISMISSED_KEY, '1')
    expect(screen.getByTestId('push-invite-card')).toBeTruthy()
    const done = jest.mocked(withTiming).mock.calls[0]?.[2]
    await act(async () => done?.(false))
    expect(screen.getByTestId('push-invite-card')).toBeTruthy()
    await act(async () => done?.(true))
    expect(screen.queryByTestId('push-invite-card')).toBeNull()
  })

  it('Để sau unmounts at once under reduced motion', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true)
    try {
      await renderCard()
      await fireEvent.press(
        await screen.findByRole('button', { name: 'Để sau' }),
      )

      expect(setItem).toHaveBeenCalledWith(PUSH_INVITE_DISMISSED_KEY, '1')
      await waitFor(() =>
        expect(screen.queryByTestId('push-invite-card')).toBeNull(),
      )
    } finally {
      jest.mocked(useReducedMotion).mockReturnValue(false)
    }
  })

  it('Bật thông báo opens the notification preferences', async () => {
    await renderCard()
    fireEvent.press(
      await screen.findByRole('button', { name: 'Bật thông báo' }),
    )

    expect(mockPush).toHaveBeenCalledWith('/(user)/notification-preferences')
  })
})
