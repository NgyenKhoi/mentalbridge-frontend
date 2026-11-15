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

/**
 * Explicit integration blocker marker: wiring live Care SupportPlan APIs into
 * `SupportPlanActionWorkspace.tsx` (`MB-702`) remains blocked until PR #292 merges
 * and owner approves the cross-module handoff.
 */
export const CARE_OWNERSHIP_INTEGRATION_BLOCKER =
  'MB_702_CARE_OWNERSHIP_ADAPTER_HANDOFF_PENDING' as const

export const careOwnedPlanProofSchema = z
  .object({
    status: z.enum(CARE_OWNERSHIP_STATES),
    subject: z.uuid().optional(),
    source: z.enum(CARE_OWNERSHIP_SOURCES).optional(),
    hasCurrentPlan: z.boolean().optional(),
    hasHistory: z.boolean().optional(),
  })
  .strict()

export type CareOwnedPlanProof = z.infer<typeof careOwnedPlanProofSchema>

const careSupportPlanSlotSchema = z
  .object({
    slotId: z.string().min(1).max(64),
    kind: z.enum(['CORE', 'OPTIONAL']),
    targetDomain: z.enum(['DEPRESSIVE_SYMPTOMS', 'ANXIETY_SYMPTOMS']),
    purposeCode: z.string().min(1).max(64),
  })
  .loose()

/**
 * Validates Care's authoritative `/api/v1/support-plans/current` and
 * `/api/v1/support-plans/current-draft` response contract.
 */
export const careSupportPlanResponseSchema = z
  .object({
    supportPlanId: z.uuid(),
    status: z.enum([
      'DRAFT',
      'ACTIVE',
      'PAUSED',
      'COMPLETED',
      'SUPERSEDED',
      'DISCARDED',
    ]),
    version: z.number().int().nonnegative(),
    source: z
      .object({
        supportEvaluationId: z.uuid(),
        evaluationVersion: z.literal(2),
        evaluationPolicyVersion: z.literal('mb-support-routing-capstone-v2'),
        evaluatedAt: z.iso.datetime(),
        selectionPolicyVersion: z.literal('mb-support-plan-selection-v1'),
        resourceEligibilityPolicyVersion: z.literal('content-eligibility-v1'),
        resourcesResolvedAt: z.iso.datetime(),
      })
      .loose(),
    entitlement: z
      .object({
        packageCode: z.enum(['PLUS', 'PREMIUM']),
        source: z.enum(['DEMO', 'PAID']),
        policyVersion: z.literal('service-entitlement-v1'),
        version: z.number().int().nonnegative(),
        decidedAt: z.iso.datetime(),
      })
      .loose(),
    slots: z.array(careSupportPlanSlotSchema).min(1).max(5),
    selectedResourceCount: z.number().int().min(1).max(5),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    disclaimerCode: z.literal('WELLBEING_SUPPORT_NOT_TREATMENT'),
  })
  .loose()

/**
 * Validates Care's authoritative `/api/v1/support-plans/history` response contract.
 */
export const careSupportPlanHistoryResponseSchema = z
  .object({
    items: z.array(careSupportPlanResponseSchema).max(50),
    nextCursor: z.string().min(1).max(256).nullable(),
    hasMore: z.boolean(),
  })
  .loose()

type CareOwnershipAttestationRecord = Readonly<{
  status: 'VERIFIED_OWNED' | 'NONE'
  subject: string
  source: 'CARE_AUTHENTICATED_READ'
  hasCurrentPlan: boolean
  hasHistory: boolean
  verifiedPlanIds: readonly string[]
}>

/**
 * Private unexported registry of proofs minted exclusively from validated Care API
 * responses. Plain object literals, navigation params, or JSON payloads matching
 * `careOwnedPlanProofSchema` are never present in this WeakMap and fail closed.
 */
const verifiedCareProofRegistry = new WeakMap<
  object,
  CareOwnershipAttestationRecord
>()

function extractPayloadOwnerSubject(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const record = payload as Record<string, unknown>
  for (const key of ['accountId', 'subject', 'userId']) {
    if (typeof record[key] === 'string') {
      return record[key]
    }
  }
  return null
}

