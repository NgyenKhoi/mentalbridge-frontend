'use client'

import { useEffect, useRef, useState } from 'react'

import type { MamOneShotCommand } from './MamCharacter'
import { MAM_ONE_SHOT_MS } from './mam-contract'

// A feature reports a save Care has confirmed (never a pending or failed one);
// the dock answers with one `nod` (MB-818: the same nod for every content, never a
// celebration) when every condition holds.
export const MAM_SAVED_EVENT = 'mam:saved'

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
      setPlaying({ kind: 'nod', key: `saved:${count.current}` })
    }
    window.addEventListener(MAM_SAVED_EVENT, onSaved)
    return () => window.removeEventListener(MAM_SAVED_EVENT, onSaved)
  }, [])
  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => setPlaying(null), MAM_ONE_SHOT_MS.nod)
    return () => clearTimeout(timer)
  }, [playing])
  return allowed ? playing : null
}
