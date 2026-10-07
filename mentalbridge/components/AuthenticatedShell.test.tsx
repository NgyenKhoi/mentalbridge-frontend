import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }))
vi.mock('@/features/assessment/api/browser-care', () => ({
  getCareProfile: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/features/auth/components/SessionActions', () => ({
  default: () => <div>Phiên người dùng</div>,
}))
vi.mock('@/features/auth/components/WorkspaceSwitcher', () => ({
  default: () => <div>Đổi không gian</div>,
}))
vi.mock('@/features/resources/components/ResourceNavBadge', () => ({
  default: () => null,
}))

import AuthenticatedShell from './AuthenticatedShell'

describe('AuthenticatedShell', () => {
  it('keeps the dashboard header focused on the current workspace actions', () => {
    render(
      <AuthenticatedShell workspaces={[]}>
        <p>Nội dung dashboard</p>
      </AuthenticatedShell>,
    )

    const topbar = screen.getByRole('banner')
    expect(
      within(topbar).getByRole('link', { name: 'Thông báo' }),
    ).toHaveAttribute('href', '/notifications')
    expect(within(topbar).getByRole('link', { name: /Hồ sơ/ })).toHaveAttribute(
      'href',
      '/profile',
    )
    expect(
      screen.queryByRole('link', { name: 'Cộng đồng' }),
    ).not.toBeInTheDocument()
  })
})
