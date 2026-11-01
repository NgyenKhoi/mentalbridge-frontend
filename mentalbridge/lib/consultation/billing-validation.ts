import type { components } from '@/contracts/consultation.generated'

type PricingPolicy = components['schemas']['CommercialPricingPolicy']
export type AdminPaymentList = components['schemas']['AdminPaymentList']
export type PlanPaymentHistory = components['schemas']['PlanPaymentHistory']

export type PlanCode = 'FREE' | 'PLUS' | 'PREMIUM'
export type PaymentProvider = 'FAKE' | 'MOMO' | 'PAYOS'
export type PaymentTerminalReason = 'EXPIRED' | 'CANCELLED' | 'PROVIDER_FAILED'

const PROVIDERS = ['FAKE', 'MOMO', 'PAYOS']
const TERMINAL_REASONS = ['EXPIRED', 'CANCELLED', 'PROVIDER_FAILED']

export type ServicePlanVersion = Readonly<{
  planVersionId: string
  planCode: PlanCode
  version: string
  displayName: string
  currency: 'VND'
  pricingPolicyVersion?: PricingPolicy
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
  paymentProvider: PaymentProvider
  generatedAt: string
}>

export type PlanPayment = Readonly<{
  paymentId: string
  subscriptionId: string
  planVersionId: string
  planCode: 'PLUS' | 'PREMIUM'
  planVersion: string
  pricingPolicyVersion?: PricingPolicy
  purpose: 'PURCHASE' | 'UPGRADE'
  provider: PaymentProvider
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CHARGEBACK'
  terminalReason?: PaymentTerminalReason | null
  amountVnd: number
  currency: 'VND'
  checkoutUrl?: string | null
  qrCodeUrl?: string | null
  qrCode?: string | null
  bin?: string | null
  accountNumber?: string | null
  accountName?: string | null
  description?: string | null
  amount?: number | null
  expiredAt?: string | null
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

function exactKeys(
  value: Record<string, unknown>,
  keys: string[],
  optional: string[] = [],
) {
  const actual = Object.keys(value)
  return (
    keys.every((key) => key in value) &&
    actual.every((key) => keys.includes(key) || optional.includes(key))
  )
}

function pricingPolicy(value: unknown) {
  return (
    value === undefined ||
    value === 'upgrade-offset-v1' ||
    value === 'sandbox-full-price-v1'
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

function text(value: unknown, max: number) {
  return typeof value === 'string' && value.length >= 1 && value.length <= max
}

const absent = (value: unknown) => value === undefined || value === null

const HOSTED_DOMAINS: Record<string, string[]> = {
  MOMO: ['momo.vn'],
  PAYOS: ['payos.vn'],
  // legacy FAKE rows carried MoMo test links
  FAKE: ['momo.vn'],
}

// Hosted links are an optional fallback; only the provider's own HTTPS domain is accepted.
function safeHostedUrl(provider: unknown, value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (HOSTED_DOMAINS[String(provider)] ?? []).some(
        (domain) =>
          url.hostname === domain || url.hostname.endsWith(`.${domain}`),
      )
    )
  } catch {
    return false
  }
}

function qrFields(payment: Record<string, unknown>) {
  return (
    (absent(payment.qrCode) || text(payment.qrCode, 1024)) &&
    (absent(payment.bin) || text(payment.bin, 32)) &&
    (absent(payment.accountNumber) || text(payment.accountNumber, 64)) &&
    (absent(payment.accountName) || text(payment.accountName, 128)) &&
    (absent(payment.description) || text(payment.description, 9)) &&
    (absent(payment.amount) || payment.amount === payment.amountVnd) &&
    (absent(payment.expiredAt) ||
      (instant(payment.expiredAt) &&
        Date.parse(payment.expiredAt) ===
          Date.parse(String(payment.expiresAt))))
  )
}

// A reason exists only on FAILED rows; legacy rows carry none.
function terminalReasonValid(payment: Record<string, unknown>) {
  return (
    absent(payment.terminalReason) ||
    (payment.status === 'FAILED' &&
      TERMINAL_REASONS.includes(String(payment.terminalReason)))
  )
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
    !PROVIDERS.includes(String(catalogue.paymentProvider)) ||
    !instant(catalogue.generatedAt)
  )
    return null

  const plans: ServicePlanVersion[] = []
  for (const value of catalogue.plans) {
    const plan = record(value)
    if (
      !plan ||
      !exactKeys(
        plan,
        [
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
        ],
        ['pricingPolicyVersion'],
      ) ||
      !pricingPolicy(plan.pricingPolicyVersion) ||
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
    paymentProvider: catalogue.paymentProvider as PaymentProvider,
    generatedAt: catalogue.generatedAt,
  }
}

export function parsePlanPayment(value: unknown): PlanPayment | null {
  const payment = record(value)
  if (
    !payment ||
    !exactKeys(
      payment,
      [
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
        'expiresAt',
        'createdAt',
        'paidAt',
        'failedAt',
      ],
      [
        'pricingPolicyVersion',
        'terminalReason',
        'checkoutUrl',
        'qrCodeUrl',
        'qrCode',
        'bin',
        'accountNumber',
        'accountName',
        'description',
        'amount',
        'expiredAt',
      ],
    ) ||
    !pricingPolicy(payment.pricingPolicyVersion) ||
    !uuid(payment.paymentId) ||
    !uuid(payment.subscriptionId) ||
    !uuid(payment.planVersionId) ||
    !['PLUS', 'PREMIUM'].includes(String(payment.planCode)) ||
    typeof payment.planVersion !== 'string' ||
    payment.planVersion.length < 1 ||
    payment.planVersion.length > 64 ||
    !['PURCHASE', 'UPGRADE'].includes(String(payment.purpose)) ||
    !PROVIDERS.includes(String(payment.provider)) ||
    !['PENDING', 'SUCCEEDED', 'FAILED', 'CHARGEBACK'].includes(
      String(payment.status),
    ) ||
    !Number.isSafeInteger(payment.amountVnd) ||
    Number(payment.amountVnd) < 1 ||
    payment.currency !== 'VND' ||
    !(
      absent(payment.checkoutUrl) ||
      safeHostedUrl(payment.provider, payment.checkoutUrl)
    ) ||
    !(
      absent(payment.qrCodeUrl) ||
      safeHostedUrl(payment.provider, payment.qrCodeUrl)
    ) ||
    !terminalReasonValid(payment) ||
    !instant(payment.expiresAt) ||
    !qrFields(payment) ||
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

export function parseAdminPaymentList(value: unknown): AdminPaymentList | null {
  const response = record(value)
  if (
    !response ||
    !exactKeys(response, ['generatedAt', 'count', 'items']) ||
    !instant(response.generatedAt) ||
    !Array.isArray(response.items) ||
    response.items.length > 200 ||
    response.count !== response.items.length
  )
    return null
  for (const value of response.items) {
    const item = record(value)
    if (
      !item ||
      !exactKeys(item, [
        'paymentId',
        'subscriptionId',
        'planVersionId',
        'planCode',
        'pricingPolicyVersion',
        'purpose',
        'provider',
        'status',
        'amountVnd',
        'currency',
        'createdAt',
        'paidAt',
        'failedAt',
      ]) ||
      !uuid(item.paymentId) ||
      !uuid(item.subscriptionId) ||
      !uuid(item.planVersionId) ||
      !['PLUS', 'PREMIUM'].includes(String(item.planCode)) ||
      item.pricingPolicyVersion === undefined ||
      !pricingPolicy(item.pricingPolicyVersion) ||
      !['PURCHASE', 'UPGRADE'].includes(String(item.purpose)) ||
      !PROVIDERS.includes(String(item.provider)) ||
      !['PENDING', 'SUCCEEDED', 'FAILED', 'CHARGEBACK'].includes(
        String(item.status),
      ) ||
      !Number.isSafeInteger(item.amountVnd) ||
      Number(item.amountVnd) <= 0 ||
      item.currency !== 'VND' ||
      !instant(item.createdAt) ||
      !(item.paidAt === null || instant(item.paidAt)) ||
      !(item.failedAt === null || instant(item.failedAt))
    )
      return null
  }
  return response as AdminPaymentList
}

export function parsePlanPaymentHistory(
  value: unknown,
): PlanPaymentHistory | null {
  const response = record(value)
  if (
    !response ||
    !exactKeys(response, ['generatedAt', 'count', 'items']) ||
    !instant(response.generatedAt) ||
    !Array.isArray(response.items) ||
    response.items.length > 50 ||
    response.count !== response.items.length ||
    !response.items.every((item) => parsePlanPayment(item) !== null)
  )
    return null
  return response as PlanPaymentHistory
}
