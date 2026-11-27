import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  isMamFeatureHiding,
  isMamFeatureSuppressed,
  subscribeMamFeatureSuppression,
  useMamSuppress,
} from './mam-suppression'
import { useMamAway, useMamSuppressed } from './use-mam-suppressed'

describe('useMamSuppress', () => {
  it('a plain zone suppresses without hiding', () => {
    const { unmount } = renderHook(() => useMamSuppress(true))
    expect(isMamFeatureSuppressed()).toBe(true)
    expect(isMamFeatureHiding()).toBe(false)
    unmount()
    expect(isMamFeatureSuppressed()).toBe(false)
  })

  it('a hide zone suppresses and hides, and releases on cleanup', () => {
    const { unmount } = renderHook(() => useMamSuppress(true, 'hide'))
    expect(isMamFeatureSuppressed()).toBe(true)
    expect(isMamFeatureHiding()).toBe(true)
    unmount()
    expect(isMamFeatureSuppressed()).toBe(false)
    expect(isMamFeatureHiding()).toBe(false)
  })

  it('ref-counts: one source releasing keeps the other, per mode', () => {
    const plain = renderHook(() => useMamSuppress(true))
    const hide = renderHook(() => useMamSuppress(true, 'hide'))
    plain.unmount()
    expect(isMamFeatureHiding()).toBe(true)
    expect(isMamFeatureSuppressed()).toBe(true)
    hide.unmount()
    expect(isMamFeatureHiding()).toBe(false)
    expect(isMamFeatureSuppressed()).toBe(false)
  })

  it('registers nothing while inactive and follows the flag', () => {
    const { rerender, unmount } = renderHook(
      ({ on }) => useMamSuppress(on, 'hide'),
      { initialProps: { on: false } },
    )
    expect(isMamFeatureHiding()).toBe(false)
    rerender({ on: true })
    expect(isMamFeatureHiding()).toBe(true)
    rerender({ on: false })
    expect(isMamFeatureHiding()).toBe(false)
    unmount()
  })

  it('notifies subscribers on both edges', () => {
    const listener = vi.fn()
    const off = subscribeMamFeatureSuppression(listener)
    const { unmount } = renderHook(() => useMamSuppress(true, 'hide'))
    unmount()
    expect(listener).toHaveBeenCalledTimes(2)
    off()
  })
})

describe('useMamAway and useMamSuppressed', () => {
  it('a modal or a hide zone is away; a plain zone is only suppressed', async () => {
    const { result } = renderHook(() => ({
      away: useMamAway(),
      suppressed: useMamSuppressed(),
    }))
    expect(result.current).toEqual({ away: false, suppressed: false })

    const plain = renderHook(() => useMamSuppress(true))
    expect(result.current).toEqual({ away: false, suppressed: true })
    plain.unmount()

    const hide = renderHook(() => useMamSuppress(true, 'hide'))
    expect(result.current).toEqual({ away: true, suppressed: true })
    hide.unmount()
    expect(result.current).toEqual({ away: false, suppressed: false })

    const dialog = document.createElement('dialog')
    document.body.appendChild(dialog)
    await act(async () => dialog.setAttribute('open', ''))
    expect(result.current).toEqual({ away: true, suppressed: true })
    await act(async () => dialog.remove())
    expect(result.current).toEqual({ away: false, suppressed: false })
  })

  it('a hidden document suppresses but does not remove the character', () => {
    const { result } = renderHook(() => ({
      away: useMamAway(),
      suppressed: useMamSuppressed(),
    }))
    const state = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(result.current).toEqual({ away: false, suppressed: true })
    state.mockRestore()
  })
})
