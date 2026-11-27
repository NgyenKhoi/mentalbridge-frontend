import type { ServiceCreditAccount } from '@/lib/consultation/consultation-validation'

/**
 * What the Plan screen may offer right now, from Consultation's own facts.
 * `unavailable` is never FREE: an outage or incomplete answer offers no upgrade.
 */
export type PlanAccessStatus =
  'loading' | 'paid' | 'free' | 'expired' | 'unavailable'

export function planAccessFrom(
  account: unknown,
): Exclude<PlanAccessStatus, 'loading'> {
  if (typeof account !== 'object' || account === null) return 'unavailable'
  const {
    entitlementState: state,
    supportPlanEnabled: enabled,
    source,
    packageCode,
  } = account as Partial<ServiceCreditAccount>
  if (typeof enabled !== 'boolean') return 'unavailable'
  if (
    state === 'ACTIVE' &&
    (source === 'PAID' || source === 'DEMO') &&
    (packageCode === 'PLUS' || packageCode === 'PREMIUM') &&
    enabled
  )
    return 'paid'
  if (source === 'DEFAULT_FREE' && packageCode === 'FREE' && !enabled) {
    if (state === 'EXPIRED') return 'expired'
    if (state === 'DEFAULT_FREE') return 'free'
  }
  return 'unavailable'
}

// A same-tab hint that the user left Plan to upgrade. It carries no ID, URL or
// right: the continuation link is fixed and Plan re-reads every fact itself.
const INTENT_KEY = 'mb.supportPlanUpgradeIntent'
const INTENT_TTL_MS = 30 * 60 * 1000

export function rememberUpgradeIntent(now = Date.now()) {
  try {
    sessionStorage.setItem(INTENT_KEY, String(now))
  } catch {
    // Storage blocked: the user can still open Plan from navigation.
  }
}

export function hasUpgradeIntent(now = Date.now()) {
  try {
    const createdAt = Number(sessionStorage.getItem(INTENT_KEY))
    if (
      createdAt > 0 &&
      now - createdAt >= 0 &&
      now - createdAt < INTENT_TTL_MS
    )
      return true
    sessionStorage.removeItem(INTENT_KEY)
  } catch {
    // Storage blocked: behave as if there is no hint.
  }
  return false
}

export function clearUpgradeIntent() {
  try {
    sessionStorage.removeItem(INTENT_KEY)
  } catch {
    // Nothing to clear.
  }
}
