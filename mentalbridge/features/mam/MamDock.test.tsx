import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MamDock } from './MamDock'
import { MamDockSlot } from './MamDockSlot'

const navigation = vi.hoisted(() => ({ pathname: '/dashboard' }))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}))

const character = vi.hoisted(() => ({ mounts: 0 }))

vi.mock('./MamCharacter', async () => {
  const { useEffect } = await import('react')
  return {
    MamCharacter: (props: {
      size: number
      behavior: string
      reducedMotion: boolean
    }) => {
      useEffect(() => {
        character.mounts += 1
      }, [])
      return (
        <span
          data-testid="mam-character"
          data-size={props.size}
          data-behavior={props.behavior}
          data-reduced={props.reducedMotion}
        />
      )
    },
  }
})

function stubMatchMedia(matches: (query: string) => boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: matches(query),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

const dockButton = () => screen.getByRole('button', { name: 'Mầm' })

describe('MamDock', () => {
  beforeEach(() => {
    navigation.pathname = '/dashboard'
    character.mounts = 0
    window.localStorage.clear()
    window.sessionStorage.clear()
    stubMatchMedia(() => false)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders nothing without a USER layout slot', () => {
    render(<MamDock />)
    expect(screen.queryByTestId('mam-character')).toBeNull()
  })

  it('renders nothing on a route outside the surface matrix', () => {
    navigation.pathname = '/support-plan'
    render(
      <>
        <MamDockSlot />
        <MamDock />
      </>,
    )
    expect(screen.queryByTestId('mam-character')).toBeNull()
  })

  it('keeps one character across a layout switch between USER routes', async () => {
    const { rerender } = render(
      <>
        <MamDockSlot key="dashboard" />
        <MamDock />
      </>,
    )
    await screen.findByTestId('mam-character')

    navigation.pathname = '/resources'
    rerender(
      <>
        <MamDockSlot key="resources" />
        <MamDock />
      </>,
    )

    expect(screen.getAllByTestId('mam-character')).toHaveLength(1)
    expect(character.mounts).toBe(1)
  })

  it('uses the 96 px dock on desktop and 72 px on compact screens', () => {
    const { unmount } = render(
      <>
        <MamDockSlot />
        <MamDock />
      </>,
    )
    expect(screen.getByTestId('mam-character').dataset.size).toBe('96')
    unmount()

    stubMatchMedia((query) => query === '(max-width: 900px)')
    render(
      <>
        <MamDockSlot />
        <MamDock />
      </>,
    )
    expect(screen.getByTestId('mam-character').dataset.size).toBe('72')
  })

  it('opens the menu, turns Mầm curious and closes on Escape with focus back', async () => {
    render(
      <>
        <MamDockSlot />
        <MamDock />
      </>,
    )
    dockButton().focus()
    fireEvent.click(dockButton())
    expect(dockButton()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('group', { name: 'Mầm' })).toBeInTheDocument()
    expect(screen.getByTestId('mam-character').dataset.behavior).toBe('curious')

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Mầm' })).toBeNull(),
    )
    expect(dockButton()).toHaveFocus()
    expect(screen.getByTestId('mam-character').dataset.behavior).toBe('idle')
  })

  it('stores mute per session and motion per device', () => {
    render(
      <>
        <MamDockSlot />
        <MamDock />
      </>,
    )
    fireEvent.click(dockButton())

    const mute = screen.getByRole('switch', { name: 'Mầm tự lên tiếng' })
    expect(mute).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(mute)
    expect(mute).toHaveAttribute('aria-checked', 'false')
    expect(
      window.sessionStorage.getItem('mentalbridge_mam_session_muted'),
    ).toBe('true')
    expect(
      window.localStorage.getItem('mentalbridge_mam_session_muted'),
    ).toBeNull()

    const motion = screen.getByRole('switch', { name: 'Chuyển động' })
    fireEvent.click(motion)
    expect(motion).toHaveAttribute('aria-checked', 'false')
    expect(window.localStorage.getItem('mentalbridge_mam_motion')).toBe(
      'reduced',
    )
    expect(screen.getByTestId('mam-character').dataset.reduced).toBe('true')
  })

  it('locks the motion switch off under the OS reduced-motion setting', () => {
    stubMatchMedia((query) => query.includes('prefers-reduced-motion'))
    render(
      <>
        <MamDockSlot />
        <MamDock />
      </>,
    )
    fireEvent.click(dockButton())
    const motion = screen.getByRole('switch', { name: 'Chuyển động' })
    expect(motion).toHaveAttribute('aria-disabled', 'true')
    expect(motion).toHaveAttribute('aria-checked', 'false')
    expect(motion).toHaveAccessibleDescription(
      'Thiết bị của bạn đang bật giảm chuyển động.',
    )
    fireEvent.click(motion)
    expect(window.localStorage.getItem('mentalbridge_mam_motion')).toBeNull()
  })

  it('hides Mầm behind a handle that survives a remount and shows it again', async () => {
    const { unmount } = render(
      <>
        <MamDockSlot />
        <MamDock />
      </>,
    )
    fireEvent.click(dockButton())
    fireEvent.click(screen.getByRole('button', { name: 'Ẩn Mầm' }))

    const handle = await screen.findByRole('button', { name: 'Hiện Mầm' })
    await waitFor(() => expect(handle).toHaveFocus())
    expect(screen.queryByTestId('mam-character')).toBeNull()
    expect(window.localStorage.getItem('mentalbridge_mam_hidden')).toBe('true')
    unmount()

    render(
      <>
        <MamDockSlot />
        <MamDock />
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Hiện Mầm' }))
    await waitFor(() => expect(dockButton()).toHaveFocus())
    expect(window.localStorage.getItem('mentalbridge_mam_hidden')).toBe('false')
  })

  it('closes the menu and stays still while a modal is open', async () => {
    render(
      <>
        <MamDockSlot />
        <MamDock />
      </>,
    )
    fireEvent.click(dockButton())

    const modal = document.createElement('div')
    modal.setAttribute('aria-modal', 'true')
    await act(async () => {
      document.body.appendChild(modal)
    })

    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Mầm' })).toBeNull(),
    )
    expect(screen.getByTestId('mam-character').dataset.reduced).toBe('true')

    await act(async () => {
      modal.remove()
    })
    await waitFor(() =>
      expect(screen.getByTestId('mam-character').dataset.reduced).toBe('false'),
    )
    expect(screen.queryByRole('group', { name: 'Mầm' })).toBeNull()
  })

  it('closes the menu when focus moves to the page', async () => {
    render(
      <>
        <button type="button">Trang</button>
        <MamDockSlot />
        <MamDock />
      </>,
    )
    dockButton().focus()
    fireEvent.click(dockButton())
    expect(screen.getByRole('group', { name: 'Mầm' })).toBeInTheDocument()
    screen.getByRole('button', { name: 'Trang' }).focus()
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Mầm' })).toBeNull(),
    )
  })

  it('keeps Mầm still on the journal list without touching the motion preference', () => {
    navigation.pathname = '/journal'
    const { rerender } = render(
      <>
        <MamDockSlot />
        <MamDock />
      </>,
    )
    expect(screen.getByTestId('mam-character').dataset.reduced).toBe('true')
    expect(window.localStorage.getItem('mentalbridge_mam_motion')).toBeNull()

    navigation.pathname = '/dashboard'
    rerender(
      <>
        <MamDockSlot />
        <MamDock />
      </>,
    )
    expect(screen.getByTestId('mam-character').dataset.reduced).toBe('false')
    expect(character.mounts).toBe(1)
  })

  it('closes the menu on a route change', async () => {
    const { rerender } = render(
      <>
        <MamDockSlot />
        <MamDock />
      </>,
    )
    fireEvent.click(dockButton())
    navigation.pathname = '/achievements'
    rerender(
      <>
        <MamDockSlot />
        <MamDock />
      </>,
    )
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Mầm' })).toBeNull(),
    )
  })
})
