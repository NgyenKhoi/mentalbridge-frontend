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
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) &&
    !Number.isNaN(Date.parse(value))
  )
}

type Check = (value: unknown) => boolean
const isString: Check = (value) => typeof value === 'string'
const isBoolean: Check = (value) => typeof value === 'boolean'
const isId: Check = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const isCount: Check = (value) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const optional =
  (check: Check): Check =>
  (value) =>
    value === undefined || value === null || check(value)
const nullable =
  (check: Check): Check =>
  (value) =>
    value === null || check(value)
const oneOf =
  (...values: string[]): Check =>
  (value) =>
    typeof value === 'string' && values.includes(value)
const arrayOf =
  (check: Check): Check =>
  (value) =>
    Array.isArray(value) && value.every(check)
const shape =
  (fields: Record<string, Check>): Check =>
  (value) =>
    isRecord(value) &&
    Object.entries(fields).every(([key, check]) => check(value[key]))

const provider = oneOf('FAKE', 'MOMO')
const payoutStatus = oneOf(
  'PENDING',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'UNKNOWN',
)
const subscription = shape({
  subscriptionId: isId,
  userAccountId: isId,
  planVersionId: isId,
  planCode: isString,
  pricingPolicyVersion: isString,
  status: isString,
  currentPeriodStart: optional(isInstant),
  currentPeriodEnd: optional(isInstant),
  createdAt: isInstant,
})
const payment = shape({
  paymentId: isId,
  subscriptionId: isId,
  planVersionId: isId,
  planCode: oneOf('PLUS', 'PREMIUM'),
  pricingPolicyVersion: oneOf('upgrade-offset-v1', 'sandbox-full-price-v1'),
  purpose: oneOf('PURCHASE', 'UPGRADE'),
  provider,
  status: oneOf('PENDING', 'SUCCEEDED', 'FAILED', 'CHARGEBACK'),
  amountVnd: isCount,
  currency: oneOf('VND'),
  createdAt: isInstant,
  paidAt: nullable(isInstant),
  failedAt: nullable(isInstant),
})
const payout = shape({
  payoutId: isId,
  specialistAccountId: isId,
  destinationHint: isString,
  amountVnd: isCount,
  currency: oneOf('VND'),
  provider,
  status: payoutStatus,
  earningCount: isCount,
  providerReference: optional(isString),
  failureCode: optional(isString),
  requestedAt: isInstant,
  completedAt: optional(isInstant),
})
const credit = shape({
  creditId: isId,
  periodId: isId,
  ordinal: isCount,
  state: isString,
  creditAllocationVnd: isCount,
  appointmentId: optional(isId),
  createdAt: isInstant,
})

export function parseAdminPayoutDetail(
  value: unknown,
): AdminPayoutDetail | null {
  const valid = shape({
    payout,
    attempts: arrayOf(
      shape({
        attemptId: isId,
        attemptNumber: isCount,
        provider,
        status: payoutStatus,
        providerReference: optional(isString),
        failureCode: optional(isString),
        requestedAt: isInstant,
        confirmedAt: optional(isInstant),
        failedAt: optional(isInstant),
      }),
    ),
    earnings: arrayOf(
      shape({
        earningId: isId,
        appointmentId: isId,
        amountVnd: isCount,
        status: isString,
        earnedAt: isInstant,
        paidAt: optional(isInstant),
      }),
    ),
    events: arrayOf(
      shape({
        eventId: isId,
        provider: isString,
        eventType: isString,
        processingStatus: isString,
        failureCode: optional(isString),
        receivedAt: isInstant,
        processedAt: optional(isInstant),
      }),
    ),
  })(value)
  return valid ? (value as AdminPayoutDetail) : null
}

