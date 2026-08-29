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

  it('does not call the BFF when the challenge is absent', () => {
    render(<EmailVerification challenge={null} />)

    expect(screen.getByText(/liên kết không còn hợp lệ/i)).toBeVisible()
    expect(mocks.verify).not.toHaveBeenCalled()
  })

  it('removes the challenge from browser history before completing verification', async () => {
    const challenge = 'v'.repeat(32)
    window.history.replaceState({}, '', `/verify-email?challenge=${challenge}`)

    render(<EmailVerification challenge={challenge} />)

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

    render(<EmailVerification challenge={'x'.repeat(32)} />)

    await waitFor(() => {
      expect(screen.getByText(/liên kết không còn hợp lệ/i)).toBeVisible()
    })
    expect(
      screen.queryByText(/private challenge detail/i),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /gửi lại/i }),
    ).not.toBeInTheDocument()
  })
})
