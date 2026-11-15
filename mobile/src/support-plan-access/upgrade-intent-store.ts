import type { GuideOrigin } from './support-plan-access-contract'

const UPGRADE_INTENT_TTL_MS = 30 * 60 * 1000

export type PendingUpgradeIntent = Readonly<{
  subject: string
  paymentId: string
  origin?: GuideOrigin | undefined
  createdAtMs: number
}>

let currentIntent: PendingUpgradeIntent | null = null

/**
 * Stores ephemeral in-memory upgrade return intent scoped to a single authenticated
 * `subject`. Never persists tokens, private URLs, or health data to device storage.
 */
export function setPendingUpgradeIntent(
  input: Readonly<{
    subject: string
    paymentId: string
    origin?: GuideOrigin | undefined
    nowMs?: number | undefined
  }>,
): PendingUpgradeIntent {
  const next: PendingUpgradeIntent = {
    subject: input.subject,
    paymentId: input.paymentId,
    origin: input.origin,
    createdAtMs: input.nowMs ?? Date.now(),
  }
  currentIntent = next
  return next
}

/**
 * Reads active checkout intent only when owned by `subject` and within TTL.
 * Automatically evicts stale or cross-account entries on mismatch.
 */
export function getPendingUpgradeIntent(
  subject: string | null | undefined,
  nowMs = Date.now(),
): PendingUpgradeIntent | null {
  if (!currentIntent) return null
  if (!subject || currentIntent.subject !== subject) {
    currentIntent = null
    return null
  }
  if (nowMs - currentIntent.createdAtMs > UPGRADE_INTENT_TTL_MS) {
    currentIntent = null
    return null
  }
  return currentIntent
}

export function consumePendingUpgradeIntent(
  subject: string | null | undefined,
  nowMs = Date.now(),
): PendingUpgradeIntent | null {
  const existing = getPendingUpgradeIntent(subject, nowMs)
  if (!existing) return null
  currentIntent = null
  return existing
}

export function clearPendingUpgradeIntent(subject?: string | null): void {
  if (!currentIntent) return
  if (!subject || currentIntent.subject === subject) {
    currentIntent = null
  }
}
