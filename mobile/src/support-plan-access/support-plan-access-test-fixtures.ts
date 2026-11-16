import {
  createCareOwnershipAdapter,
  resolveCareOwnershipFromApi,
  type CareOwnedPlanProof,
  type CareOwnershipAdapter,
  type CareOwnershipSessionBinding,
  type CareSupportPlanHistoryV3,
  type CareSupportPlanV3,
  type Mb702CareOwnershipApi,
  type PlanPayment,
  type ServiceCreditEntitlement,
  type ServicePlanCatalogue,
} from './support-plan-access-contract'

export const USER_A_SUBJECT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
export const USER_B_SUBJECT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
export const PLUS_PLAN_VERSION_ID = '11111111-1111-4111-8111-111111111111'
export const PREMIUM_PLAN_VERSION_ID = '22222222-2222-4222-8222-222222222222'
export const SUBSCRIPTION_ID = '33333333-3333-4333-8333-333333333333'
export const PAYMENT_ID_1 = '44444444-4444-4444-8444-444444444444'
export const PAYMENT_ID_2 = '55555555-5555-4555-8555-555555555555'
export const GUIDE_ID = '66666666-6666-4666-8666-666666666666'
export const SUPPORT_PLAN_ID_1 = '77777777-7777-4777-8777-777777777777'
export const SUPPORT_PLAN_ID_2 = '99999999-9999-4999-8999-999999999999'
export const SUPPORT_EVALUATION_ID_1 = '88888888-8888-4888-8888-888888888888'
export const SUPPORT_ACTION_ID_1 = '12121212-1212-4212-8212-121212121212'
export const SUPPORT_SCHEDULE_ID_1 = '34343434-3434-4434-8434-343434343434'
export const RESOURCE_PUBLICATION_ID_1 = '56565656-5656-4656-8656-565656565656'

export function makeEntitlement(
  overrides: Partial<ServiceCreditEntitlement> = {},
): ServiceCreditEntitlement {
  return {
    accountId: USER_A_SUBJECT,
    packageCode: 'FREE',
    entitlementState: 'DEFAULT_FREE',
    supportPlanEnabled: false,
    source: 'DEFAULT_FREE',
    sourceReference: null,
    periodStart: null,
    periodEnd: null,
    policyVersion: 'consultation-credit-v2',
    generatedAt: '2026-11-15T10:00:00Z',
    ...overrides,
  }
}

export function makeCatalogue(
  overrides: Partial<ServicePlanCatalogue> = {},
): ServicePlanCatalogue {
  return {
    checkoutEnabled: true,
    paymentProvider: 'PAYOS',
    generatedAt: '2026-11-15T10:00:00Z',
    plans: [
      {
        planVersionId: PLUS_PLAN_VERSION_ID,
        planCode: 'PLUS',
        version: 'v1',
        displayName: 'Gói Plus',
        currency: 'VND',
        pricingPolicyVersion: 'sandbox-full-price-v1',
        priceVnd: 5000,
        billingPeriodMonths: 1,
        consultationCredits: 4,
        maxActiveReservations: 2,
        creditAllocationVnd: 300000,
        aiQuotaCode: 'PLUS_QUOTA',
        supportPlanEnabled: true,
        entitlements: ['SUPPORT_PLAN', 'CONSULTATION_CREDITS'],
        allowedUpgrades: ['PREMIUM'],
        effectiveFrom: '2026-10-01T00:00:00Z',
      },
      {
        planVersionId: PREMIUM_PLAN_VERSION_ID,
        planCode: 'PREMIUM',
        version: 'v1',
        displayName: 'Gói Premium',
        currency: 'VND',
        pricingPolicyVersion: 'sandbox-full-price-v1',
        priceVnd: 10000,
        billingPeriodMonths: 1,
        consultationCredits: 10,
        maxActiveReservations: 4,
        creditAllocationVnd: 600000,
        aiQuotaCode: 'PREMIUM_QUOTA',
        supportPlanEnabled: true,
        entitlements: ['SUPPORT_PLAN', 'CONSULTATION_CREDITS'],
        allowedUpgrades: [],
        effectiveFrom: '2026-10-01T00:00:00Z',
      },
    ],
    ...overrides,
  }
}

export function makePayment(overrides: Partial<PlanPayment> = {}): PlanPayment {
  return {
    paymentId: PAYMENT_ID_1,
    subscriptionId: SUBSCRIPTION_ID,
    planVersionId: PLUS_PLAN_VERSION_ID,
    planCode: 'PLUS',
    planVersion: 'v1',
    pricingPolicyVersion: 'sandbox-full-price-v1',
    purpose: 'PURCHASE',
    provider: 'PAYOS',
    status: 'PENDING',
    terminalReason: null,
    amountVnd: 5000,
    currency: 'VND',
    checkoutUrl: 'https://pay.payos.vn/web/fixture-786',
    qrCodeUrl: null,
    qrCode: '00020101021238540010A0000007270124000697042201100000000786',
    bin: '970422',
    accountNumber: '0000000786',
    accountName: 'MENTALBRIDGE TEST',
    description: 'MB000786',
    amount: 5000,
    expiredAt: '2026-11-15T10:15:00Z',
    expiresAt: '2026-11-15T10:15:00Z',
    createdAt: '2026-11-15T10:00:00Z',
    paidAt: null,
    failedAt: null,
    ...overrides,
  }
}

