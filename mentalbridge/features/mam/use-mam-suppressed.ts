'use client'

import { useSyncExternalStore } from 'react'

import {
  isMamFeatureSuppressed,
  subscribeMamFeatureSuppression,
} from './mam-suppression'

// ADR "No-interrupt zones" the host can see for itself: any open modal,
// including the crisis panel, and a hidden document. Feature zones arrive
// through `useMamSuppress`.
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
  const unsubscribe = subscribeMamFeatureSuppression(onChange)
  return () => {
    observer.disconnect()
    document.removeEventListener('visibilitychange', onChange)
    unsubscribe()
  }
}

const isSuppressed = () =>
  document.visibilityState !== 'visible' ||
  document.querySelector(MODAL_SELECTOR) !== null ||
  isMamFeatureSuppressed()

export function useMamSuppressed() {
  return useSyncExternalStore(subscribe, isSuppressed, () => false)
}
