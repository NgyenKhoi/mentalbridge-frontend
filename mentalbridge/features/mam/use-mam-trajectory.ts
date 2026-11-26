'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { localDateInTimeZone } from '@/lib/emotion-check-in/presentation'

import { getMamTrajectory } from './browser-mam-trajectory'
import {
  MAM_EVENT_TYPES,
  mamEventIsNew,
  mamEventName,
  mamEventReaction,
  parseMamEvent,
  type MamEmotion,
  type MamEventDetail,
} from './mam-events'
import {
  bumpMamCount,
  mamBubbleCapped,
  mamDailyKey,
  mamSpacingWaitMs,
  readMamCount,
  readMamDaily,
  readMamIds,
  rememberMamId,
  writeMamDaily,
} from './mam-daily'
import { lineKeyOfState, pickMamLine } from './mam-lines'
import type { MamGrade, MamIntent } from './mam-orchestrator'
import type { MamRouteMode } from './mam-routes'
import {
  MAM_CELEBRATORY_STATES,
  MAM_EMOTION_LEVEL,
  MAM_STATE_REACTION,
  MAM_WINDOW_DAYS,
  daysBetween,
  mamTrajectory,
  type MamTrajectoryState,
} from './mam-trajectory'
import { mamCheerable, type MamTrajectoryView } from './mam-trajectory-source'

// A reaction that waited for a FULL route (the journal and the plan are QUIET) or for the 60 s spacing is
// still about "just now" for this long, then it is dropped rather than shown out of the blue.
const PENDING_MS = 10 * 60_000
// Margin after a computed deadline, so the retry lands on the open side of it.
const RETRY_MARGIN_MS = 50

/**
 * Where Mầm may speak. She answers what the user just did on any route she is shown on (FULL or QUIET):
 * comfort, listening and encouragement play where it happened. Only a celebration needs a FULL route.
 */
export function mamSpeaks(mode: MamRouteMode, intent: MamIntent) {
  return mode === 'full' || (mode === 'quiet' && intent !== 'CELEBRATE')
}

export type MamReaction = Readonly<{
  /** Unique per reaction: the host plays the animation once per key. */
  key: string
  intent: MamIntent
  grade?: MamGrade
  text: string
}>

const browserTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

// A malformed answer is no answer: the trajectory stays silent.
const loadView = (signal?: AbortSignal) =>
  getMamTrajectory(browserTimezone(), signal)
    .then((view) =>
      Array.isArray(view?.days) && view.band && typeof view.band === 'object'
        ? view
        : null,
    )
    .catch(() => null)

/** What a state answers with; a celebration holds back unless the look-back allows cheering. */
function stateReaction(
  state: MamTrajectoryState,
  view: MamTrajectoryView,
  accountId: string,
): Omit<MamReaction, 'key'> | null {
  const reaction = MAM_STATE_REACTION[state]
  const line = lineKeyOfState(state)
  if (!reaction || !line) return null
  if (MAM_CELEBRATORY_STATES.has(state) && !mamCheerable(view)) return null
  return { ...reaction, text: pickMamLine(line, accountId) }
}

/**
 * Mầm's trajectory and verified-event reactions (MB-897): one bubble plus one animation intent at a time.
 * - the first FULL-route visit of each local day reads the 14-day series once and answers its state;
 * - a verified event (`mam:*`, stamped with the account) answers at once, or waits for the next FULL route
 *   when it happened on a QUIET one (10 minutes at most);
 * - at most 3 bubbles a day, shared with events; a second reaction within 60 s waits for the spacing (it is
 *   not dropped); `hard` (hidden, away, safety, muted, a broken renderer) drops everything, `ready` only waits.
 * The host plays `reaction.intent` and shows `reaction.text`; reduced motion still shows the bubble.
 */
