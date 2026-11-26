import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { getMamTrajectory } from './browser-mam-trajectory'
import type { MamTrajectoryView } from './mam-trajectory-source'

import { MamDock } from './MamDock'
import { MamDockSlot } from './MamDockSlot'
import { dispatchMamEvent } from './mam-events'
import { resetMamRendererFailure } from './mam-failure'
import { resetMamDailyMemory } from './mam-daily'
import { MAM_LINES, resetMamLines } from './mam-lines'
import { setMamMotionOff, setMamMuted, setMamHidden } from './mam-preferences'
import { resetMamWelcomeAttempts } from './mam-welcome-attempts'
import { loadMamDockHost } from './testing/load-mam-dock-host'

// MB-897 at the host: the daily trajectory moment and the verified events reach the dock as one bubble and one
// look, under the same gates as every other automatic Mầm moment.

const navigation = vi.hoisted(() => ({ pathname: '/dashboard' }))
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }))
vi.mock('./browser-mam-trajectory', () => ({
  getMamTrajectory: vi.fn(),
}))
const lookBack = vi.mocked(getMamTrajectory)

vi.mock('./MamCharacter', async () => {
  const { useEffect } = await import('react')
  return {
    MamCharacter: (props: {
      behavior: string
      oneShot?: { kind: string } | null
      onStatusChange?: (status: 'ready') => void
    }) => {
      useEffect(() => {
        props.onStatusChange?.('ready')
        // Mount only, as the real character reports its status once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return (
        <span
          data-testid="mam-character"
          data-behavior={props.behavior}
          data-one-shot={props.oneShot?.kind ?? ''}
        />
      )
    },
  }
})

const today = () => {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
const shift = (days: number) => {
  const [year, month, day] = today().split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}
const series = (
  levels: number[],
  over: Partial<MamTrajectoryView> = {},
): MamTrajectoryView => ({
  asOfLocalDate: today(),
  days: levels.map((emotionLevel, index) => ({
    localDate: shift(index - (levels.length - 1)),
    emotionLevel,
  })),
  narrative: 'STEADY',
  band: { readable: true, moderatePlus: false, transition: null },
  partial: false,
  ...over,
})

const bubble = () => document.querySelector('[data-mam-bubble="celebration"]')
const textOf = () => bubble()?.textContent ?? ''
const saysOneOf = (lines: readonly string[]) =>
  lines.some((line) => textOf().includes(line))

function stubMatchMedia() {
  window.matchMedia = vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

const mountDock = () =>
  render(
    <>
      <MamDockSlot accountId="acct-1" />
      <MamDock />
    </>,
  )

beforeAll(loadMamDockHost, 20_000)

describe('Mầm trajectory at the host', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    navigation.pathname = '/dashboard'
    resetMamRendererFailure()
    resetMamWelcomeAttempts()
    resetMamDailyMemory()
    resetMamLines()
    window.localStorage.clear()
    window.sessionStorage.clear()
    Object.defineProperty(navigator, 'webdriver', {
      value: true,
      configurable: true,
    })
    stubMatchMedia()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn()
        disconnect = vi.fn()
      },
    )
    lookBack.mockReset()
    lookBack.mockResolvedValue(series([4, 5, 4, 2]))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    Reflect.deleteProperty(navigator, 'webdriver')
    document.body.innerHTML = ''
  })

  it('shows the first FULL visit of the day as one bubble with a line of the state, then not again', async () => {
    const first = mountDock()
    await waitFor(() => expect(saysOneOf(MAM_LINES.DIP_AFTER_GOOD)).toBe(true))
    // One close button dismisses it, and focus is not stolen from the page.
    expect(bubble()?.getAttribute('role')).toBe('group')
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    await waitFor(() => expect(bubble()).toBeNull())
    first.unmount()
    mountDock()
    await screen.findByTestId('mam-character')
    await act(async () => {})
    expect(lookBack).toHaveBeenCalledTimes(1)
    expect(bubble()).toBeNull()
  })

  it('keeps an emoji to look at but hides it from the screen reader', async () => {
    lookBack.mockResolvedValue(series([4, 4, 4, 4]))
    mountDock()
    await waitFor(() => expect(saysOneOf(MAM_LINES.STEADY_GOOD)).toBe(true))
    const emoji = bubble()?.querySelector(
      '[role="status"] [aria-hidden="true"]',
    )
    expect(emoji?.textContent).toMatch(/^\p{Extended_Pictographic}/u)
    // What a screen reader gets from the line has no emoji in it.
    const spoken = bubble()?.querySelector('[role="status"]')
    const readable = Array.from(spoken?.querySelectorAll('div') ?? [])
      .flatMap((node) =>
        Array.from(node.childNodes).flatMap((child) =>
          child.nodeType === Node.TEXT_NODE ? [child.textContent] : [],
        ),
      )
      .join('')
    expect(readable).not.toMatch(/\p{Extended_Pictographic}/u)
  })

  it('waits on a QUIET route and speaks at the next FULL one', async () => {
    navigation.pathname = '/journal'
    const view = mountDock()
    await screen.findByTestId('mam-character')
    await act(async () => {})
    expect(lookBack).not.toHaveBeenCalled()
    expect(bubble()).toBeNull()
    navigation.pathname = '/dashboard'
    view.rerender(
      <>
        <MamDockSlot accountId="acct-1" />
        <MamDock />
      </>,
    )
    await waitFor(() => expect(saysOneOf(MAM_LINES.DIP_AFTER_GOOD)).toBe(true))
  })

  it('answers a verified event right on the QUIET route where it happened', async () => {
    window.localStorage.setItem(`mentalbridge_mam_daily:acct-1:${today()}`, '1')
    navigation.pathname = '/support-plan'
    mountDock()
    await screen.findByTestId('mam-character')
    act(() => dispatchMamEvent({ type: 'support-done' }))
    await waitFor(() => expect(saysOneOf(MAM_LINES.SUPPORT_DONE)).toBe(true))
  })

  it('comforts on the journal page after a low journal mood', async () => {
    window.localStorage.setItem(`mentalbridge_mam_daily:acct-1:${today()}`, '1')
    navigation.pathname = '/journal'
    mountDock()
    await screen.findByTestId('mam-character')
    act(() => dispatchMamEvent({ type: 'journal-saved', mood: 'VERY_LOW' }))
    await waitFor(() => expect(saysOneOf(MAM_LINES.FIRST_LOW)).toBe(true))
  })

  it('shows a COMFORT line after a low check-in, with no celebration look', async () => {
    window.localStorage.setItem(`mentalbridge_mam_daily:acct-1:${today()}`, '1')
    mountDock()
    await screen.findByTestId('mam-character')
    act(() =>
      dispatchMamEvent({
        type: 'checkin-saved',
        emotion: 'VERY_LOW',
        intensity: 3,
        localDate: today(),
      }),
    )
    await waitFor(() => expect(saysOneOf(MAM_LINES.DIP_AFTER_GOOD)).toBe(true))
    expect(screen.getByTestId('mam-character').dataset.behavior).not.toBe(
      'happy',
    )
    // No link to the achievements: this is not an award.
    expect(bubble()?.querySelector('a')).toBeNull()
  })

  it('shows nothing when muted, hidden or when the series cannot be read', async () => {
    setMamMuted(true)
    const muted = mountDock()
    await screen.findByTestId('mam-character')
    await act(async () => {})
    expect(bubble()).toBeNull()
    expect(lookBack).not.toHaveBeenCalled()
    muted.unmount()
    setMamMuted(false)

    setMamHidden(true)
    const hidden = mountDock()
    await act(async () => {})
    expect(bubble()).toBeNull()
    expect(lookBack).not.toHaveBeenCalled()
    hidden.unmount()
    setMamHidden(false)

    lookBack.mockRejectedValue(new Error('down'))
    mountDock()
    await screen.findByTestId('mam-character')
    await act(async () => {})
    expect(bubble()).toBeNull()
  })

  it('still shows the bubble with reduced motion, and starts no look', async () => {
    setMamMotionOff(true)
    mountDock()
    await waitFor(() => expect(saysOneOf(MAM_LINES.DIP_AFTER_GOOD)).toBe(true))
    expect(screen.getByTestId('mam-character').dataset.oneShot).toBe('')
  })

  it('no celebration on a harder look-back: a bounce back stays silent', async () => {
    lookBack.mockResolvedValue(series([2, 3, 2, 4], { narrative: 'HARDER' }))
    mountDock()
    await screen.findByTestId('mam-character')
    await act(async () => {})
    await waitFor(() => expect(lookBack).toHaveBeenCalled())
    expect(bubble()).toBeNull()
  })
})