export type CareSupportPlanSnapshotInput = Readonly<{
  authenticatedSubject: string
  currentPlan?: unknown | null | undefined
  currentDraft?: unknown | null | undefined
  history?: unknown | null | undefined
}>

/**
 * Mints a non-forgeable `CareOwnedPlanProof` strictly from validated Care
 * SupportPlan API responses (`/api/v1/support-plans/current`, `current-draft`, `history`)
 * bound to the authenticated session `subject`. Any malformed, missing, or cross-subject
 * payload resolves fail-closed to `{ status: 'UNAVAILABLE' }`.
 */
export function attestCareOwnershipFromApiResponse(
  input: CareSupportPlanSnapshotInput,
): CareOwnedPlanProof {
  const subjectCheck = z.uuid().safeParse(input.authenticatedSubject)
  if (!subjectCheck.success) {
    return Object.freeze({ status: 'UNAVAILABLE' as const })
  }
  const validSubject = subjectCheck.data

  if (
    input.currentPlan === undefined &&
    input.currentDraft === undefined &&
    input.history === undefined
  ) {
    return Object.freeze({ status: 'UNAVAILABLE' as const })
  }

  const verifiedPlanIds: string[] = []
  let hasCurrentPlan = false
  let hasHistory = false

  for (const candidate of [input.currentPlan, input.currentDraft]) {
    if (candidate != null) {
      const ownerSubject = extractPayloadOwnerSubject(candidate)
      if (ownerSubject !== null && ownerSubject !== validSubject) {
        return Object.freeze({ status: 'UNAVAILABLE' as const })
      }
      const parsedPlan = careSupportPlanResponseSchema.safeParse(candidate)
      if (!parsedPlan.success) {
        return Object.freeze({ status: 'UNAVAILABLE' as const })
      }
      hasCurrentPlan = true
      verifiedPlanIds.push(parsedPlan.data.supportPlanId)
    }
  }

  if (input.history != null) {
    const historyOwner = extractPayloadOwnerSubject(input.history)
    if (historyOwner !== null && historyOwner !== validSubject) {
      return Object.freeze({ status: 'UNAVAILABLE' as const })
    }
    const parsedHistory = careSupportPlanHistoryResponseSchema.safeParse(
      input.history,
    )
    if (!parsedHistory.success) {
      return Object.freeze({ status: 'UNAVAILABLE' as const })
    }
    for (const item of parsedHistory.data.items) {
      const itemOwner = extractPayloadOwnerSubject(item)
      if (itemOwner !== null && itemOwner !== validSubject) {
        return Object.freeze({ status: 'UNAVAILABLE' as const })
      }
      verifiedPlanIds.push(item.supportPlanId)
    }
    if (parsedHistory.data.items.length > 0) {
      hasHistory = true
    }
  }

  if (hasCurrentPlan || hasHistory) {
    const proof: CareOwnedPlanProof = Object.freeze({
      status: 'VERIFIED_OWNED',
      subject: validSubject,
      source: 'CARE_AUTHENTICATED_READ',
      hasCurrentPlan,
      hasHistory,
    })
    verifiedCareProofRegistry.set(proof, {
      status: 'VERIFIED_OWNED',
      subject: validSubject,
      source: 'CARE_AUTHENTICATED_READ',
      hasCurrentPlan,
      hasHistory,
      verifiedPlanIds: Object.freeze([...verifiedPlanIds]),
    })
    return proof
  }

  const noneProof: CareOwnedPlanProof = Object.freeze({
    status: 'NONE',
    subject: validSubject,
    source: 'CARE_AUTHENTICATED_READ',
    hasCurrentPlan: false,
    hasHistory: false,
  })
  verifiedCareProofRegistry.set(noneProof, {
    status: 'NONE',
    subject: validSubject,
    source: 'CARE_AUTHENTICATED_READ',
    hasCurrentPlan: false,
    hasHistory: false,
    verifiedPlanIds: Object.freeze([]),
  })
  return noneProof
}

