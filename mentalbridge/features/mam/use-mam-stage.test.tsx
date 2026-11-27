import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { MamPlayContext } from './mam-orchestrator'
import { useMamDevIntent, useMamStage } from './use-mam-stage'

const context = (patch: Partial<MamPlayContext> = {}): MamPlayContext => ({
  routeMode: 'full',
  viewportWidth: 1440,
  reduced: false,
  hidden: false,
  gates: {
    calm: true,
    present: true,
    festive: true,
    touch: true,
    autonomous: true,
  },
  ...patch,
})

function setup(initial: Partial<MamPlayContext> = {}) {
  let ctx = context(initial)
  let mode = 'dock'
  const travel = {
    sleep: vi.fn(async () => {}),
    scene: vi.fn(async () => true),
    welcome: vi.fn(async () => true),
    snap: vi.fn(() => {
      mode = 'dock'
    }),
    mode: () => mode,
  }
  const playLocal = vi.fn()
  const dockRef = {
    current: {
      getBoundingClientRect: () => new DOMRect(24, 700, 96, 96),
    } as HTMLButtonElement,
  }
  const hook = renderHook(() =>
    useMamStage({
      travel: travel as never,
      dockRef,
      size: 96,
      playLocal,
      getContext: () => ctx,
    }),
  )
  return {
    ...hook,
    travel,
    playLocal,
    setMode: (next: string) => {
      mode = next
    },
    setContext(patch: Partial<MamPlayContext>) {
      ctx = { ...ctx, ...patch }
      hook.rerender()
    },
  }
}

