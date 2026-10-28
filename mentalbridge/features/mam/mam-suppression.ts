'use client'

import { useEffect } from 'react'

// A feature reports its own no-interrupt zone (dirty form, validation error,
// safety surface) while `active`; the host ORs it with the zones it sees itself.
let active = 0
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

export function subscribeMamFeatureSuppression(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const isMamFeatureSuppressed = () => active > 0

export function useMamSuppress(suppress: boolean) {
  useEffect(() => {
    if (!suppress) return
    active += 1
    notify()
    return () => {
      active -= 1
      notify()
    }
  }, [suppress])
}
