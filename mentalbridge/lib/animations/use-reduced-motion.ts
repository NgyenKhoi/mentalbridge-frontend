'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => undefined
  const preference = window.matchMedia(QUERY)
  preference.addEventListener('change', onChange)
  return () => preference.removeEventListener('change', onChange)
}

function snapshot() {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY).matches
    : true
}

// Motion's current hook snapshots only at mount. Subscribe so a preference
// change also stops pointer-driven transforms and numeric transitions live.
export function useReactiveReducedMotion() {
  return useSyncExternalStore(subscribe, snapshot, () => true)
}
