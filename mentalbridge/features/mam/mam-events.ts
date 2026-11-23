// Verified-success events for Mầm (MB-897). A feature dispatches one only after the server confirmed the
// save (never a pending or failed one). The detail carries enums and dates, never text, and is stamped with
// the signed-in account: the host drops an event from another account and plays a duplicate once.
import type { ReassessmentSummary } from '@/features/assessment/api/care-contract'
import { localDateInTimeZone } from '@/lib/emotion-check-in/presentation'

import { slottedMamAccountId } from './MamDockSlot'
import type { MamLineKey } from './mam-lines'
import type { MamGrade, MamIntent } from './mam-orchestrator'
import { MAM_EMOTION_LEVEL } from './mam-trajectory'

export type MamEmotion = keyof typeof MAM_EMOTION_LEVEL
export type MamBandChange = 'LOWER' | 'SAME' | 'HIGHER'

export type MamEvent =
  | Readonly<{ type: 'journal-saved' }>
  | Readonly<{
      type: 'checkin-saved'
      emotion: MamEmotion
      intensity: number
      localDate: string
    }>
  | Readonly<{ type: 'support-done' }>
  | Readonly<{ type: 'resource-done' }>
  | Readonly<{
      type: 'reassessment-done'
      band: MamBandChange
      moderatePlus: boolean
      /** The summary it came from: one reassessment reacts once. */
      id: string
    }>

export type MamEventType = MamEvent['type']
export const MAM_EVENT_TYPES: readonly MamEventType[] = [
  'journal-saved',
  'checkin-saved',
  'support-done',
  'resource-done',
  'reassessment-done',
]
export const mamEventName = (type: MamEventType) => `mam:${type}`

export type MamEventDetail = MamEvent &
  Readonly<{ accountId: string; localDate: string }>

const browserDate = () =>
  localDateInTimeZone(
    new Date(),
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  )

