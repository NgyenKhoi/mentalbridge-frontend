// Celebration director (ADR_MAM_RIVE_V1_CONTRACT.md, "Celebration policy and
// budget"). Pure scheduler: no React, no DOM. Clock, storage, locks and the
// session id are injected so the policy runs under unit tests.
import type {
  AchievementCollection,
  ResourceBingoBoard,
} from '@/lib/content/content-validation'
import type { MamOneShot } from './mam-contract'

export const MAM_AWARD_READ_EVENT = 'mam:award-read'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const COOLDOWN_MS = 30 * MINUTE
const DAILY_CAP = 3
const CUT_OFF_MS = 24 * HOUR
const SEEN_TTL_MS = 48 * HOUR
// shortcut: liveness is "touched in the last 30 min", not a heartbeat; upgrade if idle tabs lose awards in practice
const SESSION_LIVE_MS = 30 * MINUTE
const SESSION_TTL_MS = 24 * HOUR
const MAX_SESSIONS = 20
const FRESH_READ_MS = 5 * MINUTE
const COALESCE_MS = 10_000
const MAX_AWARDS = 200
const MAX_QUEUE = 50

export type MamAwardKind = 'achievement' | 'bingo'

export interface MamAward {
  key: string
  kind: MamAwardKind
  /** `unlockedAt` or `verifiedAt` in epoch ms. */
  at: number
  title?: string
}

/** One owner read of Achievements (per domain) or of a Bingo board. */
export interface MamAwardRead {
  scope: string
  available: boolean
  visible: boolean
  readAt: number
  awards: MamAward[]
}

export interface MamQueueEntry extends MamAward {
  scope: string
  queuedAt: number
  /** The tabs that observed it; the entry lives while one of them is live. */
  sessions: string[]
}

export interface MamRecord {
  v: 1
  seen: Record<string, number>
  baselined: Record<string, true>
  lastReads: Record<string, { at: number; eligible: string[] }>
  queue: MamQueueEntry[]
  reservations: { atMs: number; hero: boolean }[]
  /** Last time each tab session touched the record. */
  sessions: Record<string, number>
}

export interface MamAppearance {
  oneShot: MamOneShot
  entries: MamQueueEntry[]
}

export const achievementKey = (definitionId: string, unlockedAt: string) =>
  `achievement:${definitionId}:${unlockedAt}`

export const bingoKey = (
  weekStart: string,
  timeZone: string,
  position: number,
  resourceId: string,
  contentVersion: string,
) =>
  `bingo:${weekStart}:${timeZone}:${position}:${resourceId}:${contentVersion}`

/** Achievements: EARNED with `unlockedAt` only. One read per source domain. */
export function awardsFromAchievements(
  collection: AchievementCollection,
  readAt: number,
  visible: boolean,
): MamAwardRead[] {
  return collection.sources.map(({ domain, availability }) => {
    // A user who hid their rewards gets no celebration of them.
    const available =
      availability === 'AVAILABLE' && collection.visibilityState === 'VISIBLE'
    const awards: MamAward[] = []
    for (const item of available ? collection.items : []) {
      const at = item.unlockedAt === null ? NaN : Date.parse(item.unlockedAt)
      if (item.domain !== domain || item.status !== 'EARNED' || isNaN(at))
        continue
      awards.push({
        key: achievementKey(item.definitionId, item.unlockedAt as string),
        kind: 'achievement',
        at,
        title: item.title,
      })
    }
    return {
      scope: `achievements:${domain}`,
      available,
      visible,
      readAt,
      awards,
    }
  })
}

/** Bingo: CONTENT_VERIFIED items only. SELF_CONFIRMED and NONE never qualify. */
export function awardsFromBingo(
  board: ResourceBingoBoard,
  readAt: number,
  visible: boolean,
): MamAwardRead {
  const awards: MamAward[] = []
  for (const item of board.items) {
    const at = item.verifiedAt === null ? NaN : Date.parse(item.verifiedAt)
    if (item.evidence !== 'CONTENT_VERIFIED' || isNaN(at)) continue
    awards.push({
      key: bingoKey(
        board.weekStart,
        board.timeZone,
        item.position,
        item.resourceId,
        item.contentVersion,
      ),
      kind: 'bingo',
      at,
    })
  }
  return {
    scope: `bingo:${board.weekStart}:${board.timeZone}`,
    available: true,
    visible,
    readAt,
    awards,
  }
}

export function dispatchMamAwardRead(read: MamAwardRead) {
  window.dispatchEvent(new CustomEvent(MAM_AWARD_READ_EVENT, { detail: read }))
}

const object = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const text = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max

const kindOf = (scope: string): MamAwardKind =>
  scope.startsWith('bingo:') ? 'bingo' : 'achievement'

