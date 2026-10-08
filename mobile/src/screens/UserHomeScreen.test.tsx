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

  it('opens the private Journal journey', async () => {
    await render(<UserHomeScreen />)
    await fireEvent.press(screen.getByRole('button', { name: 'Viết nhật ký' }))
    expect(mockPush).toHaveBeenCalledWith('./journal')
  })

  it('opens the personal profile action', async () => {
    await render(<UserHomeScreen />)

    await fireEvent.press(
      screen.getByRole('button', { name: 'Mở hồ sơ cá nhân' }),
    )

    expect(mockPush).toHaveBeenCalledWith('./profile')
  })

  it('opens the Care-backed assessment journey', async () => {
    await render(<UserHomeScreen />)

    await fireEvent.press(
      screen.getByRole('button', { name: 'Bắt đầu sàng lọc' }),
    )

    expect(mockPush).toHaveBeenCalledWith('./assessment')
  })

  it('opens the Care-backed support plan journey', async () => {
    await render(<UserHomeScreen />)

    await fireEvent.press(
      screen.getByRole('button', { name: 'Mở kế hoạch hỗ trợ' }),
    )

    expect(mockPush).toHaveBeenCalledWith('./support-plan')
  })

  it('opens the Journal-backed daily emotion journey', async () => {
    await render(<UserHomeScreen />)

    await fireEvent.press(
      screen.getByRole('button', { name: 'Ghi nhận cảm xúc' }),
    )

    expect(mockPush).toHaveBeenCalledWith('./emotion')
  })

  it('opens the reviewed Content resources journey', async () => {
    await render(<UserHomeScreen />)

    await fireEvent.press(
      screen.getByRole('button', { name: 'Khám phá tài nguyên' }),
    )

    expect(mockPush).toHaveBeenCalledWith('./resources')
  })
})