/** Dispatches a verified success. Nobody to hear it (no signed-in slot) means nothing is sent. */
export function dispatchMamEvent(event: MamEvent) {
  const accountId = slottedMamAccountId()
  if (!accountId || typeof window === 'undefined') return
  const detail: MamEventDetail = {
    localDate: browserDate(),
    ...event,
    accountId,
  }
  window.dispatchEvent(new CustomEvent(mamEventName(event.type), { detail }))
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const BANDS: readonly string[] = ['LOWER', 'SAME', 'HIGHER']

/** The detail of an event for this account, or null: another account, an unknown shape or a stray field. */
export function parseMamEvent(
  type: MamEventType,
  detail: unknown,
  accountId: string,
): MamEventDetail | null {
  if (!detail || typeof detail !== 'object') return null
  const value = detail as Record<string, unknown>
  if (value.accountId !== accountId) return null
  if (typeof value.localDate !== 'string' || !DATE.test(value.localDate))
    return null
  const base = { accountId, localDate: value.localDate }
  switch (type) {
    case 'journal-saved':
    case 'support-done':
    case 'resource-done':
      return { ...base, type }
    case 'checkin-saved':
      return typeof value.emotion === 'string' &&
        value.emotion in MAM_EMOTION_LEVEL &&
        typeof value.intensity === 'number' &&
        Number.isFinite(value.intensity)
        ? {
            ...base,
            type,
            emotion: value.emotion as MamEmotion,
            intensity: value.intensity,
          }
        : null
    case 'reassessment-done':
      return typeof value.band === 'string' &&
        BANDS.includes(value.band) &&
        typeof value.moderatePlus === 'boolean' &&
        typeof value.id === 'string' &&
        value.id
        ? {
            ...base,
            type,
            band: value.band as MamBandChange,
            moderatePlus: value.moderatePlus,
            id: value.id,
          }
        : null
  }
}

export const MAM_DEDUPE_MS = 10_000

/**
 * One event plays once: the same id ever, or the same type and local date within 10 s. `seen` is the
 * caller's own memory (one per signed-in account); returns whether this event is new.
 */
export function mamEventIsNew(
  seen: Map<string, number>,
  event: MamEventDetail,
  now = Date.now(),
) {
  const byId = 'id' in event ? `${event.type}:id:${event.id}` : null
  const byDate = `${event.type}:${event.localDate}`
  const last = seen.get(byDate)
  if (
    (byId && seen.has(byId)) ||
    (last !== undefined && now - last < MAM_DEDUPE_MS)
  )
    return false
  seen.set(byDate, now)
  if (byId) seen.set(byId, now)
  return true
}

const LEVELS = ['MINIMAL', 'MILD', 'MODERATE', 'MODERATELY_SEVERE', 'SEVERE']

/**
 * The band change Care reported for a reassessment: worse on any instrument is HIGHER, otherwise better on
 * any is LOWER, else SAME. `moderatePlus` is true when any instrument's current band is moderate or higher,
 * with or without a previous point (it then comforts, whatever moved). Null, so silent, when a level is not
 * one this client knows (never read as LOWER) or when nothing could be compared and no band is moderate+.
 */
export function mamBandChange(
  summary: Pick<ReassessmentSummary, 'screening'>,
): Readonly<{ band: MamBandChange; moderatePlus: boolean }> | null {
  const trends = summary.screening.trends
  const levels = trends.flatMap((trend) => [
    trend.current.screeningLevel,
    ...(trend.previous ? [trend.previous.screeningLevel] : []),
  ])
  if (levels.some((level) => !LEVELS.includes(level))) return null
  const moderatePlus = trends.some(
    (trend) =>
      LEVELS.indexOf(trend.current.screeningLevel) >=
      LEVELS.indexOf('MODERATE'),
  )
  const steps = trends.flatMap((trend) =>
    trend.state === 'AVAILABLE' && trend.previous
      ? [
          {
            from: LEVELS.indexOf(trend.previous.screeningLevel),
            to: LEVELS.indexOf(trend.current.screeningLevel),
          },
        ]
      : [],
  )
  if (!steps.length) return moderatePlus ? { band: 'SAME', moderatePlus } : null
  return {
    band: steps.some((s) => s.to > s.from)
      ? 'HIGHER'
      : steps.some((s) => s.to < s.from)
        ? 'LOWER'
        : 'SAME',
    moderatePlus,
  }
}

export type MamEventReaction = Readonly<{
  intent: MamIntent
  grade?: MamGrade
  line: MamLineKey
}>

export const MAM_RETURN_DAYS = 3
export const MAM_SUPPORT_CELEBRATE_EVERY = 3

/**
 * What an event answers with. `calm` is whether the last look-back allowed cheering (not harder, no
 * moderate-or-higher band, nothing missing); null is unknown. Both celebrations (the third support step and a
 * lower reassessment band) need a known calm, so neither ever rests on a guess.
 * `daysSinceJournal` is null for a first entry or an unknown history, which is a plain nod.
 */
export function mamEventReaction(
  event: MamEvent,
  context: Readonly<{
    calm: boolean | null
    supportToday: number
    daysSinceJournal: number | null
  }>,
): MamEventReaction | null {
  switch (event.type) {
    case 'journal-saved':
      return context.daysSinceJournal !== null &&
        context.daysSinceJournal >= MAM_RETURN_DAYS
        ? { intent: 'ENCOURAGE', line: 'JOURNAL_RETURN' }
        : { intent: 'LISTEN', line: 'JOURNAL_SAVED' }
    case 'support-done':
      return context.calm === true &&
        context.supportToday > 0 &&
        context.supportToday % MAM_SUPPORT_CELEBRATE_EVERY === 0
        ? { intent: 'CELEBRATE', grade: 'soft', line: 'SUPPORT_THIRD' }
        : { intent: 'ENCOURAGE', line: 'SUPPORT_DONE' }
    case 'resource-done':
      return { intent: 'ENCOURAGE', line: 'RESOURCE_DONE' }
    case 'reassessment-done':
      if (event.moderatePlus || event.band === 'HIGHER')
        return { intent: 'COMFORT', line: 'REASSESSMENT_CARE' }
      return event.band === 'LOWER' && context.calm === true
        ? { intent: 'CELEBRATE', grade: 'soft', line: 'REASSESSMENT_LOWER' }
        : { intent: 'LISTEN', line: 'REASSESSMENT_SAME' }
    case 'checkin-saved':
      // Answered from the trajectory, which needs the series.
      return null
  }
}