function parseAward(value: unknown, kind: MamAwardKind): MamAward | null {
  const award = object(value)
  if (
    !award ||
    award.kind !== kind ||
    !text(award.key, 300) ||
    !award.key.startsWith(`${kind}:`) ||
    !finite(award.at) ||
    (kind === 'achievement'
      ? !text(award.title, 200)
      : award.title !== undefined)
  )
    return null
  return {
    key: award.key,
    kind,
    at: award.at,
    ...(kind === 'achievement' ? { title: award.title as string } : {}),
  }
}

/** The event detail is untrusted: anything off-shape is dropped whole. */
export function parseMamAwardRead(detail: unknown): MamAwardRead | null {
  const read = object(detail)
  if (
    !read ||
    !text(read.scope, 120) ||
    !/^(achievements|bingo):/.test(read.scope) ||
    typeof read.available !== 'boolean' ||
    typeof read.visible !== 'boolean' ||
    !finite(read.readAt) ||
    !Array.isArray(read.awards) ||
    read.awards.length > MAX_AWARDS
  )
    return null
  const kind = kindOf(read.scope)
  const awards = read.awards.map((award) => parseAward(award, kind))
  if (awards.includes(null)) return null
  return {
    scope: read.scope,
    available: read.available,
    visible: read.visible,
    readAt: read.readAt,
    awards: awards as MamAward[],
  }
}

export const emptyMamRecord = (): MamRecord => ({
  v: 1,
  seen: {},
  baselined: {},
  lastReads: {},
  queue: [],
  reservations: [],
  sessions: {},
})

function parseEntry(value: unknown): MamQueueEntry | null {
  const entry = object(value)
  if (!entry) return null
  const scope = entry.scope
  if (!text(scope, 120)) return null
  const award = parseAward(entry, kindOf(scope))
  const { sessions } = entry
  return award &&
    finite(entry.queuedAt) &&
    Array.isArray(sessions) &&
    sessions.length <= MAX_SESSIONS &&
    sessions.every((id) => text(id, 80))
    ? { ...award, scope, queuedAt: entry.queuedAt, sessions }
    : null
}

/**
 * Rebuilds a record from stored JSON. A malformed `seen` resets the whole
 * record, so the next read rebaselines silently instead of replaying delivered
 * awards; other malformed parts only lose themselves (they can only delay).
 */
export function parseMamRecord(raw: string | null): MamRecord {
  const record = emptyMamRecord()
  let value: Record<string, unknown> | null = null
  try {
    value = raw === null ? null : object(JSON.parse(raw))
  } catch {
    return record
  }
  if (!value || value.v !== 1) return record
  const seen = object(value.seen)
  const baselined = object(value.baselined)
  const lastReads = object(value.lastReads)
  const sessions = object(value.sessions)
  if (
    !seen ||
    !baselined ||
    !lastReads ||
    !sessions ||
    !Array.isArray(value.queue) ||
    !Array.isArray(value.reservations) ||
    !Object.values(seen).every(finite)
  )
    return record
  Object.assign(record.seen, seen)
  for (const [id, at] of Object.entries(sessions))
    if (finite(at)) record.sessions[id] = at
  for (const [scope, flag] of Object.entries(baselined))
    if (flag === true) record.baselined[scope] = true
  for (const [scope, read] of Object.entries(lastReads)) {
    const item = object(read)
    if (
      item &&
      finite(item.at) &&
      Array.isArray(item.eligible) &&
      item.eligible.every((key) => typeof key === 'string')
    )
      record.lastReads[scope] = { at: item.at, eligible: item.eligible }
  }
  for (const entry of value.queue.slice(0, MAX_QUEUE)) {
    const parsed = parseEntry(entry)
    if (parsed) record.queue.push(parsed)
  }
  for (const item of value.reservations) {
    const reservation = object(item)
    if (reservation && finite(reservation.atMs))
      record.reservations.push({
        atMs: reservation.atMs,
        hero: reservation.hero === true,
      })
  }
  return record
}

const sameLocalDay = (a: number, b: number) =>
  new Date(a).toDateString() === new Date(b).toDateString()

/**
 * Drops what can no longer matter. A queue entry goes when it is a day old or
 * none of its tabs touched the record in the last 30 min; its key then counts
 * as seen, so an identical later read does not queue it again.
 */
export function pruneMamRecord(record: MamRecord, now: number) {
  for (const [key, at] of Object.entries(record.seen))
    if (now - at > SEEN_TTL_MS) delete record.seen[key]
  for (const [id, at] of Object.entries(record.sessions))
    if (now - at > SESSION_TTL_MS) delete record.sessions[id]
  record.reservations = record.reservations.filter(
    ({ atMs }) => sameLocalDay(atMs, now) || now - atMs < COOLDOWN_MS,
  )
  record.queue = record.queue.filter((entry) => {
    const live =
      now - entry.queuedAt <= CUT_OFF_MS &&
      entry.sessions.some(
        (id) => now - (record.sessions[id] ?? -Infinity) <= SESSION_LIVE_MS,
      )
    if (!live) record.seen[entry.key] = entry.at
    return live
  })
}

