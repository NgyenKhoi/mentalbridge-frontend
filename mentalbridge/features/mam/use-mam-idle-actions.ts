'use client'

import { useEffect, useRef } from 'react'

import { isTypingTarget } from './mam-gaze'

// MB-818 goal 3: one small idle action every 25–45 s, at most 2 per rolling minute. MB-896: the hook keeps the
// cadence and the cap; which look plays (and never the same twice in a row) is the orchestrator's `IDLE` intent.
export const IDLE_ACTION_MIN_MS = 25_000
export const IDLE_ACTION_MAX_MS = 45_000
export const IDLE_ACTIONS_PER_MINUTE = 2

/**
 * Calls `play` (the host asks the orchestrator for `IDLE`) at random 25–45 s intervals while
 * `enabled`. Turning `enabled` off drops the pending timer; turning it on
 * waits a fresh interval. An action that cannot play now (cap, typing) is
 * skipped, never queued. `slow` (a QUIET route, MB-895) doubles the interval:
 * half the cadence. `allowTyping` keeps it going while a field has focus (the journal editor,
 * where Mầm keeps the user company).
 */
export function useMamIdleActions(
  enabled: boolean,
  play: () => void,
  random: () => number = Math.random,
  slow = false,
  allowTyping = false,
) {
  const latest = useRef({ play, random })
  useEffect(() => {
    latest.current = { play, random }
  })
  // Shared across enable cycles, so toggling cannot beat the cap.
  const fired = useRef<number[]>([])
  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout>
    const run = () => {
      const now = Date.now()
      fired.current = fired.current.filter((at) => now - at < 60_000)
      if (
        fired.current.length < IDLE_ACTIONS_PER_MINUTE &&
        (allowTyping || !isTypingTarget(document.activeElement))
      ) {
        const { play: start } = latest.current
        fired.current.push(now)
        start()
      }
      schedule()
    }
    const schedule = () => {
      const { random: next } = latest.current
      timer = setTimeout(
        run,
        (IDLE_ACTION_MIN_MS +
          next() * (IDLE_ACTION_MAX_MS - IDLE_ACTION_MIN_MS)) *
          (slow ? 2 : 1),
      )
    }
    schedule()
    return () => clearTimeout(timer)
  }, [enabled, slow, allowTyping])
}
