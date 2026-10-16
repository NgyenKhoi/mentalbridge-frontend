import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const navigation = vi.hoisted(() => ({ pathname: '/dashboard' }))
const profileApi = vi.hoisted(() => ({ getCareProfile: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }))
vi.mock('@/features/assessment/api/browser-care', () => ({
  getCareProfile: profileApi.getCareProfile,
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
  beforeEach(() => {
    navigation.pathname = '/dashboard'
    profileApi.getCareProfile.mockReset().mockResolvedValue(null)
  })

  it('offers Community from the USER header and main navigation without a plan gate', () => {
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
      within(topbar).getByRole('link', { name: 'Cộng đồng' }),
    ).toHaveAttribute('href', '/community')
    expect(
      within(
        screen.getByRole('navigation', { name: 'Điều hướng chính' }),
      ).getByRole('link', { name: 'Cộng đồng' }),
    ).toHaveAttribute('href', '/community')
  })

  it('keeps the Community sidebar link named when the sidebar is collapsed', async () => {
    const user = userEvent.setup()
    render(<AuthenticatedShell workspaces={[]}>Nội dung</AuthenticatedShell>)

    await user.click(screen.getByRole('button', { name: 'Thu gọn sidebar' }))

    const link = within(
      screen.getByRole('navigation', { name: 'Điều hướng chính' }),
    ).getByRole('link', { name: 'Cộng đồng' })
    expect(link).toHaveAttribute('title', 'Cộng đồng')
    expect(link).toHaveAttribute('aria-label', 'Cộng đồng')
    expect(link).toHaveAttribute('href', '/community')
  })

  it('closes the mobile menu when its labeled Community entry is chosen', async () => {
    const user = userEvent.setup()
    render(<AuthenticatedShell workspaces={[]}>Nội dung</AuthenticatedShell>)
    const trigger = screen.getByRole('button', { name: 'Mở menu' })

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const link = within(
      screen.getByRole('navigation', { name: 'Điều hướng chính' }),
    ).getByRole('link', { name: 'Cộng đồng' })
    link.addEventListener('click', (event) => event.preventDefault())
    await user.click(link)

    expect(link).toHaveAttribute('href', '/community')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByRole('button', { name: 'Đóng menu' }),
    ).not.toBeInTheDocument()
  })

  it.each(['loading', 'unavailable'])(
    'keeps Community reachable when the Care profile is %s',
    (state) => {
      if (state === 'loading')
        profileApi.getCareProfile.mockReturnValue(new Promise(() => {}))
      else
        profileApi.getCareProfile.mockRejectedValue(
          new Error('Profile unavailable'),
        )
      render(<AuthenticatedShell workspaces={[]}>Nội dung</AuthenticatedShell>)

      expect(
        within(screen.getByRole('banner')).getByRole('link', {
          name: 'Cộng đồng',
        }),
      ).toHaveAttribute('href', '/community')
    },
  )

  it('preserves Community in the resource-specific header variant', () => {
    navigation.pathname = '/resources/00000000-0000-4000-8000-000000000215'
    render(<AuthenticatedShell workspaces={[]}>Tài nguyên</AuthenticatedShell>)

    const topbar = screen.getByRole('banner')
    expect(
      within(topbar).getByRole('link', { name: 'Cộng đồng' }),
    ).toHaveAttribute('href', '/community')
    expect(
      within(topbar).getByRole('navigation', { name: 'Đường dẫn trên cùng' }),
    ).toBeVisible()
  })

  it('names a saved assessment result in the shared shell', () => {
    navigation.pathname =
      '/assessments/results/20000000-0000-4000-8000-000000000101'
    render(<AuthenticatedShell workspaces={[]}>Kết quả</AuthenticatedShell>)

    expect(
      within(screen.getByRole('banner')).getByText('Kết quả sàng lọc'),
    ).toBeVisible()
  })
})
