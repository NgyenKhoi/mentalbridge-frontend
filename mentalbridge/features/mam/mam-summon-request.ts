import { useSyncExternalStore } from 'react'

import type { MamIntent } from './mam-targets'

// A page control (the Mầm button on a card) asks the one global host to open
// its bubble at the card the control sits in. The host ignores it while hidden
// or suppressed, and when the control is not inside a registered target.
export const MAM_SUMMON_EVENT = 'mam:summon'

export type MamSummonRequest = Readonly<{
  source: HTMLElement
  intent: MamIntent
}>

// The host loads lazily (MB-781). A press before it listens is kept, the latest
// only, and handed to it once. It is dropped when the user can no longer mean
// it: Mầm was suppressed or hidden meanwhile, the route changed or the card left.
let hostListening = false
let pending: (MamSummonRequest & { pathname: string }) | null = null

export function requestMamSummon(source: HTMLElement, intent: MamIntent) {
  if (!hostListening)
    pending = { source, intent, pathname: window.location.pathname }
  window.dispatchEvent(
    new CustomEvent<MamSummonRequest>(MAM_SUMMON_EVENT, {
      detail: { source, intent },
    }),
  )
}

export function listenMamSummons() {
  hostListening = true
}

export function stopHearingMamSummons() {
  hostListening = false
}

/** The press the host missed, once, if it still stands. */
export function takePendingMamSummon(): MamSummonRequest | null {
  const request = pending
  pending = null
  return request?.source.isConnected &&
    request.pathname === window.location.pathname
    ? { source: request.source, intent: request.intent }
    : null
}

export function discardPendingMamSummon() {
  pending = null
}

// A host that failed to load never answers: card buttons go inert, as while
// Mầm is suppressed, instead of doing nothing.
let hostUnavailable = false
const listeners = new Set<() => void>()

export function markMamHostUnavailable() {
  hostUnavailable = true
  pending = null
  listeners.forEach((listener) => listener())
}

export const useMamHostUnavailable = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => hostUnavailable,
    () => false,
  )
