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

const careActionTypeSchema = z.enum([
  'RESOURCE',
  'JOURNAL',
  'EMOTION_CHECK_IN',
  'ROUTINE_SELF_MANAGEMENT',
  'PROFESSIONAL_SUPPORT',
  'REASSESSMENT_SCREENING',
  'SELF_REPORT_REVIEW',
])

const careRepresentationModeSchema = z.enum([
  'V2_RESOURCE_ADAPTER',
  'NATIVE_V3',
])

const careSupportPlanStateSchema = z.enum([
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'SUPERSEDED',
  'DISCARDED',
])

const careNullableText = (max: number) => z.string().min(1).max(max).nullable()
const careInstantSchema = z.iso.datetime({ offset: true })

const careSymptomCodeSchema = z.enum([
  'SLEEP_DIFFICULTY',
  'LOW_ENERGY',
  'PERSISTENT_WORRY',
  'LOW_MOOD',
  'CONCENTRATION_DIFFICULTY',
  'APPETITE_CHANGE',
  'SOCIAL_WITHDRAWAL',
  'STRESS_OVERLOAD',
])

const careSymptomMappingSchema = z
  .object({
    reassessmentSummaryId: z.uuid(),
    selfReportId: z.uuid(),
    selfReportRevision: z.number().int().nonnegative(),
    currentPeriod: z
      .object({ startAt: careInstantSchema, endAt: careInstantSchema })
      .strict(),
    catalogRevision: z.string().min(1).max(128),
    mappingRevision: z.string().min(1).max(128),
    selectedCodes: z
      .array(careSymptomCodeSchema)
      .max(8)
      .refine((values) => new Set(values).size === values.length),
    resourceReasons: z
      .array(
        z
          .object({
            code: careSymptomCodeSchema,
            slotId: z.string().min(1).max(128),
            resourceId: z.uuid(),
            contentVersion: z
              .string()
              .max(19)
              .regex(/^(0|[1-9][0-9]{0,18})$/),
            publicationId: z.uuid(),
            role: z.enum(['PRIMARY', 'ADJUNCT']),
            eligibilityPolicyVersion: z.string().min(1).max(128),
            reasonCode: z.literal('SELF_REPORTED_SYMPTOM_MATCH'),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict()

const careActionSourceSchema = z
  .object({
    ownerDomain: z.enum(['CONTENT', 'JOURNAL_AI', 'CONSULTATION', 'CARE']),
    sourceKind: z.enum([
      'RESOURCE_VERSION',
      'JOURNAL_TEMPLATE',
      'EMOTION_CHECK_IN_CAPABILITY',
      'PROFESSIONAL_SUPPORT_PATHWAY',
      'APPOINTMENT',
      'QUESTIONNAIRE_DEFINITION',
    ]),
    sourceId: z.string().min(1).max(255),
    sourceRevision: careNullableText(128),
    sourcePolicyVersion: careNullableText(128),
    publicationId: z.uuid().nullable(),
    eligibilityPolicyVersion: careNullableText(128),
    verifiedAt: careInstantSchema.nullable(),
  })
  .strict()

const careActionScheduleSchema = z
  .object({
    scheduleId: z.uuid(),
    version: z.number().int().min(1),
    schedulePolicyVersion: z.string().min(1).max(128),
    recurrenceType: z.enum(['ONCE', 'DAILY', 'WEEKLY']),
    recurrenceDayOfWeek: z.number().int().min(1).max(7).nullable(),
    daysOfWeek: z.array(z.number().int().min(1).max(7)).max(7),
    preferredDaypart: z
      .enum(['MORNING', 'AFTERNOON', 'EVENING', 'FLEXIBLE'])
      .nullable(),
    estimatedDurationMinutes: z.number().int().min(5).max(180).nullable(),
    localTime: z.iso.time(),
    timezone: z.string().min(1).max(64),
    effectiveFrom: z.iso.date(),
    effectiveUntil: z.iso.date().nullable(),
    reminderEnabled: z.boolean(),
    status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED']),
  })
  .strict()

const carePlanActionV3Schema = z
  .object({
    actionId: z.string().min(1).max(128),
    actionType: careActionTypeSchema,
    actionVersion: z.number().int().nonnegative(),
    representationMode: careRepresentationModeSchema,
    status: z.enum(['DRAFT', 'ACTIVE', 'ENDED']),
    pathRole: z.enum(['PRIMARY', 'ADJUNCT']),
    purposeCode: z.string().min(1).max(64),
    rationale: careNullableText(2048),
    ordinal: z.number().int().min(1).max(20),
    source: careActionSourceSchema.nullable(),
    provenance: z
      .object({
        category: z.enum([
          'USER_SELECTED',
          'SUPPORT_GUIDE',
          'SPECIALIST',
          'SYSTEM_POLICY',
        ]),
        referenceId: careNullableText(255),
        referenceVersion: careNullableText(128),
        acceptedAt: careInstantSchema,
      })
      .strict()
      .refine(
        (value) =>
          (value.referenceId === null) === (value.referenceVersion === null),
      ),
    presentation: z
      .object({
        title: z.string().min(1).max(255),
        summary: careNullableText(4096),
        instructions: careNullableText(2048),
        externalUrl: z.url().max(2048).nullable(),
      })
      .strict(),
    schedules: z.array(careActionScheduleSchema).max(50),
    createdAt: careInstantSchema,
    updatedAt: careInstantSchema,
    activatedAt: careInstantSchema.nullable(),
    endedAt: careInstantSchema.nullable(),
  })
  .strict()
  .superRefine((action, context) => {
    if (
      action.representationMode === 'NATIVE_V3' &&
      !z.uuid().safeParse(action.actionId).success
    ) {
      context.addIssue({
        code: 'custom',
        path: ['actionId'],
        message: 'Invalid native action identity.',
      })
    }
    const source = action.source
    let valid = false
    switch (action.actionType) {
      case 'RESOURCE':
        valid =
          source?.ownerDomain === 'CONTENT' &&
          source.sourceKind === 'RESOURCE_VERSION' &&
          /^\d+$/.test(source.sourceRevision ?? '') &&
          source.publicationId !== null &&
          source.eligibilityPolicyVersion !== null &&
          source.verifiedAt !== null
        break
      case 'JOURNAL':
        valid =
          source === null ||
          (source.ownerDomain === 'JOURNAL_AI' &&
            source.sourceKind === 'JOURNAL_TEMPLATE')
        break
      case 'EMOTION_CHECK_IN':
        valid =
          source === null ||
          (source.ownerDomain === 'JOURNAL_AI' &&
            source.sourceKind === 'EMOTION_CHECK_IN_CAPABILITY')
        break
      case 'PROFESSIONAL_SUPPORT':
        valid =
          source?.ownerDomain === 'CONSULTATION' &&
          ['PROFESSIONAL_SUPPORT_PATHWAY', 'APPOINTMENT'].includes(
            source.sourceKind,
          )
        break
      case 'REASSESSMENT_SCREENING':
        valid =
          source?.ownerDomain === 'CARE' &&
          source.sourceKind === 'QUESTIONNAIRE_DEFINITION'
        break
      default:
        valid = source === null
    }
    if (!valid) {
      context.addIssue({
        code: 'custom',
        path: ['source'],
        message: 'Invalid action source attribution.',
      })
    }
  })

const careSupportPlanCycleSchema = z
  .object({
    policyVersion: z.literal('support-plan-cycle-v1'),
    lengthDays: z.literal(14),
    timezone: z.string().min(1).max(64),
    cycleNumber: z.number().int().min(1),
    startedOn: z.iso.date().nullable(),
    reviewDueOn: z.iso.date().nullable(),
    currentDay: z.number().int().min(1).nullable(),
    pausedDays: z.number().int().min(0),
    state: z.enum([
      'NOT_STARTED',
      'IN_PROGRESS',
      'PAUSED',
      'REVIEW_DUE',
      'CLOSED',
    ]),
  })
  .strict()

/**
 * Validates Care's authoritative SupportPlan v3 (`SupportPlanV3` / `CanonicalSupportPlan`)
 * response contract (`/api/v2/support-plans/current`, `/api/v2/support-plans/current-draft`,
 * `/api/v2/support-plans/history` items) across `NATIVE_V3` and `V2_RESOURCE_ADAPTER`.
 *
 * Schema validation ONLY checks payload structure and invariants; it never grants
 * ownership by itself. Care v3 responses do not embed `accountId`/`subject` in the JSON
 * body — ownership is enforced by the authenticated owner API request and session binding.
 */
export const careSupportPlanV3Schema = z
  .object({
    supportPlanId: z.uuid(),
    symptomMapping: careSymptomMappingSchema.optional(),
    modelVersion: z.literal(3),
    planPolicyVersion: z.string().min(1).max(128),
    representationMode: careRepresentationModeSchema,
    status: careSupportPlanStateSchema,
    version: z.number().int().nonnegative(),
    safety: z
      .object({
        status: z.enum([
          'NEGATIVE_SAFETY_SCREEN',
          'POSITIVE_SAFETY_SCREEN',
          'NOT_APPLICABLE',
        ]),
        reasonCode: z.string().min(1).max(64),
        policyVersion: z.string().min(1).max(64),
        guidanceCode: z.enum([
          'REVIEW_SAFETY_GUIDANCE',
          'STANDARD_SAFETY_REMINDER',
        ]),
        guidance: z.string().min(1).max(2048),
      })
      .strict(),
    cycle: careSupportPlanCycleSchema.nullable().optional(),
    focuses: z
      .array(
        z
          .object({
            focusId: z.string().min(1).max(128),
            title: z.string().min(1).max(255),
            rationale: careNullableText(2048),
            ordinal: z.number().int().min(1).max(20),
            personalizationProvenance: z
              .object({
                personalizationId: z.uuid(),
                revision: z.number().int().min(1),
                schemaVersion: z.literal('support-plan-personalization-v1'),
                reasonCode: z.literal('USER_PREFERENCE_AND_CARE_POLICY'),
              })
              .strict()
              .nullable(),
            actions: z.array(carePlanActionV3Schema).min(1).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    createdAt: careInstantSchema,
    updatedAt: careInstantSchema,
    activatedAt: careInstantSchema.nullable(),
    completedAt: careInstantSchema.nullable(),
    completionReason: z
      .enum(['USER_DECISION', 'PLAN_NO_LONGER_FITS', 'OTHER'])
      .nullable(),
    supersededAt: careInstantSchema.nullable(),
    discardedAt: careInstantSchema.nullable(),
    disclaimerCode: z.literal('WELLBEING_SUPPORT_NOT_TREATMENT'),
    disclaimer: z.string().min(1).max(1000),
  })
  .strict()
  .superRefine((plan, context) => {
    for (const focus of plan.focuses) {
      for (const action of focus.actions) {
        if (action.representationMode !== plan.representationMode) {
          context.addIssue({
            code: 'custom',
            path: ['focuses'],
            message: 'Action representation mismatch.',
          })
        }
      }
    }
  })

export const careCurrentSupportPlanV3Schema = careSupportPlanV3Schema.refine(
  (plan) => plan.status === 'ACTIVE' || plan.status === 'PAUSED',
  'Current SupportPlan v3 must be ACTIVE or PAUSED.',
)

export const careDraftSupportPlanV3Schema = careSupportPlanV3Schema.refine(
  (plan) => plan.status === 'DRAFT',
  'Current draft SupportPlan v3 must be DRAFT.',
)

/**
 * Validates Care's authoritative `/api/v2/support-plans/history` response contract
 * (`SupportPlanActionHistory` in MB-702).
 */
export const careSupportPlanHistoryV3Schema = z
  .object({
    items: z.array(careSupportPlanV3Schema).max(20),
    nextCursor: z.string().min(1).max(256).nullable(),
    hasMore: z.boolean(),
  })
  .strict()
  .refine(
    (value) =>
      value.hasMore === (value.nextCursor !== null) &&
      value.items.every((item) =>
        ['COMPLETED', 'SUPERSEDED', 'DISCARDED'].includes(item.status),
      ),
    'Invalid terminal SupportPlan v3 history.',
  )

export const careSupportPlanResponseSchema = careSupportPlanV3Schema
export const careSupportPlanHistoryResponseSchema =
  careSupportPlanHistoryV3Schema

export type CareSupportPlanV3 = z.infer<typeof careSupportPlanV3Schema>
export type CareSupportPlanHistoryV3 = z.infer<
  typeof careSupportPlanHistoryV3Schema
>

export type CareSupportPlanSnapshotValidation = Readonly<{
  valid: boolean
  hasCurrentPlan: boolean
  hasCurrentDraft: boolean
  hasHistory: boolean
}>

/**
 * Pure schema validator for Care v3 SupportPlan responses (`current`, `current-draft`,
 * `history`). Distinguishes schema validation from authenticated ownership verification:
 * this function NEVER mints a `CareOwnedPlanProof` and cannot unlock `read-only-owned`.
 */
export function validateCareSupportPlanV3Snapshot(input: {
  readonly currentPlan?: unknown | null | undefined
  readonly currentDraft?: unknown | null | undefined
  readonly history?: unknown | null | undefined
}): CareSupportPlanSnapshotValidation {
  if (
    input.currentPlan === undefined &&
    input.currentDraft === undefined &&
    input.history === undefined
  ) {
    return {
      valid: false,
      hasCurrentPlan: false,
      hasCurrentDraft: false,
      hasHistory: false,
    }
  }

  let hasCurrentPlan = false
  let hasCurrentDraft = false
  let hasHistory = false

  if (input.currentPlan != null) {
    const parsed = careCurrentSupportPlanV3Schema.safeParse(input.currentPlan)
    if (!parsed.success) {
      return {
        valid: false,
        hasCurrentPlan: false,
        hasCurrentDraft: false,
        hasHistory: false,
      }
    }
    hasCurrentPlan = true
  }

  if (input.currentDraft != null) {
    const parsed = careDraftSupportPlanV3Schema.safeParse(input.currentDraft)
    if (!parsed.success) {
      return {
        valid: false,
        hasCurrentPlan: false,
        hasCurrentDraft: false,
        hasHistory: false,
      }
    }
    hasCurrentDraft = true
  }

  if (input.history != null) {
    const parsed = careSupportPlanHistoryV3Schema.safeParse(input.history)
    if (!parsed.success) {
      return {
        valid: false,
        hasCurrentPlan: false,
        hasCurrentDraft: false,
        hasHistory: false,
      }
    }
    hasHistory = parsed.data.items.length > 0
  }

  return {
    valid: true,
    hasCurrentPlan,
    hasCurrentDraft,
    hasHistory,
  }
}

/**
 * Minimal Care v3 read interface compatible with MB-702 `SupportPlanActionApi`
 * (`createSupportPlanActionApi(client)` in `mobile/src/support-plan/support-plan-action-api.ts`):
 * - `getCurrent()` -> `GET /api/v2/support-plans/current`
 * - `getDraft()` -> `GET /api/v2/support-plans/current-draft`
 * - `getHistory(cursor)` -> `GET /api/v2/support-plans/history`
 *
 * When wired after PR #292 merges (tracked by `CARE_OWNERSHIP_INTEGRATION_BLOCKER`),
 * `client` MUST be the route/session-bound authenticated `AxiosInstance` created via
 * `createApiClient({ config, getBearerToken: () => secureCredentialStore.getAccessToken() })`.
 */
export interface Mb702CareOwnershipApi {
  getCurrent(): Promise<unknown>
  getDraft(): Promise<unknown>
  getHistory(cursor?: string): Promise<unknown>
}

export interface CareOwnershipSessionBinding {
  /** Authenticated `session.subject` (UUID) for which this adapter is bound. */
  readonly subject: string
  /** Live callback returning the currently active `session.subject` (or `null` after sign-out). */
  readonly getActiveSubject?: (() => string | null) | undefined
  /** Optional live callback returning `sessionGeneration` from `useSession()`. */
  readonly getSessionGeneration?: (() => number) | undefined
}

const CARE_OWNERSHIP_ADAPTER_BRAND = Symbol('MB703_CARE_OWNERSHIP_ADAPTER')

export interface CareOwnershipAdapter {
  readonly [CARE_OWNERSHIP_ADAPTER_BRAND]: true
  readonly subject: string
}

type InternalCareAdapterRecord = {
  readonly api: Mb702CareOwnershipApi
  readonly boundSubject: string
  readonly getActiveSubject?: (() => string | null) | undefined
  readonly getSessionGeneration?: (() => number) | undefined
  requestSeq: number
}

type CareOwnershipAttestationRecord = Readonly<{
  status: 'VERIFIED_OWNED' | 'NONE'
  subject: string
  subjectEpoch: number
  globalEpoch: number
  sessionGeneration?: number | undefined
  getActiveSubject?: (() => string | null) | undefined
  getSessionGeneration?: (() => number) | undefined
  source: 'CARE_AUTHENTICATED_READ'
  hasCurrentPlan: boolean
  hasHistory: boolean
  verifiedPlanIds: readonly string[]
}>

const trustedCareAdapterRegistry = new WeakMap<
  object,
  InternalCareAdapterRecord
>()

const verifiedCareProofRegistry = new WeakMap<
  object,
  CareOwnershipAttestationRecord
>()

const subjectOwnershipEpochMap = new Map<string, number>()
let globalCareOwnershipEpoch = 0

function getSubjectOwnershipEpoch(subject: string): number {
  return subjectOwnershipEpochMap.get(subject) ?? 0
}

/**
 * Revokes all previously minted `CareOwnedPlanProof` records and invalidates any
 * in-flight Care ownership resolutions for `subject` (or across all subjects when
 * omitted / on sign-out). Prevents stale proofs from being reused across account
 * switches or sign-out/re-login boundaries.
 */
export function invalidateCareOwnershipForSubject(
  subject?: string | null,
): void {
  globalCareOwnershipEpoch += 1
  if (typeof subject === 'string' && subject.length > 0) {
    subjectOwnershipEpochMap.set(subject, getSubjectOwnershipEpoch(subject) + 1)
  }
}

/**
 * Creates a session-bound `CareOwnershipAdapter` wrapping MB-702's `SupportPlanActionApi`
 * (`getCurrent`, `getDraft`, `getHistory`).
 *
 * Security note: Within this standalone module (prior to PR #292 merge, tracked by
 * `CARE_OWNERSHIP_INTEGRATION_BLOCKER`), only adapters registered via
 * `createCareOwnershipAdapter` / `createHttpCareOwnershipAdapter` can produce proofs
 * accepted by `verifyCareOwnership`. Plain objects, navigation params, local flags,
 * or client-generated `CanonicalSupportPlan` objects are never trusted.
 */
export function createCareOwnershipAdapter(
  api: Mb702CareOwnershipApi,
  sessionBinding: CareOwnershipSessionBinding | string,
): CareOwnershipAdapter {
  const binding: CareOwnershipSessionBinding =
    typeof sessionBinding === 'string'
      ? { subject: sessionBinding }
      : sessionBinding
  const parsedSubject = z.uuid().parse(binding.subject)
  if (
    !api ||
    typeof api.getCurrent !== 'function' ||
    typeof api.getDraft !== 'function' ||
    typeof api.getHistory !== 'function'
  ) {
    throw new Error(
      'CareOwnershipAdapter requires MB-702 getCurrent(), getDraft(), and getHistory().',
    )
  }

  const adapter: CareOwnershipAdapter = Object.freeze({
    [CARE_OWNERSHIP_ADAPTER_BRAND]: true as const,
    subject: parsedSubject,
  })

  trustedCareAdapterRegistry.set(adapter, {
    api,
    boundSubject: parsedSubject,
    getActiveSubject: binding.getActiveSubject,
    getSessionGeneration: binding.getSessionGeneration,
    requestSeq: 0,
  })

  return adapter
}

export function isTrustedCareOwnershipAdapter(
  value: unknown,
): value is CareOwnershipAdapter {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    trustedCareAdapterRegistry.has(value as object)
  )
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
      candidate.code === 'SUPPORT_PLAN_CURRENT_NOT_FOUND' ||
      candidate.code === 'SUPPORT_PLAN_DRAFT_NOT_FOUND' ||
      candidate.code === 'NOT_FOUND')
  ) {
    return true
  }
  return false
}

const MAX_CARE_HISTORY_PAGES = 5

/**
 * Resolves a session-bound `CareOwnedPlanProof` exclusively through a registered
 * `CareOwnershipAdapter` (`getCurrent`, `getDraft`, `getHistory`).
 *
 * - Rejects unregistered plain objects, mismatched subjects, stale async responses
 *   after sign-out/account switch, 401/403/5xx errors, and malformed Care v3 payloads
 *   fail-closed (`{ status: 'UNAVAILABLE' }`).
 * - Returns `{ status: 'NONE' }` only when all three Care v3 endpoints (`current`,
 *   `current-draft`, and `history`) have been checked and confirmed empty.
 */
export async function resolveCareOwnershipFromApi(
  adapter: CareOwnershipAdapter | null | undefined,
  authenticatedSubject: string | null | undefined,
): Promise<CareOwnedPlanProof> {
  if (!adapter || typeof adapter !== 'object' || !authenticatedSubject) {
    return Object.freeze({ status: 'UNAVAILABLE' as const })
  }

  const record = trustedCareAdapterRegistry.get(adapter)
  const subjectCheck = z.uuid().safeParse(authenticatedSubject)
  if (!record || !subjectCheck.success) {
    return Object.freeze({ status: 'UNAVAILABLE' as const })
  }

  const validSubject = subjectCheck.data
  if (record.boundSubject !== validSubject) {
    return Object.freeze({ status: 'UNAVAILABLE' as const })
  }

  if (record.getActiveSubject && record.getActiveSubject() !== validSubject) {
    return Object.freeze({ status: 'UNAVAILABLE' as const })
  }

  const startSubjectEpoch = getSubjectOwnershipEpoch(validSubject)
  const startGlobalEpoch = globalCareOwnershipEpoch
  const startSessionGeneration = record.getSessionGeneration?.()
  const reqSeq = (record.requestSeq += 1)

  const isSessionStillCurrent = (): boolean => {
    if (record.requestSeq !== reqSeq) return false
    if (getSubjectOwnershipEpoch(validSubject) !== startSubjectEpoch) {
      return false
    }
    if (globalCareOwnershipEpoch !== startGlobalEpoch) return false
    if (record.getActiveSubject && record.getActiveSubject() !== validSubject) {
      return false
    }
    if (
      record.getSessionGeneration &&
      startSessionGeneration !== undefined &&
      record.getSessionGeneration() !== startSessionGeneration
    ) {
      return false
    }
    return true
  }

  try {
    const [currentRaw, draftRaw, firstHistoryRaw] = await Promise.all([
      record.api.getCurrent().catch((err: unknown) => {
        if (isNotFoundCareError(err)) return null
        throw err
      }),
      record.api.getDraft().catch((err: unknown) => {
        if (isNotFoundCareError(err)) return null
        throw err
      }),
      record.api.getHistory(),
    ])

    if (!isSessionStillCurrent()) {
      return Object.freeze({ status: 'UNAVAILABLE' as const })
    }

    const verifiedPlanIds: string[] = []
    let hasCurrentPlan = false
    let hasHistory = false

    if (currentRaw !== null) {
      const parsedCurrent = careCurrentSupportPlanV3Schema.safeParse(currentRaw)
      if (!parsedCurrent.success) {
        return Object.freeze({ status: 'UNAVAILABLE' as const })
      }
      hasCurrentPlan = true
      verifiedPlanIds.push(parsedCurrent.data.supportPlanId)
    }

    if (draftRaw !== null) {
      const parsedDraft = careDraftSupportPlanV3Schema.safeParse(draftRaw)
      if (!parsedDraft.success) {
        return Object.freeze({ status: 'UNAVAILABLE' as const })
      }
      hasCurrentPlan = true
      verifiedPlanIds.push(parsedDraft.data.supportPlanId)
    }

    const firstHistory =
      careSupportPlanHistoryV3Schema.safeParse(firstHistoryRaw)
    if (!firstHistory.success) {
      return Object.freeze({ status: 'UNAVAILABLE' as const })
    }

    for (const item of firstHistory.data.items) {
      verifiedPlanIds.push(item.supportPlanId)
    }
    if (firstHistory.data.items.length > 0) {
      hasHistory = true
    } else if (
      firstHistory.data.hasMore &&
      firstHistory.data.nextCursor !== null
    ) {
      const visitedCursors = new Set<string>()
      let nextCursor: string | null = firstHistory.data.nextCursor
      let pagesFetched = 1

      while (
        !hasHistory &&
        nextCursor !== null &&
        pagesFetched < MAX_CARE_HISTORY_PAGES
      ) {
        if (visitedCursors.has(nextCursor)) {
          return Object.freeze({ status: 'UNAVAILABLE' as const })
        }
        visitedCursors.add(nextCursor)
        const pageRaw = await record.api.getHistory(nextCursor)
        if (!isSessionStillCurrent()) {
          return Object.freeze({ status: 'UNAVAILABLE' as const })
        }
        const parsedPage = careSupportPlanHistoryV3Schema.safeParse(pageRaw)
        if (!parsedPage.success) {
          return Object.freeze({ status: 'UNAVAILABLE' as const })
        }
        pagesFetched += 1
        for (const item of parsedPage.data.items) {
          verifiedPlanIds.push(item.supportPlanId)
        }
        if (parsedPage.data.items.length > 0) {
          hasHistory = true
          break
        }
        nextCursor = parsedPage.data.hasMore ? parsedPage.data.nextCursor : null
      }

      if (!hasHistory && nextCursor !== null) {
        return Object.freeze({ status: 'UNAVAILABLE' as const })
      }
    }

    if (!isSessionStillCurrent()) {
      return Object.freeze({ status: 'UNAVAILABLE' as const })
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
        subjectEpoch: startSubjectEpoch,
        globalEpoch: startGlobalEpoch,
        sessionGeneration: startSessionGeneration,
        getActiveSubject: record.getActiveSubject,
        getSessionGeneration: record.getSessionGeneration,
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
      subjectEpoch: startSubjectEpoch,
      globalEpoch: startGlobalEpoch,
      sessionGeneration: startSessionGeneration,
      getActiveSubject: record.getActiveSubject,
      getSessionGeneration: record.getSessionGeneration,
      source: 'CARE_AUTHENTICATED_READ',
      hasCurrentPlan: false,
      hasHistory: false,
      verifiedPlanIds: Object.freeze([]),
    })
    return noneProof
  } catch {
    return Object.freeze({ status: 'UNAVAILABLE' as const })
  }
}

/**
 * Resolves verified Care ownership fail-closed for the active subject.
 *
 * Schema validation alone NEVER grants `VERIFIED_OWNED`; the proof object must have
 * been produced by `resolveCareOwnershipFromApi` through a session-bound
 * `CareOwnershipAdapter` for the active `subject`, and the subject/session must not
 * have changed or signed out since the proof was resolved.
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
    const noneAttestation = verifiedCareProofRegistry.get(proof)
    if (
      unverifiedOwnedHint === true ||
      (noneAttestation &&
        (!normalizedSubject || noneAttestation.subject !== normalizedSubject))
    ) {
      return 'UNAVAILABLE'
    }
    return 'NONE'
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
    getSubjectOwnershipEpoch(normalizedSubject) !== attestation.subjectEpoch ||
    (attestation.getActiveSubject &&
      attestation.getActiveSubject() !== normalizedSubject) ||
    (attestation.getSessionGeneration &&
      attestation.sessionGeneration !== undefined &&
      attestation.getSessionGeneration() !== attestation.sessionGeneration) ||
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