export interface CareOwnershipApiReader {
  getCurrent?(): Promise<unknown>
  getCurrentDraft?(): Promise<unknown>
  getHistory?(): Promise<unknown>
}

function isNotFoundCareError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as {
    status?: unknown
    code?: unknown
    response?: { status?: unknown } | undefined
  }
  if (candidate.status === 404 || candidate.response?.status === 404) {
    return true
  }
  if (
    typeof candidate.code === 'string' &&
    (candidate.code === 'HTTP_404' ||
      candidate.code === 'SUPPORT_PLAN_NOT_FOUND' ||
      candidate.code === 'NOT_FOUND')
  ) {
    return true
  }
  return false
}

/**
 * Resolves a non-forgeable `CareOwnedPlanProof` from an authenticated Care API reader.
 * Fails closed (`{ status: 'UNAVAILABLE' }`) on network, 5xx, auth, or contract errors.
 */
export async function resolveCareOwnershipFromApi(
  reader: CareOwnershipApiReader | null | undefined,
  authenticatedSubject: string | null | undefined,
): Promise<CareOwnedPlanProof> {
  if (!reader || !authenticatedSubject) {
    return Object.freeze({ status: 'UNAVAILABLE' as const })
  }
  if (!reader.getCurrent && !reader.getCurrentDraft && !reader.getHistory) {
    return Object.freeze({ status: 'UNAVAILABLE' as const })
  }

  try {
    const [currentPlan, currentDraft, history] = await Promise.all([
      reader.getCurrent
        ? reader.getCurrent().catch((err: unknown) => {
            if (isNotFoundCareError(err)) return null
            throw err
          })
        : Promise.resolve(undefined),
      reader.getCurrentDraft
        ? reader.getCurrentDraft().catch((err: unknown) => {
            if (isNotFoundCareError(err)) return null
            throw err
          })
        : Promise.resolve(undefined),
      reader.getHistory ? reader.getHistory() : Promise.resolve(undefined),
    ])

    return attestCareOwnershipFromApiResponse({
      authenticatedSubject,
      currentPlan,
      currentDraft,
      history,
    })
  } catch {
    return Object.freeze({ status: 'UNAVAILABLE' as const })
  }
}

/**
 * Resolves verified Care ownership fail-closed for the active subject.
 * Schema validation alone NEVER grants `VERIFIED_OWNED`; the proof object must have
 * been attested by `attestCareOwnershipFromApiResponse` for the active `subject`.
 */
export function verifyCareOwnership(
  proof: unknown,
  authenticatedSubject: string | null | undefined,
  unverifiedOwnedHint?: boolean,
): CareOwnershipState {
  const subjectCheck = z.uuid().safeParse(authenticatedSubject)
  const normalizedSubject = subjectCheck.success ? subjectCheck.data : null

  if (proof == null) {
    return unverifiedOwnedHint === true ? 'UNAVAILABLE' : 'NONE'
  }

  if (typeof proof !== 'object') {
    return 'UNAVAILABLE'
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

  if (unverifiedOwnedHint === false) {
    return 'UNAVAILABLE'
  }

  const attestation = verifiedCareProofRegistry.get(proof)
  const hasOwnedArtifact =
    data.hasCurrentPlan === true || data.hasHistory === true

  if (
    !attestation ||
    !Object.isFrozen(proof) ||
    attestation.status !== 'VERIFIED_OWNED' ||
    !normalizedSubject ||
    attestation.subject !== normalizedSubject ||
    data.subject !== normalizedSubject ||
    attestation.source !== 'CARE_AUTHENTICATED_READ' ||
    data.source !== 'CARE_AUTHENTICATED_READ' ||
    !hasOwnedArtifact ||
    (attestation.hasCurrentPlan !== Boolean(data.hasCurrentPlan) &&
      attestation.hasHistory !== Boolean(data.hasHistory)) ||
    attestation.verifiedPlanIds.length === 0
  ) {
    return 'UNAVAILABLE'
  }

  return 'VERIFIED_OWNED'
}
