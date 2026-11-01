'use client'

import { useEffect, useRef, useState } from 'react'

import type { MamOneShotCommand } from './MamCharacter'

// A feature reports a save Care has confirmed (never a pending or failed one);
// the dock answers with one `light_success` when every condition holds.
export const MAM_SAVED_EVENT = 'mam:saved'
// The asset returns to `idle` itself at 1.3 s (ADR "Control contract").
const LIGHT_SUCCESS_MS = 1400

export const dispatchMamSaved = () =>
  window.dispatchEvent(new Event(MAM_SAVED_EVENT))

/** The one-shot to feed `MamCharacter`; null while idle or once cut short. */
export function useMamSaved(
  allowed: boolean,
  pathname: string,
): MamOneShotCommand | null {
  const [playing, setPlaying] = useState<MamOneShotCommand | null>(null)
  const [route, setRoute] = useState(pathname)
  if (route !== pathname) {
    setRoute(pathname)
    if (playing) setPlaying(null)
  }
  // Withdrawn eligibility (a modal, a hide zone) discards the pending save, so
  // a remounted character never replays it.
  if (!allowed && playing) setPlaying(null)
  const count = useRef(0)
  const allowedRef = useRef(allowed)
  useEffect(() => {
    allowedRef.current = allowed
  })
  useEffect(() => {
    const onSaved = () => {
      if (!allowedRef.current) return
      count.current += 1
      setPlaying({ kind: 'light_success', key: `saved:${count.current}` })
    }
    window.addEventListener(MAM_SAVED_EVENT, onSaved)
    return () => window.removeEventListener(MAM_SAVED_EVENT, onSaved)
  }, [])
  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => setPlaying(null), LIGHT_SUCCESS_MS)
    return () => clearTimeout(timer)
  }, [playing])
  return allowed ? playing : null
}
