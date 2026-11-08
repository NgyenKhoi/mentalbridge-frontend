import { act, fireEvent, render, waitFor } from '@testing-library/react'
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
import { dispatchMamSaved } from './mam-saved'
import { loadMamDockHost } from './testing/load-mam-dock-host'

// MB-814 review R1-7: the real MamCharacter on the Rive control mock. A one-shot
// that wakes a sleeping Mầm must reach the asset once and must not be cancelled
// by the wake's own change of looping state.

const navigation = vi.hoisted(() => ({ pathname: '/support-plan' }))
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }))

const rive = vi.hoisted(() => {
  type Value = {
    value: unknown
    listeners: Set<() => void>
    on: (cb: () => void) => void
    off: (cb?: () => void) => void
  }
  const value = (initial: unknown): Value => {
    const listeners = new Set<() => void>()
    return {
      value: initial,
      listeners,
      on: (cb) => listeners.add(cb),
      off: (cb) => (cb ? listeners.delete(cb) : listeners.clear()),
    }
  }
  const oneShots = [
    'light_success',
    'celebrate_soft',
    'celebrate_hero',
    'drowsy',
    'wake',
    'giggle',
    'tickled',
    'nod',
    'stretch',
    'look_around',
    'scratch',
    'point',
  ]
  const state = {
    instances: [] as Array<{
      load: () => void
      fired: string[]
      values: Record<string, Value>
      complete: () => void
    }>,
  }
  class Rive {
    values: Record<string, Value> = {
      behaviorState: value('idle'),
      celebrationTier: value('none'),
      attentionDirection: value(0),
      reducedMotion: value(false),
      isVisible: value(true),
    }
    fired: string[] = []
    viewModelInstance = {
      enum: (path: string) => this.values[path] ?? null,
      number: (path: string) => this.values[path] ?? null,
      boolean: (path: string) => this.values[path] ?? null,
      trigger: (path: string) =>
        path === 'playOnce' || path === 'returnToDock'
          ? {
              trigger: () => {
                this.fired.push(path)
                const behavior = this.values.behaviorState!
                // The asset writes idle itself when a one-shot is interrupted.
                if (
                  path === 'returnToDock' &&
                  oneShots.includes(String(behavior.value))
                ) {
                  behavior.value = 'idle'
                  behavior.listeners.forEach((cb) => cb())
                }
              },
            }
          : null,
    }
    resizeDrawingSurfaceToCanvas = vi.fn()
    cleanup = vi.fn()
    constructor(public options: Record<string, unknown>) {
      state.instances.push({
        fired: this.fired,
        values: this.values,
        load: () => (options.onLoad as () => void)(),
        // The asset writes idle when a one-shot ends.
        complete: () => {
          const behavior = this.values.behaviorState!
          behavior.value = 'idle'
          behavior.listeners.forEach((cb) => cb())
        },
      })
    }
  }
  return {
    state,
    module: {
      Rive,
      Layout: class {},
      Fit: { Contain: 'contain' },
      Alignment: { Center: 'center' },
      RuntimeLoader: {
        setWasmUrl: () => {},
        setWasmFallbackUrl: () => {},
        getInstance: (ok: () => void) => ok(),
      },
    },
  }
})
vi.mock('@rive-app/canvas-lite', () => rive.module)

const realTimeout = globalThis.setTimeout

function stubBrowser() {
  vi.stubGlobal(
    'matchMedia',
    (media: string) =>
      ({
        matches: false,
        media,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))),
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    {} as CanvasRenderingContext2D,
  )
}

beforeAll(async () => {
  stubBrowser()
  await loadMamDockHost()
}, 20_000)

describe('a one-shot that wakes a sleeping Mầm', () => {
  beforeEach(() => {
    resetMamRendererFailure()
    rive.state.instances = []
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.localStorage.setItem('mentalbridge_mam_tip_seen', 'true')
    navigation.pathname = '/support-plan'
    stubBrowser()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('reaches the asset once and is not cut short by the wake', async () => {
    // Faked before the dock mounts so its idle timer is the fake one; the clock
    // still follows real time, so waitFor keeps working.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'Date'],
      shouldAdvanceTime: true,
    })
    render(
      <>
        <MamDockSlot />
        <MamDock />
      </>,
    )
    await waitFor(() => expect(rive.state.instances).toHaveLength(1))
    const instance = rive.state.instances[0]!
    act(() => instance.load())
    await waitFor(() =>
      expect(
        document
          .querySelector('[data-mam-dock] [data-mam-status]')
          ?.getAttribute('data-mam-status'),
      ).toBe('ready'),
    )

    // 60 s idle: the upright yawn (a Rive one-shot) comes first, then Mầm lies down.
    act(() => vi.advanceTimersByTime(60_000))
    await waitFor(() =>
      expect(instance.values.behaviorState!.value).toBe('drowsy'),
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2600)
    })
    await waitFor(() =>
      expect(instance.values.behaviorState!.value).toBe('sleep'),
    )
    // Idle actions and the yawn reached the asset on their own: count from here.
    instance.fired.length = 0

    act(() => dispatchMamSaved())
    await waitFor(() => expect(instance.fired).toContain('playOnce'))
    // Give the wake and the next renders time to (wrongly) cancel it.
    await act(() => new Promise<void>((resolve) => realTimeout(resolve, 400)))
    expect(instance.fired).toEqual(['playOnce'])
    // The SupportPlan save is a nod, and a sleeping Mầm is woken for it.
    expect(instance.values.behaviorState!.value).toBe('nod')
  }, 15_000)

  it('a click on a sleeping Mầm plays the Rive wake once and lands back on the host state', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'Date'],
      shouldAdvanceTime: true,
    })
    const { getByRole } = render(
      <>
        <MamDockSlot />
        <MamDock />
      </>,
    )
    await waitFor(() => expect(rive.state.instances).toHaveLength(1))
    const instance = rive.state.instances[0]!
    act(() => instance.load())
    await waitFor(() =>
      expect(
        document
          .querySelector('[data-mam-dock] [data-mam-status]')
          ?.getAttribute('data-mam-status'),
      ).toBe('ready'),
    )
    act(() => vi.advanceTimersByTime(60_000))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2600)
    })
    await waitFor(() =>
      expect(instance.values.behaviorState!.value).toBe('sleep'),
    )
    instance.fired.length = 0

    fireEvent.click(getByRole('button', { name: /đang ngủ/ }))
    await waitFor(() => expect(instance.fired).toEqual(['playOnce']))
    expect(instance.values.behaviorState!.value).toBe('wake')
    // The asset ends the wake on idle; the host's own loop state is not asleep any more.
    act(() => instance.complete())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    expect(instance.values.behaviorState!.value).not.toBe('sleep')
    expect(instance.fired.filter((kind) => kind === 'playOnce')).toHaveLength(1)
  }, 15_000)
})
