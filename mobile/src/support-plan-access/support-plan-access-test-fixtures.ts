import type {
  CareOwnedPlanProof,
  PlanPayment,
  ServiceCreditEntitlement,
  ServicePlanCatalogue,
} from './support-plan-access-contract'

export const USER_A_SUBJECT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
export const USER_B_SUBJECT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
export const PLUS_PLAN_VERSION_ID = '11111111-1111-4111-8111-111111111111'
export const PREMIUM_PLAN_VERSION_ID = '22222222-2222-4222-8222-222222222222'
export const SUBSCRIPTION_ID = '33333333-3333-4333-8333-333333333333'
export const PAYMENT_ID_1 = '44444444-4444-4444-8444-444444444444'
export const PAYMENT_ID_2 = '55555555-5555-4555-8555-555555555555'
export const GUIDE_ID = '66666666-6666-4666-8666-666666666666'

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

export function makeVerifiedCareOwnership(
  subject = USER_A_SUBJECT,
  overrides: Partial<CareOwnedPlanProof> = {},
): CareOwnedPlanProof {
  return {
    status: 'VERIFIED_OWNED',
    subject,
    source: 'CARE_AUTHENTICATED_READ',
    hasCurrentPlan: true,
    hasHistory: false,
    ...overrides,
  }
}
