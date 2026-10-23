import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'

import { ApiError } from '@/api/api-error'

import { PasswordRecoveryScreen } from './PasswordRecoveryScreen'

const validChallenge = 'password-reset-challenge-that-is-long-enough'
const genericAcknowledgement =
  'Kiểm tra email của bạn. Nếu tài khoản đủ điều kiện, liên kết đặt lại mật khẩu sẽ được gửi.'
let mockChallenge: string | undefined
const mockReplace = jest.fn()
const mockRequestPasswordRecovery = jest.fn()
const mockResetPassword = jest.fn()

jest.mock('expo-router', () => ({
  router: { replace: (path: string) => mockReplace(path) },
  useLocalSearchParams: () => ({ challenge: mockChallenge }),
}))

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({
    requestPasswordRecovery: mockRequestPasswordRecovery,
    resetPassword: mockResetPassword,
  }),
}))

describe('mobile password recovery and reset', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockChallenge = undefined
  })

  it('waits for Identity and then shows the generic recovery acknowledgement', async () => {
    let resolveRequest: (() => void) | undefined
    mockRequestPasswordRecovery.mockImplementation(
      () => new Promise<void>((resolve) => (resolveRequest = resolve)),
    )
    await render(<PasswordRecoveryScreen />)

    await screen.findByText('Quên mật khẩu?')
    await fireEvent.changeText(
      screen.getByLabelText('Email'),
      ' User@Example.com ',
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Gửi liên kết khôi phục' }),
    )

    expect(screen.getByRole('button', { name: 'Đang gửi...' })).toBeDisabled()
    expect(screen.queryByText(genericAcknowledgement)).not.toBeOnTheScreen()
    resolveRequest?.()

    await waitFor(() =>
      expect(mockRequestPasswordRecovery).toHaveBeenCalledWith(
        'user@example.com',
      ),
    )
    expect(await screen.findByText(genericAcknowledgement)).toBeOnTheScreen()
  })

  it('removes the challenge from navigation state and never reports invalid reset as success', async () => {
    mockChallenge = validChallenge
    mockResetPassword.mockRejectedValue(
      new ApiError({
        code: 'INVALID_CHALLENGE',
        message: 'Consumed',
        status: 400,
      }),
    )
    await render(<PasswordRecoveryScreen />)

    await screen.findByText('Tạo mật khẩu mới')
    expect(mockReplace).toHaveBeenCalledWith('/reset-password')
    await fireEvent.changeText(
      screen.getByLabelText('Mật khẩu mới'),
      'new-correct-password',
    )
    await fireEvent.changeText(
      screen.getByLabelText('Xác nhận mật khẩu mới'),
      'new-correct-password',
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Đặt lại mật khẩu' }),
    )

    expect(
      await screen.findByText(
        'Liên kết đặt lại mật khẩu không hợp lệ, đã hết hạn hoặc đã được sử dụng.',
      ),
    ).toBeOnTheScreen()
    expect(
      screen.queryByText('Mật khẩu đã được thay đổi'),
    ).not.toBeOnTheScreen()
  })

  it('returns to sign-in without auto-login after a confirmed reset', async () => {
    mockChallenge = validChallenge
    mockResetPassword.mockResolvedValue(undefined)
    await render(<PasswordRecoveryScreen />)

    await screen.findByText('Tạo mật khẩu mới')
    await fireEvent.changeText(
      screen.getByLabelText('Mật khẩu mới'),
      'new-correct-password',
    )
    await fireEvent.changeText(
      screen.getByLabelText('Xác nhận mật khẩu mới'),
      'new-correct-password',
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Đặt lại mật khẩu' }),
    )

    expect(
      await screen.findByText('Mật khẩu đã được thay đổi'),
    ).toBeOnTheScreen()
    expect(mockReplace).not.toHaveBeenCalledWith('/sign-in')
    await fireEvent.press(
      screen.getByRole('button', { name: 'Về trang đăng nhập' }),
    )
    expect(mockReplace).toHaveBeenCalledWith('/sign-in')
  })

  it('keeps a network failure retryable with the challenge still in memory', async () => {
    mockChallenge = validChallenge
    mockResetPassword
      .mockRejectedValueOnce(
        new ApiError({ code: 'NETWORK_ERROR', message: 'Offline' }),
      )
      .mockResolvedValueOnce(undefined)
    await render(<PasswordRecoveryScreen />)

    await screen.findByText('Tạo mật khẩu mới')
    await fireEvent.changeText(
      screen.getByLabelText('Mật khẩu mới'),
      'new-correct-password',
    )
    await fireEvent.changeText(
      screen.getByLabelText('Xác nhận mật khẩu mới'),
      'new-correct-password',
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Đặt lại mật khẩu' }),
    )
    expect(
      await screen.findByText(
        'Dịch vụ đặt lại mật khẩu tạm thời chưa sẵn sàng. Bạn có thể thử lại với liên kết này.',
      ),
    ).toBeOnTheScreen()

    await fireEvent.press(
      screen.getByRole('button', { name: 'Đặt lại mật khẩu' }),
    )
    expect(
      await screen.findByText('Mật khẩu đã được thay đổi'),
    ).toBeOnTheScreen()
    expect(mockResetPassword).toHaveBeenCalledTimes(2)
  })
})
