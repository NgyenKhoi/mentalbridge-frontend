import { z } from 'zod'

export const PACKAGE_CODES = ['FREE', 'PLUS', 'PREMIUM'] as const
export type PackageCode = (typeof PACKAGE_CODES)[number]

export const ENTITLEMENT_STATES = ['ACTIVE', 'EXPIRED', 'DEFAULT_FREE'] as const
export type EntitlementState = (typeof ENTITLEMENT_STATES)[number]

export const ENTITLEMENT_SOURCES = ['DEFAULT_FREE', 'DEMO', 'PAID'] as const
export type EntitlementSource = (typeof ENTITLEMENT_SOURCES)[number]

export const PAYMENT_PROVIDERS = ['FAKE', 'MOMO', 'PAYOS'] as const
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number]

export const PAYMENT_STATUSES = [
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'CHARGEBACK',
] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_TERMINAL_REASONS = [
  'EXPIRED',
  'CANCELLED',
  'PROVIDER_FAILED',
] as const
export type PaymentTerminalReason = (typeof PAYMENT_TERMINAL_REASONS)[number]

export const serviceCreditEntitlementSchema = z
  .object({
    accountId: z.uuid(),
    packageCode: z.enum(PACKAGE_CODES),
    entitlementState: z.enum(ENTITLEMENT_STATES).nullable().optional(),
    supportPlanEnabled: z.boolean().nullable().optional(),
    source: z.enum(ENTITLEMENT_SOURCES).nullable().optional(),
    sourceReference: z.string().nullable().optional(),
    periodStart: z.iso.datetime().nullable().optional(),
    periodEnd: z.iso.datetime().nullable().optional(),
    policyVersion: z
      .enum(['consultation-credit-v1', 'consultation-credit-v2'])
      .optional(),
    generatedAt: z.iso.datetime().optional(),
  })
  .loose()

export type ServiceCreditEntitlement = z.infer<
  typeof serviceCreditEntitlementSchema
>

export function isHostedCheckoutSupportedProvider(
  provider: PaymentProvider,
): boolean {
  return provider === 'PAYOS'
}

export function isAllowedCheckoutUrl(
  rawUrl: string,
  provider: PaymentProvider,
): boolean {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  if (parsed.username !== '' || parsed.password !== '') return false
  if (parsed.port !== '' && parsed.port !== '443') return false

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '')
  if (provider === 'PAYOS') {
    return hostname === 'payos.vn' || hostname.endsWith('.payos.vn')
  }
  if (provider === 'MOMO') {
    return hostname === 'momo.vn' || hostname.endsWith('.momo.vn')
  }
  return false
}

export function canOpenHostedCheckoutUrl(
  rawUrl: string | null | undefined,
  provider: PaymentProvider,
): rawUrl is string {
  if (!rawUrl || !isHostedCheckoutSupportedProvider(provider)) {
    return false
  }
  return isAllowedCheckoutUrl(rawUrl, provider)
}

export const servicePlanVersionSchema = z
  .object({
    planVersionId: z.uuid(),
    planCode: z.enum(PACKAGE_CODES),
    version: z.string().min(1),
    displayName: z.string().min(1),
    currency: z.literal('VND'),
    pricingPolicyVersion: z.string().min(1).optional(),
    priceVnd: z.number().int().nonnegative(),
    billingPeriodMonths: z.number().int().nonnegative(),
    consultationCredits: z.number().int().nonnegative(),
    maxActiveReservations: z.number().int().nonnegative(),
    creditAllocationVnd: z.number().int().nonnegative(),
    aiQuotaCode: z.string().min(1).optional(),
    supportPlanEnabled: z.boolean(),
    entitlements: z.array(z.string()),
    allowedUpgrades: z.array(z.string()),
    effectiveFrom: z.iso.datetime(),
  })
  .loose()

export type ServicePlanVersion = z.infer<typeof servicePlanVersionSchema>

export const servicePlanCatalogueSchema = z
  .object({
    plans: z.array(servicePlanVersionSchema),
    checkoutEnabled: z.boolean(),
    paymentProvider: z.enum(PAYMENT_PROVIDERS),
    generatedAt: z.iso.datetime(),
  })
  .loose()

export type ServicePlanCatalogue = z.infer<typeof servicePlanCatalogueSchema>

