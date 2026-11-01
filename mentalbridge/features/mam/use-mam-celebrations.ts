'use client'

import { useCallback, useEffect, useState } from 'react'

import type { MamOneShotCommand } from './MamCharacter'
import type { MamOneShot } from './mam-contract'
import {
  MAM_AWARD_READ_EVENT,
  mamAppearanceText,
  observeMamAwardRead,
  parseMamAwardRead,
  reserveMamNext,
  returnMamAppearance,
  stopHearingMamAwardReads,
  takeMamNoteFor,
  takeUnheardMamAwardReads,
  type MamAppearance,
} from './mam-celebrations'
import { endMamAwardSession } from './mam-award-session'
import { useMamAwardReads } from './use-mam-award-reads'

// Margin after a computed deadline, so the retry lands on the open side of it.
const RETRY_MARGIN_MS = 50
// The asset writes `idle` at 1.3 / 1.0 / 1.6 s (ADR "Control contract").
const ONE_SHOT_MS: Record<MamOneShot, number> = {
  light_success: 1400,
  celebrate_soft: 1100,
  celebrate_hero: 1700,
}

interface Active {
  appearance: MamAppearance
  reservedAt: number
  /** The route it started on; leaving it before the one-shot ends is an interruption. */
  pathname: string
  phase: 'playing' | 'bubble'
  text: string | null
}

export interface MamCelebration {
  /** Feed to `MamCharacter`; null once the one-shot is over or interrupted. */
  oneShot: MamOneShotCommand | null
  /** The `happy` bubble text, while it is open. */
  bubbleText: string | null
  /** True while a `celebrate_hero` plays: the dock rises and settles. */
  flight: boolean
  dismiss(): void
}

/**
 * Host side of the celebration director: listens for owner reads, releases one
 * appearance when the host allows it, and returns the slot if it is cut short.
 * `allowed` is every release condition the host owns (route, dock shown, not
 * hidden, muted, reduced, suppressed, no summon or menu, character ready);
 * `blocked` only stops a new start (the dock is stepping aside for an action).
 */
export function useMamCelebrations({
  accountId,
  pathname,
  allowed,
  blocked,
}: Readonly<{
  accountId: string | null
  pathname: string
  allowed: boolean
  blocked: boolean
}>): MamCelebration {
  const [active, setActive] = useState<Active | null>(null)
  // Bumped by every observed read and by a deferred retry; each re-asks for a release.
  const [wake, setWake] = useState(0)
  const startable = allowed && !blocked

  // An owner read (MB-774 dispatches them); the detail is untrusted.
  useEffect(() => {
    if (!accountId) return
    const observe = async (detail: unknown) => {
      const read = parseMamAwardRead(detail)
      if (!read) return
      await observeMamAwardRead(accountId, read)
      setWake((value) => value + 1)
    }
    let pending = Promise.resolve()
    const enqueue = (detail: unknown) => {
      pending = pending.then(() => observe(detail))
    }
    const onRead = (event: Event) => enqueue((event as CustomEvent).detail)
    window.addEventListener(MAM_AWARD_READ_EVENT, onRead)
    // Replay before live reads (MB-781), so the first stays the baseline and
    // the latest owner read reconciles last even while a lock is busy.
    takeUnheardMamAwardReads(accountId).forEach(enqueue)
    return () => {
      stopHearingMamAwardReads()
      window.removeEventListener(MAM_AWARD_READ_EVENT, onRead)
      // Reads still in flight belong to this account, not the next one.
      endMamAwardSession()
    }
  }, [accountId])

  // After the listener, so the first read already has one.
  useMamAwardReads({ accountId, pathname })

  // Release: the lock-guarded reservation decides (budget, freshness, the 10 s
  // coalescing window); this only asks when the host is free. One timer waits for
  // the deadline it reports. Cleanup marks the request stale: a reservation that
  // completes afterwards goes back to the account it was made for, never adopted.
  const free = startable && active === null
  useEffect(() => {
    if (!accountId || !free) return
    let stale = false
    let retry: ReturnType<typeof setTimeout> | undefined
    void reserveMamNext(accountId).then((result) => {
      const reservation = result?.reservation
      if (stale) {
        if (reservation)
          void returnMamAppearance(
            accountId,
            reservation.appearance,
            reservation.reservedAt,
          ).then(() => setWake((value) => value + 1))
        return
      }
      if (reservation) {
        setActive({
          appearance: reservation.appearance,
          reservedAt: reservation.reservedAt,
          pathname,
          phase: 'playing',
          text: mamAppearanceText(reservation.appearance.entries),
        })
      } else if (result?.retryAt != null) {
        retry = setTimeout(
          () => setWake((value) => value + 1),
          Math.max(0, result.retryAt - Date.now()) + RETRY_MARGIN_MS,
        )
      }
    })
    return () => {
      stale = true
      clearTimeout(retry)
    }
  }, [accountId, free, pathname, wake])

  // Cut short (route, hide, mute, motion, suppression, summon, menu): drop the
  // appearance at once. A finished one-shot only loses its bubble.
  if (active && (!allowed || active.pathname !== pathname)) setActive(null)

  // This effect owns the reservation while the one-shot plays. When the one-shot
  // ends, an achievement gets its bubble and a Bingo light_success is done; any
  // other exit, including unmount, returns the slot and the entries wait.
  const playing = active?.phase === 'playing' ? active : null
  useEffect(() => {
    if (!playing) return
    let delivered = false
    const timer = setTimeout(() => {
      delivered = true
      setActive((current) =>
        current?.reservedAt !== playing.reservedAt
          ? current
          : current.text
            ? { ...current, phase: 'bubble' }
            : null,
      )
    }, ONE_SHOT_MS[playing.appearance.oneShot])
    return () => {
      clearTimeout(timer)
      if (!delivered)
        void returnMamAppearance(
          accountId,
          playing.appearance,
          playing.reservedAt,
        )
    }
  }, [accountId, playing])

  const dismiss = useCallback(() => setActive(null), [])

  return {
    oneShot: playing
      ? {
          kind: playing.appearance.oneShot,
          key: `celebration:${playing.reservedAt}`,
        }
      : null,
    bubbleText: active?.phase === 'bubble' ? active.text : null,
    flight: playing?.appearance.oneShot === 'celebrate_hero',
    dismiss,
  }
}

/**
 * Reduced motion or muted: nothing plays, so a fresh achievement's sentence
 * shows when the user opens the dock menu (ADR). No one-shot, no budget.
 */
export function useMamCelebrationNote({
  accountId,
  open,
}: Readonly<{ accountId: string | null; open: boolean }>) {
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => {
    if (!accountId || !open) return
    let cancelled = false
    void takeMamNoteFor(accountId).then((text) => {
      if (!cancelled) setNote(text)
    })
    return () => {
      cancelled = true
      setNote(null)
    }
  }, [accountId, open])
  return open ? note : null
}
