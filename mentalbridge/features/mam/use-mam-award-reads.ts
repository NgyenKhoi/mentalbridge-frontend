'use client'

import { useEffect } from 'react'

import { getAchievements } from '@/features/achievements/api/browser-achievements'
import { useMamPreferences } from './mam-preferences'
import { isMamCelebrationRoute } from './mam-routes'

// ADR "Reward watcher": reads on dock-route entry and window focus, never
// closer than 5 min, no background polling.
const MIN_GAP_MS = 5 * 60_000

// Module level so every host mount and route change shares one cadence.
let lastRead: { accountId: string; at: number } | null = null

/**
 * The read only feeds the director: the API client dispatches each successful
 * response as a `mam:award-read`; a failure here is silent and never baselines.
 * Bingo is not read here: its snapshots come from the paid Resources page.
 * shortcut: a cadence read on /achievements duplicates the gallery's own GET
 * (1 extra request per entry), upgrade to a shared read cache if Content load
 * matters.
 */
export function useMamAwardReads({
  accountId,
  pathname,
}: Readonly<{ accountId: string | null; pathname: string }>) {
  const { hidden } = useMamPreferences()
  const active =
    accountId !== null && !hidden && isMamCelebrationRoute(pathname)

  useEffect(() => {
    if (!active) return
    const read = () => {
      const now = Date.now()
      if (lastRead?.accountId === accountId && now - lastRead.at < MIN_GAP_MS)
        return
      // Stamped before the request: a failing backend is not retried within 5 min.
      lastRead = { accountId, at: now }
      void getAchievements(
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      ).catch(() => {})
    }
    read()
    window.addEventListener('focus', read)
    return () => window.removeEventListener('focus', read)
  }, [active, accountId, pathname])
}
