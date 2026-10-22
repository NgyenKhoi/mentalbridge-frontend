import type { components } from '@/contracts/consultation.generated'

export type AdminPayoutDetail = components['schemas']['AdminPayoutDetail']
export type AdminSubscriptionDetail =
  components['schemas']['AdminSubscriptionDetail']
export type AdminCommercialDiscrepancyReport =
  components['schemas']['AdminCommercialDiscrepancyReport']
export type AdminCommercialProvenance =
  components['schemas']['AdminCommercialProvenance']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

export function parseAdminPayoutDetail(value: unknown): AdminPayoutDetail | null {
  if (!isRecord(value)) return null
  if (!isRecord(value.payout) || !Array.isArray(value.attempts) || !Array.isArray(value.earnings) || !Array.isArray(value.events)) {
    return null
  }
  return value as unknown as AdminPayoutDetail
}

export function parseAdminSubscriptionDetail(value: unknown): AdminSubscriptionDetail | null {
  if (!isRecord(value)) return null
  if (
    typeof value.subscriptionId !== 'string' ||
    typeof value.status !== 'string' ||
    !Array.isArray(value.payments) ||
    !Array.isArray(value.credits) ||
    !Array.isArray(value.upgrades)
  ) {
    return null
  }
  return value as unknown as AdminSubscriptionDetail
}

export function parseAdminCommercialDiscrepancies(
  value: unknown,
): AdminCommercialDiscrepancyReport | null {
  if (!isRecord(value)) return null
  if (
    !isInstant(value.generatedAt) ||
    typeof value.totalDiscrepancies !== 'number' ||
    !Array.isArray(value.webhooks) ||
    !Array.isArray(value.payouts) ||
    !Array.isArray(value.heldEarnings) ||
    !Array.isArray(value.disputes)
  ) {
    return null
  }
  return value as unknown as AdminCommercialDiscrepancyReport
}

export function parseAdminCommercialProvenance(
  value: unknown,
): AdminCommercialProvenance | null {
  if (!isRecord(value)) return null
  if (
    !isInstant(value.generatedAt) ||
    typeof value.queryIdentifierType !== 'string' ||
    typeof value.queryIdentifierValue !== 'string' ||
    typeof value.found !== 'boolean' ||
    !Array.isArray(value.payments) ||
    !Array.isArray(value.credits) ||
    !Array.isArray(value.appointments) ||
    !Array.isArray(value.disputes) ||
    !Array.isArray(value.earnings) ||
    !Array.isArray(value.payouts)
  ) {
    return null
  }
  if (value.subscriptions !== undefined && !Array.isArray(value.subscriptions)) {
    return null
  }
  return value as unknown as AdminCommercialProvenance
}

