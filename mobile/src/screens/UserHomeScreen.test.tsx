import { fireEvent, render, screen } from '@testing-library/react-native'

import { UserHomeScreen } from './UserHomeScreen'

const mockPush = jest.fn()
const mockSignOut = jest.fn()

jest.mock('expo-router', () => ({
  router: { push: (path: string) => mockPush(path) },
}))

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ signOut: mockSignOut }),
}))

describe('USER home screen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('opens the personal profile as the primary USER action', async () => {
    await render(<UserHomeScreen />)

    await fireEvent.press(
      screen.getByRole('button', { name: 'Mở hồ sơ cá nhân' }),
    )

    expect(mockPush).toHaveBeenCalledWith('./profile')
  })
})
