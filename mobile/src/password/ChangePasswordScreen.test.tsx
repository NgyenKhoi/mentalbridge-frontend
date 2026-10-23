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

jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
    replace: (path: string) => mockReplace(path),
  },
}))

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ changePassword: mockChangePassword }),
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
    await render(<ChangePasswordScreen />)

    await fireEvent.press(
      screen.getByRole('button', { name: 'Đổi mật khẩu và đăng xuất' }),
    )

    expect(await screen.findByText('Nhập mật khẩu hiện tại.')).toBeOnTheScreen()
    expect(mockChangePassword).not.toHaveBeenCalled()
  })

  it('shows a wrong-current-password error without clearing or navigating', async () => {
    mockChangePassword.mockRejectedValue(
      new ApiError({
        code: 'INVALID_CREDENTIALS',
        message: 'Wrong current password',
        status: 401,
      }),
    )
    await render(<ChangePasswordScreen />)
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
    await render(<ChangePasswordScreen />)
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