export const planPaymentSchema = z
  .object({
    paymentId: z.uuid(),
    subscriptionId: z.uuid(),
    planVersionId: z.uuid(),
    planCode: z.enum(['PLUS', 'PREMIUM']),
    planVersion: z.string().min(1),
    pricingPolicyVersion: z.string().min(1).optional(),
    purpose: z.enum(['PURCHASE', 'UPGRADE']),
    provider: z.enum(PAYMENT_PROVIDERS),
    status: z.enum(PAYMENT_STATUSES),
    terminalReason: z.enum(PAYMENT_TERMINAL_REASONS).nullable().optional(),
    amountVnd: z.number().int().nonnegative(),
    currency: z.literal('VND'),
    checkoutUrl: z.string().nullable().optional(),
    qrCodeUrl: z.string().nullable().optional(),
    qrCode: z.string().nullable().optional(),
    bin: z.string().nullable().optional(),
    accountNumber: z.string().nullable().optional(),
    accountName: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    amount: z.number().int().nonnegative().nullable().optional(),
    expiredAt: z.iso.datetime().nullable().optional(),
    expiresAt: z.iso.datetime(),
    createdAt: z.iso.datetime(),
    paidAt: z.iso.datetime().nullable(),
    failedAt: z.iso.datetime().nullable(),
  })
  .loose()
  .superRefine((payment, context) => {
    if (payment.status !== 'FAILED' && payment.terminalReason != null) {
      context.addIssue({
        code: 'custom',
        path: ['terminalReason'],
        message: 'Only FAILED payments may specify a terminalReason',
      })
    }
    if (payment.amount != null && payment.amount !== payment.amountVnd) {
      context.addIssue({
        code: 'custom',
        path: ['amount'],
        message: 'Transfer amount must match amountVnd',
      })
    }
    if (
      payment.checkoutUrl != null &&
      !isAllowedCheckoutUrl(payment.checkoutUrl, payment.provider)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['checkoutUrl'],
        message: 'Checkout URL is not on an approved payment host',
      })
    }
  })

export type PlanPayment = z.infer<typeof planPaymentSchema>

export const planPaymentHistorySchema = z
  .object({
    items: z.array(planPaymentSchema),
    count: z.number().int().nonnegative(),
    generatedAt: z.iso.datetime(),
  })
  .loose()

export type PlanPaymentHistory = z.infer<typeof planPaymentHistorySchema>

export const GUIDE_ORIGIN_SOURCES = [
  'GUIDE',
  'HOME',
  'PLAN',
  'REASSESSMENT',
] as const
export type GuideOriginSource = (typeof GUIDE_ORIGIN_SOURCES)[number]

/** Non-sensitive caller origin metadata; never carries tokens, URLs, or clinical answers. */
export const guideOriginSchema = z
  .object({
    source: z.enum(GUIDE_ORIGIN_SOURCES),
    guideId: z.uuid().optional(),
    step: z.string().trim().min(1).max(64).optional(),
  })
  .strict()

export type GuideOrigin = z.infer<typeof guideOriginSchema>

export function sanitizeGuideOrigin(origin: unknown): GuideOrigin | undefined {
  if (origin == null) return undefined
  const parsed = guideOriginSchema.safeParse(origin)
  return parsed.success ? parsed.data : undefined
}

export const CARE_OWNERSHIP_STATES = [
  'NONE',
  'VERIFIED_OWNED',
  'UNAVAILABLE',
] as const

export type CareOwnershipState = (typeof CARE_OWNERSHIP_STATES)[number]

export const CARE_OWNERSHIP_SOURCES = ['CARE_AUTHENTICATED_READ'] as const

export const careOwnedPlanProofSchema = z
  .object({
    status: z.enum(CARE_OWNERSHIP_STATES),
    subject: z.string().trim().min(1).optional(),
    source: z.enum(CARE_OWNERSHIP_SOURCES).optional(),
    hasCurrentPlan: z.boolean().optional(),
    hasHistory: z.boolean().optional(),
  })
  .strict()

export type CareOwnedPlanProof = z.infer<typeof careOwnedPlanProofSchema>

/**
 * Resolves verified Care ownership fail-closed for the active subject.
 * Raw unverified boolean hints cannot grant `VERIFIED_OWNED`.
 */
export function verifyCareOwnership(
  proof: unknown,
  authenticatedSubject: string | null | undefined,
  unverifiedOwnedHint?: boolean,
): CareOwnershipState {
  const normalizedSubject =
    typeof authenticatedSubject === 'string' &&
    authenticatedSubject.trim().length > 0
      ? authenticatedSubject.trim()
      : null

  if (proof == null) {
    return unverifiedOwnedHint === true ? 'UNAVAILABLE' : 'NONE'
  }

  const parsed = careOwnedPlanProofSchema.safeParse(proof)
  if (!parsed.success) {
    return 'UNAVAILABLE'
  }

  const data = parsed.data
  if (data.status === 'UNAVAILABLE') {
    return 'UNAVAILABLE'
  }

  if (data.status === 'NONE') {
    return unverifiedOwnedHint === true ? 'UNAVAILABLE' : 'NONE'
  }

  const hasOwnedArtifact =
    data.hasCurrentPlan === true || data.hasHistory === true
  if (
    !normalizedSubject ||
    data.subject !== normalizedSubject ||
    data.source !== 'CARE_AUTHENTICATED_READ' ||
    !hasOwnedArtifact
  ) {
    return 'UNAVAILABLE'
  }

  return 'VERIFIED_OWNED'
}