describe('useMamStage (host adapter)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('a one-shot variation reaches the stage channel, ends by itself and reports what runs', () => {
    const { result } = setup()
    act(
      () =>
        void result.current.orchestrator.play('ENCOURAGE', {
          source: 'saved',
          variation: 'nod',
        }),
    )
    expect(result.current.shot).toMatchObject({
      kind: 'nod',
      key: expect.stringMatching(/^stage:/),
    })
    expect(result.current.current).toMatchObject({
      intent: 'ENCOURAGE',
      variation: 'nod',
    })
    expect(result.current.lastVariation).toBe('nod')
    act(() => void vi.advanceTimersByTime(900))
    expect(result.current.current).toBeNull()
    expect(result.current.shot).toBeNull()
    expect(result.current.lastVariation).toBe('nod')
  })

  it('props, a loop and the gaze follow the sequence and are all gone after it', () => {
    const { result } = setup()
    act(
      () =>
        void result.current.orchestrator.play('COMFORT', {
          source: 't',
          variation: 'umbrella',
        }),
    )
    expect(result.current.loop).toBe('gentle')
    expect(result.current.props).toEqual([
      { id: 'umbrella', phase: 'in', side: 'right' },
    ])
    act(() => void vi.advanceTimersByTime(3900))
    expect(result.current.props).toEqual([
      { id: 'umbrella', phase: 'out', side: 'right' },
    ])
    expect(result.current.loop).toBeNull()
    act(() => result.current.removeProp('umbrella'))
    expect(result.current.props).toEqual([])

    act(
      () =>
        void result.current.orchestrator.play('IDLE', {
          source: 't',
          variation: 'butterfly',
        }),
    )
    expect(result.current.gaze).not.toBeNull()
    act(() => void vi.advanceTimersByTime(4400))
    expect(result.current.gaze).toBeNull()
  })

  it('the plant pot hides her until it lands', () => {
    const { result } = setup()
    act(
      () =>
        void result.current.orchestrator.play('WELCOME', {
          source: 'welcome',
          variation: 'plant_pot',
        }),
    )
    expect(result.current.concealed).toBe(true)
    expect(result.current.props.map((p) => p.id)).toEqual(['plantPot'])
    act(() => void vi.advanceTimersByTime(850))
    expect(result.current.concealed).toBe(false)
  })

  it('a cancel clears everything at once and snaps only a scene it owns', () => {
    const { result, travel, setMode } = setup()
    act(
      () =>
        void result.current.orchestrator.play('WELCOME', {
          source: 'welcome',
          variation: 'plant_pot',
        }),
    )
    act(() => void vi.advanceTimersByTime(1000))
    act(() => void result.current.orchestrator.cancel('route'))
    expect(result.current.props).toEqual([])
    expect(result.current.concealed).toBe(false)
    expect(result.current.shot).toBeNull()
    expect(travel.snap).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(20_000))
    expect(result.current.current).toBeNull()

    act(
      () =>
        void result.current.orchestrator.play('WELCOME', {
          source: 'welcome',
          variation: 'parachute',
        }),
    )
    setMode('scene')
    act(() => void result.current.orchestrator.cancel('input'))
    expect(travel.snap).toHaveBeenCalledTimes(1)
    expect(result.current.loop).toBeNull()
  })

  it('runs the parachute as a travel scene and the airplane as the welcome flight with its wave', async () => {
    const { result, travel, playLocal } = setup()
    act(
      () =>
        void result.current.orchestrator.play('WELCOME', {
          source: 'welcome',
          variation: 'parachute',
        }),
    )
    expect(travel.scene).toHaveBeenCalledTimes(1)
    const [duration, sample] = travel.scene.mock.calls[0] as unknown as [
      number,
      (ms: number) => { y: number },
    ]
    expect(duration).toBe(4200)
    expect(sample(0).y).toBeLessThan(-700)
    expect(sample(4200).y).toBe(0)
    act(() => void result.current.orchestrator.cancel('route'))

    await act(async () => {
      result.current.orchestrator.play('WELCOME', {
        source: 'welcome',
        variation: 'airplane',
      })
    })
    expect(travel.welcome).toHaveBeenCalledTimes(1)
    expect(playLocal).toHaveBeenCalledWith('wave')
  })

  it('adds the travel that makes a dance and a spin readable at the dock size', () => {
    const { result, travel } = setup()
    act(
      () =>
        void result.current.orchestrator.play('HAPPY', {
          source: 't',
          variation: 'tiny_dance',
        }),
    )
    expect(result.current.shot).toMatchObject({ kind: 'dance' })
    const [danceMs, dance] = travel.scene.mock.calls[0] as unknown as [
      number,
      (ms: number) => { y: number },
    ]
    expect(danceMs).toBe(2500)
    expect(dance(450).y).toBeLessThan(-6)
    act(() => void result.current.orchestrator.cancel('route'))
    act(
      () =>
        void result.current.orchestrator.play('HAPPY', {
          source: 't',
          variation: 'spin',
        }),
    )
    const [spinMs, spin] = travel.scene.mock.calls[1] as unknown as [
      number,
      (ms: number) => { y: number },
    ]
    expect(spinMs).toBe(1200)
    expect(spin(530).y).toBeLessThan(-12)
  })

  it('refreshes on every render: a lost gate cancels what it no longer allows', () => {
    const { result, setContext } = setup()
    act(
      () =>
        void result.current.orchestrator.play('IDLE', {
          source: 'idle',
          variation: 'stretch',
        }),
    )
    expect(result.current.current?.variation).toBe('stretch')
    setContext({
      gates: {
        calm: true,
        present: true,
        festive: true,
        touch: true,
        autonomous: false,
      },
    })
    expect(result.current.current).toBeNull()
    expect(result.current.shot).toBeNull()
  })

  it('cancels when the host unmounts', () => {
    const { result, unmount } = setup()
    act(() => void result.current.orchestrator.play('HAPPY', { source: 't' }))
    const orchestrator = result.current.orchestrator
    unmount()
    expect(orchestrator.current()).toBeNull()
  })
})

describe('useMamDevIntent (?mamIntent=)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState(null, '', '/')
  })

  it('plays the named intent once, 400 ms after the host is ready, with the forced variation', () => {
    window.history.replaceState(
      null,
      '',
      '/dashboard?mamIntent=celebrate&mamVariation=clap',
    )
    const play = vi.fn()
    const { rerender } = renderHook(
      ({ ready }) => useMamDevIntent(ready, play),
      { initialProps: { ready: false } },
    )
    act(() => void vi.advanceTimersByTime(1000))
    expect(play).not.toHaveBeenCalled()
    rerender({ ready: true })
    act(() => void vi.advanceTimersByTime(399))
    expect(play).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(1))
    expect(play).toHaveBeenCalledWith('CELEBRATE', {
      source: 'dev',
      variation: 'clap',
    })
    rerender({ ready: false })
    rerender({ ready: true })
    act(() => void vi.advanceTimersByTime(1000))
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('ignores an unknown or missing intent, and a host that is not ready', () => {
    const play = vi.fn()
    window.history.replaceState(null, '', '/dashboard?mamIntent=DANCE')
    renderHook(() => useMamDevIntent(true, play))
    window.history.replaceState(null, '', '/dashboard')
    renderHook(() => useMamDevIntent(true, play))
    act(() => void vi.advanceTimersByTime(2000))
    expect(play).not.toHaveBeenCalled()
  })
})
