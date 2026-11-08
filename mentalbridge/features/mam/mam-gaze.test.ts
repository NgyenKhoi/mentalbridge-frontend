import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createMamGaze,
  GAZE_RADIUS_PX,
  GAZE_RESET_MS,
  gazeTarget,
  isTypingTarget,
  useMamGaze,
} from './mam-gaze'

const frame = () => vi.advanceTimersByTime(16)

describe('gazeTarget', () => {
  it('is horizontal, clamped to -1…1 and 0 beyond the radius', () => {
    expect(gazeTarget(0, 0)).toBe(0)
    expect(gazeTarget(80, 200)).toBeCloseTo(0.5)
    expect(gazeTarget(-80, -200)).toBeCloseTo(-0.5)
    expect(gazeTarget(300, 0)).toBe(1)
    expect(gazeTarget(-300, 0)).toBe(-1)
    expect(gazeTarget(GAZE_RADIUS_PX + 1, 0)).toBe(0)
    expect(gazeTarget(0, GAZE_RADIUS_PX + 1)).toBe(0)
  })
})

describe('createMamGaze', () => {
  beforeEach(() =>
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'requestAnimationFrame',
        'cancelAnimationFrame',
      ],
    }),
  )
  afterEach(() => vi.useRealTimers())

  const dock = () => ({ x: 100, y: 100 })

  it('eases toward the pointer and notifies at most once per animation frame', () => {
    const gaze = createMamGaze(dock)
    const seen: number[] = []
    gaze.subscribe(() => seen.push(gaze.get()))
    // A burst of moves inside one frame writes nothing yet.
    for (let x = 100; x < 180; x += 10) gaze.move(x, 100)
    expect(seen).toEqual([])
    frame()
    expect(seen).toHaveLength(1)
    expect(seen[0]).toBeGreaterThan(0)
    expect(seen[0]).toBeLessThan(0.5)
    for (let i = 0; i < 40; i++) frame()
    expect(gaze.get()).toBeCloseTo(0.4375, 2)
    // At rest it runs no frames and notifies no one.
    const settled = seen.length
    for (let i = 0; i < 10; i++) frame()
    expect(seen).toHaveLength(settled)
    gaze.dispose()
  })

  it('returns to the centre 2 s after the last move', () => {
    const gaze = createMamGaze(dock)
    gaze.move(260, 100)
    for (let i = 0; i < 40; i++) frame()
    expect(gaze.get()).toBeCloseTo(1, 1)
    vi.advanceTimersByTime(GAZE_RESET_MS - 17 * 0)
    for (let i = 0; i < 60; i++) frame()
    expect(gaze.get()).toBe(0)
    gaze.dispose()
  })

  it('does not reset while the pointer keeps moving', () => {
    const gaze = createMamGaze(dock)
    for (let step = 0; step < 4; step++) {
      gaze.move(260, 100)
      vi.advanceTimersByTime(GAZE_RESET_MS - 100)
    }
    expect(gaze.get()).toBeGreaterThan(0.9)
    gaze.dispose()
  })

  it('snaps back at once on disable and clamps a far pointer to 0', () => {
    const gaze = createMamGaze(dock)
    const listener = vi.fn()
    gaze.subscribe(listener)
    gaze.move(220, 100)
    for (let i = 0; i < 40; i++) frame()
    gaze.reset(true)
    expect(gaze.get()).toBe(0)
    const calls = listener.mock.calls.length
    for (let i = 0; i < 20; i++) frame()
    expect(listener.mock.calls.length).toBe(calls)
    gaze.move(100 + GAZE_RADIUS_PX + 50, 100)
    for (let i = 0; i < 40; i++) frame()
    expect(gaze.get()).toBe(0)
    gaze.dispose()
  })
})

describe('isTypingTarget', () => {
  it('is true for text fields, selects, textareas and editable content only', () => {
    const make = (html: string) => {
      document.body.innerHTML = html
      return document.body.firstElementChild
    }
    expect(isTypingTarget(make('<input type="text">'))).toBe(true)
    expect(isTypingTarget(make('<input>'))).toBe(true)
    expect(isTypingTarget(make('<textarea></textarea>'))).toBe(true)
    expect(isTypingTarget(make('<select></select>'))).toBe(true)
    expect(isTypingTarget(null)).toBe(false)
    expect(isTypingTarget(make('<input type="checkbox">'))).toBe(false)
    expect(isTypingTarget(make('<button>ok</button>'))).toBe(false)
    document.body.innerHTML = ''
  })
})

describe('useMamGaze', () => {
  beforeEach(() =>
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'requestAnimationFrame',
        'cancelAnimationFrame',
      ],
    }),
  )
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  const dockRef = () => {
    const button = document.createElement('button')
    button.getBoundingClientRect = () => new DOMRect(50, 50, 100, 100)
    document.body.append(button)
    return { current: button }
  }
  const move = (x: number, y: number, pointerType = 'mouse') => {
    const event = new MouseEvent('pointermove', { clientX: x, clientY: y })
    Object.defineProperty(event, 'pointerType', { value: pointerType })
    window.dispatchEvent(event)
  }

  it('adds one passive pointermove listener while enabled and removes it after', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const { rerender } = renderHook(({ on }) => useMamGaze(on, dockRef()), {
      initialProps: { on: true },
    })
    const moves = add.mock.calls.filter(([type]) => type === 'pointermove')
    expect(moves).toHaveLength(1)
    expect(moves[0]![2]).toEqual({ passive: true })
    rerender({ on: false })
    expect(
      remove.mock.calls.filter(([type]) => type === 'pointermove'),
    ).toHaveLength(1)
    add.mockRestore()
    remove.mockRestore()
  })

  it('follows a mouse near the dock, ignores touch, and resets when typing starts', () => {
    const { result } = renderHook(() => useMamGaze(true, dockRef()))
    act(() => move(100 + 120, 100))
    act(() => void vi.advanceTimersByTime(600))
    expect(result.current.get()).toBeGreaterThan(0.5)
    act(() => move(100 - 120, 100, 'touch'))
    act(() => void vi.advanceTimersByTime(600))
    expect(result.current.get()).toBeGreaterThan(0.5)

    const input = document.createElement('input')
    document.body.append(input)
    input.focus()
    act(() => move(100 - 120, 100))
    act(() => void vi.advanceTimersByTime(900))
    expect(result.current.get()).toBe(0)
  })

  it('disabling resets the eyes at once', () => {
    const ref = dockRef()
    const { result, rerender } = renderHook(({ on }) => useMamGaze(on, ref), {
      initialProps: { on: true },
    })
    act(() => move(100 + 120, 100))
    act(() => void vi.advanceTimersByTime(600))
    expect(result.current.get()).toBeGreaterThan(0.5)
    rerender({ on: false })
    expect(result.current.get()).toBe(0)
  })
})
