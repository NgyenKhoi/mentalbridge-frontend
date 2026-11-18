import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'

import { ApiError } from '@/api/api-error'

import { ChangePasswordScreen } from './ChangePasswordScreen'

const mockBack = jest.fn()
const mockReplace = jest.fn()
const mockChangePassword = jest.fn()
const mockRequestPasswordRecovery = jest.fn()

jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
    replace: (path: string) => mockReplace(path),
  },
}))

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({
    changePassword: mockChangePassword,
    requestPasswordRecovery: mockRequestPasswordRecovery,
  }),
}))

async function fillValidForm() {
  await fireEvent.changeText(
    screen.getByLabelText('Mật khẩu hiện tại'),
    'correct-password',
  )
  await fireEvent.changeText(
    screen.getByLabelText('Mật khẩu mới'),
    'new-correct-password',
  )
  await fireEvent.changeText(
    screen.getByLabelText('Xác nhận mật khẩu mới'),
    'new-correct-password',
  )
}

describe('authenticated mobile password change', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('validates the form before contacting Identity', async () => {
    await render(<ChangePasswordScreen onClose={jest.fn()} />)

    await fireEvent.press(
      screen.getByRole('button', { name: 'Đổi mật khẩu và đăng xuất' }),
    )

    expect(await screen.findByText('Nhập mật khẩu hiện tại.')).toBeOnTheScreen()
    expect(mockChangePassword).not.toHaveBeenCalled()
  })

  it('requests a recovery link from the sheet without leaving the signed-in route', async () => {
    mockRequestPasswordRecovery.mockResolvedValue(undefined)
    await render(<ChangePasswordScreen onClose={jest.fn()} />)
    await fireEvent.press(
      screen.getByRole('button', { name: 'Quên mật khẩu?' }),
    )
    await fireEvent.changeText(
      screen.getByLabelText('Email'),
      ' User@Example.com ',
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Gửi liên kết đặt lại' }),
    )
    await screen.findByText(/Hãy kiểm tra email/)
    expect(mockRequestPasswordRecovery).toHaveBeenCalledWith('user@example.com')
    expect(mockChangePassword).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('shows a wrong-current-password error without clearing or navigating', async () => {
    mockChangePassword.mockRejectedValue(
      new ApiError({
        code: 'INVALID_CREDENTIALS',
        message: 'Wrong current password',
        status: 401,
      }),
    )
    await render(<ChangePasswordScreen onClose={jest.fn()} />)
    await fillValidForm()

    await fireEvent.press(
      screen.getByRole('button', { name: 'Đổi mật khẩu và đăng xuất' }),
    )

    expect(
      await screen.findByText(
        'Mật khẩu hiện tại không đúng hoặc phiên đăng nhập không còn hợp lệ.',
      ),
    ).toBeOnTheScreen()
    expect(mockReplace).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('correct-password')).toBeOnTheScreen()
  })

  it('returns to sign-in only after Identity confirms the change', async () => {
    let resolveChange: (() => void) | undefined
    mockChangePassword.mockImplementation(
      () => new Promise<void>((resolve) => (resolveChange = resolve)),
    )
    await render(<ChangePasswordScreen onClose={jest.fn()} />)
    await fillValidForm()

    await fireEvent.press(
      screen.getByRole('button', { name: 'Đổi mật khẩu và đăng xuất' }),
    )
    expect(screen.getByRole('button', { name: 'Đang đổi...' })).toBeDisabled()
    expect(mockReplace).not.toHaveBeenCalled()

    resolveChange?.()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/sign-in'))
    expect(mockChangePassword).toHaveBeenCalledWith(
      'correct-password',
      'new-correct-password',
    )
  })
})
