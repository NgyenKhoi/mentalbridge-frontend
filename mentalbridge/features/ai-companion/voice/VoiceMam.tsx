'use client'

import { useSyncExternalStore } from 'react'
import { MicOff } from 'lucide-react'
import { MamCharacter } from '@/features/mam/MamCharacter'
import { useMamPreferences } from '@/features/mam/mam-preferences'
import { useReactiveReducedMotion } from '@/lib/animations/use-reduced-motion'
import styles from './Voice.module.css'

export type VoiceMamBehavior = 'idle' | 'thinking' | 'speaking'

// Same query as the compact rules in Voice.module.css: under 480 px wide or 760 px tall.
const COMPACT = '(max-width: 479.98px), (max-height: 759.98px)'
function subscribeCompact(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => undefined
  const query = window.matchMedia(COMPACT)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
const isCompact = () =>
  typeof window.matchMedia === 'function' && window.matchMedia(COMPACT).matches

/**
 * The AI voice call's face (MB-815). It only reflects call state: the stage has one
 * fixed size per breakpoint, so a state change never moves the layout.
 */
export function VoiceMam({
  behavior,
  dimmed,
  muted,
}: Readonly<{ behavior: VoiceMamBehavior; dimmed: boolean; muted: boolean }>) {
  const { motionOff } = useMamPreferences()
  const reduced = useReactiveReducedMotion() || motionOff
  const compact = useSyncExternalStore(subscribeCompact, isCompact, () => false)
  return (
    <div
      className={styles.stage}
      data-state={behavior}
      data-mam-behavior={behavior}
      data-dim={dimmed}
      data-reduced={reduced}
    >
      <div className={styles.halo} aria-hidden="true" />
      <div className={styles.ring} aria-hidden="true" />
      <div className={styles.mam} aria-hidden="true">
        <MamCharacter
          size={compact ? 116 : 164}
          behavior={behavior}
          reducedMotion={reduced}
        />
      </div>
      {muted ? (
        <div className={styles.micBadge} aria-hidden="true">
          <MicOff />
        </div>
      ) : null}
    </div>
  )
}
