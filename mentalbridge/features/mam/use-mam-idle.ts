'use client'

import { useEffect, useRef } from 'react'

// Design §D: input is a pointer move or press, a key, a wheel turn, a touch or a scroll.
const IDLE_MS = 60_000
export const MAM_INPUT_EVENTS = [
  'pointermove',
  'pointerdown',
  'keydown',
  'wheel',
  'touchstart',
  'scroll',
] as const

/**
 * Calls `onIdle` once after 60 s without input while `enabled`. Any input
 * restarts the wait; turning `enabled` off drops it, turning it on starts anew.
 */
export function useMamIdle(enabled: boolean, onIdle: () => void) {
  const latest = useRef(onIdle)
  useEffect(() => {
    latest.current = onIdle
  })
  useEffect(() => {
    if (!enabled) return
    let timer = setTimeout(() => latest.current(), IDLE_MS)
    const restart = () => {
      clearTimeout(timer)
      timer = setTimeout(() => latest.current(), IDLE_MS)
    }
    for (const type of MAM_INPUT_EVENTS)
      window.addEventListener(type, restart, { capture: true, passive: true })
    return () => {
      clearTimeout(timer)
      for (const type of MAM_INPUT_EVENTS)
        window.removeEventListener(type, restart, { capture: true })
    }
  }, [enabled])
}
