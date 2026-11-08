'use client'

import { useEffect, useRef } from 'react'

import type { MamOneShot } from './mam-contract'
import { isTypingTarget } from './mam-gaze'

// MB-818 goal 3: one small idle action every 25–45 s, at most 2 per rolling minute.
export const IDLE_ACTION_MIN_MS = 25_000
export const IDLE_ACTION_MAX_MS = 45_000
export const IDLE_ACTIONS_PER_MINUTE = 2
export const IDLE_ACTIONS = ['stretch', 'look_around', 'scratch'] as const

/**
 * Calls `play` with one idle action at random 25–45 s intervals while
 * `enabled`. Turning `enabled` off drops the pending timer; turning it on
 * waits a fresh interval. An action that cannot play now (cap, typing) is
 * skipped, never queued.
 */
export function useMamIdleActions(
  enabled: boolean,
  play: (kind: MamOneShot) => void,
  random: () => number = Math.random,
) {
  const latest = useRef({ play, random })
  useEffect(() => {
    latest.current = { play, random }
  })
  // Shared across enable cycles, so toggling cannot beat the cap.
  const fired = useRef<number[]>([])
  const last = useRef<(typeof IDLE_ACTIONS)[number] | null>(null)
  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout>
    const run = () => {
      const now = Date.now()
      fired.current = fired.current.filter((at) => now - at < 60_000)
      if (
        fired.current.length < IDLE_ACTIONS_PER_MINUTE &&
        !isTypingTarget(document.activeElement)
      ) {
        const { play: start, random: next } = latest.current
        const choices = IDLE_ACTIONS.filter((kind) => kind !== last.current)
        const kind = choices[Math.floor(next() * choices.length)]!
        last.current = kind
        fired.current.push(now)
        start(kind)
      }
      schedule()
    }
    const schedule = () => {
      const { random: next } = latest.current
      timer = setTimeout(
        run,
        IDLE_ACTION_MIN_MS + next() * (IDLE_ACTION_MAX_MS - IDLE_ACTION_MIN_MS),
      )
    }
    schedule()
    return () => clearTimeout(timer)
  }, [enabled])
}
