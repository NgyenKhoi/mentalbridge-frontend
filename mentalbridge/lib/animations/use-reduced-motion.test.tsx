import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useReactiveReducedMotion } from './use-reduced-motion'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('reacts to preference changes without reloading and unsubscribes', () => {
  let reduce = false
  const listeners = new Set<() => void>()
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      get matches() {
        return reduce
      },
      addEventListener: (_: string, listener: () => void) =>
        listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) =>
        listeners.delete(listener),
    })),
  )
  const { result, unmount } = renderHook(() => useReactiveReducedMotion())
  expect(result.current).toBe(false)
  act(() => {
    reduce = true
    listeners.forEach((listener) => listener())
  })
  expect(result.current).toBe(true)
  act(() => {
    reduce = false
    listeners.forEach((listener) => listener())
  })
  expect(result.current).toBe(false)
  unmount()
  expect(listeners.size).toBe(0)
})
