import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { MamDock } from './MamDock'
import { MamDockSlot } from './MamDockSlot'
import { observeMamAwardRead, type MamAward } from './mam-celebrations'
import { resetMamRendererFailure } from './mam-failure'
import { dispatchMamSaved } from './mam-saved'
import { useMamSuppress } from './mam-suppression'
import { loadMamDockHost } from './testing/load-mam-dock-host'
import { useMamTarget } from './use-mam-target'

// Captured before any test fakes timers: Motion paints on real frames.
const realTimeout = globalThis.setTimeout

const navigation = vi.hoisted(() => ({ pathname: '/dashboard' }))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}))

const character = vi.hoisted(() => ({
  mounts: 0,
  plays: 0,
  ready: false,
  fallback: null as 'error' | 'unsupported' | null,
}))

vi.mock('./MamCharacter', async () => {
  const { useEffect } = await import('react')
  return {
    MamCharacter: (props: {
      size: number
      behavior: string
      reducedMotion: boolean
      oneShot?: { kind: string } | null
      onStatusChange?: (status: 'ready') => void
      onFallback?: (reason: 'error' | 'unsupported') => void
    }) => {
      useEffect(() => {
        character.mounts += 1
        if (character.ready) props.onStatusChange?.('ready')
        if (character.fallback) props.onFallback?.(character.fallback)
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

// The dock host is lazy (MB-781): load it once, as the app does.
beforeAll(loadMamDockHost, 20_000)

describe('MamDock', () => {
  beforeEach(() => {
    navigation.pathname = '/dashboard'
    character.mounts = 0
    character.plays = 0
    character.ready = false
    character.fallback = null
    // The dizzy latch lasts for the page; each test is a fresh page.
    resetMamRendererFailure()
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
  // MB-814: the living Mầm. The character is a stub; the host's own gates,
  // labels and sequences are what these cover.
  describe('living Mầm', () => {
    function Cards() {
      const ref = useMamTarget({ kind: 'home.next-step' })
      return (
        <main className="ref-content">
          <section ref={ref} aria-label="Bước tiếp theo">
            <button type="button">Làm ngay</button>
          </section>
        </main>
      )
    }
    const living = (cards = true) => (
      <>
        {cards ? <Cards /> : null}
        <MamDockSlot />
        <MamDock />
      </>
    )
    const root = () => document.querySelector('[data-mam-dock]')!
    const anyDock = () => screen.getByRole('button', { name: /^Mầm/ })
    // Sequences resume on promises: advance the clock the async way, inside act.
    const advance = (ms: number) =>
      act(async () => {
        await vi.advanceTimersByTimeAsync(ms)
      })
    const behavior = () =>
      screen.getByTestId('mam-character').getAttribute('data-behavior')
    const tip = () => screen.queryByRole('group', { name: 'Mầm' })
    const motionStub = (reduced: boolean, coarse = false) =>
      stubMatchMedia(
        (query) =>
          (reduced && query.includes('prefers-reduced-motion')) ||
          (coarse && query === '(pointer: coarse)'),
      )
    const press = (
      type: 'pointerDown' | 'pointerMove' | 'pointerUp',
      x: number,
      y: number,
    ) =>
      fireEvent[type](anyDock(), {
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        clientX: x,
        clientY: y,
      })

    beforeEach(() => {
      character.ready = true
      if (!('PointerEvent' in window))
        vi.stubGlobal(
          'PointerEvent',
          class extends MouseEvent {
            pointerType: string
            pointerId: number
            isPrimary: boolean
            constructor(type: string, init: PointerEventInit = {}) {
              super(type, init)
              this.pointerType = init.pointerType ?? 'mouse'
              this.pointerId = init.pointerId ?? 0
              this.isPrimary = init.isPrimary ?? false
            }
          },
        )
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    describe('the one-time tip', () => {
      const realSetTimeout = globalThis.setTimeout
      const realWait = (ms: number) =>
        new Promise<void>((resolve) => realSetTimeout(resolve, ms))

      it('shows once, 1.4 s after load, and is marked seen', () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
        const { unmount } = render(living())
        act(() => vi.advanceTimersByTime(1399))
        expect(tip()).toBeNull()
        act(() => vi.advanceTimersByTime(1))
        act(() => vi.advanceTimersByTime(100))
        expect(tip()).toHaveTextContent(
          'Mẹo nè: chuột phải vào thẻ bất kỳ, mình sẽ trèo lên giải thích cho bạn.',
        )
        expect(window.localStorage.getItem('mentalbridge_mam_tip_seen')).toBe(
          'true',
        )
        // The tip never takes focus (it is automatic).
        expect(dockButton()).not.toHaveFocus()
        fireEvent.click(screen.getByRole('button', { name: 'Cảm ơn Mầm' }))
        unmount()

        render(living())
        act(() => vi.advanceTimersByTime(5000))
        expect(tip()).toBeNull()
      })

      it('uses the long-press copy on a coarse pointer', () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
        motionStub(false, true)
        render(living())
        act(() => vi.advanceTimersByTime(1400))
        act(() => vi.advanceTimersByTime(200))
        expect(tip()).toHaveTextContent(
          'Mẹo nè: nhấn giữ vào thẻ bất kỳ, mình sẽ trèo lên giải thích cho bạn.',
        )
      })

      it('shows without a hop under reduced motion', () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
        motionStub(true)
        render(living())
        act(() => vi.advanceTimersByTime(1600))
        expect(tip()).not.toBeNull()
        expect(root()).toHaveAttribute('data-mam-travel', 'dock')
      })

      it.each([
        [
          '"tự lên tiếng" is off',
          () =>
            window.sessionStorage.setItem(
              'mentalbridge_mam_session_muted',
              'true',
            ),
        ],
        [
          'Mầm is hidden',
          () => window.localStorage.setItem('mentalbridge_mam_hidden', 'true'),
        ],
        [
          'the tip was seen',
          () =>
            window.localStorage.setItem('mentalbridge_mam_tip_seen', 'true'),
        ],
      ])('stays away when %s', (_name, arrange) => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
        arrange()
        render(living())
        act(() => vi.advanceTimersByTime(5000))
        expect(tip()).toBeNull()
        expect(screen.queryByText(/Mẹo nè/)).toBeNull()
      })

      it('needs a registered element target on the page', () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
        render(living(false))
        act(() => vi.advanceTimersByTime(5000))
        expect(tip()).toBeNull()
        expect(window.localStorage.getItem('mentalbridge_mam_tip_seen')).toBe(
          null,
        )
      })

      it('waits while a feature zone is quiet', () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
        function Zone() {
          useMamSuppress(true)
          return null
        }
        render(
          <>
            <Zone />
            {living()}
          </>,
        )
        act(() => vi.advanceTimersByTime(5000))
        expect(tip()).toBeNull()
      })

      it('leaves one bubble: a tip left open holds an award that becomes due', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
        vi.setSystemTime(new Date(2026, 9, 27, 10, 0, 0))
        window.localStorage.removeItem('mentalbridge_mam_tip_seen')
        navigation.pathname = '/dashboard'
        Object.defineProperty(navigator, 'locks', {
          configurable: true,
          value: {
            request: (_name: string, callback: () => unknown) =>
              Promise.resolve().then(callback),
          },
        })
        const read = (awards: MamAward[]) => ({
          scope: 'achievements:JOURNAL',
          available: true,
          visible: true,
          readAt: Date.now(),
          awards,
        })
        const earned = Date.now() - 60_000
        await observeMamAwardRead('u1', read([]))
        await observeMamAwardRead(
          'u1',
          read([
            {
              key: `achievement:a:${new Date(earned).toISOString()}`,
              kind: 'achievement',
              at: earned,
              title: 'Thành tựu a',
            },
          ]),
        )
        render(
          <>
            <Cards />
            <MamDockSlot accountId="u1" />
            <MamDock />
          </>,
        )
        const bubbles = () => document.querySelectorAll('[data-mam-bubble]')
        const oneShot = () =>
          screen.getByTestId('mam-character').getAttribute('data-one-shot')

        await act(() => vi.advanceTimersByTimeAsync(1600))
        expect(bubbles()).toHaveLength(1)
        expect(bubbles()[0]).toHaveAttribute('data-mam-bubble', 'tip')
        // The coalescing window closes while the tip is still open: held.
        await act(() => vi.advanceTimersByTimeAsync(15_000))
        expect(bubbles()).toHaveLength(1)
        expect(oneShot()).toBe('')

        fireEvent.click(screen.getByRole('button', { name: 'Cảm ơn Mầm' }))
        await act(() => vi.advanceTimersByTimeAsync(200))
        expect(oneShot()).toBe('celebrate_hero')
        await act(() => realWait(400)) // the tip's exit animation
        await act(() => vi.advanceTimersByTimeAsync(3000))
        expect(bubbles()).toHaveLength(1)
        expect(bubbles()[0]).toHaveAttribute('data-mam-bubble', 'celebration')
      })
    })

    describe('the dock menu lead', () => {
      it('names the right-click path on a fine pointer, even with the tip off', () => {
        window.localStorage.setItem('mentalbridge_mam_tip_seen', 'true')
        render(living())
        fireEvent.click(dockButton())
        expect(
          screen.getByText(
            'Mầm ngồi ở góc này và chỉ lên tiếng khi bạn cần. Chuột phải vào một thẻ để hỏi Mầm về thẻ đó.',
          ),
        ).toBeInTheDocument()
      })

      it('names the long-press path on a coarse pointer', () => {
        motionStub(false, true)
        render(living())
        fireEvent.click(dockButton())
        expect(
          screen.getByText(
            'Mầm ngồi ở góc này và chỉ lên tiếng khi bạn cần. Nhấn giữ vào một thẻ để hỏi Mầm về thẻ đó.',
          ),
        ).toBeInTheDocument()
      })
    })

    describe('dizzy', () => {
      beforeEach(() => {
        window.localStorage.setItem('mentalbridge_mam_tip_seen', 'true')
      })

      it('shows for a renderer failure, with the failure label and swirl eyes', async () => {
        character.fallback = 'error'
        render(living())
        const dock = await screen.findByRole('button', {
          name: 'Mầm đang gặp sự cố',
        })
        expect(root()).toHaveAttribute('data-mam-dizzy', 'true')
        expect(behavior()).toBe('gentle')
        // Two swirl eyes and a wobbly mouth over the calm pose.
        expect(dock.querySelectorAll('svg ellipse')).toHaveLength(3)
        expect(dock.querySelectorAll('svg [data-star]')).toHaveLength(3)
        expect(dock.querySelector('[data-still]')).toHaveAttribute(
          'data-still',
          'false',
        )
      })

      it('plays for 8 s, settles, and plays again each time the message opens', async () => {
        vi.useFakeTimers({
          toFake: ['setTimeout', 'clearTimeout', 'Date'],
          shouldAdvanceTime: true,
        })
        character.fallback = 'error'
        render(living())
        const dock = await screen.findByRole('button', {
          name: 'Mầm đang gặp sự cố',
        })
        const art = () => dock.querySelector('[data-still]')!
        expect(art()).toHaveAttribute('data-still', 'false')
        act(() => vi.advanceTimersByTime(7900))
        expect(art()).toHaveAttribute('data-still', 'false')
        act(() => vi.advanceTimersByTime(200))
        expect(art()).toHaveAttribute('data-still', 'true')

        fireEvent.click(dock)
        expect(art()).toHaveAttribute('data-still', 'false')
        act(() => vi.advanceTimersByTime(8100))
        expect(art()).toHaveAttribute('data-still', 'true')
      })

      it('keeps Tab inside the open message', async () => {
        character.fallback = 'error'
        render(living())
        const dock = await screen.findByRole('button', {
          name: 'Mầm đang gặp sự cố',
        })
        fireEvent.click(dock)
        const dialog = await screen.findByRole('dialog', { name: 'Mầm' })
        const close = screen.getByRole('button', { name: 'Đóng Mầm' })
        const hide = screen.getByRole('button', { name: 'Ẩn Mầm' })
        hide.focus()
        fireEvent.keyDown(hide, { key: 'Tab' })
        expect(close).toHaveFocus()
        fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
        expect(hide).toHaveFocus()
        // A middle button leaves Tab alone.
        const confirm = screen.getByRole('button', { name: 'Đã hiểu' })
        confirm.focus()
        expect(fireEvent.keyDown(confirm, { key: 'Tab' })).toBe(true)
        expect(dialog).not.toHaveAttribute('aria-modal')
      })

      it('is static under reduced motion', async () => {
        motionStub(true)
        character.fallback = 'error'
        render(living())
        const dock = await screen.findByRole('button', {
          name: 'Mầm đang gặp sự cố',
        })
        expect(dock.querySelector('[data-still]')).toHaveAttribute(
          'data-still',
          'true',
        )
      })

      it('is not shown for an unsupported device', () => {
        character.fallback = 'unsupported'
        render(living())
        expect(root()).toHaveAttribute('data-mam-dizzy', 'false')
        fireEvent.click(dockButton())
        expect(screen.getByRole('group', { name: 'Mầm' })).toBeInTheDocument()
      })

      it('a tap says so, with Đã hiểu and Ẩn Mầm, and hands focus back', async () => {
        character.fallback = 'error'
        render(living())
        const dock = await screen.findByRole('button', {
          name: 'Mầm đang gặp sự cố',
        })
        dock.focus()
        fireEvent.click(dock)
        const dialog = await screen.findByRole('dialog', { name: 'Mầm' })
        await waitFor(() =>
          expect(dialog).toHaveTextContent(
            'Mình đang bị choáng một chút nên tạm thời chưa giúp được. Bạn vẫn dùng trang bình thường nha, lát nữa gọi lại mình nè.',
          ),
        )
        expect(screen.queryByRole('group', { name: 'Mầm' })).toBeNull()
        expect(screen.getByRole('button', { name: 'Đã hiểu' })).toHaveFocus()
        expect(
          screen.getByRole('button', { name: 'Ẩn Mầm' }),
        ).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Đã hiểu' }))
        await waitFor(() => expect(dock).toHaveFocus())
        await waitFor(() =>
          expect(screen.queryByRole('dialog', { name: 'Mầm' })).toBeNull(),
        )
      })

      it('Escape closes the message and Ẩn Mầm hides the broken Mầm', async () => {
        character.fallback = 'error'
        render(living())
        const dock = await screen.findByRole('button', {
          name: 'Mầm đang gặp sự cố',
        })
        dock.focus()
        fireEvent.click(dock)
        await screen.findByRole('dialog', { name: 'Mầm' })
        fireEvent.keyDown(document, { key: 'Escape' })
        await waitFor(() =>
          expect(screen.queryByRole('dialog', { name: 'Mầm' })).toBeNull(),
        )
        expect(dock).toHaveFocus()

        fireEvent.click(dock)
        fireEvent.click(await screen.findByRole('button', { name: 'Ẩn Mầm' }))
        expect(
          await screen.findByRole('button', { name: 'Hiện Mầm' }),
        ).toBeInTheDocument()
        expect(window.localStorage.getItem('mentalbridge_mam_hidden')).toBe(
          'true',
        )
      })
    })

    // Before the suites that fake every timer: Motion's frame loop paints on real frames.
    describe('first drag move', () => {
      it('a fast first move already carries Mầm, and the release keeps the movement', async () => {
        const capture = vi.fn()
        HTMLElement.prototype.setPointerCapture = capture
        render(living())
        const mover = anyDock().querySelector<HTMLElement>('[class*="mover"]')!
        const shift = () =>
          Number(
            /translateX\((-?[\d.]+)px\)/.exec(
              mover.getAttribute('style') ?? '',
            )?.[1],
          )
        press('pointerDown', 50, 700)
        await act(() => new Promise<void>((r) => realTimeout(r, 25)))
        press('pointerMove', 300, 500)
        // The release comes inside the 90 ms window, so the flick is thrown.
        press('pointerUp', 300, 500)
        expect(root()).toHaveAttribute('data-mam-travel', 'fly')
        // Carried by the first move (250 px), then flung on to the right.
        await waitFor(() => expect(shift()).toBeGreaterThan(260))
        delete (HTMLElement.prototype as { setPointerCapture?: unknown })
          .setPointerCapture
      })
    })

    describe('sleep', () => {
      const sleep = async () => {
        await advance(60_000)
        await advance(1500)
      }

      beforeEach(() => {
        window.localStorage.setItem('mentalbridge_mam_tip_seen', 'true')
        vi.useFakeTimers()
      })

      it('lies down after 60 s without input, then wakes on a tap that opens no menu', async () => {
        render(living())
        await advance(59_000)
        expect(root()).toHaveAttribute('data-mam-sleep', 'false')
        await advance(1000)
        expect(root()).toHaveAttribute('data-mam-sleep', 'true')
        expect(
          screen.getByRole('button', {
            name: 'Mầm đang ngủ, bấm để đánh thức',
          }),
        ).toBeInTheDocument()
        // The asset sets the blanket once the lie-down rotation ends.
        expect(behavior()).toBe('idle')
        await advance(1200)
        expect(behavior()).toBe('sleep')

        // Page input does not wake Mầm.
        fireEvent.keyDown(document.body, { key: 'a' })
        fireEvent.pointerMove(document.body)
        await advance(2000)
        expect(root()).toHaveAttribute('data-mam-sleep', 'true')

        const sleeping = screen.getByRole('button', {
          name: 'Mầm đang ngủ, bấm để đánh thức',
        })
        fireEvent.click(sleeping)
        expect(sleeping).toHaveAttribute('aria-expanded', 'false')
        expect(screen.queryByRole('group', { name: 'Mầm' })).toBeNull()
        await advance(3000)
        expect(root()).toHaveAttribute('data-mam-sleep', 'false')
        expect(behavior()).toBe('idle')
        expect(dockButton()).toHaveAttribute('aria-label', 'Mầm')
      })

      it('input before 60 s restarts the wait', async () => {
        render(living())
        await advance(50_000)
        fireEvent.keyDown(document.body, { key: 'a' })
        await advance(50_000)
        expect(root()).toHaveAttribute('data-mam-sleep', 'false')
        await advance(10_000)
        expect(root()).toHaveAttribute('data-mam-sleep', 'true')
      })

      it('does not sleep with the menu open', async () => {
        render(living())
        fireEvent.click(dockButton())
        await sleep()
        expect(root()).toHaveAttribute('data-mam-sleep', 'false')
      })

      it('does not sleep before the character is ready', async () => {
        character.ready = false
        render(living())
        await sleep()
        expect(root()).toHaveAttribute('data-mam-sleep', 'false')
      })

      it('never sleeps under reduced motion', async () => {
        motionStub(true)
        render(living())
        await sleep()
        expect(root()).toHaveAttribute('data-mam-sleep', 'false')
      })

      it('does not sleep while a feature zone is quiet', async () => {
        function Zone({ on }: Readonly<{ on: boolean }>) {
          useMamSuppress(on)
          return null
        }
        const view = (on: boolean) => (
          <>
            <Zone on={on} />
            {living()}
          </>
        )
        const { rerender } = render(view(true))
        await sleep()
        expect(root()).toHaveAttribute('data-mam-sleep', 'false')
        rerender(view(false))
        await sleep()
        expect(root()).toHaveAttribute('data-mam-sleep', 'true')
      })

      it('does not sleep while dizzy', async () => {
        character.fallback = 'error'
        render(living())
        await sleep()
        expect(root()).toHaveAttribute('data-mam-sleep', 'false')
      })

      it('a celebration wakes a sleeping Mầm without ceremony', async () => {
        navigation.pathname = '/support-plan'
        render(living())
        await sleep()
        expect(root()).toHaveAttribute('data-mam-sleep', 'true')
        act(() => dispatchMamSaved())
        expect(root()).toHaveAttribute('data-mam-sleep', 'false')
        expect(
          screen.getByTestId('mam-character').getAttribute('data-one-shot'),
        ).toBe('light_success')
      })

      it('a drag wakes a sleeping Mầm quietly', async () => {
        render(living())
        await sleep()
        press('pointerDown', 50, 700)
        press('pointerMove', 80, 650)
        expect(root()).toHaveAttribute('data-mam-sleep', 'false')
        expect(root()).toHaveAttribute('data-mam-travel', 'drag')
      })
    })

    describe('drag and throw', () => {
      beforeEach(() => {
        window.localStorage.setItem('mentalbridge_mam_tip_seen', 'true')
      })

      it('captures the pointer at the press, so a fast first move off the button still drags', () => {
        const capture = vi.fn()
        HTMLElement.prototype.setPointerCapture = capture
        render(living())
        press('pointerDown', 50, 700)
        expect(capture).toHaveBeenCalledWith(1)
        // The very first move is already far away: the drag starts anyway.
        press('pointerMove', 300, 500)
        expect(root()).toHaveAttribute('data-mam-travel', 'drag')
        delete (HTMLElement.prototype as { setPointerCapture?: unknown })
          .setPointerCapture
      })

      it('a press that moves under 6 px is a tap and opens the menu', async () => {
        render(living())
        press('pointerDown', 50, 700)
        press('pointerMove', 53, 702)
        press('pointerUp', 53, 702)
        fireEvent.click(dockButton())
        expect(root()).toHaveAttribute('data-mam-travel', 'dock')
        expect(screen.getByRole('group', { name: 'Mầm' })).toBeInTheDocument()
      })

      it('leaves the tab order while Mầm is away from the dock', async () => {
        vi.useFakeTimers()
        render(living())
        expect(anyDock()).not.toHaveAttribute('tabindex')
        press('pointerDown', 50, 700)
        press('pointerMove', 90, 600)
        expect(anyDock()).toHaveAttribute('tabindex', '-1')
        press('pointerUp', 90, 600)
        await advance(20_000)
        expect(anyDock()).not.toHaveAttribute('tabindex')
      })

      it('drags past 6 px, throws, hops home and ignores the click that ends the drag', async () => {
        vi.useFakeTimers()
        render(living())
        press('pointerDown', 50, 700)
        press('pointerMove', 90, 600)
        expect(root()).toHaveAttribute('data-mam-travel', 'drag')
        expect(root()).toHaveAttribute('data-front', 'true')
        expect(behavior()).toBe('curious')
        press('pointerMove', 120, 520)
        press('pointerUp', 120, 520)
        fireEvent.click(dockButton())
        expect(root()).toHaveAttribute('data-mam-travel', 'fly')
        expect(screen.queryByRole('group', { name: 'Mầm' })).toBeNull()

        await advance(20_000)
        expect(root()).toHaveAttribute('data-mam-travel', 'dock')
        expect(root()).toHaveAttribute('data-front', 'false')
        expect(behavior()).toBe('idle')
        // After the drag a plain tap works again.
        fireEvent.click(dockButton())
        expect(screen.getByRole('group', { name: 'Mầm' })).toBeInTheDocument()
      })

      it('Escape during the flight snaps Mầm home', async () => {
        vi.useFakeTimers()
        render(living())
        press('pointerDown', 50, 700)
        press('pointerMove', 90, 600)
        press('pointerUp', 90, 600)
        await advance(100)
        expect(root()).toHaveAttribute('data-mam-travel', 'fly')
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(root()).toHaveAttribute('data-mam-travel', 'dock')
      })

      it('a route change during the flight snaps Mầm home', async () => {
        vi.useFakeTimers()
        const { rerender } = render(living())
        press('pointerDown', 50, 700)
        press('pointerMove', 90, 600)
        press('pointerUp', 90, 600)
        await advance(100)
        expect(root()).toHaveAttribute('data-mam-travel', 'fly')
        navigation.pathname = '/achievements'
        rerender(living())
        expect(root()).toHaveAttribute('data-mam-travel', 'dock')
      })

      it('a modal during the flight snaps Mầm home', async () => {
        vi.useFakeTimers()
        render(living())
        press('pointerDown', 50, 700)
        press('pointerMove', 90, 600)
        press('pointerUp', 90, 600)
        await advance(100)
        const modal = document.createElement('div')
        modal.setAttribute('aria-modal', 'true')
        await act(async () => {
          document.body.appendChild(modal)
          await vi.advanceTimersByTimeAsync(50)
        })
        expect(root()).toHaveAttribute('data-mam-travel', 'dock')
      })

      it.each([
        ['reduced motion', () => motionStub(true)],
        [
          'dizzy',
          () => {
            character.fallback = 'error'
          },
        ],
      ])('does not drag under %s', (_name, arrange) => {
        arrange()
        render(living())
        const dock = screen.getByRole('button', { name: /^Mầm/ })
        fireEvent.pointerDown(dock, {
          pointerId: 1,
          isPrimary: true,
          button: 0,
          clientX: 50,
          clientY: 700,
        })
        fireEvent.pointerMove(dock, {
          pointerId: 1,
          isPrimary: true,
          clientX: 120,
          clientY: 600,
        })
        expect(root()).toHaveAttribute('data-mam-travel', 'dock')
      })
    })

    // ---- Round 1 review ---------------------------------------------------
    describe('round 1 review', () => {
      function Zone({ on }: Readonly<{ on: boolean }>) {
        useMamSuppress(on)
        return null
      }
      const quiet = (on: boolean) => (
        <>
          <Zone on={on} />
          {living()}
        </>
      )

      beforeEach(() => {
        window.localStorage.setItem('mentalbridge_mam_tip_seen', 'true')
      })

      it('stays dizzy across an excluded route and back', async () => {
        character.fallback = 'error'
        const { rerender } = render(living())
        await screen.findByRole('button', { name: 'Mầm đang gặp sự cố' })
        // A reload is the only way out: the renderer would now succeed.
        character.fallback = null
        navigation.pathname = '/support-plan/today'
        rerender(living())
        expect(screen.queryByTestId('mam-character')).toBeNull()
        navigation.pathname = '/dashboard'
        rerender(living())
        expect(
          await screen.findByRole('button', { name: 'Mầm đang gặp sự cố' }),
        ).toBeInTheDocument()
        expect(root()).toHaveAttribute('data-mam-dizzy', 'true')
      })

      it('suppression freezes the dizzy playback and releases it after', async () => {
        character.fallback = 'error'
        const { rerender } = render(quiet(false))
        const dock = await screen.findByRole('button', {
          name: 'Mầm đang gặp sự cố',
        })
        const art = () => dock.querySelector('[data-still]')!
        expect(art()).toHaveAttribute('data-still', 'false')
        rerender(quiet(true))
        await waitFor(() => expect(art()).toHaveAttribute('data-still', 'true'))
        rerender(quiet(false))
        await waitFor(() =>
          expect(art()).toHaveAttribute('data-still', 'false'),
        )
      })

      it('suppression keeps a settled sleep asleep, frozen, and page input still does not wake it', async () => {
        vi.useFakeTimers()
        const { rerender } = render(quiet(false))
        await advance(60_000)
        await advance(1500)
        expect(root()).toHaveAttribute('data-mam-sleep', 'true')
        expect(behavior()).toBe('sleep')
        rerender(quiet(true))
        await advance(100)
        expect(root()).toHaveAttribute('data-mam-suppressed', 'true')
        fireEvent.keyDown(document.body, { key: 'a' })
        fireEvent.pointerMove(document.body)
        await advance(3000)
        expect(root()).toHaveAttribute('data-mam-sleep', 'true')
        expect(behavior()).toBe('sleep')
      })

      it('suppression during the sleep transform lands asleep in the settled pose', async () => {
        vi.useFakeTimers()
        const { rerender } = render(quiet(false))
        await advance(60_000)
        await advance(300)
        expect(behavior()).toBe('idle')
        rerender(quiet(true))
        await advance(2000)
        expect(root()).toHaveAttribute('data-mam-sleep', 'true')
        expect(behavior()).toBe('sleep')
        expect(root()).toHaveAttribute('data-mam-travel', 'dock')
      })
    })
  })
})