export function makeCareSupportPlanResponse(
  overrides: Partial<CareSupportPlanV3> & Record<string, unknown> = {},
): CareSupportPlanV3 {
  const status = (overrides.status as CareSupportPlanV3['status']) ?? 'ACTIVE'
  const representationMode =
    (overrides.representationMode as CareSupportPlanV3['representationMode']) ??
    'NATIVE_V3'
  const actionStatus =
    status === 'DRAFT'
      ? ('DRAFT' as const)
      : status === 'COMPLETED' ||
          status === 'SUPERSEDED' ||
          status === 'DISCARDED'
        ? ('ENDED' as const)
        : ('ACTIVE' as const)
  const scheduleStatus =
    status === 'DRAFT'
      ? ('DRAFT' as const)
      : status === 'PAUSED'
        ? ('PAUSED' as const)
        : status === 'COMPLETED' ||
            status === 'SUPERSEDED' ||
            status === 'DISCARDED'
          ? ('ENDED' as const)
          : ('ACTIVE' as const)
  const instant = '2026-11-15T09:55:00Z'

  return {
    supportPlanId: SUPPORT_PLAN_ID_1,
    modelVersion: 3,
    planPolicyVersion: 'support-plan-proposal-v1',
    representationMode,
    status,
    version: 1,
    safety: {
      status: 'NEGATIVE_SAFETY_SCREEN',
      reasonCode: 'NO_SAFETY_CONCERN_REPORTED',
      policyVersion: 'safety-screen-v1',
      guidanceCode: 'STANDARD_SAFETY_REMINDER',
      guidance: 'Nếu bạn cần hỗ trợ khẩn cấp, hãy mở mục Hỗ trợ an toàn.',
    },
    cycle: {
      policyVersion: 'support-plan-cycle-v1',
      lengthDays: 14,
      timezone: 'Asia/Ho_Chi_Minh',
      cycleNumber: 1,
      startedOn: status === 'DRAFT' ? null : '2026-11-15',
      reviewDueOn: status === 'DRAFT' ? null : '2026-11-28',
      currentDay: status === 'DRAFT' ? null : 1,
      pausedDays: 0,
      state:
        status === 'DRAFT'
          ? 'NOT_STARTED'
          : status === 'PAUSED'
            ? 'PAUSED'
            : status === 'ACTIVE'
              ? 'IN_PROGRESS'
              : 'CLOSED',
    },
    focuses: [
      {
        focusId: 'focus-emotion-1',
        title: 'Nhận biết cảm xúc hằng ngày',
        rationale: null,
        ordinal: 1,
        personalizationProvenance: null,
        actions: [
          representationMode === 'V2_RESOURCE_ADAPTER'
            ? {
                actionId: 'slot-breathing-1',
                actionType: 'RESOURCE',
                actionVersion: 1,
                representationMode: 'V2_RESOURCE_ADAPTER',
                status: actionStatus,
                pathRole: 'PRIMARY',
                purposeCode: 'GROUNDING',
                rationale: null,
                ordinal: 1,
                source: {
                  ownerDomain: 'CONTENT',
                  sourceKind: 'RESOURCE_VERSION',
                  sourceId: SUPPORT_EVALUATION_ID_1,
                  sourceRevision: '1',
                  sourcePolicyVersion: 'content-eligibility-v1',
                  publicationId: RESOURCE_PUBLICATION_ID_1,
                  eligibilityPolicyVersion: 'content-eligibility-v1',
                  verifiedAt: instant,
                },
                provenance: {
                  category: 'SUPPORT_GUIDE',
                  referenceId: GUIDE_ID,
                  referenceVersion: '1',
                  acceptedAt: instant,
                },
                presentation: {
                  title: 'Thở chậm 5 phút',
                  summary: 'Bài tập thở giảm căng thẳng.',
                  instructions: null,
                  externalUrl: null,
                },
                schedules: [],
                createdAt: instant,
                updatedAt: instant,
                activatedAt: status === 'DRAFT' ? null : instant,
                endedAt: actionStatus === 'ENDED' ? instant : null,
              }
            : {
                actionId: SUPPORT_ACTION_ID_1,
                actionType: 'EMOTION_CHECK_IN',
                actionVersion: 1,
                representationMode: 'NATIVE_V3',
                status: actionStatus,
                pathRole: 'ADJUNCT',
                purposeCode: 'NOTICE_SELF_REPORTED_EMOTIONS',
                rationale: null,
                ordinal: 1,
                source: {
                  ownerDomain: 'JOURNAL_AI',
                  sourceKind: 'EMOTION_CHECK_IN_CAPABILITY',
                  sourceId: 'daily-emotion-check-in',
                  sourceRevision: '1',
                  sourcePolicyVersion: 'daily-emotion-check-in-v1',
                  publicationId: null,
                  eligibilityPolicyVersion: null,
                  verifiedAt: instant,
                },
                provenance: {
                  category: 'USER_SELECTED',
                  referenceId: null,
                  referenceVersion: null,
                  acceptedAt: instant,
                },
                presentation: {
                  title: 'Dành một phút nhìn lại cảm xúc',
                  summary: 'Nhận biết điều bạn đang cảm nhận.',
                  instructions: null,
                  externalUrl: null,
                },
                schedules: [
                  {
                    scheduleId: SUPPORT_SCHEDULE_ID_1,
                    version: 1,
                    schedulePolicyVersion: 'support-plan-activity-schedule-v2',
                    recurrenceType: 'DAILY',
                    recurrenceDayOfWeek: null,
                    daysOfWeek: [],
                    preferredDaypart: 'EVENING',
                    estimatedDurationMinutes: 5,
                    localTime: '19:00:00',
                    timezone: 'Asia/Ho_Chi_Minh',
                    effectiveFrom: '2026-11-15',
                    effectiveUntil: null,
                    reminderEnabled: false,
                    status: scheduleStatus,
                  },
                ],
                createdAt: instant,
                updatedAt: instant,
                activatedAt: status === 'DRAFT' ? null : instant,
                endedAt: actionStatus === 'ENDED' ? instant : null,
              },
        ],
      },
    ],
    createdAt: instant,
    updatedAt: instant,
    activatedAt: status === 'DRAFT' ? null : instant,
    completedAt: status === 'COMPLETED' ? instant : null,
    completionReason: status === 'COMPLETED' ? 'USER_DECISION' : null,
    supersededAt: status === 'SUPERSEDED' ? instant : null,
    discardedAt: status === 'DISCARDED' ? instant : null,
    disclaimerCode: 'WELLBEING_SUPPORT_NOT_TREATMENT',
    disclaimer: 'Kế hoạch hỗ trợ sức khỏe tinh thần, không thay thế điều trị.',
    ...overrides,
  } as CareSupportPlanV3
}

