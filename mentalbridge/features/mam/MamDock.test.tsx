import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MamDock } from './MamDock'
import { MamDockSlot } from './MamDockSlot'
import { dispatchMamSaved } from './mam-saved'
import { useMamSuppress } from './mam-suppression'

const navigation = vi.hoisted(() => ({ pathname: '/dashboard' }))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}))

const character = vi.hoisted(() => ({ mounts: 0, plays: 0, ready: false }))

vi.mock('./MamCharacter', async () => {
  const { useEffect } = await import('react')
  return {
    MamCharacter: (props: {
      size: number
      behavior: string
      reducedMotion: boolean
      oneShot?: { kind: string } | null
      onStatusChange?: (status: 'ready') => void
    }) => {
      useEffect(() => {
        character.mounts += 1
        if (character.ready) props.onStatusChange?.('ready')
        // Mount only: the status is reported once, as the real character does.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      const shotKey = (props.oneShot as { key?: string } | null | undefined)
        ?.key
      useEffect(() => {
        if (shotKey) character.plays += 1
      }, [shotKey])
      return (
        <span
          data-testid="mam-character"
          data-size={props.size}
          data-behavior={props.behavior}
          data-reduced={props.reducedMotion}
          data-one-shot={props.oneShot?.kind ?? ''}
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
let resizeContent: () => void

function stubOverlap() {
  let overlapping = true
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      if (this.matches('[data-mam-dock]')) return new DOMRect(20, 700, 96, 96)
      if (this.closest('.ref-content'))
        return new DOMRect(20, overlapping ? 720 : 100, 200, 44)
      return new DOMRect()
    },
  )
  return (value: boolean) => {
    overlapping = value
  }
}

describe('MamDock', () => {
  beforeEach(() => {
    navigation.pathname = '/dashboard'
    character.mounts = 0
    character.plays = 0
    character.ready = false
    window.localStorage.clear()
    window.sessionStorage.clear()
    stubMatchMedia(() => false)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(onResize: () => void) {
          resizeContent = onResize
        }
        observe = vi.fn()
        disconnect = vi.fn()
      },
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('renders nothing without a USER layout slot', () => {
    render(<MamDock />)
    expect(screen.queryByTestId('mam-character')).toBeNull()
  })

  it('renders nothing on a route outside the surface matrix', () => {
    navigation.pathname = '/support-plan/today'
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
      expect(screen.queryByTestId('mam-character')).toBeNull(),
    )
    expect(screen.queryByRole('group', { name: 'Mầm' })).toBeNull()
    expect(document.querySelector('[data-mam-dock]')).toHaveAttribute(
      'data-mam-dock',
      'away',
    )

    await act(async () => {
      modal.remove()
    })
    const returned = await screen.findByTestId('mam-character')
    expect(returned.dataset.reduced).toBe('false')
    expect(screen.queryByRole('group', { name: 'Mầm' })).toBeNull()
  })

  it('removes the hide handle too while a dialog is open, and brings it back', async () => {
    window.localStorage.setItem('mentalbridge_mam_hidden', 'true')
    render(
      <>
        <MamDockSlot />
        <MamDock />
      </>,
    )
    expect(screen.getByRole('button', { name: 'Hiện Mầm' })).toBeInTheDocument()
    const dialog = document.createElement('dialog')
    await act(async () => {
      document.body.appendChild(dialog)
      dialog.setAttribute('open', '')
    })
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Hiện Mầm' })).toBeNull(),
    )
    await act(async () => {
      dialog.removeAttribute('open')
    })
    expect(
      await screen.findByRole('button', { name: 'Hiện Mầm' }),
    ).toBeInTheDocument()
  })

  describe('feature zones', () => {
    function Zone({
      mode,
      on = true,
    }: Readonly<{ mode?: 'hide' | 'suppress'; on?: boolean }>) {
      useMamSuppress(on, mode)
      return null
    }
    const dock = (zone: ReactNode) => (
      <>
        {zone}
        <MamDockSlot />
        <MamDock />
      </>
    )

    it('a hide zone removes the character and returns it after', async () => {
      const { rerender } = render(dock(<Zone mode="hide" />))
      await waitFor(() =>
        expect(screen.queryByTestId('mam-character')).toBeNull(),
      )
      rerender(dock(<Zone mode="hide" on={false} />))
      expect(await screen.findByTestId('mam-character')).toBeInTheDocument()
    })

    it('a plain suppress zone keeps the character, still and inert', () => {
      render(dock(<Zone />))
      expect(screen.getByTestId('mam-character').dataset.reduced).toBe('true')
      expect(document.querySelector('[data-mam-dock]')).toHaveAttribute(
        'data-mam-dock',
        'shown',
      )
    })

    it('moves focus from the dock to the page content when a hide zone removes it', async () => {
      const content = document.createElement('main')
      content.className = 'ref-content'
      content.tabIndex = -1
      document.body.appendChild(content)
      const { rerender } = render(dock(<Zone on={false} />))
      dockButton().focus()
      expect(dockButton()).toHaveFocus()
      rerender(dock(<Zone mode="hide" />))
      await waitFor(() => expect(content).toHaveFocus())
    })

    it('leaves focus alone when it is not in the dock', async () => {
      const content = document.createElement('main')
      content.className = 'ref-content'
      content.tabIndex = -1
      document.body.appendChild(content)
      const { rerender } = render(
        <>
          {dock(<Zone on={false} />)}
          <button type="button">Trang</button>
        </>,
      )
      screen.getByRole('button', { name: 'Trang' }).focus()
      rerender(
        <>
          {dock(<Zone mode="hide" />)}
          <button type="button">Trang</button>
        </>,
      )
      await waitFor(() =>
        expect(screen.queryByTestId('mam-character')).toBeNull(),
      )
      expect(screen.getByRole('button', { name: 'Trang' })).toHaveFocus()
    })

    it('a hide zone closes an open menu', async () => {
      const { rerender } = render(dock(<Zone on={false} />))
      fireEvent.click(dockButton())
      expect(screen.getByRole('group', { name: 'Mầm' })).toBeInTheDocument()
      rerender(dock(<Zone mode="hide" />))
      await waitFor(() =>
        expect(screen.queryByTestId('mam-character')).toBeNull(),
      )
      expect(screen.queryByRole('group', { name: 'Mầm' })).toBeNull()
    })
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

  it('yields to overlapping page actions and recovers on scroll, resize and content resize', async () => {
    const setOverlap = stubOverlap()
    render(
      <>
        <main className="ref-content">
          <button type="button">Lưu ghi nhận</button>
        </main>
        <MamDockSlot />
        <MamDock />
      </>,
    )
    const root = dockButton().closest('[data-mam-dock]')
    await waitFor(() => expect(root).toHaveAttribute('data-yield', 'true'))
    expect(root).toHaveAttribute('data-focus-yield', 'false')

    const action = screen.getByRole('button', { name: 'Lưu ghi nhận' })
    action.style.opacity = '0'
    act(() => resizeContent())
    await waitFor(() => expect(root).toHaveAttribute('data-yield', 'false'))
    action.style.opacity = '1'
    action.style.clipPath = 'inset(50%)'
    act(() => resizeContent())
    await waitFor(() => expect(root).toHaveAttribute('data-yield', 'false'))
    action.style.clipPath = ''
    act(() => resizeContent())
    await waitFor(() => expect(root).toHaveAttribute('data-yield', 'true'))

    setOverlap(false)
    fireEvent.scroll(window)
    await waitFor(() => expect(root).toHaveAttribute('data-yield', 'false'))
    setOverlap(true)
    fireEvent.resize(window)
    await waitFor(() => expect(root).toHaveAttribute('data-yield', 'true'))
    setOverlap(false)
    act(() => resizeContent())
    await waitFor(() => expect(root).toHaveAttribute('data-yield', 'false'))
  })

  it('rechecks actions replacing same-sized loading placeholders', async () => {
    stubOverlap()
    const { container } = render(
      <>
        <main className="ref-content" />
        <MamDockSlot />
        <MamDock />
      </>,
    )
    const root = dockButton().closest('[data-mam-dock]')
    const action = document.createElement('button')
    action.textContent = 'Lưu ghi nhận'
    act(() => container.querySelector('.ref-content')?.appendChild(action))
    await waitFor(() => expect(root).toHaveAttribute('data-yield', 'true'))
    act(() => action.remove())
    await waitFor(() => expect(root).toHaveAttribute('data-yield', 'false'))
  })

  it('keeps focus yield and lets the focused dock or its open menu take precedence', async () => {
    stubOverlap()
    render(
      <>
        <main className="ref-content">
          <button type="button">Lưu ghi nhận</button>
        </main>
        <MamDockSlot />
        <MamDock />
      </>,
    )
    const root = dockButton().closest('[data-mam-dock]')
    await waitFor(() => expect(root).toHaveAttribute('data-yield', 'true'))
    // Custom controls may focus a transparent native input under their label.
    const action = screen.getByRole('button', { name: 'Lưu ghi nhận' })
    action.style.opacity = '0'
    act(() => action.focus())
    await waitFor(() =>
      expect(root).toHaveAttribute('data-focus-yield', 'true'),
    )
    act(() => dockButton().focus())
    await waitFor(() => expect(root).toHaveAttribute('data-yield', 'false'))

    action.style.opacity = '1'
    fireEvent.click(dockButton())
    act(() => dockButton().blur())
    fireEvent.scroll(window)
    expect(dockButton()).toHaveAttribute('aria-expanded', 'true')
    await waitFor(() => expect(root).toHaveAttribute('data-yield', 'false'))
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(root).toHaveAttribute('data-yield', 'true'))
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

  it('shows on /support-plan and on no deeper SupportPlan path', () => {
    navigation.pathname = '/support-plan'
    const { unmount } = render(
      <>
        <MamDockSlot />
        <MamDock />
      </>,
    )
    expect(screen.getByTestId('mam-character')).toBeInTheDocument()
    unmount()
  })

  describe('a confirmed save', () => {
    const shown = () => (
      <>
        <MamDockSlot />
        <MamDock />
      </>
    )
    const oneShot = () =>
      screen.getByTestId('mam-character').getAttribute('data-one-shot')

    beforeEach(() => {
      navigation.pathname = '/support-plan'
      character.ready = true
    })

    it('plays light_success once, then settles', async () => {
      vi.useFakeTimers()
      render(shown())
      expect(oneShot()).toBe('')
      act(() => dispatchMamSaved())
      expect(oneShot()).toBe('light_success')
      act(() => {
        vi.advanceTimersByTime(1500)
      })
      expect(oneShot()).toBe('')
      vi.useRealTimers()
    })

    it('clears playing save feedback on navigation without replaying on return', () => {
      const { rerender } = render(shown())
      act(() => dispatchMamSaved())
      expect(oneShot()).toBe('light_success')

      navigation.pathname = '/achievements'
      rerender(shown())
      expect(oneShot()).toBe('')
      navigation.pathname = '/support-plan'
      rerender(shown())
      expect(oneShot()).toBe('')
      expect(character.mounts).toBe(1)

      act(() => dispatchMamSaved())
      expect(oneShot()).toBe('light_success')
    })

    it('does not replay an interrupted save when Mầm returns before it ends', async () => {
      function Zone({ on }: Readonly<{ on: boolean }>) {
        useMamSuppress(on, 'hide')
        return null
      }
      const withZone = (on: boolean) => (
        <>
          <Zone on={on} />
          {shown()}
        </>
      )
      const { rerender } = render(withZone(false))
      act(() => dispatchMamSaved())
      expect(oneShot()).toBe('light_success')
      expect(character.plays).toBe(1)

      rerender(withZone(true))
      await waitFor(() =>
        expect(screen.queryByTestId('mam-character')).toBeNull(),
      )
      rerender(withZone(false))
      expect(await screen.findByTestId('mam-character')).toBeInTheDocument()
      expect(oneShot()).toBe('')
      expect(character.plays).toBe(1)
    })

    it.each([
      [
        'hidden',
        () => window.localStorage.setItem('mentalbridge_mam_hidden', 'true'),
      ],
      [
        'muted',
        () =>
          window.sessionStorage.setItem(
            'mentalbridge_mam_session_muted',
            'true',
          ),
      ],
      [
        'motion off',
        () => window.localStorage.setItem('mentalbridge_mam_motion', 'reduced'),
      ],
    ])('stays still while Mầm is %s', (name, setup) => {
      setup()
      render(shown())
      act(() => dispatchMamSaved())
      // Hidden Mầm has no character at all, so nothing can play.
      if (name === 'hidden')
        expect(screen.queryByTestId('mam-character')).toBeNull()
      else expect(oneShot()).toBe('')
    })

    it('stays still while the feature reports a no-interrupt zone', () => {
      function Dirty() {
        useMamSuppress(true)
        return null
      }
      render(
        <>
          <Dirty />
          {shown()}
        </>,
      )
      act(() => dispatchMamSaved())
      expect(oneShot()).toBe('')
    })

    it('stays still while the menu is open', () => {
      render(shown())
      fireEvent.click(dockButton())
      act(() => dispatchMamSaved())
      expect(oneShot()).toBe('')
    })

    it('stays still before the character is ready', () => {
      character.ready = false
      render(shown())
      act(() => dispatchMamSaved())
      expect(oneShot()).toBe('')
    })
  })
})
