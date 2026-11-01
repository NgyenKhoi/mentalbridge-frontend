import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { MamCharacter as MamCharacterComponent } from './MamCharacter'

let MamCharacter: typeof MamCharacterComponent

const runtime = vi.hoisted(() => {
  const state = {
    wasmUrl: '',
    fallbackUrl: 'unset' as string | null,
    runtimeError: null as Error | null,
    loadError: false,
    instances: [] as Array<{
      options: Record<string, unknown>
      cleanup: ReturnType<typeof vi.fn>
      load: () => void
      values: Record<string, VmValue>
      fired: string[]
      complete: () => void
    }>,
  }

  type VmValue = {
    value: unknown
    listeners: Set<() => void>
    on: (cb: () => void) => void
    off: (cb?: () => void) => void
  }
  const vmValue = (value: unknown): VmValue => {
    const listeners = new Set<() => void>()
    return {
      value,
      listeners,
      on: (cb) => listeners.add(cb),
      off: (cb) => (cb ? listeners.delete(cb) : listeners.clear()),
    }
  }
  const oneShots = ['light_success', 'celebrate_soft', 'celebrate_hero']

  class Rive {
    cleanup = vi.fn()
    values: Record<string, VmValue> = {
      behaviorState: vmValue('idle'),
      celebrationTier: vmValue('none'),
      attentionDirection: vmValue(0),
      reducedMotion: vmValue(false),
      isVisible: vmValue(true),
    }
    fired: string[] = []
    // Models the asset writing `idle` when a one-shot ends or is interrupted.
    assetWritesIdle = () => {
      const behavior = this.values.behaviorState!
      behavior.value = 'idle'
      behavior.listeners.forEach((cb) => cb())
    }
    viewModelInstance = {
      enum: (path: string) => this.values[path] ?? null,
      number: (path: string) => this.values[path] ?? null,
      boolean: (path: string) => this.values[path] ?? null,
      trigger: (path: string) =>
        path === 'playOnce' || path === 'returnToDock'
          ? {
              trigger: () => {
                this.fired.push(path)
                if (
                  path === 'returnToDock' &&
                  oneShots.includes(String(this.values.behaviorState!.value))
                )
                  this.assetWritesIdle()
              },
            }
          : null,
    }
    resizeDrawingSurfaceToCanvas = vi.fn()
    constructor(public options: Record<string, unknown>) {
      state.instances.push({
        options,
        cleanup: this.cleanup,
        values: this.values,
        fired: this.fired,
        complete: () => this.assetWritesIdle(),
        load: () =>
          state.loadError
            ? (options.onLoadError as () => void)()
            : (options.onLoad as () => void)(),
      })
    }
  }

  return {
    state,
    module: {
      Rive,
      Layout: class {
        constructor(public options: unknown) {}
      },
      Fit: { Contain: 'contain' },
      Alignment: { Center: 'center' },
      RuntimeLoader: {
        setWasmUrl: (url: string) => {
          state.wasmUrl = url
        },
        setWasmFallbackUrl: (url: string | null) => {
          state.fallbackUrl = url
        },
        getInstance: (ok: () => void, fail: (error: Error) => void) =>
          state.runtimeError ? fail(state.runtimeError) : ok(),
      },
    },
  }
})

vi.mock('@rive-app/canvas-lite', () => runtime.module)

const reducedMotion = vi.hoisted(() => ({ value: false }))
vi.mock('@/lib/animations/use-reduced-motion', () => ({
  useReactiveReducedMotion: () => reducedMotion.value,
}))

