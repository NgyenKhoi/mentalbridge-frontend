import { describe, expect, it } from 'vitest'
import {
  parseAdminPaymentList,
  parsePlanPayment,
  parsePlanPaymentHistory,
  parseServicePlanCatalogue,
} from './billing-validation'

const plan = {
  planVersionId: '51500000-0000-4000-8000-000000000002',
  planCode: 'PLUS',
  version: 'v2-vnd-2026-01',
  displayName: 'Plus',
  currency: 'VND',
  priceVnd: 1390000,
  billingPeriodMonths: 1,
  consultationCredits: 4,
  maxActiveReservations: 2,
  creditAllocationVnd: 300000,
  aiQuotaCode: 'PLUS_DAILY',
  supportPlanEnabled: true,
  entitlements: ['SUPPORT_PLAN'],
  allowedUpgrades: ['PREMIUM'],
  effectiveFrom: '2026-01-01T00:00:00Z',
}

describe('billing validation', () => {
  it('validates bounded canonical admin reads and rejects leaked provider fields', () => {
    const item = {
      paymentId: '62200000-0000-4000-8000-000000000004',
      subscriptionId: '62200000-0000-4000-8000-000000000005',
      planVersionId: plan.planVersionId,
      planCode: 'PLUS',
      pricingPolicyVersion: 'sandbox-full-price-v1',
      purpose: 'PURCHASE',
      provider: 'FAKE',
      status: 'SUCCEEDED',
      amountVnd: 5000,
      currency: 'VND',
      createdAt: '2026-10-11T00:00:00Z',
      paidAt: '2026-10-11T00:00:01Z',
      failedAt: null,
    }
    const response = { generatedAt: item.createdAt, count: 1, items: [item] }
    expect(parseAdminPaymentList(response)).toEqual(response)
    expect(parseAdminPaymentList({ ...response, count: 2 })).toBeNull()
    expect(
      parseAdminPaymentList({
        ...response,
        count: 201,
        items: Array(201).fill(item),
      }),
    ).toBeNull()
    for (const invalid of [
      { provider: 'PAYOS' },
      { amountVnd: -1 },
      { pricingPolicyVersion: 'unknown' },
      { rawProviderPayload: 'not-for-browser' },
      { checkoutUrl: 'https://test-payment.momo.vn/private' },
    ])
      expect(
        parseAdminPaymentList({
          ...response,
          items: [{ ...item, ...invalid }],
        }),
      ).toBeNull()
  })

  it('keeps owner history bounded and rejects malformed payment records', () => {
    const empty = { generatedAt: '2026-10-11T00:00:00Z', count: 0, items: [] }
    expect(parsePlanPaymentHistory(empty)).toEqual(empty)
    expect(parsePlanPaymentHistory({ ...empty, count: 1 })).toBeNull()
    expect(
      parsePlanPaymentHistory({
        ...empty,
        count: 51,
        items: Array(51).fill({}),
      }),
    ).toBeNull()
    expect(
      parsePlanPaymentHistory({
        ...empty,
        count: 1,
        items: [{ status: 'SUCCEEDED' }],
      }),
    ).toBeNull()
  })
  it('accepts only an exact authoritative 0/4/10 catalogue', () => {
    const catalogue = {
      plans: [
        {
          ...plan,
          planVersionId: '51500000-0000-4000-8000-000000000001',
          planCode: 'FREE',
          displayName: 'Miễn phí',
          priceVnd: 0,
          consultationCredits: 0,
          maxActiveReservations: 0,
          creditAllocationVnd: 0,
          supportPlanEnabled: false,
          allowedUpgrades: ['PLUS', 'PREMIUM'],
        },
        plan,
        {
          ...plan,
          planVersionId: '51500000-0000-4000-8000-000000000003',
          planCode: 'PREMIUM',
          displayName: 'Premium',
          priceVnd: 3490000,
          consultationCredits: 10,
          maxActiveReservations: 4,
          allowedUpgrades: [],
        },
      ],
      checkoutEnabled: true,
      paymentProvider: 'MOMO',
      generatedAt: '2026-10-10T00:00:00Z',
    }
    expect(parseServicePlanCatalogue(catalogue)).toEqual(catalogue)
    const sandbox = {
      ...catalogue,
      plans: catalogue.plans.map((value) => ({
        ...value,
        pricingPolicyVersion: 'sandbox-full-price-v1',
      })),
    }
    expect(parseServicePlanCatalogue(sandbox)).toEqual(sandbox)
    expect(
      parseServicePlanCatalogue({
        ...catalogue,
        plans: catalogue.plans.map((value) => ({
          ...value,
          pricingPolicyVersion: 'unapproved-policy',
        })),
      }),
    ).toBeNull()
    expect(
      parseServicePlanCatalogue({
        ...catalogue,
        plans: [
          catalogue.plans[0],
          { ...plan, consultationCredits: 3 },
          catalogue.plans[2],
        ],
      }),
    ).toBeNull()
  })

  it('rejects checkout redirects outside the MoMo HTTPS boundary', () => {
    const payment = {
      paymentId: 'aa100000-0000-4000-8000-000000000001',
      subscriptionId: 'aa100000-0000-4000-8000-000000000002',
      planVersionId: plan.planVersionId,
      planCode: 'PLUS',
      planVersion: plan.version,
      purpose: 'PURCHASE',
      provider: 'MOMO',
      status: 'PENDING',
      amountVnd: 1390000,
      currency: 'VND',
      checkoutUrl: 'https://payment.momo.vn/checkout/one',
      qrCodeUrl: 'https://payment.momo.vn/qr/one',
      expiresAt: '2026-10-10T00:15:00Z',
      createdAt: '2026-10-10T00:00:00Z',
      paidAt: null,
      failedAt: null,
    }
    expect(parsePlanPayment(payment)).toEqual(payment)
    expect(
      parsePlanPayment({ ...payment, checkoutUrl: null, qrCodeUrl: null }),
    ).not.toBeNull()
    expect(
      parsePlanPayment({
        ...payment,
        pricingPolicyVersion: 'sandbox-full-price-v1',
        provider: 'FAKE',
        amountVnd: 5000,
      }),
    ).not.toBeNull()
    expect(
      parsePlanPayment({
        ...payment,
        pricingPolicyVersion: 'unapproved-policy',
      }),
    ).toBeNull()
    expect(
      parsePlanPayment({
        ...payment,
        checkoutUrl: 'https://example.com/checkout',
      }),
    ).toBeNull()
    expect(
      parsePlanPayment({
        ...payment,
        checkoutUrl: 'http://payment.momo.vn/checkout',
      }),
    ).toBeNull()
  })
})
