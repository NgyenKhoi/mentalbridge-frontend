export type PlanCode = 'FREE' | 'PLUS' | 'PREMIUM'

export type ServicePlanVersion = Readonly<{
  planVersionId: string
  planCode: PlanCode
  version: string
  displayName: string
  currency: 'VND'
  priceVnd: number
  billingPeriodMonths: 1
  consultationCredits: 0 | 4 | 10
  maxActiveReservations: 0 | 2 | 4
  creditAllocationVnd: number
  aiQuotaCode: string
  supportPlanEnabled: boolean
  entitlements: readonly string[]
  allowedUpgrades: readonly ('PLUS' | 'PREMIUM')[]
  effectiveFrom: string
}>

export type ServicePlanCatalogue = Readonly<{
  plans: readonly ServicePlanVersion[]
  checkoutEnabled: boolean
  paymentProvider: 'MOMO'
  generatedAt: string
}>

export type PlanPayment = Readonly<{
  paymentId: string
  subscriptionId: string
  planVersionId: string
  planCode: 'PLUS' | 'PREMIUM'
  planVersion: string
  purpose: 'PURCHASE' | 'UPGRADE'
  provider: 'FAKE' | 'MOMO'
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CHARGEBACK'
  amountVnd: number
  currency: 'VND'
  checkoutUrl: string
  qrCodeUrl: string | null
  expiresAt: string
  createdAt: string
  paidAt: string | null
  failedAt: string | null
}>

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function exactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value)
  return (
    actual.length === keys.length && actual.every((key) => keys.includes(key))
  )
}

function uuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
}

function instant(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function safeMomoUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (url.hostname === 'momo.vn' || url.hostname.endsWith('.momo.vn'))
    )
  } catch {
    return false
  }
}

export function parseServicePlanCatalogue(
  value: unknown,
): ServicePlanCatalogue | null {
  const catalogue = record(value)
  if (
    !catalogue ||
    !exactKeys(catalogue, [
      'plans',
      'checkoutEnabled',
      'paymentProvider',
      'generatedAt',
    ]) ||
    !Array.isArray(catalogue.plans) ||
    catalogue.plans.length !== 3 ||
    typeof catalogue.checkoutEnabled !== 'boolean' ||
    catalogue.paymentProvider !== 'MOMO' ||
    !instant(catalogue.generatedAt)
  )
    return null

  const plans: ServicePlanVersion[] = []
  for (const value of catalogue.plans) {
    const plan = record(value)
    if (
      !plan ||
      !exactKeys(plan, [
        'planVersionId',
        'planCode',
        'version',
        'displayName',
        'currency',
        'priceVnd',
        'billingPeriodMonths',
        'consultationCredits',
        'maxActiveReservations',
        'creditAllocationVnd',
        'aiQuotaCode',
        'supportPlanEnabled',
        'entitlements',
        'allowedUpgrades',
        'effectiveFrom',
      ]) ||
      !uuid(plan.planVersionId) ||
      !['FREE', 'PLUS', 'PREMIUM'].includes(String(plan.planCode)) ||
      typeof plan.version !== 'string' ||
      plan.version.length < 1 ||
      plan.version.length > 64 ||
      typeof plan.displayName !== 'string' ||
      plan.displayName.length < 1 ||
      plan.displayName.length > 64 ||
      plan.currency !== 'VND' ||
      !Number.isSafeInteger(plan.priceVnd) ||
      Number(plan.priceVnd) < 0 ||
      plan.billingPeriodMonths !== 1 ||
      ![0, 4, 10].includes(Number(plan.consultationCredits)) ||
      ![0, 2, 4].includes(Number(plan.maxActiveReservations)) ||
      !Number.isSafeInteger(plan.creditAllocationVnd) ||
      Number(plan.creditAllocationVnd) < 0 ||
      typeof plan.aiQuotaCode !== 'string' ||
      plan.aiQuotaCode.length < 1 ||
      typeof plan.supportPlanEnabled !== 'boolean' ||
      !Array.isArray(plan.entitlements) ||
      !plan.entitlements.every((item) => typeof item === 'string') ||
      !Array.isArray(plan.allowedUpgrades) ||
      !plan.allowedUpgrades.every((item) =>
        ['PLUS', 'PREMIUM'].includes(String(item)),
      ) ||
      !instant(plan.effectiveFrom)
    )
      return null
    if (
      (plan.planCode === 'FREE' &&
        (plan.priceVnd !== 0 ||
          plan.consultationCredits !== 0 ||
          plan.maxActiveReservations !== 0)) ||
      (plan.planCode === 'PLUS' &&
        (plan.consultationCredits !== 4 || plan.maxActiveReservations !== 2)) ||
      (plan.planCode === 'PREMIUM' &&
        (plan.consultationCredits !== 10 || plan.maxActiveReservations !== 4))
    )
      return null
    plans.push(plan as ServicePlanVersion)
  }
  if (plans.map((plan) => plan.planCode).join(',') !== 'FREE,PLUS,PREMIUM')
    return null
  return {
    plans,
    checkoutEnabled: catalogue.checkoutEnabled,
    paymentProvider: 'MOMO',
    generatedAt: catalogue.generatedAt,
  }
}

export function parsePlanPayment(value: unknown): PlanPayment | null {
  const payment = record(value)
  if (
    !payment ||
    !exactKeys(payment, [
      'paymentId',
      'subscriptionId',
      'planVersionId',
      'planCode',
      'planVersion',
      'purpose',
      'provider',
      'status',
      'amountVnd',
      'currency',
      'checkoutUrl',
      'qrCodeUrl',
      'expiresAt',
      'createdAt',
      'paidAt',
      'failedAt',
    ]) ||
    !uuid(payment.paymentId) ||
    !uuid(payment.subscriptionId) ||
    !uuid(payment.planVersionId) ||
    !['PLUS', 'PREMIUM'].includes(String(payment.planCode)) ||
    typeof payment.planVersion !== 'string' ||
    payment.planVersion.length < 1 ||
    payment.planVersion.length > 64 ||
    !['PURCHASE', 'UPGRADE'].includes(String(payment.purpose)) ||
    !['FAKE', 'MOMO'].includes(String(payment.provider)) ||
    !['PENDING', 'SUCCEEDED', 'FAILED', 'CHARGEBACK'].includes(
      String(payment.status),
    ) ||
    !Number.isSafeInteger(payment.amountVnd) ||
    Number(payment.amountVnd) < 1 ||
    payment.currency !== 'VND' ||
    !safeMomoUrl(payment.checkoutUrl) ||
    !(payment.qrCodeUrl === null || safeMomoUrl(payment.qrCodeUrl)) ||
    !instant(payment.expiresAt) ||
    !instant(payment.createdAt) ||
    !(payment.paidAt === null || instant(payment.paidAt)) ||
    !(payment.failedAt === null || instant(payment.failedAt))
  )
    return null
  return payment as PlanPayment
}

export function parseCheckoutInput(value: unknown): { planVersionId: string } {
  const input = record(value)
  if (
    !input ||
    !exactKeys(input, ['planVersionId']) ||
    !uuid(input.planVersionId)
  ) {
    throw new Error('planVersionId')
  }
  return { planVersionId: input.planVersionId }
}
