import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  IDLE_ACTION_MAX_MS,
  IDLE_ACTION_MIN_MS,
  IDLE_ACTIONS,
  useMamIdleActions,
} from './use-mam-idle-actions'

describe('useMamIdleActions', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('plays one idle action between 25 s and 45 s, never earlier', () => {
    const play = vi.fn()
    renderHook(() => useMamIdleActions(true, play, () => 0))
    act(() => void vi.advanceTimersByTime(IDLE_ACTION_MIN_MS - 1))
    expect(play).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(1))
    expect(play).toHaveBeenCalledTimes(1)
    expect(IDLE_ACTIONS).toContain(play.mock.calls[0]![0])

    const late = vi.fn()
    renderHook(() => useMamIdleActions(true, late, () => 0.999))
    act(() => void vi.advanceTimersByTime(IDLE_ACTION_MAX_MS - 100))
    expect(late).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(100))
    expect(late).toHaveBeenCalledTimes(1)
  })

  it('never plays the same action twice in a row', () => {
    const play = vi.fn()
    renderHook(() => useMamIdleActions(true, play, () => 0))
    act(() => void vi.advanceTimersByTime(IDLE_ACTION_MIN_MS * 2 + 100))
    expect(play.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(play.mock.calls[0]![0]).not.toBe(play.mock.calls[1]![0])
  })

  it('plays at most 2 per rolling minute and skips the rest, never queueing them', () => {
    const play = vi.fn()
    renderHook(() => useMamIdleActions(true, play, () => 0))
    // Fires at 25 s, 50 s (two in the window), skips 75 s only if two are within 60 s.
    act(() => void vi.advanceTimersByTime(60_000))
    expect(play).toHaveBeenCalledTimes(2)
    // The third slot (75 s) is inside the minute that holds the 25 s and 50 s: skipped.
    act(() => void vi.advanceTimersByTime(15_000))
    expect(play).toHaveBeenCalledTimes(2)
    // 100 s: the 25 s one has aged out, so one more plays.
    act(() => void vi.advanceTimersByTime(25_000))
    expect(play).toHaveBeenCalledTimes(3)
  })

  it('drops the pending timer when disabled and waits afresh when enabled again', () => {
    const play = vi.fn()
    const { rerender } = renderHook(
      ({ on }) => useMamIdleActions(on, play, () => 0),
      { initialProps: { on: true } },
    )
    act(() => void vi.advanceTimersByTime(20_000))
    rerender({ on: false })
    act(() => void vi.advanceTimersByTime(120_000))
    expect(play).not.toHaveBeenCalled()
    rerender({ on: true })
    act(() => void vi.advanceTimersByTime(IDLE_ACTION_MIN_MS - 1))
    expect(play).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(1))
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('toggling enabled cannot beat the per-minute cap', () => {
    const play = vi.fn()
    const { rerender } = renderHook(
      ({ on }) => useMamIdleActions(on, play, () => 0),
      { initialProps: { on: true } },
    )
    for (let i = 0; i < 3; i++) {
      act(() => void vi.advanceTimersByTime(IDLE_ACTION_MIN_MS))
      rerender({ on: false })
      rerender({ on: true })
    }
    // 25 s each: two plays, then the third falls inside the same minute.
    expect(play).toHaveBeenCalledTimes(2)
  })

  it('skips an action while the user is typing in a field', () => {
    const play = vi.fn()
    renderHook(() => useMamIdleActions(true, play, () => 0))
    const input = document.createElement('input')
    document.body.append(input)
    input.focus()
    act(() => void vi.advanceTimersByTime(IDLE_ACTION_MIN_MS))
    expect(play).not.toHaveBeenCalled()
    // Not queued: it waits for the next slot, which plays once typing is over.
    input.blur()
    act(() => void vi.advanceTimersByTime(IDLE_ACTION_MIN_MS - 1))
    expect(play).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(1))
    expect(play).toHaveBeenCalledTimes(1)
  })
})
