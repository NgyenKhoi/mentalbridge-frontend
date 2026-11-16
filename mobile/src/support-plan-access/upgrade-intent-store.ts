import {
  sanitizeGuideOrigin,
  type GuideOrigin,
  type PlanPayment,
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
  payment?: PlanPayment | undefined
  createdAtMs: number
}>

export type InFlightCheckoutRecord<T = unknown> = Readonly<{
  subject: string
  planVersionId: string
  idempotencyKey: string
  promise: Promise<T>
}>

export type ExpiredUnresolvedCheckoutAttempt = Readonly<{
  subject: string
  planVersionId: string
  idempotencyKey: string
  status: 'preparing' | 'uncertain'
  paymentId?: string | undefined
  createdAtMs: number
  expiredAtMs: number
}>

let currentIntent: PendingUpgradeIntent | null = null
let currentCheckoutAttempt: CheckoutAttemptRecord | null = null
let currentInFlightCheckout: InFlightCheckoutRecord | null = null
const expiredUnresolvedSubjects = new Set<string>()
const expiredUnresolvedAttempts = new Map<
  string,
  ExpiredUnresolvedCheckoutAttempt
>()

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
    if (
      currentCheckoutAttempt.status === 'preparing' ||
      currentCheckoutAttempt.status === 'uncertain'
    ) {
      const record: ExpiredUnresolvedCheckoutAttempt = {
        subject: currentCheckoutAttempt.subject,
        planVersionId: currentCheckoutAttempt.planVersionId,
        idempotencyKey: currentCheckoutAttempt.idempotencyKey,
        status: currentCheckoutAttempt.status,
        paymentId: currentCheckoutAttempt.paymentId,
        createdAtMs: currentCheckoutAttempt.createdAtMs,
        expiredAtMs: nowMs,
      }
      expiredUnresolvedAttempts.set(
        `${record.subject}:${record.planVersionId}`,
        record,
      )
      expiredUnresolvedSubjects.add(currentCheckoutAttempt.subject)
    }
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
    payment?: PlanPayment | undefined
    nowMs?: number | undefined
  }>,
): CheckoutAttemptRecord {
  const next: CheckoutAttemptRecord = {
    subject: input.subject,
    planVersionId: input.planVersionId,
    idempotencyKey: input.idempotencyKey,
    status: input.status,
    paymentId: input.paymentId,
    payment: input.payment,
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
  payment?: PlanPayment,
): CheckoutAttemptRecord {
  return saveCheckoutAttempt({
    subject,
    planVersionId,
    idempotencyKey,
    status: 'pending',
    paymentId,
    payment,
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
  if (!subject) {
    currentCheckoutAttempt = null
    currentInFlightCheckout = null
    expiredUnresolvedSubjects.clear()
    expiredUnresolvedAttempts.clear()
    return
  }
  if (currentCheckoutAttempt?.subject === subject) {
    currentCheckoutAttempt = null
  }
  if (currentInFlightCheckout?.subject === subject) {
    currentInFlightCheckout = null
  }
  expiredUnresolvedSubjects.delete(subject)
  for (const key of Array.from(expiredUnresolvedAttempts.keys())) {
    if (key.startsWith(`${subject}:`)) {
      expiredUnresolvedAttempts.delete(key)
    }
  }
}

export function getInFlightCheckout<T = unknown>(
  subject: string | null | undefined,
  planVersionId?: string | null,
): InFlightCheckoutRecord<T> | null {
  if (!currentInFlightCheckout) return null
  if (!subject || currentInFlightCheckout.subject !== subject) {
    currentInFlightCheckout = null
    return null
  }
  if (
    planVersionId &&
    currentInFlightCheckout.planVersionId !== planVersionId
  ) {
    return null
  }
  return currentInFlightCheckout as InFlightCheckoutRecord<T>
}

export function setInFlightCheckout<T = unknown>(
  entry: InFlightCheckoutRecord<T>,
): void {
  currentInFlightCheckout = entry
}

export function clearInFlightCheckout(
  subject?: string | null,
  idempotencyKey?: string | null,
): void {
  if (!currentInFlightCheckout) return
  if (subject && currentInFlightCheckout.subject !== subject) return
  if (
    idempotencyKey &&
    currentInFlightCheckout.idempotencyKey !== idempotencyKey
  ) {
    return
  }
  currentInFlightCheckout = null
}

export function getExpiredUnresolvedCheckoutAttempt(
  subject: string | null | undefined,
  planVersionId?: string | null,
): ExpiredUnresolvedCheckoutAttempt | null {
  if (!subject) return null
  if (planVersionId) {
    return expiredUnresolvedAttempts.get(`${subject}:${planVersionId}`) ?? null
  }
  for (const [key, value] of expiredUnresolvedAttempts.entries()) {
    if (key.startsWith(`${subject}:`)) {
      return value
    }
  }
  return null
}

export function hasExpiredUnresolvedCheckoutAttempt(
  subject: string | null | undefined,
  planVersionId?: string | null,
): boolean {
  if (!subject) return false
  if (planVersionId) {
    return expiredUnresolvedAttempts.has(`${subject}:${planVersionId}`)
  }
  return (
    expiredUnresolvedSubjects.has(subject) ||
    getExpiredUnresolvedCheckoutAttempt(subject) !== null
  )
}

export function markExpiredUnresolvedCheckoutAttempt(
  subjectOrRecord: string | ExpiredUnresolvedCheckoutAttempt,
  planVersionId?: string,
  idempotencyKey?: string,
): void {
  if (typeof subjectOrRecord === 'string') {
    expiredUnresolvedSubjects.add(subjectOrRecord)
    if (planVersionId && idempotencyKey) {
      expiredUnresolvedAttempts.set(`${subjectOrRecord}:${planVersionId}`, {
        subject: subjectOrRecord,
        planVersionId,
        idempotencyKey,
        status: 'uncertain',
        createdAtMs: Date.now(),
        expiredAtMs: Date.now(),
      })
    }
  } else {
    expiredUnresolvedSubjects.add(subjectOrRecord.subject)
    expiredUnresolvedAttempts.set(
      `${subjectOrRecord.subject}:${subjectOrRecord.planVersionId}`,
      subjectOrRecord,
    )
  }
}

export function clearExpiredUnresolvedCheckoutAttempt(
  subject?: string | null,
  planVersionId?: string | null,
): void {
  if (!subject) {
    expiredUnresolvedSubjects.clear()
    expiredUnresolvedAttempts.clear()
    return
  }
  if (planVersionId) {
    expiredUnresolvedAttempts.delete(`${subject}:${planVersionId}`)
    let hasRemaining = false
    for (const key of expiredUnresolvedAttempts.keys()) {
      if (key.startsWith(`${subject}:`)) {
        hasRemaining = true
        break
      }
    }
    if (!hasRemaining) {
      expiredUnresolvedSubjects.delete(subject)
    }
    return
  }
  expiredUnresolvedSubjects.delete(subject)
  for (const key of Array.from(expiredUnresolvedAttempts.keys())) {
    if (key.startsWith(`${subject}:`)) {
      expiredUnresolvedAttempts.delete(key)
    }
  }
}
