'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { MamOneShotCommand } from './MamCharacter'
import { MAM_ONE_SHOT_MS, type MamOneShot } from './mam-contract'

/**
 * The host's own one-shot channel (MB-818: drowsy, wake, poke, idle actions).
 * A new command replaces the last one; each drops itself when the asset is done.
 */
export function useMamShot() {
  const [shot, setShot] = useState<MamOneShotCommand | null>(null)
  const count = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const cancel = useCallback(() => {
    clearTimeout(timer.current)
    setShot(null)
  }, [])
  const play = useCallback((kind: MamOneShot) => {
    clearTimeout(timer.current)
    count.current += 1
    setShot({ kind, key: `local:${count.current}` })
    timer.current = setTimeout(() => setShot(null), MAM_ONE_SHOT_MS[kind])
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  return { shot, play, cancel }
}
