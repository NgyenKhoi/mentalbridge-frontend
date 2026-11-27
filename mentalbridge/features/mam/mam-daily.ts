// Per-account, per-local-day counters of Mầm's trajectory and event bubbles (MB-897): the daily moment's
// "done" flag, the 3-a-day cap, the support steps of the day, the last journal day. Storage may be blocked or
// full (private windows, quota), so every read and write is guarded and falls back to this tab's memory.
// shortcut: old days' keys stay in storage (a few bytes each), prune them if the key count ever matters.
export const MAM_BUBBLE_CAP = 3
/** Needing Mầm less (mam-v3): on a steady-good day she speaks once. */
export const MAM_BUBBLE_CAP_STEADY = 1
export const MAM_SPACING_MS = 60_000

const memory = new Map<string, string>()

export const mamDailyKey = (kind: string, accountId: string, localDate = '') =>
  `mentalbridge_mam_${kind}:${accountId}${localDate ? `:${localDate}` : ''}`

export function readMamDaily(key: string): string | null {
  try {
    const stored = window.localStorage.getItem(key)
    if (stored !== null) return stored
  } catch {
    // Blocked storage: the memory copy below.
  }
  return memory.get(key) ?? null
}

export function writeMamDaily(key: string, value: string) {
  memory.set(key, value)
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Kept in memory for this tab.
  }
}

export function readMamCount(key: string) {
  const count = Number(readMamDaily(key))
  return Number.isInteger(count) && count > 0 ? count : 0
}

/** Adds one and returns the new count. */
export function bumpMamCount(key: string) {
  const count = readMamCount(key) + 1
  writeMamDaily(key, String(count))
  return count
}

export const MAM_IDS_KEPT = 5

/** The last few ids answered under a key (newest last). A single plain id from an older build reads as one. */
export function readMamIds(key: string): string[] {
  const stored = readMamDaily(key)
  if (stored === null) return []
  try {
    const parsed: unknown = JSON.parse(stored)
    if (Array.isArray(parsed))
      return parsed.filter((id): id is string => typeof id === 'string')
  } catch {
    // Not JSON: an older build stored the bare id.
  }
  return [stored]
}

export function rememberMamId(key: string, id: string) {
  const ids = readMamIds(key).filter((known) => known !== id)
  writeMamDaily(key, JSON.stringify([...ids, id].slice(-MAM_IDS_KEPT)))
}

/** At most 3 bubbles a day (1 on a steady-good day): a reaction past the cap is dropped. */
export const mamBubbleCapped = (shownToday: number, steady = false) =>
  shownToday >= (steady ? MAM_BUBBLE_CAP_STEADY : MAM_BUBBLE_CAP)

/** How long a reaction waits for the 60 s spacing since the last bubble (0 when it may show now). */
export const mamSpacingWaitMs = (lastShownAt: number | null, now: number) =>
  lastShownAt === null ? 0 : Math.max(0, lastShownAt + MAM_SPACING_MS - now)

/** Tests only: forget this tab's copy (the storage is the test's own to clear). */
export const resetMamDailyMemory = () => memory.clear()
