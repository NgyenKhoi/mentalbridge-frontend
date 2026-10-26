'use client'

import { useSyncExternalStore } from 'react'

// ADR "No-interrupt zones" the host can see for itself: any open modal,
// including the crisis panel, and a hidden document. Feature zones arrive
// through MB-769 events.
const MODAL_SELECTOR = 'dialog[open], [aria-modal="true"]'

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['open', 'aria-modal'],
  })
  document.addEventListener('visibilitychange', onChange)
  return () => {
    observer.disconnect()
    document.removeEventListener('visibilitychange', onChange)
  }
}

const isSuppressed = () =>
  document.visibilityState !== 'visible' ||
  document.querySelector(MODAL_SELECTOR) !== null

export function useMamSuppressed() {
  return useSyncExternalStore(subscribe, isSuppressed, () => false)
}
