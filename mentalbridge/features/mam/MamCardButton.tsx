'use client'

import { MAM_ASSET } from './mam-contract'
import { useMamPreferences } from './mam-preferences'
import { requestMamSummon } from './mam-summon-request'
import styles from './MamCardButton.module.css'
import { useMamAway, useMamSuppressed } from './use-mam-suppressed'

/**
 * Mầm's button on a card (ADR "Summon"; the 44 px target is the button, the
 * circle is its look). Alone it asks the global Mầm to explain the registered
 * target it sits in: not rendered while Mầm is hidden, inert while suppressed
 * or `disabled`. With `onToggle` it is an inline control (a disclosure) that
 * never summons, so it stays while Mầm is hidden. Neither renders while Mầm is
 * away (an open modal or a feature's hide zone, e.g. a safety state).
 */
export function MamCardButton({
  id,
  label,
  disabled = false,
  onToggle,
  expanded,
  controls,
}: Readonly<{
  id?: string
  label: string
  disabled?: boolean
  onToggle?: () => void
  expanded?: boolean
  controls?: string
}>) {
  const { hidden } = useMamPreferences()
  const suppressed = useMamSuppressed()
  const away = useMamAway()
  if (away || (hidden && !onToggle)) return null
  const inert = !onToggle && (disabled || suppressed)
  return (
    <button
      id={id}
      type="button"
      className={styles.button}
      data-mam-trigger=""
      aria-label={label}
      aria-disabled={inert || undefined}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={(event) => {
        if (onToggle) onToggle()
        else if (!inert) requestMamSummon(event.currentTarget, 'EXPLAIN')
      }}
    >
      <span className={styles.disc}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG pose, as the dock fallback. */}
        <img
          src={MAM_ASSET.fallbackSrc}
          alt=""
          width={24}
          height={24}
          draggable={false}
        />
      </span>
    </button>
  )
}
