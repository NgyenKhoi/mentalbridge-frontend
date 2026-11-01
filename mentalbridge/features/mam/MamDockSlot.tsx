'use client'

import { useEffect, useSyncExternalStore } from 'react'

import { endMamAwardSession } from './mam-award-session'

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
  // Another account signed in (MB-781): reward reads still in flight for the
  // previous one are dropped even if the dock host never loaded to end them.
  if (id !== undefined && accountId !== null && id !== accountId)
    endMamAwardSession()
  if (id !== undefined) accountId = id
  listeners.forEach((listener) => listener())
}

/** The signed-in account while a USER layout is mounted, else null. */
export const slottedMamAccountId = () => (slots > 0 ? accountId : null)

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
