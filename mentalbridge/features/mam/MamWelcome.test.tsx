import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
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
import { resetMamRendererFailure } from './mam-failure'
import { resetMamWelcomeAttempts } from './mam-welcome-attempts'
import { setMamHidden, setMamMotionOff } from './mam-preferences'
import { useMamSuppress } from './mam-suppression'
import { FLIGHT_MS } from './mam-welcome-flight'
import { loadMamDockHost } from './testing/load-mam-dock-host'

// The welcome airplane on the host (MB-894, docs/ADR_MAM_RIVE_V2_CONTRACT.md).

const navigation = vi.hoisted(() => ({ pathname: '/dashboard' }))
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }))

const character = vi.hoisted(() => ({
  status: 'ready' as 'ready' | 'loading' | 'fallback',
}))
vi.mock('./MamCharacter', async () => {
  const { useEffect } = await import('react')
  return {
    MamCharacter: (props: {
      behavior: string
      visible?: boolean
      oneShot?: { kind: string } | null
      onStatusChange?: (status: 'ready' | 'fallback') => void
    }) => {
      useEffect(() => {
        if (character.status !== 'loading')
          props.onStatusChange?.(character.status)
        // Mount only: the status is reported once, as the real character does.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return (
        <span
          data-testid="mam-character"
          data-behavior={props.behavior}
          data-visible={props.visible ?? true}
          data-one-shot={props.oneShot?.kind ?? ''}
        />
      )
    },
  }
})

const KEY = 'mentalbridge_mam_welcome:u1'
const mode = () =>
  document.querySelector('[data-mam-dock]')?.getAttribute('data-mam-travel')
const plane = () => document.querySelectorAll('[data-mam-plane]')
// An exited layer may linger a frame in jsdom; what matters is that nothing of it shows.
const shown = () =>
  Array.from(plane())
    .filter((el) => (el as HTMLElement).style.opacity !== '0')
    .map((el) => (el as HTMLElement).dataset.mamPlane)
const ms = (time: number) => act(() => vi.advanceTimersByTimeAsync(time))
const TO_FLIGHT = 700 + 50

function Suppressed({
  on = true,
  mode = 'hide',
}: Readonly<{ on?: boolean; mode?: 'hide' | 'suppress' }>) {
  useMamSuppress(on, mode)
  return null
}

const app = (extra?: React.ReactNode) => (
  <>
    {extra}
    <button type="button">Hành động trên trang</button>
    <MamDockSlot accountId="u1" />
    <MamDock />
  </>
)

// jsdom has no PointerEvent; the host only listens for the event name.
if (!('PointerEvent' in window))
  Object.defineProperty(window, 'PointerEvent', { value: MouseEvent })

beforeAll(loadMamDockHost, 20_000)

describe('Mầm welcome airplane', () => {
  beforeEach(() => {
    navigation.pathname = '/dashboard'
    character.status = 'ready'
    resetMamRendererFailure()
    resetMamWelcomeAttempts()
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.history.replaceState(null, '', '/dashboard')
    Object.defineProperty(navigator, 'webdriver', {
      value: false,
      configurable: true,
    })
    window.matchMedia = vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn()
        disconnect = vi.fn()
      },
    )
    vi.useFakeTimers()
  })

  afterEach(async () => {
    cleanup()
    // Let Motion's own pending frame run on the fake clock; a frame left behind would stall it for the next test.
    await vi.advanceTimersByTimeAsync(200)
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    Reflect.deleteProperty(navigator, 'webdriver')
    Reflect.deleteProperty(document, 'visibilityState')
    setMamMotionOff(false)
    setMamHidden(false)
    document.body.innerHTML = ''
  })

  it('holds the dock character back, then flies once on /dashboard when ready', async () => {
    render(app())
    expect(screen.getByTestId('mam-character').dataset.visible).toBe('false')
    expect(mode()).toBe('dock')
    await ms(TO_FLIGHT)
    expect(mode()).toBe('welcome')
    expect(screen.getByTestId('mam-character').dataset.visible).toBe('true')
    expect(plane().length).toBeGreaterThan(0)
    expect(window.sessionStorage.getItem(KEY)).toBe('1')
    // The plane never takes a pointer.
    expect(document.querySelector('[data-mam-plane="front"]')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    await ms(FLIGHT_MS.end + 100)
    expect(mode()).toBe('dock')
    // The greeting follows the landing.
    expect(screen.getByTestId('mam-character').dataset.oneShot).toBe('wave')
    await ms(1000)
    expect(shown()).toHaveLength(0)
  })

  it('does not repeat after a re-render, a navigation or a remount', async () => {
    const { rerender, unmount } = render(app())
    await ms(TO_FLIGHT + FLIGHT_MS.end + 600)
    expect(mode()).toBe('dock')
    rerender(app())
    navigation.pathname = '/resources'
    rerender(app())
    navigation.pathname = '/dashboard'
    rerender(app())
    await ms(TO_FLIGHT + 200)
    expect(mode()).toBe('dock')
    unmount()
    render(app())
    await ms(TO_FLIGHT + 200)
    expect(mode()).toBe('dock')
  })

  it('replays with ?mamWelcome=1 even after the session flag', async () => {
    window.sessionStorage.setItem(KEY, '1')
    window.history.replaceState(null, '', '/dashboard?mamWelcome=1')
    render(app())
    await ms(TO_FLIGHT)
    expect(mode()).toBe('welcome')
  })

  it('never starts for an automated browser, but the replay query still does', async () => {
    Object.defineProperty(navigator, 'webdriver', {
      value: true,
      configurable: true,
    })
    const { unmount } = render(app())
    await ms(TO_FLIGHT + 200)
    expect(mode()).toBe('dock')
    unmount()
    window.history.replaceState(null, '', '/dashboard?mamWelcome=1')
    render(app())
    await ms(TO_FLIGHT)
    expect(mode()).toBe('welcome')
  })

  it.each([
    ['a QUIET route', () => (navigation.pathname = '/journal')],
    ['reduced motion', () => setMamMotionOff(true)],
    ['a hidden Mầm', () => setMamHidden(true)],
    [
      'a hidden tab',
      () =>
        Object.defineProperty(document, 'visibilityState', {
          value: 'hidden',
          configurable: true,
        }),
    ],
  ])('does not start under %s', async (_name, arrange) => {
    arrange()
    render(app())
    await ms(TO_FLIGHT + 300)
    expect(mode()).not.toBe('welcome')
    expect(shown()).toHaveLength(0)
  })

  it('does not start inside a modal or safety zone', async () => {
    render(app(<Suppressed />))
    await ms(TO_FLIGHT + 300)
    expect(mode()).not.toBe('welcome')
  })

  const visible = () => screen.getByTestId('mam-character').dataset.visible

  it('holds Mầm back while the asset loads, then shows her and skips the scene after 4 s', async () => {
    character.status = 'loading'
    render(app())
    await ms(3500)
    expect(visible()).toBe('false')
    await ms(700)
    expect(visible()).toBe('true')
    expect(mode()).toBe('dock')
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
  })

  it('shows the static pose at once when the character falls back, with no scene', async () => {
    character.status = 'fallback'
    render(app())
    expect(visible()).toBe('true')
    await ms(TO_FLIGHT + 300)
    expect(visible()).toBe('true')
    expect(mode()).toBe('dock')
  })

  it('keeps Mầm visible inside a no-interrupt zone, and a later release never starts the scene', async () => {
    const { rerender } = render(app(<Suppressed mode="suppress" />))
    expect(visible()).toBe('true')
    await ms(4500)
    expect(visible()).toBe('true')
    rerender(app(<Suppressed on={false} mode="suppress" />))
    await ms(TO_FLIGHT + 1000)
    expect(mode()).toBe('dock')
    expect(visible()).toBe('true')
  })

  it('ends the wait when the user starts to use the page', async () => {
    render(app())
    await ms(300)
    fireEvent.keyDown(document.body, { key: 'a' })
    await ms(TO_FLIGHT + 500)
    expect(mode()).toBe('dock')
    expect(visible()).toBe('true')
  })

  it.each(['/resources', '/achievements', '/analytics'])(
    'is eligible on the first FULL route, %s, not only /dashboard',
    async (path) => {
      navigation.pathname = path
      window.history.replaceState(null, '', path)
      render(app())
      await ms(TO_FLIGHT)
      expect(mode()).toBe('welcome')
    },
  )

  it('never plays on a QUIET route and plays once on the first FULL route after it', async () => {
    navigation.pathname = '/journal'
    const { rerender } = render(app())
    expect(visible()).toBe('true')
    await ms(TO_FLIGHT + 300)
    expect(mode()).toBe('dock')
    navigation.pathname = '/resources'
    rerender(app())
    await ms(TO_FLIGHT)
    expect(mode()).toBe('welcome')
    await ms(FLIGHT_MS.end + 600)
    // QUIET again, then FULL again: the welcome never replays.
    navigation.pathname = '/journal'
    rerender(app())
    navigation.pathname = '/analytics'
    rerender(app())
    await ms(TO_FLIGHT + 300)
    expect(mode()).toBe('dock')
  })

  it('input that ends the wait also ends it for later FULL routes', async () => {
    const { rerender } = render(app())
    await ms(300)
    fireEvent.keyDown(document.body, { key: 'a' })
    expect(window.sessionStorage.getItem(KEY)).toBe('1')
    navigation.pathname = '/achievements'
    rerender(app())
    await ms(TO_FLIGHT + 300)
    expect(mode()).toBe('dock')
  })

  it('a wait that ended on the 4 s cap never holds Mầm back again on later FULL routes or after a HIDDEN one', async () => {
    character.status = 'loading'
    const { rerender, unmount } = render(app())
    await ms(4500)
    expect(visible()).toBe('true')
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
    character.status = 'ready'
    navigation.pathname = '/achievements'
    rerender(app())
    // No hold: she is shown at once and no scene starts.
    expect(visible()).toBe('true')
    await ms(TO_FLIGHT + 300)
    expect(mode()).toBe('dock')
    // FULL, HIDDEN, FULL: the host remounts and still does not hold her back.
    unmount()
    navigation.pathname = '/dashboard'
    render(app())
    expect(visible()).toBe('true')
    await ms(TO_FLIGHT + 300)
    expect(mode()).toBe('dock')
  })

  it('a failed start check (a viewport under 480 px high) counts as attempted too', async () => {
    const height = window.innerHeight
    Object.defineProperty(window, 'innerHeight', {
      value: 400,
      configurable: true,
    })
    try {
      const { rerender } = render(app())
      await ms(TO_FLIGHT + 300)
      expect(mode()).toBe('dock')
      expect(visible()).toBe('true')
      navigation.pathname = '/analytics'
      rerender(app())
      expect(visible()).toBe('true')
      await ms(TO_FLIGHT + 300)
      expect(mode()).toBe('dock')
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        value: height,
        configurable: true,
      })
    }
  })

  it('?mamWelcome=1 still replays after an attempt', async () => {
    character.status = 'loading'
    const { unmount } = render(app())
    await ms(4500)
    unmount()
    character.status = 'ready'
    window.history.replaceState(null, '', '/dashboard?mamWelcome=1')
    render(app())
    await ms(TO_FLIGHT)
    expect(mode()).toBe('welcome')
  })

  it('becomes due when /dashboard is reached later in the session, once', async () => {
    navigation.pathname = '/journal'
    const { rerender } = render(app())
    await ms(TO_FLIGHT + 300)
    expect(mode()).toBe('dock')
    navigation.pathname = '/dashboard'
    rerender(app())
    expect(visible()).toBe('false')
    await ms(TO_FLIGHT)
    expect(mode()).toBe('welcome')
    await ms(FLIGHT_MS.end + 600)
    navigation.pathname = '/resources'
    rerender(app())
    navigation.pathname = '/dashboard'
    rerender(app())
    await ms(TO_FLIGHT + 300)
    expect(mode()).toBe('dock')
  })

  it('replays with the query once per page load, not on every return', async () => {
    window.history.replaceState(null, '', '/dashboard?mamWelcome=1')
    const { rerender } = render(app())
    await ms(TO_FLIGHT + FLIGHT_MS.end + 600)
    navigation.pathname = '/resources'
    rerender(app())
    navigation.pathname = '/dashboard'
    rerender(app())
    await ms(TO_FLIGHT + 300)
    expect(mode()).toBe('dock')
  })

  it('a resize in flight skips the scene', async () => {
    render(app())
    await ms(TO_FLIGHT + 1500)
    expect(mode()).toBe('welcome')
    fireEvent(window, new Event('resize'))
    await ms(0)
    expect(mode()).toBe('dock')
  })

  it.each([
    ['pointerdown', (target: Element) => fireEvent.pointerDown(target)],
    ['keydown', () => fireEvent.keyDown(document.body, { key: 'a' })],
    ['wheel', () => fireEvent.wheel(document.body)],
    ['touchstart', (target: Element) => fireEvent.touchStart(target)],
  ])('%s cancels at once and leaves no plane behind', async (_name, input) => {
    render(app())
    await ms(TO_FLIGHT + 1500)
    expect(mode()).toBe('welcome')
    const action = screen.getByRole('button', { name: 'Hành động trên trang' })
    const onClick = vi.fn()
    action.addEventListener('click', onClick)
    input(action)
    await ms(0)
    expect(mode()).toBe('dock')
    // The plane fades over 180 ms, then it is gone; the greeting never plays.
    await ms(2000)
    expect(shown()).toHaveLength(0)
    expect(screen.getByTestId('mam-character').dataset.oneShot).toBe('')
    // The input still reaches the page.
    fireEvent.click(action)
    expect(onClick).toHaveBeenCalledOnce()
    await ms(FLIGHT_MS.end)
    expect(mode()).toBe('dock')
  })

  it('a route change in flight ends the scene', async () => {
    const { rerender } = render(app())
    await ms(TO_FLIGHT + 1500)
    navigation.pathname = '/resources'
    rerender(app())
    await ms(2000)
    expect(mode()).toBe('dock')
    expect(shown()).toHaveLength(0)
  })

  it('unmounting mid-flight leaves no timers or frames behind', async () => {
    const { unmount } = render(app())
    await ms(TO_FLIGHT + 1500)
    expect(mode()).toBe('welcome')
    unmount()
    expect(shown()).toHaveLength(0)
    await ms(FLIGHT_MS.end)
    expect(vi.getTimerCount()).toBe(0)
  })
})
