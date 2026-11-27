'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { localDateInTimeZone } from '@/lib/emotion-check-in/presentation'
import { mamDailyKey, readMamDaily, writeMamDaily } from './mam-daily'
import { readGuide } from './mam-guide'
import type { MamBubbleSpec, MamGuideAction, MamGuideMotion } from './mam-guide'
import {
  MAM_MOMENT_EVENT,
  dispatchMamMoment,
  markMomentSeen,
  momentFits,
  momentSeen,
  momentSpec,
  parseMamMoment,
  type MamMoment,
} from './mam-moments'

/** How long Mầm sits beside the user after "Để Mầm ở đây với bạn 1 chút". */
export const MAM_STAY_MS = 20_000

const today = () =>
  localDateInTimeZone(
    new Date(),
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  )
const reminderKey = (accountId: string) =>
  mamDailyKey('moment-remind', accountId)

export type MamMoments = Readonly<{
  bubble: MamBubbleSpec | null
  motion: MamGuideMotion | undefined
  key: string
  /** Changes with every moment shown, so the text swaps in place inside one bubble. */
  step: number
  /** Mầm keeps sitting beside the user for a while after the bubble closed. */
  staying: boolean
  act: (action: MamGuideAction) => void
  close: () => void
}>

/**
 * Shows the moments other screens dispatch (mam-moments.ts), each once per account, one at a time. While
 * `ready` is false (the guide, a menu, a tour or a suppression holds the dock) moments wait in line.
 */
export function useMamMoments(
  accountId: string | null,
  ready: boolean,
): MamMoments {
  const pathname = usePathname()
  const [queue, setQueue] = useState<readonly MamMoment[]>([])
  const [staying, setStaying] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!accountId) return
    const onMoment = (event: Event) => {
      const moment = parseMamMoment((event as CustomEvent).detail)
      if (!moment || momentSeen(accountId, moment.key)) return
      setQueue((items) =>
        items.some((item) => item.key === moment.key)
          ? items
          : [...items, moment],
      )
    }
    window.addEventListener(MAM_MOMENT_EVENT, onMoment)
    // The reminder the user asked for yesterday ("Mai Mầm nhắc mình nhé") comes back once, on a later day.
    const reminder = readMamDaily(reminderKey(accountId))
    const [day, href] = (reminder ?? '').split('|')
    let timer: number | undefined
    // Free graduated after "Để sau" on the plan: Home asks once more, from the next day on.
    const guide = readGuide(accountId)
    const freePlanLater =
      guide?.graduatedAt &&
      guide.declined.plan &&
      guide.plan !== 'PLUS' &&
      guide.plan !== 'PREMIUM' &&
      guide.declined.plan.at.slice(0, 10) <
        new Date().toISOString().slice(0, 10)
    const reask = freePlanLater
      ? window.setTimeout(() =>
          dispatchMamMoment({ kind: 'plan-reask', key: 'plan-reask' }),
        )
      : undefined
    if (day && day < today()) {
      writeMamDaily(reminderKey(accountId), '')
      // Through the same event, after this render, like any other moment.
      timer = window.setTimeout(() =>
        dispatchMamMoment({
          kind: 'plan-reminder',
          key: `reminder:${day}`,
          ...(href ? { href } : {}),
        }),
      )
    }
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(reask)
      window.removeEventListener(MAM_MOMENT_EVENT, onMoment)
    }
  }, [accountId])

  useEffect(() => {
    if (!staying) return
    const timer = window.setTimeout(() => setStaying(false), MAM_STAY_MS)
    return () => window.clearTimeout(timer)
  }, [staying])

  // The first moment that belongs on this page; the others keep their place in line.
  const current =
    ready && accountId
      ? (queue.find((item) => momentFits(item, pathname)) ?? null)
      : null
  const bubble = current ? momentSpec(current) : null

  const currentKey = current?.key
  const close = useCallback(() => {
    if (!currentKey) return
    if (accountId) markMomentSeen(accountId, currentKey)
    setQueue((items) => items.filter((item) => item.key !== currentKey))
    setStep((value) => value + 1)
  }, [accountId, currentKey])

  const act = useCallback(
    (action: MamGuideAction) => {
      const first = current
      if (!first || !accountId) return
      if (
        action.go === 'pick' &&
        first.kind === 'guide-open' &&
        first.activity
      ) {
        // "Chỉ Mầm đi": the same bubble turns into the one lightest activity.
        markMomentSeen(accountId, first.key)
        setQueue((items) =>
          items.map((item) =>
            item.key === first.key
              ? {
                  kind: 'guide-pick',
                  key: `pick:${first.key}`,
                  activity: first.activity,
                }
              : item,
          ),
        )
        setStep((value) => value + 1)
        return
      }
      if (action.go === 'remind')
        writeMamDaily(reminderKey(accountId), `${today()}|${first.href ?? ''}`)
      if (action.go === 'stay' || action.go === 'remind') setStaying(true)
      // An action with an href is a Link: it navigates by itself.
      close()
    },
    [accountId, close, current],
  )

  return {
    bubble,
    motion: bubble?.kind === 'consent' ? undefined : bubble?.motion,
    key: current?.key ?? '',
    step,
    staying,
    act,
    close,
  }
}
