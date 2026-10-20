import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

  it('keeps AI conversation and appointment messaging separate in the USER workspace', () => {
    navigation.pathname = '/ai-companion'
    render(
      <AuthenticatedShell workspaces={[]}>Hội thoại AI</AuthenticatedShell>,
    )

    const navigationMenu = within(
      screen.getByRole('navigation', { name: 'Điều hướng chính' }),
    )
    expect(
      navigationMenu.getByRole('link', { name: 'AI Companion' }),
    ).toHaveAttribute('href', '/ai-companion')
    expect(
      navigationMenu.getByRole('link', { name: 'Tin nhắn' }),
    ).toHaveAttribute('href', '/messages')
    expect(
      within(screen.getByRole('banner')).getByText('AI Companion'),
    ).toBeVisible()
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

  describe('page entrance latch', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => {
      vi.restoreAllMocks()
      vi.useRealTimers()
    })

    it('finishes once and stays entered through same-path content changes', () => {
      const { rerender } = render(
        <AuthenticatedShell workspaces={[]}>
          Nội dung ban đầu
        </AuthenticatedShell>,
      )
      const content = screen.getByRole('main')
      expect(content).not.toHaveAttribute('data-entered')

      act(() => vi.advanceTimersByTime(1199))
      expect(content).not.toHaveAttribute('data-entered')
      act(() => vi.advanceTimersByTime(1))
      expect(content).toHaveAttribute('data-entered')

      // Query-only navigation also keeps usePathname unchanged.
      rerender(
        <AuthenticatedShell workspaces={[]}>
          Nội dung cập nhật
        </AuthenticatedShell>,
      )
      expect(screen.getByRole('main')).toBe(content)
      expect(content).toHaveAttribute('data-entered')
    })

    it('resets for each pathname, including a quick return to the previous page', () => {
      const shell = (
        <AuthenticatedShell workspaces={[]}>Nội dung</AuthenticatedShell>
      )
      const { rerender } = render(shell)
      const content = screen.getByRole('main')
      act(() => vi.advanceTimersByTime(1200))
      expect(content).toHaveAttribute('data-entered')

      navigation.pathname = '/journal'
      rerender(<AuthenticatedShell workspaces={[]}>Nhật ký</AuthenticatedShell>)
      expect(screen.getByRole('main')).toBe(content)
      expect(content).not.toHaveAttribute('data-entered')
      act(() => vi.advanceTimersByTime(600))

      navigation.pathname = '/dashboard'
      rerender(shell)
      expect(screen.getByRole('main')).toBe(content)
      expect(content).not.toHaveAttribute('data-entered')
      act(() => vi.advanceTimersByTime(600))
      expect(content).not.toHaveAttribute('data-entered')
      act(() => vi.advanceTimersByTime(600))
      expect(content).toHaveAttribute('data-entered')
    })

    it('replaces the pending timer on navigation and clears it on unmount', () => {
      const scheduled = vi.spyOn(window, 'setTimeout')
      const cleared = vi.spyOn(window, 'clearTimeout')
      const { rerender, unmount } = render(
        <AuthenticatedShell workspaces={[]}>Nội dung</AuthenticatedShell>,
      )

      navigation.pathname = '/journal'
      rerender(<AuthenticatedShell workspaces={[]}>Nhật ký</AuthenticatedShell>)
      const entranceTimers = scheduled.mock.calls.flatMap(([, delay], index) =>
        delay === 1200 ? [scheduled.mock.results[index].value] : [],
      )
      expect(entranceTimers).toHaveLength(2)
      expect(cleared).toHaveBeenCalledWith(entranceTimers[0])

      unmount()
      expect(cleared).toHaveBeenCalledWith(entranceTimers[1])
    })
  })
})