/** Applies one owner read: seed silently, or queue what is new. */
export function observeMamRead(
  record: MamRecord,
  read: MamAwardRead,
  now: number,
  sessionId: string,
) {
  const { scope, awards } = read
  const kind = kindOf(scope)
  const readAt = Math.min(read.readAt, now)
  // The 24 h cut-off also gates reconciliation: an award that aged past it
  // while queued is no longer listed as eligible.
  const fresh = awards.filter((award) => readAt - award.at <= CUT_OFF_MS)
  const eligible = read.available ? fresh.map((award) => award.key) : []
  record.lastReads[scope] = { at: readAt, eligible }
  if (!read.visible) {
    record.queue = record.queue.filter((entry) => entry.kind !== kind)
    return
  }
  // Reconciliation: an entry the owner no longer lists never plays.
  record.queue = record.queue.filter(
    (entry) => entry.scope !== scope || eligible.includes(entry.key),
  )
  if (!read.available) return
  if (!record.baselined[scope]) {
    for (const award of awards) record.seen[award.key] = award.at
    record.baselined[scope] = true
    return
  }
  for (const award of fresh) {
    if (record.seen[award.key] !== undefined) continue
    const queued = record.queue.find((entry) => entry.key === award.key)
    if (queued) {
      if (!queued.sessions.includes(sessionId)) queued.sessions.push(sessionId)
    } else if (record.queue.length < MAX_QUEUE)
      record.queue.push({
        ...award,
        scope,
        queuedAt: now,
        sessions: [sessionId],
      })
  }
}

/** Queued entries whose scope was read at most 5 minutes ago and still lists them. */
function freshEntries(record: MamRecord, now: number) {
  return record.queue
    .filter((entry) => {
      const read = record.lastReads[entry.scope]
      return (
        read !== undefined &&
        now - read.at <= FRESH_READ_MS &&
        read.eligible.includes(entry.key)
      )
    })
    .sort((a, b) => a.queuedAt - b.queuedAt)
}

/**
 * The next appearance the budget allows, or null. Does not change the record.
 * Nothing is released before the earliest ready entry has waited the 10 s
 * coalescing window, so awards observed in that window share one appearance.
 */
export function nextMamAppearance(
  record: MamRecord,
  now: number,
): MamAppearance | null {
  const today = record.reservations.filter(({ atMs }) =>
    sameLocalDay(atMs, now),
  )
  if (
    today.length >= DAILY_CAP ||
    record.reservations.some(({ atMs }) => now - atMs < COOLDOWN_MS)
  )
    return null
  const ready = freshEntries(record, now)
  if (ready.length === 0 || now < ready[0].queuedAt + COALESCE_MS) return null
  const entries = ready.filter(
    (entry) => entry.queuedAt - ready[0].queuedAt <= COALESCE_MS,
  )
  // The tier is decided here, at play time, not when the award was queued.
  const oneShot = entries.some((entry) => entry.kind === 'achievement')
    ? today.some(({ hero }) => hero)
      ? 'celebrate_soft'
      : 'celebrate_hero'
    : 'light_success'
  return { oneShot, entries }
}

/**
 * When a fresh queued entry could next be released, or null when nothing is
 * waiting, the day is full, or its evidence expires first. The host sets one
 * timer for it; there is no polling.
 */
export function mamRetryAt(record: MamRecord, now: number): number | null {
  const ready = freshEntries(record, now)
  if (ready.length === 0) return null
  const today = record.reservations.filter(({ atMs }) =>
    sameLocalDay(atMs, now),
  )
  if (today.length >= DAILY_CAP) return null
  const budgetOpens = Math.max(
    -Infinity,
    ...record.reservations.map(({ atMs }) => atMs + COOLDOWN_MS),
  )
  const at = Math.max(ready[0].queuedAt + COALESCE_MS, budgetOpens)
  const expires = record.lastReads[ready[0].scope].at + FRESH_READ_MS
  return at <= expires ? at : null
}

/** Consumes the slot and marks the keys seen; call under the lock, after the budget check. */
export function reserveMamAppearance(
  record: MamRecord,
  appearance: MamAppearance,
  now: number,
) {
  record.reservations.push({
    atMs: now,
    hero: appearance.oneShot === 'celebrate_hero',
  })
  for (const { key, at } of appearance.entries) record.seen[key] = at
  record.queue = record.queue.filter(
    (entry) => !appearance.entries.some(({ key }) => key === entry.key),
  )
}

