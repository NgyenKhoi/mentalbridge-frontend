import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requestVerification: vi.fn(),
  requestRecovery: vi.fn(),
  resetPassword: vi.fn(),
  changePassword: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}))

vi.mock('@/features/auth/api/browser-auth', () => ({
  requestEmailVerification: mocks.requestVerification,
  requestPasswordRecovery: mocks.requestRecovery,
  resetPassword: mocks.resetPassword,
  changePassword: mocks.changePassword,
  credentialRequestErrorMessage: () => 'Không thể gửi yêu cầu.',
  passwordResetErrorMessage: () => 'Không thể đặt lại mật khẩu.',
  passwordChangeErrorMessage: () => 'Không thể đổi mật khẩu.',
}))

import PasswordChangeForm from './PasswordChangeForm'
import PasswordRecovery from './PasswordRecovery'
import VerificationResendForm from './VerificationResendForm'

describe('credential lifecycle forms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requestVerification.mockResolvedValue(undefined)
    mocks.requestRecovery.mockResolvedValue(undefined)
    mocks.resetPassword.mockResolvedValue(undefined)
    mocks.changePassword.mockResolvedValue(undefined)
    window.history.replaceState({}, '', '/')
  })

  it('submits verification resend and shows only the generic accepted message', async () => {
    const user = userEvent.setup()
    render(<VerificationResendForm initialEmail="member@example.com" />)

    await user.click(
      screen.getByRole('button', { name: /gửi lại email xác minh/i }),
    )

    expect(mocks.requestVerification).toHaveBeenCalledWith('member@example.com')
    expect(await screen.findByRole('status')).toHaveTextContent(
      /nếu tài khoản đang chờ xác minh và đủ điều kiện/i,
    )
  })

  it('requests password recovery without exposing account eligibility', async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', '/reset-password')
    render(<PasswordRecovery />)
    await screen.findByRole('heading', { name: /quên mật khẩu/i })

    await user.type(
      screen.getByLabelText('Email'),
      'unknown-member@example.com',
    )
    await user.click(
      screen.getByRole('button', { name: /gửi liên kết khôi phục/i }),
    )

    expect(mocks.requestRecovery).toHaveBeenCalledWith(
      'unknown-member@example.com',
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      /nếu tài khoản đủ điều kiện/i,
    )
  })

  it('removes a reset challenge from history before submitting it once', async () => {
    const challenge = 'r'.repeat(32)
    const user = userEvent.setup()
    window.history.replaceState(
      {},
      '',
      `/reset-password?challenge=${challenge}`,
    )
    render(<PasswordRecovery />)

    await screen.findByRole('heading', { name: /đặt lại mật khẩu/i })
    expect(window.location.pathname).toBe('/reset-password')
    expect(window.location.search).toBe('')

    await user.type(
      screen.getByLabelText('Mật khẩu mới'),
      'a sufficiently long password',
    )
    await user.type(
      screen.getByLabelText('Xác nhận mật khẩu mới'),
      'a sufficiently long password',
    )
    await user.click(screen.getByRole('button', { name: /đặt lại mật khẩu/i }))

    expect(mocks.resetPassword).toHaveBeenCalledWith(
      challenge,
      'a sufficiently long password',
    )
    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/login?credential=reset')
    })
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })

  it('changes the password then routes to a fresh login', async () => {
    const user = userEvent.setup()
    render(<PasswordChangeForm />)

    await user.type(screen.getByLabelText('Mật khẩu hiện tại'), 'old password')
    await user.type(
      screen.getByLabelText('Mật khẩu mới'),
      'a sufficiently long password',
    )
    await user.type(
      screen.getByLabelText('Xác nhận mật khẩu mới'),
      'a sufficiently long password',
    )
    await user.click(
      screen.getByRole('button', { name: /đổi mật khẩu và đăng xuất/i }),
    )

    expect(mocks.changePassword).toHaveBeenCalledWith(
      'old password',
      'a sufficiently long password',
    )
    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/login?credential=changed')
    })
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })
})