beforeEach(async () => {
  // The asset cache is module state: every test gets a fresh module.
  vi.resetModules()
  ;({ MamCharacter } = await import('./MamCharacter'))
  runtime.state.instances = []
  runtime.state.runtimeError = null
  runtime.state.loadError = false
  reducedMotion.value = false
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    {} as CanvasRenderingContext2D,
  )
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function loaded() {
  await waitFor(() => expect(runtime.state.instances).toHaveLength(1))
  const instance = runtime.state.instances[0]!
  act(() => instance.load())
  return instance
}

describe('MamCharacter', () => {
  it('shows the static pose and hides itself from assistive technology while loading', () => {
    const { container } = render(<MamCharacter size={96} />)
    const root = container.firstElementChild!
    expect(root.getAttribute('aria-hidden')).toBe('true')
    expect(root.getAttribute('data-mam-status')).toBe('loading')
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      '/mam/mam-v03-idle.svg',
    )
  })

  it('loads the frozen asset from the app origin with no CDN fallback', async () => {
    const { container } = render(<MamCharacter size={96} behavior="curious" />)
    const instance = await loaded()

    expect(runtime.state.wasmUrl).toBe('/mam/rive-lite-2.47.1.wasm')
    expect(runtime.state.fallbackUrl).toBeNull()
    expect(instance.options.buffer).toBeInstanceOf(ArrayBuffer)
    expect(instance.options).toMatchObject({
      artboard: 'companion_main',
      stateMachines: 'MamBehaviorController',
      autoBind: true,
    })
    await waitFor(() =>
      expect(container.firstElementChild?.getAttribute('data-mam-status')).toBe(
        'ready',
      ),
    )
    // The static pose stays mounted and is hidden by CSS once the canvas has faded in.
    expect(container.querySelector('img')?.getAttribute('data-ready')).toBe(
      'true',
    )
    expect(instance.values.behaviorState!.value).toBe('curious')
  })

  it('fires a one-shot once per key and never on re-render', async () => {
    const { rerender } = render(
      <MamCharacter size={96} oneShot={{ kind: 'celebrate_hero', key: 1 }} />,
    )
    const instance = await loaded()
    await waitFor(() => expect(instance.fired).toEqual(['playOnce']))

    rerender(
      <MamCharacter
        size={96}
        attention={-0.5}
        oneShot={{ kind: 'celebrate_hero', key: 1 }}
      />,
    )
    expect(instance.fired).toEqual(['playOnce'])

    rerender(
      <MamCharacter size={96} oneShot={{ kind: 'light_success', key: 2 }} />,
    )
    await waitFor(() => expect(instance.fired).toHaveLength(2))
  })

  it('replays an older key that follows a different one (A, B, A)', async () => {
    const shot = (key: string) => ({ kind: 'light_success' as const, key })
    const { rerender } = render(<MamCharacter size={96} oneShot={shot('a')} />)
    const instance = await loaded()
    await waitFor(() => expect(instance.fired).toHaveLength(1))
    rerender(<MamCharacter size={96} oneShot={shot('b')} />)
    rerender(<MamCharacter size={96} oneShot={shot('a')} />)
    await waitFor(() => expect(instance.fired).toHaveLength(3))
  })

  it('interrupts a running one-shot for a new looping state and keeps it after the hero would have ended', async () => {
    const { rerender } = render(
      <MamCharacter size={96} oneShot={{ kind: 'celebrate_hero', key: 1 }} />,
    )
    const instance = await loaded()
    await waitFor(() =>
      expect(instance.values.behaviorState!.value).toBe('celebrate_hero'),
    )

    rerender(<MamCharacter size={96} behavior="thinking" oneShot={null} />)
    await waitFor(() => expect(instance.fired).toContain('returnToDock'))
    act(() => instance.complete()) // a late completion write must not win
    expect(instance.values.behaviorState!.value).toBe('thinking')
  })

  it('restores the host state when a one-shot ends on its own, and does not interrupt it for unrelated props', async () => {
    const { rerender } = render(
      <MamCharacter
        size={96}
        behavior="explaining"
        oneShot={{ kind: 'celebrate_soft', key: 1 }}
      />,
    )
    const instance = await loaded()
    await waitFor(() =>
      expect(instance.values.behaviorState!.value).toBe('celebrate_soft'),
    )
    rerender(
      <MamCharacter
        size={96}
        behavior="explaining"
        attention={0.5}
        oneShot={{ kind: 'celebrate_soft', key: 1 }}
      />,
    )
    expect(instance.fired).not.toContain('returnToDock')
    expect(instance.values.behaviorState!.value).toBe('celebrate_soft')

    act(() => instance.complete())
    expect(instance.values.behaviorState!.value).toBe('explaining')
  })

  it('follows a live OS reduced-motion change after the character is ready', async () => {
    const { container, rerender } = render(<MamCharacter size={96} />)
    const instance = await loaded()
    await waitFor(() =>
      expect(container.firstElementChild?.getAttribute('data-mam-status')).toBe(
        'ready',
      ),
    )
    reducedMotion.value = true
    rerender(
      <MamCharacter size={96} oneShot={{ kind: 'celebrate_hero', key: 9 }} />,
    )
    await waitFor(() => expect(instance.values.reducedMotion!.value).toBe(true))
    expect(instance.fired).toEqual([])
    expect(container.firstElementChild?.getAttribute('data-mam-reduced')).toBe(
      'true',
    )
  })

  it("exposes the user's motion setting to CSS even when the OS allows motion", () => {
    const { container } = render(<MamCharacter size={96} reducedMotion />)
    expect(container.firstElementChild?.getAttribute('data-mam-reduced')).toBe(
      'true',
    )
  })

  it.each(['after', 'before'])(
    'falls back for good when the canvas context is lost %s the asset loads',
    async (moment) => {
      const { container } = render(<MamCharacter size={96} />)
      await waitFor(() => expect(runtime.state.instances).toHaveLength(1))
      const instance = runtime.state.instances[0]!
      const canvas = container.querySelector('canvas')!
      if (moment === 'after') act(() => instance.load())
      act(() => {
        canvas.dispatchEvent(new Event('contextlost'))
      })
      if (moment === 'before') act(() => instance.load())

      await waitFor(() =>
        expect(
          container.firstElementChild?.getAttribute('data-mam-status'),
        ).toBe('fallback'),
      )
      expect(instance.cleanup).toHaveBeenCalledTimes(1)
      expect(container.querySelector('img')?.getAttribute('data-ready')).toBe(
        'false',
      )
    },
  )

  it('applies OS reduced motion and blocks one-shots', async () => {
    reducedMotion.value = true
    render(
      <MamCharacter size={96} oneShot={{ kind: 'celebrate_hero', key: 1 }} />,
    )
    const instance = await loaded()
    await waitFor(() => expect(instance.values.reducedMotion!.value).toBe(true))
    expect(instance.fired).toEqual([])
  })

  it('hides the character and its static pose when not visible', async () => {
    const { container } = render(<MamCharacter size={96} visible={false} />)
    expect(container.querySelector('img')).toBeNull()
    const instance = await loaded()
    await waitFor(() => expect(instance.values.isVisible!.value).toBe(false))
  })

  it.each([
    ['the asset fails to load', () => (runtime.state.loadError = true)],
    [
      'the WASM runtime fails',
      () => (runtime.state.runtimeError = new Error('wasm')),
    ],
  ])('keeps the static pose when %s', async (_case, arrange) => {
    arrange()
    const onStatusChange = vi.fn()
    const { container } = render(
      <MamCharacter size={72} onStatusChange={onStatusChange} />,
    )
    if (!runtime.state.runtimeError) await loaded()
    await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith('fallback'))
    expect(container.querySelector('img')).not.toBeNull()
  })

  it('falls back without loading the runtime when canvas is unsupported', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const { container } = render(<MamCharacter size={72} />)
    await waitFor(() =>
      expect(container.firstElementChild?.getAttribute('data-mam-status')).toBe(
        'fallback',
      ),
    )
    expect(runtime.state.instances).toHaveLength(0)
  })

  it('downloads the asset once for every instance on the page', async () => {
    const Fresh = MamCharacter
    render(
      <>
        <Fresh size={72} />
        <Fresh size={96} />
      </>,
    )
    await waitFor(() => expect(runtime.state.instances).toHaveLength(2))
    const [first, second] = runtime.state.instances
    expect(first!.options.buffer).not.toBe(second!.options.buffer)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('/mam/mam-v03.riv')
  })

  it('keeps the static pose when the asset download fails, and retries later', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 404 }))
    const Fresh = MamCharacter
    const first = render(<Fresh size={72} />)
    await waitFor(() =>
      expect(
        first.container.firstElementChild?.getAttribute('data-mam-status'),
      ).toBe('fallback'),
    )
    expect(runtime.state.instances).toHaveLength(0)

    render(<Fresh size={72} />)
    await waitFor(() => expect(runtime.state.instances).toHaveLength(1))
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('cleans up the runtime on unmount, including during load', async () => {
    const { unmount } = render(<MamCharacter size={96} />)
    await waitFor(() => expect(runtime.state.instances).toHaveLength(1))
    const instance = runtime.state.instances[0]!
    unmount()
    expect(instance.cleanup).toHaveBeenCalledTimes(1)
    act(() => instance.load())
  })
})
