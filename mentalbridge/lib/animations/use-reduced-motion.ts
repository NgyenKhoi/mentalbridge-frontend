'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  const preference = window.matchMedia(QUERY)
  preference.addEventListener('change', onChange)
  return () => preference.removeEventListener('change', onChange)
}

function snapshot() {
  return window.matchMedia(QUERY).matches
}

// Motion's current hook snapshots only at mount. Subscribe so a preference
// change also stops pointer-driven transforms and numeric transitions live.
export function useReactiveReducedMotion() {
  return useSyncExternalStore(subscribe, snapshot, () => true)
}
