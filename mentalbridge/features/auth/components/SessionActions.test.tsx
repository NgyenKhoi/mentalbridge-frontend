import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  terminate: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}))

vi.mock('@/features/auth/api/browser-auth', () => ({
  terminateSession: mocks.terminate,
}))

import SessionActions from './SessionActions'

describe('SessionActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prevents repeated logout actions while revocation is pending', async () => {
    let finish: (() => void) | undefined
    mocks.terminate.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve
      }),
    )
    render(<SessionActions />)
    fireEvent.click(screen.getByRole('button', { name: 'Mở menu tài khoản' }))
    const logout = screen.getByRole('menuitem', { name: 'Đăng xuất' })

    fireEvent.click(logout)
    fireEvent.click(logout)

    expect(mocks.terminate).toHaveBeenCalledOnce()
    await act(async () => finish?.())
    expect(mocks.replace).toHaveBeenCalledWith('/login')
  })

  it('redirects deterministically when backend revocation is unavailable', async () => {
    mocks.terminate.mockRejectedValue(new Error('unavailable'))
    render(<SessionActions />)
    fireEvent.click(screen.getByRole('button', { name: 'Mở menu tài khoản' }))

    await act(async () => {
      fireEvent.click(
        screen.getByRole('menuitem', { name: 'Đăng xuất mọi thiết bị' }),
      )
    })

    expect(mocks.terminate).toHaveBeenCalledWith('all')
    expect(mocks.replace).toHaveBeenCalledWith('/login')
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })

  it('opens the account menu and closes it with Escape or an outside click', () => {
    render(<SessionActions />)
    const trigger = screen.getByRole('button', { name: 'Mở menu tài khoản' })

    fireEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    fireEvent.click(trigger)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('preserves personal account destinations by default', () => {
    render(<SessionActions />)
    expect(screen.getByText('Tài khoản cá nhân')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mở menu tài khoản' }))
    expect(
      screen.getByRole('menuitem', { name: 'Hồ sơ cá nhân' }),
    ).toHaveAttribute('href', '/profile')
    expect(
      screen.getByRole('menuitem', { name: 'Gói dịch vụ' }),
    ).toHaveAttribute('href', '/subscription')
  })

  it('keeps specialist account actions accessible when the sidebar is collapsed', async () => {
    mocks.terminate.mockResolvedValue(undefined)
    render(
      <SessionActions
        compact
        accountKind="specialist"
        displayName="Nguyễn An"
        avatar="NA"
        description="Đang chờ xét duyệt"
      />,
    )
    const trigger = screen.getByRole('button', {
      name: 'Mở menu tài khoản chuyên gia',
    })
    expect(trigger).toHaveAttribute('title', 'Nguyễn An · Đang chờ xét duyệt')
    fireEvent.click(trigger)
    expect(
      screen.getByRole('menuitem', { name: 'Hồ sơ chuyên gia' }),
    ).toHaveAttribute('href', '/specialist/profile')
    await act(async () =>
      fireEvent.click(screen.getByRole('menuitem', { name: 'Đăng xuất' })),
    )
    expect(mocks.terminate).toHaveBeenCalledWith('current')
    expect(mocks.replace).toHaveBeenCalledWith('/login')
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })
})
