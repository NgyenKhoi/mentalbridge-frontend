import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Header from './Header'

const auth = vi.hoisted(() => ({
  resolveCurrentWorkspace: vi.fn(),
}))

vi.mock('@/features/auth/api/browser-auth', () => ({
  resolveCurrentWorkspace: auth.resolveCurrentWorkspace,
}))

vi.mock('@/components/motion/MagneticButton', () => ({
  default: ({ children }: Readonly<{ children: React.ReactNode }>) => children,
}))

describe('marketing Header session actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps public sign-in actions when there is no session hint', () => {
    render(<Header />)

    expect(screen.getAllByRole('link', { name: 'Đăng nhập' })).not.toHaveLength(
      0,
    )
    expect(auth.resolveCurrentWorkspace).not.toHaveBeenCalled()
  })

  it('replaces sign-in actions with the authoritative workspace link', async () => {
    auth.resolveCurrentWorkspace.mockResolvedValue({
      path: '/specialist/dashboard',
      workspace: {
        role: 'SPECIALIST',
        label: 'Chuyên gia',
        path: '/specialist/dashboard',
      },
    })

    render(<Header hasSessionHint />)

    await waitFor(() =>
      expect(
        screen.getAllByRole('link', { name: 'Vào trang chuyên gia' }),
      ).not.toHaveLength(0),
    )
    for (const link of screen.getAllByRole('link', {
      name: 'Vào trang chuyên gia',
    })) {
      expect(link).toHaveAttribute('href', '/specialist/dashboard')
    }
    expect(screen.queryByRole('link', { name: 'Đăng nhập' })).toBeNull()
  })
})
