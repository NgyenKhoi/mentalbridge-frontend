import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'

import { RegistrationScreen } from './RegistrationScreen'

const mockRegisterUser = jest.fn()
const mockRequestEmailVerification = jest.fn()

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
}))

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({
    registerUser: mockRegisterUser,
    requestEmailVerification: mockRequestEmailVerification,
  }),
}))

describe('USER registration screen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('submits a fixed USER registration and shows the verification handoff', async () => {
    mockRegisterUser.mockResolvedValue(undefined)
    await render(<RegistrationScreen />)

    await fireEvent.changeText(
      screen.getByLabelText('Email'),
      ' User@Example.com ',
    )
    await fireEvent.changeText(
      screen.getByLabelText('Mật khẩu'),
      'correct-password',
    )
    await fireEvent.changeText(
      screen.getByLabelText('Xác nhận mật khẩu'),
      'correct-password',
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo tài khoản' }))

    await waitFor(() =>
      expect(mockRegisterUser).toHaveBeenCalledWith(
        'user@example.com',
        'correct-password',
        '11111111-1111-4111-8111-111111111111',
      ),
    )
    expect(await screen.findByText('Kiểm tra email của bạn')).toBeOnTheScreen()
  })

  it('validates the password before contacting Identity', async () => {
    await render(<RegistrationScreen />)

    await fireEvent.changeText(
      screen.getByLabelText('Email'),
      'user@example.com',
    )
    await fireEvent.changeText(screen.getByLabelText('Mật khẩu'), 'short')
    await fireEvent.changeText(
      screen.getByLabelText('Xác nhận mật khẩu'),
      'short',
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo tài khoản' }))

    expect(
      await screen.findByText('Mật khẩu phải có ít nhất 12 ký tự.'),
    ).toBeOnTheScreen()
    expect(mockRegisterUser).not.toHaveBeenCalled()
  })
})
