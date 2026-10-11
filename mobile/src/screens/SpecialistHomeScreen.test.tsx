import { fireEvent, render, screen } from '@testing-library/react-native'

import { SpecialistHomeScreen } from './SpecialistHomeScreen'

const mockPush = jest.fn()
const mockSignOut = jest.fn()

jest.mock('expo-router', () => ({
  router: { push: (path: string) => mockPush(path) },
}))

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ signOut: mockSignOut }),
}))

describe('SPECIALIST home screen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('opens the appointment workbench as the primary journey', async () => {
    await render(<SpecialistHomeScreen />)

    await fireEvent.press(
      screen.getByRole('button', { name: 'Mở lịch hẹn tư vấn' }),
    )

    expect(mockPush).toHaveBeenCalledWith('./appointments')
  })

  it('keeps the professional profile journey available', async () => {
    await render(<SpecialistHomeScreen />)

    await fireEvent.press(
      screen.getByRole('button', { name: 'Quản lý hồ sơ nghề nghiệp' }),
    )

    expect(mockPush).toHaveBeenCalledWith('./profile')
  })

  it('preserves the shared Messages destination after the dev sync', async () => {
    await render(<SpecialistHomeScreen />)
    await fireEvent.press(
      screen.getByRole('button', { name: 'Phiên trò chuyện' }),
    )
    expect(mockPush).toHaveBeenCalledWith('./messages')
  })

  it('opens the availability journey', async () => {
    await render(<SpecialistHomeScreen />)

    await fireEvent.press(
      screen.getByRole('button', { name: 'Quản lý lịch khả dụng' }),
    )

    expect(mockPush).toHaveBeenCalledWith('./availability')
  })
})
