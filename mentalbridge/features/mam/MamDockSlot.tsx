'use client'

import { useEffect, useSyncExternalStore } from 'react'

// USER layouts render the slot after their server role gate; the single dock
// in the root providers shows only while one is mounted. Moving between two
// USER layouts unmounts one slot and mounts the next in the same commit, so
// the dock and its character stay mounted. The slot also carries the signed-in
// account id, the key of the celebration record (MB-773).
let slots = 0
let accountId: string | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function change(delta: number, id?: string) {
  slots += delta
  if (id !== undefined) accountId = id
  listeners.forEach((listener) => listener())
}

export function useMamDockSlotted() {
  return useSyncExternalStore(
    subscribe,
    () => slots > 0,
    () => false,
  )
}

export function useMamAccountId() {
  return useSyncExternalStore(
    subscribe,
    () => accountId,
    () => null,
  )
}

export function MamDockSlot({
  accountId: id,
}: Readonly<{ accountId?: string }>) {
  useEffect(() => {
    change(1, id)
    return () => change(-1)
  }, [id])
  return null
}
