import { fireEvent, render, screen } from '@testing-library/react-native'

import { AppProviders } from '@/providers/AppProviders'
import { WelcomeScreen } from '@/screens/WelcomeScreen'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: (path: string) => mockPush(path),
  },
}))

describe('mobile startup shell', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('boots the provider stack and unauthenticated welcome screen', async () => {
    await render(
      <AppProviders
        runtimeConfig={{
          apiBaseUrl: 'https://api.test.mentalbridge',
          apiTimeoutMs: 5_000,
        }}
      >
        <WelcomeScreen />
      </AppProviders>,
    )

    expect(
      screen.getByRole('header', {
        name: 'Một không gian bình tĩnh để chăm sóc tinh thần',
      }),
    ).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }))

    expect(mockPush).toHaveBeenCalledWith('/sign-in')
  })
})