export function useMamTrajectory({
  accountId,
  mode,
  hard,
  ready,
}: Readonly<{
  accountId: string | null
  mode: MamRouteMode
  hard: boolean
  ready: boolean
}>): { reaction: MamReaction | null; dismiss(): void } {
  const [shown, setShown] = useState<{
    reaction: MamReaction
    accountId: string
  } | null>(null)
  const [wake, setWake] = useState(0)
  const pending = useRef<{ reaction: MamReaction; at: number } | null>(null)
  const lastShownAt = useRef<number | null>(null)
  const seen = useRef(new Map<string, number>())
  const cheering = useRef<boolean | null>(null)
  const tried = useRef(new Set<string>())
  const live = useRef({ hard })
  useEffect(() => {
    live.current = { hard }
  })
  // Read on every render, so a tab that stays on FULL routes across midnight asks again for the new day.
  const today = localDateInTimeZone(new Date(), browserTimezone())

  // Another account, a hide zone or a route Mầm may not speak on ends what is on screen.
  if (
    shown &&
    (shown.accountId !== accountId ||
      hard ||
      !mamSpeaks(mode, shown.reaction.intent))
  )
    setShown(null)

  useEffect(
    () => () => {
      pending.current = null
      lastShownAt.current = null
      cheering.current = null
      seen.current.clear()
      tried.current.clear()
    },
    [accountId],
  )

  // A new reaction waits for delivery; the daily one never replaces an event's that is already waiting.
  const offer = useCallback(
    (reaction: Omit<MamReaction, 'key'> | null, keepWaiting = false) => {
      if (!reaction || (keepWaiting && pending.current)) return
      pending.current = {
        reaction: { ...reaction, key: `mam-reaction:${Date.now()}` },
        at: Date.now(),
      }
      setWake((value) => value + 1)
    },
    [],
  )

  // Delivery: the one place a reaction becomes a bubble. The daily cap drops it; the 60 s spacing only waits.
  useEffect(() => {
    const next = pending.current
    if (!next || shown || !accountId) return
    const now = Date.now()
    if (hard || now - next.at > PENDING_MS) {
      pending.current = null
      return
    }
    if (!mamSpeaks(mode, next.reaction.intent) || !ready) return
    const countKey = mamDailyKey('bubbles', accountId, today)
    if (mamBubbleCapped(readMamCount(countKey))) {
      pending.current = null
      return
    }
    const wait = mamSpacingWaitMs(lastShownAt.current, now)
    if (wait > 0) {
      const timer = setTimeout(
        () => setWake((value) => value + 1),
        wait + RETRY_MARGIN_MS,
      )
      return () => clearTimeout(timer)
    }
    pending.current = null
    bumpMamCount(countKey)
    lastShownAt.current = now
    setShown({ reaction: next.reaction, accountId })
  }, [wake, shown, hard, mode, ready, accountId, today])

  useEffect(() => {
    if (!accountId) return
    const controller = new AbortController()
    const answer = async (event: MamEventDetail, supportToday: number) => {
      if (event.type === 'checkin-saved') {
        // The series is read after Care confirmed the save; today's level is also set from the event.
        const view = await loadView(controller.signal)
        if (controller.signal.aborted || !view) return
        const level = MAM_EMOTION_LEVEL[event.emotion]
        const days = view.days.map((day) => ({
          localDate: day.localDate,
          level: day.localDate === event.localDate ? level : day.emotionLevel,
        }))
        if (!days.some((day) => day.localDate === event.localDate))
          days.push({ localDate: event.localDate, level })
        cheering.current = mamCheerable(view)
        offer(
          stateReaction(mamTrajectory(days, event.localDate), view, accountId),
        )
        return
      }
      let daysSinceJournal: number | null = null
      let previousJournalMood: MamEmotion | null = null
      if (event.type === 'journal-saved') {
        const key = mamDailyKey('journal', event.accountId)
        const last = readMamDaily(key)
        daysSinceJournal = last ? daysBetween(last, event.localDate) : null
        writeMamDaily(key, event.localDate)
        // Stored as `date|MOOD`: only the picked level, never the entry text.
        const moodKey = mamDailyKey('journal-mood', event.accountId)
        const [moodDate, mood] = (readMamDaily(moodKey) ?? '').split('|')
        if (
          moodDate &&
          mood &&
          mood in MAM_EMOTION_LEVEL &&
          daysBetween(moodDate, event.localDate) < MAM_WINDOW_DAYS
        )
          previousJournalMood = mood as MamEmotion
        if (event.mood)
          writeMamDaily(moodKey, `${event.localDate}|${event.mood}`)
      }
      const context = {
        calm: cheering.current,
        supportToday,
        daysSinceJournal,
        previousJournalMood,
      }
      // A celebration needs a known calm. A reassessment always asks again (the band may just have changed);
      // a support step uses what this page load knows, else asks. A failed read is "not calm", never a guess.
      if (
        mamEventReaction(event, { ...context, calm: true })?.intent ===
        'CELEBRATE'
      ) {
        if (event.type === 'reassessment-done' || context.calm === null) {
          const view = await loadView(controller.signal)
          if (controller.signal.aborted) return
          context.calm = view ? mamCheerable(view) : false
          if (view) cheering.current = context.calm
        }
      }
      const reaction = mamEventReaction(event, context)
      if (reaction)
        offer({
          intent: reaction.intent,
          ...(reaction.grade ? { grade: reaction.grade } : {}),
          text: pickMamLine(reaction.line, accountId),
        })
    }

    const listeners = MAM_EVENT_TYPES.map((type) => {
      const listener = (raw: Event) => {
        const event = parseMamEvent(
          type,
          (raw as CustomEvent).detail,
          accountId,
        )
        if (!event || live.current.hard) return
        // One reassessment answers once, also after a reload or another review of the same summary.
        const answered = mamDailyKey('reassessment', accountId)
        if (
          event.type === 'reassessment-done' &&
          readMamIds(answered).includes(event.id)
        )
          return
        // A step done a moment after another still counts toward the day's third, though it plays no line.
        const supportToday =
          event.type === 'support-done'
            ? bumpMamCount(
                mamDailyKey('support', event.accountId, event.localDate),
              )
            : 0
        if (!mamEventIsNew(seen.current, event)) return
        if (event.type === 'reassessment-done')
          rememberMamId(answered, event.id)
        void answer(event, supportToday)
      }
      window.addEventListener(mamEventName(type), listener)
      return () => window.removeEventListener(mamEventName(type), listener)
    })
    return () => {
      controller.abort()
      listeners.forEach((remove) => remove())
    }
  }, [accountId, offer])

  // The first FULL-route visit of the local day: read the series once. A request cut short by leaving the
  // route is tried again on the next FULL visit; a failed one waits for the next load, never loops.
  useEffect(() => {
    if (!accountId || hard || mode !== 'full') return
    const key = mamDailyKey('daily', accountId, today)
    const attempts = tried.current
    if (readMamDaily(key) || attempts.has(key)) return
    attempts.add(key)
    const controller = new AbortController()
    let finished = false
    void loadView(controller.signal).then((view) => {
      finished = true
      if (controller.signal.aborted || !view) return
      writeMamDaily(key, '1')
      cheering.current = mamCheerable(view)
      const days = view.days.map((day) => ({
        localDate: day.localDate,
        level: day.emotionLevel,
      }))
      offer(
        stateReaction(mamTrajectory(days, view.asOfLocalDate), view, accountId),
        true,
      )
    })
    return () => {
      controller.abort()
      if (!finished) attempts.delete(key)
    }
  }, [accountId, hard, mode, offer, today])

  return {
    reaction: shown?.reaction ?? null,
    dismiss: () => setShown(null),
  }
}
