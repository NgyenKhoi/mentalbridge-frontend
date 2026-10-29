'use client'

import { useEffect } from 'react'

// A feature reports its own no-interrupt zone (dirty form, validation error,
// safety surface) while `active`; the host ORs it with the zones it sees itself.
// A 'hide' zone also removes the character (safety, long-form writing); a plain
// 'suppress' zone only stops reactions.
export type MamSuppressMode = 'suppress' | 'hide'

const counts: Record<MamSuppressMode, number> = { suppress: 0, hide: 0 }
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

export function subscribeMamFeatureSuppression(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const isMamFeatureSuppressed = () => counts.suppress + counts.hide > 0

export const isMamFeatureHiding = () => counts.hide > 0

export function useMamSuppress(
  suppress: boolean,
  mode: MamSuppressMode = 'suppress',
) {
  useEffect(() => {
    if (!suppress) return
    counts[mode] += 1
    notify()
    return () => {
      counts[mode] -= 1
      notify()
    }
  }, [suppress, mode])
}
