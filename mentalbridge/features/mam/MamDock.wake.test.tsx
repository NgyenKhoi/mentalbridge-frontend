import { act, render, waitFor } from '@testing-library/react'
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
  const oneShots = ['light_success', 'celebrate_soft', 'celebrate_hero']
  const state = {
    instances: [] as Array<{
      load: () => void
      fired: string[]
      values: Record<string, Value>
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

    // 60 s idle; the lie-down itself runs on real frames.
    act(() => vi.advanceTimersByTime(60_000))
    await waitFor(() =>
      expect(instance.values.behaviorState!.value).toBe('sleep'),
    )
    expect(instance.fired).toEqual([])

    act(() => dispatchMamSaved())
    await waitFor(() => expect(instance.fired).toContain('playOnce'))
    // Give the wake and the next renders time to (wrongly) cancel it.
    await act(() => new Promise<void>((resolve) => realTimeout(resolve, 400)))
    expect(instance.fired).toEqual(['playOnce'])
    expect(instance.values.behaviorState!.value).toBe('light_success')
  }, 15_000)
})