export function parseAdminSubscriptionDetail(
  value: unknown,
): AdminSubscriptionDetail | null {
  const valid = shape({
    subscriptionId: isId,
    userAccountId: isId,
    planVersionId: isId,
    planCode: oneOf('FREE', 'PLUS', 'PREMIUM'),
    pricingPolicyVersion: isString,
    status: oneOf('PENDING_PAYMENT', 'ACTIVE', 'ENDED'),
    currentPeriodStart: optional(isInstant),
    currentPeriodEnd: optional(isInstant),
    createdAt: isInstant,
    payments: arrayOf(payment),
    credits: arrayOf(credit),
    upgrades: arrayOf(
      shape({
        upgradeId: isId,
        fromPlanVersionId: isId,
        toPlanVersionId: isId,
        offsetVnd: isCount,
        amountDueVnd: isCount,
        status: isString,
        quotedAt: isInstant,
        appliedAt: optional(isInstant),
      }),
    ),
  })(value)
  return valid ? (value as AdminSubscriptionDetail) : null
}

export function parseAdminCommercialDiscrepancies(
  value: unknown,
): AdminCommercialDiscrepancyReport | null {
  const valid = shape({
    generatedAt: isInstant,
    totalDiscrepancies: isCount,
    webhooks: arrayOf(
      shape({
        id: isId,
        orderId: isString,
        provider: isString,
        transId: optional(isCount),
        discrepancyType: isString,
        status: isString,
        failureCode: optional(isString),
        receivedAt: isInstant,
      }),
    ),
    payouts: arrayOf(
      shape({
        payoutId: isId,
        specialistAccountId: isId,
        destinationHint: isString,
        amountVnd: isCount,
        currency: oneOf('VND'),
        provider: isString,
        status: isString,
        failureCode: optional(isString),
        requestedAt: isInstant,
      }),
    ),
    heldEarnings: arrayOf(
      shape({
        earningId: isId,
        appointmentId: isId,
        specialistAccountId: isId,
        amountVnd: isCount,
        status: isString,
        holdReason: isString,
        earnedAt: isInstant,
        settlementAvailableAt: isInstant,
      }),
    ),
    disputes: arrayOf(
      shape({
        disputeId: isId,
        appointmentId: isId,
        openedByRole: isString,
        reasonCode: isString,
        status: isString,
        resolutionOutcome: optional(isString),
        openedAt: isInstant,
        eligibleUntil: isInstant,
      }),
    ),
  })(value)
  return valid ? (value as AdminCommercialDiscrepancyReport) : null
}

export function parseAdminCommercialProvenance(
  value: unknown,
): AdminCommercialProvenance | null {
  const valid = shape({
    generatedAt: isInstant,
    queryIdentifierType: isString,
    queryIdentifierValue: isString,
    found: isBoolean,
    truncated: isBoolean,
    subscription: optional(subscription),
    subscriptions: arrayOf(subscription),
    payments: arrayOf(payment),
    credits: arrayOf(credit),
    appointments: arrayOf(
      shape({
        appointmentId: isId,
        specialistAccountId: isId,
        serviceCreditId: isId,
        status: isString,
        modality: isString,
        sessionOutcome: optional(isString),
        completionFactId: optional(isId),
        scheduledStartAt: isInstant,
        scheduledEndAt: isInstant,
        sessionSettledAt: optional(isInstant),
      }),
    ),
    disputes: arrayOf(
      shape({
        disputeId: isId,
        appointmentId: isId,
        openedByRole: isString,
        reasonCode: isString,
        status: isString,
        resolutionOutcome: optional(isString),
        resolutionReason: optional(isString),
        openedAt: isInstant,
        resolvedAt: optional(isInstant),
      }),
    ),
    earnings: arrayOf(
      shape({
        earningId: isId,
        appointmentId: isId,
        consumedCreditId: isId,
        specialistAccountId: isId,
        planVersion: isString,
        creditAllocationVnd: isCount,
        specialistShareBps: isCount,
        specialistAmountVnd: isCount,
        platformAllocationVnd: isCount,
        status: isString,
        earnedAt: isInstant,
        settlementAvailableAt: isInstant,
        paidAt: optional(isInstant),
      }),
    ),
    payouts: arrayOf(payout),
  })(value)
  return valid ? (value as AdminCommercialProvenance) : null
}
