'use client'

import { useEffect, useRef } from 'react'
import { MAM_ASSET } from './mam-contract'
import { useMamPreferences } from './mam-preferences'
import {
  discardPendingMamSummon,
  requestMamSummon,
  useMamHostUnavailable,
} from './mam-summon-request'
import styles from './MamCardButton.module.css'
import { useMamAway, useMamSuppressed } from './use-mam-suppressed'

/**
 * Mầm's button on a card (ADR "Summon"; the 44 px target is the button, the
 * circle is its look). Alone it asks the global Mầm to explain the registered
 * target it sits in: not rendered while Mầm is hidden, inert while suppressed,
 * `disabled` or the host failed to load (MB-781). With `onToggle` it is an
 * inline control (a disclosure) that never summons, so it stays while Mầm is
 * hidden. Neither renders while Mầm is away (an open modal or a feature's hide
 * zone, e.g. a safety state). When that removes the button while it has focus,
 * focus moves to the card's heading (never to the page body), unless a modal is
 * open and owns focus.
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
  const unavailable = useMamHostUnavailable()
  const gone = away || (hidden && !onToggle)
  // The card the button sits in, kept only while the button holds focus.
  const focusedCard = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const card = focusedCard.current
    if (!gone || !card) return
    focusedCard.current = null
    const focusLost =
      !document.activeElement || document.activeElement === document.body
    if (
      !focusLost ||
      !card.isConnected ||
      document.querySelector('dialog[open], [aria-modal="true"]')
    )
      return
    const target = card.querySelector<HTMLElement>('h1, h2, h3, h4') ?? card
    if (!target.hasAttribute('tabindex')) target.tabIndex = -1
    target.focus()
  }, [gone])
  // A press waiting for the lazy host no longer stands once Mầm goes quiet.
  useEffect(() => {
    if (gone || suppressed) discardPendingMamSummon()
  }, [gone, suppressed])
  if (gone) return null
  const inert = !onToggle && (disabled || suppressed || unavailable)
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
      onFocus={(event) => {
        focusedCard.current =
          event.currentTarget.closest<HTMLElement>('[data-mam]')
      }}
      onBlur={(event) => {
        const button = event.currentTarget
        // A removed button reports blur while detaching; only a still-mounted one lost focus.
        queueMicrotask(() => {
          if (button.isConnected) focusedCard.current = null
        })
      }}
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
