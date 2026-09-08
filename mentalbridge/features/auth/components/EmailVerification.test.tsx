import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
}))

vi.mock('@/features/auth/api/browser-auth', () => ({
  verifyEmailChallenge: mocks.verify,
  verificationErrorMessage: () =>
    'Liên kết xác minh không hợp lệ, đã hết hạn hoặc không còn đủ điều kiện sử dụng.',
}))

import EmailVerification from './EmailVerification'

describe('EmailVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verify.mockResolvedValue(undefined)
    window.history.replaceState({}, '', '/')
  })

  it('does not call the BFF when the challenge is absent', async () => {
    window.history.replaceState({}, '', '/verify-email')

    render(<EmailVerification />)

    expect(await screen.findByText(/liên kết không còn hợp lệ/i)).toBeVisible()
    expect(mocks.verify).not.toHaveBeenCalled()
  })

  it('removes the challenge from browser history before completing verification', async () => {
    const challenge = 'v'.repeat(32)
    window.history.replaceState({}, '', `/verify-email?challenge=${challenge}`)

    render(<EmailVerification />)

    expect(mocks.verify).toHaveBeenCalledWith(challenge)
    expect(window.location.pathname).toBe('/verify-email')
    expect(window.location.search).toBe('')
    expect(await screen.findByText(/xác minh thành công/i)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute(
      'href',
      '/login',
    )
  })

  it('groups invalid, expired, and ineligible challenges into a safe state', async () => {
    mocks.verify.mockRejectedValue(new Error('private challenge detail'))
    window.history.replaceState(
      {},
      '',
      `/verify-email?challenge=${'x'.repeat(32)}`,
    )

    render(<EmailVerification />)

    await waitFor(() => {
      expect(screen.getByText(/liên kết không còn hợp lệ/i)).toBeVisible()
    })
    expect(
      screen.queryByText(/private challenge detail/i),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /gửi lại email xác minh/i }),
    ).toBeVisible()
  })
})