export function makeCareSupportPlanHistoryResponse(
  items: CareSupportPlanV3[] = [
    makeCareSupportPlanResponse({
      supportPlanId: SUPPORT_PLAN_ID_2,
      status: 'COMPLETED',
    }),
  ],
  pagination: { nextCursor?: string | null; hasMore?: boolean } = {},
): CareSupportPlanHistoryV3 {
  const hasMore = pagination.hasMore ?? false
  const nextCursor =
    pagination.nextCursor !== undefined
      ? pagination.nextCursor
      : hasMore
        ? 'cursor-page-2'
        : null
  return {
    items,
    nextCursor,
    hasMore,
  }
}

export function makeCareOwnershipAdapter(
  sessionBinding: CareOwnershipSessionBinding | string = USER_A_SUBJECT,
  overrides: Partial<Mb702CareOwnershipApi> = {},
): CareOwnershipAdapter {
  const notFound = () =>
    Promise.reject({
      status: 404,
      code: 'HTTP_404',
    })
  return createCareOwnershipAdapter(
    {
      getCurrent:
        overrides.getCurrent ??
        (() => Promise.resolve(makeCareSupportPlanResponse())),
      getDraft: overrides.getDraft ?? notFound,
      getHistory:
        overrides.getHistory ??
        (() =>
          Promise.resolve(
            makeCareSupportPlanHistoryResponse([], {
              hasMore: false,
              nextCursor: null,
            }),
          )),
    },
    sessionBinding,
  )
}

export async function makeVerifiedCareOwnership(
  subject = USER_A_SUBJECT,
  overrides: Partial<CareOwnedPlanProof> = {},
): Promise<CareOwnedPlanProof> {
  const targetSubject = overrides.subject ?? subject
  const hasCurrentPlan = overrides.hasCurrentPlan ?? true
  const hasHistory = overrides.hasHistory ?? false
  const notFound = () =>
    Promise.reject({
      status: 404,
      code: 'HTTP_404',
    })
  const adapter = makeCareOwnershipAdapter(targetSubject, {
    getCurrent: hasCurrentPlan
      ? () => Promise.resolve(makeCareSupportPlanResponse())
      : notFound,
    getDraft: notFound,
    getHistory: () =>
      Promise.resolve(
        hasHistory
          ? makeCareSupportPlanHistoryResponse()
          : makeCareSupportPlanHistoryResponse([], {
              hasMore: false,
              nextCursor: null,
            }),
      ),
  })
  const resolved = await resolveCareOwnershipFromApi(adapter, targetSubject)
  if (overrides.status !== undefined && overrides.status !== resolved.status) {
    return Object.freeze({
      ...resolved,
      ...overrides,
    })
  }
  return resolved
}
