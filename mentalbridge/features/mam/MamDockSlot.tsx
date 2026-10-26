'use client'

import { useEffect, useSyncExternalStore } from 'react'

// USER layouts render the slot after their server role gate; the single dock
// in the root providers shows only while one is mounted. Moving between two
// USER layouts unmounts one slot and mounts the next in the same commit, so
// the dock and its character stay mounted.
let slots = 0
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function change(delta: number) {
  slots += delta
  listeners.forEach((listener) => listener())
}

export function useMamDockSlotted() {
  return useSyncExternalStore(
    subscribe,
    () => slots > 0,
    () => false,
  )
}

export function MamDockSlot() {
  useEffect(() => {
    change(1)
    return () => change(-1)
  }, [])
  return null
}
