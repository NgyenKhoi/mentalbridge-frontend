import {
  sanitizeGuideOrigin,
  type GuideOrigin,
} from './support-plan-access-contract'

const UPGRADE_INTENT_TTL_MS = 30 * 60 * 1000

export type PendingUpgradeIntent = Readonly<{
  subject: string
  paymentId: string
  origin?: GuideOrigin | undefined
  createdAtMs: number
}>

export type CheckoutAttemptStatus =
  'preparing' | 'uncertain' | 'pending' | 'terminal'

export type CheckoutAttemptRecord = Readonly<{
  subject: string
  planVersionId: string
  idempotencyKey: string
  status: CheckoutAttemptStatus
  paymentId?: string | undefined
  createdAtMs: number
}>

let currentIntent: PendingUpgradeIntent | null = null
let currentCheckoutAttempt: CheckoutAttemptRecord | null = null

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
    origin: sanitizeGuideOrigin(input.origin),
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

export function getCheckoutAttempt(
  subject: string | null | undefined,
  planVersionId?: string | null,
  nowMs = Date.now(),
): CheckoutAttemptRecord | null {
  if (!currentCheckoutAttempt) return null
  if (!subject || currentCheckoutAttempt.subject !== subject) {
    currentCheckoutAttempt = null
    return null
  }
  if (nowMs - currentCheckoutAttempt.createdAtMs > UPGRADE_INTENT_TTL_MS) {
    currentCheckoutAttempt = null
    return null
  }
  if (planVersionId && currentCheckoutAttempt.planVersionId !== planVersionId) {
    return null
  }
  return currentCheckoutAttempt
}

export function saveCheckoutAttempt(
  input: Readonly<{
    subject: string
    planVersionId: string
    idempotencyKey: string
    status: CheckoutAttemptStatus
    paymentId?: string | undefined
    nowMs?: number | undefined
  }>,
): CheckoutAttemptRecord {
  const next: CheckoutAttemptRecord = {
    subject: input.subject,
    planVersionId: input.planVersionId,
    idempotencyKey: input.idempotencyKey,
    status: input.status,
    paymentId: input.paymentId,
    createdAtMs: input.nowMs ?? Date.now(),
  }
  currentCheckoutAttempt = next
  return next
}

export function markCheckoutAttemptUncertain(
  subject: string,
  planVersionId: string,
  idempotencyKey: string,
  nowMs = Date.now(),
): CheckoutAttemptRecord {
  return saveCheckoutAttempt({
    subject,
    planVersionId,
    idempotencyKey,
    status: 'uncertain',
    nowMs,
  })
}

export function markCheckoutAttemptPending(
  subject: string,
  planVersionId: string,
  idempotencyKey: string,
  paymentId: string,
  nowMs = Date.now(),
): CheckoutAttemptRecord {
  return saveCheckoutAttempt({
    subject,
    planVersionId,
    idempotencyKey,
    status: 'pending',
    paymentId,
    nowMs,
  })
}

export function markCheckoutAttemptTerminal(
  subject: string,
  paymentId?: string | null,
): void {
  if (!currentCheckoutAttempt || currentCheckoutAttempt.subject !== subject) {
    return
  }
  if (
    paymentId &&
    currentCheckoutAttempt.paymentId &&
    currentCheckoutAttempt.paymentId !== paymentId
  ) {
    return
  }
  currentCheckoutAttempt = {
    ...currentCheckoutAttempt,
    status: 'terminal',
  }
}

export function clearCheckoutAttempt(subject?: string | null): void {
  if (!currentCheckoutAttempt) return
  if (!subject || currentCheckoutAttempt.subject === subject) {
    currentCheckoutAttempt = null
  }
}
