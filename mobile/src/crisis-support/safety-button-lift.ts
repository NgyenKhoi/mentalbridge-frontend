import { useSyncExternalStore } from 'react'

// Sticky footer heights by owning screen, so the floating safety button sits above the newest one.
const lifts = new Map<object, number>()
const listeners = new Set<() => void>()
let lift = 0

function publish() {
  const next = [...lifts.values()].at(-1) ?? 0
  if (next === lift) return
  lift = next
  listeners.forEach((listener) => listener())
}

/** `height` null removes the owner (its screen unmounted or dropped its footer). */
export function setSafetyButtonLift(owner: object, height: number | null) {
  // Re-inserting moves the owner last: the screen laid out most recently is the one on top.
  lifts.delete(owner)
  if (height !== null) lifts.set(owner, height)
  publish()
}

export const useSafetyButtonLift = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => lift,
  )