/** Returns the slot and puts the entries back; `seen` stays, so the requeue bypasses it. */
export function interruptMamAppearance(
  record: MamRecord,
  appearance: MamAppearance,
  reservedAt: number,
  sessionId: string,
) {
  const index = record.reservations.findIndex(({ atMs }) => atMs === reservedAt)
  if (index >= 0) record.reservations.splice(index, 1)
  for (const entry of appearance.entries)
    if (!record.queue.some(({ key }) => key === entry.key))
      record.queue.push({
        ...entry,
        sessions: [...new Set([...entry.sessions, sessionId])].slice(
          -MAX_SESSIONS,
        ),
      })
}

/** "Bạn vừa ghi nhận ..." for the achievements of a group; null when there are none. */
export function mamAppearanceText(entries: readonly MamQueueEntry[]) {
  const [first, ...others] = entries.filter(
    (entry) => entry.kind === 'achievement',
  )
  if (!first) return null
  const more = others.length > 0 ? ` và ${others.length} thành tựu khác` : ''
  return `Bạn vừa ghi nhận “${first.title}”${more}.`
}

/** Reduced motion or muted: the fresh achievement text for the dock menu, no budget. Marks its keys seen. */
export function takeMamNote(record: MamRecord, now: number) {
  const entries = freshEntries(record, now).filter(
    (entry) => entry.kind === 'achievement',
  )
  for (const { key, at } of entries) record.seen[key] = at
  record.queue = record.queue.filter(
    (entry) => !entries.some(({ key }) => key === entry.key),
  )
  return mamAppearanceText(entries)
}

export interface MamCelebrationEnv {
  now(): number
  storage: Pick<Storage, 'getItem' | 'setItem'> | null
  sessionId: string | null
  locks: Pick<LockManager, 'request'> | null
}

const SESSION_KEY = 'mentalbridge_mam_celebration_session'

export function browserMamEnv(): MamCelebrationEnv {
  let storage: Storage | null = null
  let sessionId: string | null = null
  try {
    storage = window.localStorage
    sessionId = window.sessionStorage.getItem(SESSION_KEY)
    if (!sessionId) {
      sessionId = crypto.randomUUID()
      window.sessionStorage.setItem(SESSION_KEY, sessionId)
    }
  } catch {
    // Blocked storage: the director stays silent.
  }
  return {
    now: Date.now,
    storage,
    sessionId,
    locks: typeof navigator === 'undefined' ? null : (navigator.locks ?? null),
  }
}

/**
 * Runs `update` on the account's record under its exclusive lock and saves it.
 * Null when storage, locks or the account are unavailable, or anything throws:
 * nothing then plays automatically.
 */
async function withRecord<T>(
  accountId: string | null,
  env: MamCelebrationEnv,
  update: (record: MamRecord, now: number, sessionId: string) => T,
): Promise<T | null> {
  const { storage, locks, sessionId } = env
  if (!accountId || !storage || !locks || !sessionId) return null
  const key = `mentalbridge_mam_celebrations:${accountId}`
  try {
    return await locks.request(
      `mentalbridge-mam-celebrations:${accountId}`,
      () => {
        const now = env.now()
        const record = parseMamRecord(storage.getItem(key))
        record.sessions[sessionId] = now
        pruneMamRecord(record, now)
        const result = update(record, now, sessionId)
        storage.setItem(key, JSON.stringify(record))
        return result
      },
    )
  } catch {
    return null
  }
}

export const observeMamAwardRead = (
  accountId: string | null,
  read: MamAwardRead,
  env = browserMamEnv(),
) =>
  withRecord(accountId, env, (record, now, sessionId) =>
    observeMamRead(record, read, now, sessionId),
  )

/**
 * Budget check, reservation and seen-marking in one locked step. `reservation`
 * is null when nothing may play yet; `retryAt` then says when to ask again.
 */
export const reserveMamNext = (
  accountId: string | null,
  env = browserMamEnv(),
) =>
  withRecord(accountId, env, (record, now) => {
    const appearance = nextMamAppearance(record, now)
    if (!appearance)
      return { reservation: null, retryAt: mamRetryAt(record, now) }
    reserveMamAppearance(record, appearance, now)
    return { reservation: { appearance, reservedAt: now }, retryAt: null }
  })

export const returnMamAppearance = (
  accountId: string | null,
  appearance: MamAppearance,
  reservedAt: number,
  env = browserMamEnv(),
) =>
  withRecord(accountId, env, (record, _now, sessionId) =>
    interruptMamAppearance(record, appearance, reservedAt, sessionId),
  )

export const takeMamNoteFor = (
  accountId: string | null,
  env = browserMamEnv(),
) => withRecord(accountId, env, (record, now) => takeMamNote(record, now))
