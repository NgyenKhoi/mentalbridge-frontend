import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useMamIdle } from './use-mam-idle'

describe('useMamIdle', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('fires once after 60 s without input', () => {
    const onIdle = vi.fn()
    renderHook(() => useMamIdle(true, onIdle))
    act(() => vi.advanceTimersByTime(59_999))
    expect(onIdle).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it.each([
    'pointermove',
    'pointerdown',
    'keydown',
    'wheel',
    'touchstart',
    'scroll',
  ])('a %s restarts the wait', (type) => {
    const onIdle = vi.fn()
    renderHook(() => useMamIdle(true, onIdle))
    act(() => vi.advanceTimersByTime(50_000))
    act(() => {
      window.dispatchEvent(new Event(type))
    })
    act(() => vi.advanceTimersByTime(50_000))
    expect(onIdle).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(10_000))
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('waits afresh when enabled again, and never fires while disabled', () => {
    const onIdle = vi.fn()
    const { rerender } = renderHook(
      ({ enabled }) => useMamIdle(enabled, onIdle),
      { initialProps: { enabled: false } },
    )
    act(() => vi.advanceTimersByTime(120_000))
    expect(onIdle).not.toHaveBeenCalled()
    rerender({ enabled: true })
    act(() => vi.advanceTimersByTime(30_000))
    rerender({ enabled: false })
    act(() => vi.advanceTimersByTime(60_000))
    expect(onIdle).not.toHaveBeenCalled()
    rerender({ enabled: true })
    act(() => vi.advanceTimersByTime(59_000))
    expect(onIdle).not.toHaveBeenCalled()
  })
})
