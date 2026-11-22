'use client'

import { useSyncExternalStore } from 'react'

import {
  isMamFeatureHiding,
  isMamFeatureSuppressed,
  subscribeMamFeatureSuppression,
} from './mam-suppression'

// ADR "No-interrupt zones" the host can see for itself: any open modal,
// including the crisis panel, and a hidden document. Feature zones arrive
// through `useMamSuppress`.
const MODAL_SELECTOR = 'dialog[open], [aria-modal="true"]'
// MB-895: a modal that opts in with `data-mam-companion="quiet"` (the journal editor) keeps Mầm
// in her corner on a desktop screen, drawn above its backdrop (ADR "Route surface matrix V2").
// Every other modal still removes her. At 900 px or less the dialog covers the screen, and a
// browser without the Popover API cannot draw her above it: both stay away.
const COMPANION_SELECTOR = 'dialog[open][data-mam-companion="quiet"]'
const DESKTOP_QUERY = '(min-width: 901px)'

// One body observer and one media query serve every hook and every host: they exist only while
// something subscribes.
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())
let stop: (() => void) | null = null
let desktop: MediaQueryList | null = null

function start() {
  const observer = new MutationObserver(notify)
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['open', 'aria-modal', 'data-mam-companion'],
  })
  document.addEventListener('visibilitychange', notify)
  desktop =
    typeof window.matchMedia === 'function'
      ? window.matchMedia(DESKTOP_QUERY)
      : null
  desktop?.addEventListener('change', notify)
  const unsubscribe = subscribeMamFeatureSuppression(notify)
  return () => {
    observer.disconnect()
    document.removeEventListener('visibilitychange', notify)
    desktop?.removeEventListener('change', notify)
    desktop = null
    unsubscribe()
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) stop = start()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      stop?.()
      stop = null
    }
  }
}

// The subscribed query's `matches` once a hook is mounted; before that, a one-off read.
const isDesktop = () =>
  (
    desktop ??
    (typeof window.matchMedia === 'function'
      ? window.matchMedia(DESKTOP_QUERY)
      : null)
  )?.matches === true

function companionDialog(): HTMLElement | null {
  if (!('showPopover' in HTMLElement.prototype) || !isDesktop()) return null
  return document.querySelector<HTMLElement>(COMPANION_SELECTOR)
}

const isModalOpen = () => {
  const exempt = companionDialog()
  return Array.from(document.querySelectorAll(MODAL_SELECTOR)).some(
    (modal) => modal !== exempt,
  )
}

const isSuppressed = () =>
  document.visibilityState !== 'visible' ||
  isModalOpen() ||
  isMamFeatureSuppressed()

// A modal or a feature's hide zone removes the character; a hidden tab or a
// dirty form only stops reactions.
const isAway = () => isModalOpen() || isMamFeatureHiding()

export function useMamSuppressed() {
  return useSyncExternalStore(subscribe, isSuppressed, () => false)
}

export function useMamAway() {
  return useSyncExternalStore(subscribe, isAway, () => false)
}

/** The open companion-friendly modal Mầm may sit beside on this screen, else null. */
export function useMamCompanionDialog() {
  return useSyncExternalStore(subscribe, companionDialog, () => null)
}
