import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'

import { ApiError } from '@/api/api-error'

import { SignInScreen } from './SignInScreen'

const mockPush = jest.fn()
const mockSignIn = jest.fn()

jest.mock('expo-router', () => ({
  router: { push: (path: string) => mockPush(path) },
}))

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ signIn: mockSignIn }),
}))

describe('USER sign-in screen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('submits normalized credentials through the Identity session boundary', async () => {
    mockSignIn.mockResolvedValue(undefined)
    await render(<SignInScreen />)

    expect(screen.getByTestId('sign-in-email-input')).toEqual(
      screen.getByLabelText('Email'),
    )
    expect(screen.getByTestId('sign-in-password-input')).toEqual(
      screen.getByLabelText('Mật khẩu'),
    )
    expect(
      screen.getByTestId('sign-in-password-input').props.secureTextEntry,
    ).toBe(true)

    await fireEvent.changeText(
      screen.getByLabelText('Email'),
      ' User@Example.com ',
    )
    await fireEvent.changeText(
      screen.getByLabelText('Mật khẩu'),
      'correct-password',
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Đăng nhập' }))

    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith(
        'user@example.com',
        'correct-password',
      ),
    )
  })

  it('distinguishes invalid credentials from dependency unavailability', async () => {
    mockSignIn.mockRejectedValue(
      new ApiError({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
        status: 401,
      }),
    )
    await render(<SignInScreen />)

    await fireEvent.changeText(
      screen.getByLabelText('Email'),
      'user@example.com',
    )
    await fireEvent.changeText(
      screen.getByLabelText('Mật khẩu'),
      'wrong-password',
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Đăng nhập' }))

    expect(
      await screen.findByText(
        'Email, mật khẩu hoặc trạng thái tài khoản không hợp lệ.',
      ),
    ).toBeOnTheScreen()

    mockSignIn.mockRejectedValue(
      new ApiError({ code: 'NETWORK_ERROR', message: 'Offline' }),
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Đăng nhập' }))

    expect(
      await screen.findByText(
        'Dịch vụ đăng nhập tạm thời chưa sẵn sàng. Vui lòng thử lại sau.',
      ),
    ).toBeOnTheScreen()
  })

  it('links to USER registration without exposing an actor selector', async () => {
    await render(<SignInScreen />)

    await fireEvent.press(screen.getByText('Tạo tài khoản cá nhân'))

    expect(mockPush).toHaveBeenCalledWith('./register')
  })
})
