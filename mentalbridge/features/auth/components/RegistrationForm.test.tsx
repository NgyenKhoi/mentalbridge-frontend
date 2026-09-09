import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createKey: vi.fn(),
  register: vi.fn(),
}))

vi.mock('@/features/auth/api/browser-auth', () => ({
  createRegistrationIdempotencyKey: mocks.createKey,
  registerAccount: mocks.register,
  registrationErrorMessage: () => 'Không thể tạo tài khoản.',
}))

import RegistrationForm from './RegistrationForm'

async function completeForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email'), 'member@example.com')
  await user.type(
    screen.getByLabelText('Mật khẩu'),
    'correct horse battery staple',
  )
  await user.type(
    screen.getByLabelText('Xác nhận mật khẩu'),
    'correct horse battery staple',
  )
  await user.click(screen.getByRole('checkbox'))
}

describe('RegistrationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createKey.mockReturnValue('registration-key-0001')
    mocks.register.mockResolvedValue(undefined)
  })

  it('offers only the two public registration actors and no profile fields', () => {
    render(<RegistrationForm />)

    expect(screen.getByRole('radio', { name: /người dùng/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /chuyên gia/i })).toBeVisible()
    expect(screen.queryByText(/admin/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/họ.*tên/i)).not.toBeInTheDocument()
  })

  it('enforces the password character and UTF-8 byte limits before submission', async () => {
    const user = userEvent.setup()
    render(<RegistrationForm />)

    await user.type(screen.getByLabelText('Email'), 'member@example.com')
    await user.type(screen.getByLabelText('Mật khẩu'), 'too-short')
    await user.type(screen.getByLabelText('Xác nhận mật khẩu'), 'too-short')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))

    expect(screen.getByText('Mật khẩu phải có ít nhất 12 ký tự.')).toBeVisible()
    expect(mocks.register).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText('Mật khẩu'))
    await user.type(screen.getByLabelText('Mật khẩu'), '🙂'.repeat(19))
    await user.clear(screen.getByLabelText('Xác nhận mật khẩu'))
    await user.type(screen.getByLabelText('Xác nhận mật khẩu'), '🙂'.repeat(19))
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))

    expect(
      screen.getByText('Mật khẩu không được vượt quá 72 byte UTF-8.'),
    ).toBeVisible()
    expect(mocks.register).not.toHaveBeenCalled()
  })

  it('reuses the same idempotency key when unchanged data is retried', async () => {
    mocks.register
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    render(<RegistrationForm />)
    await completeForm(user)

    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))

    expect(mocks.createKey).toHaveBeenCalledOnce()
    expect(mocks.register).toHaveBeenCalledTimes(2)
    expect(mocks.register.mock.calls[0]?.[1]).toBe('registration-key-0001')
    expect(mocks.register.mock.calls[1]?.[1]).toBe('registration-key-0001')
    expect(await screen.findByText(/kiểm tra email của bạn/i)).toBeVisible()
  })

  it('submits a specialist registration and shows the pending state', async () => {
    const user = userEvent.setup()
    render(<RegistrationForm />)
    await completeForm(user)
    await user.click(screen.getByRole('radio', { name: /chuyên gia/i }))

    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))

    expect(mocks.register).toHaveBeenCalledWith(
      {
        email: 'member@example.com',
        password: 'correct horse battery staple',
        actorType: 'SPECIALIST',
      },
      'registration-key-0001',
    )
    expect(await screen.findByText(/kiểm tra email của bạn/i)).toBeVisible()
    expect(
      screen.getByRole('button', { name: /gửi lại email xác minh/i }),
    ).toBeVisible()
    expect(screen.getByLabelText(/email tài khoản/i)).toHaveValue(
      'member@example.com',
    )
  })
})
