import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}))

vi.mock('@/features/auth/api/browser-auth', () => ({
  loginAndResolveWorkspace: mocks.login,
  loginErrorMessage: () => 'Không thể đăng nhập.',
}))

import LoginForm from './LoginForm'

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has no browser-controlled role selector', () => {
    render(<LoginForm />)

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('prevents duplicate submission and routes from the resolved session', async () => {
    let resolveLogin: ((value: { path: string }) => void) | undefined
    mocks.login.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve
      }),
    )
    const user = userEvent.setup()
    const { container } = render(<LoginForm />)

    await user.type(screen.getByLabelText('Email'), 'member@example.com')
    await user.type(screen.getByLabelText('Mật khẩu'), 'secret')
    const form = container.querySelector('form')
    expect(form).not.toBeNull()

    fireEvent.submit(form!)
    fireEvent.submit(form!)

    expect(mocks.login).toHaveBeenCalledOnce()
    expect(mocks.login).toHaveBeenCalledWith({
      email: 'member@example.com',
      password: 'secret',
    })

    await act(async () => {
      resolveLogin?.({ path: '/specialist/dashboard' })
    })

    expect(mocks.replace).toHaveBeenCalledWith('/specialist/dashboard')
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })
})
