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
    expect(
      parseAdminPaymentList({
        ...response,
        items: [{ ...item, provider: 'PAYOS' }],
      }),
    ).not.toBeNull()
    for (const invalid of [
      { provider: 'STRIPE' },
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
    for (const paymentProvider of ['FAKE', 'PAYOS'])
      expect(
        parseServicePlanCatalogue({ ...catalogue, paymentProvider }),
      ).toEqual({ ...catalogue, paymentProvider })
    expect(
      parseServicePlanCatalogue({ ...catalogue, paymentProvider: 'STRIPE' }),
    ).toBeNull()
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

  describe('PayOS in-app QR payment', () => {
    const payos = {
      paymentId: 'aa100000-0000-4000-8000-000000000001',
      subscriptionId: 'aa100000-0000-4000-8000-000000000002',
      planVersionId: plan.planVersionId,
      planCode: 'PLUS',
      planVersion: plan.version,
      pricingPolicyVersion: 'sandbox-full-price-v1',
      purpose: 'PURCHASE',
      provider: 'PAYOS',
      status: 'PENDING',
      terminalReason: null,
      amountVnd: 5000,
      currency: 'VND',
      qrCode: '00020101021238540010A00000072701240006970422',
      bin: '970422',
      accountNumber: '0000000786',
      accountName: 'MENTALBRIDGE TEST',
      description: 'MB000786',
      amount: 5000,
      expiredAt: '2026-10-30T10:15:00Z',
      expiresAt: '2026-10-30T10:15:00Z',
      createdAt: '2026-10-30T10:00:00Z',
      paidAt: null,
      failedAt: null,
    }

    it('accepts a QR payment without any hosted URL and an unconfirmed one without QR fields', () => {
      expect(parsePlanPayment(payos)).toEqual(payos)
      const legacy = Object.fromEntries(
        Object.entries(payos).filter(
          ([key]) =>
            ![
              'qrCode',
              'bin',
              'accountNumber',
              'accountName',
              'description',
              'amount',
              'expiredAt',
            ].includes(key),
        ),
      )
      expect(parsePlanPayment(legacy)).toEqual(legacy)
      expect(
        parsePlanPayment({
          ...payos,
          qrCode: null,
          bin: null,
          accountNumber: null,
          accountName: null,
          description: null,
          amount: null,
          expiredAt: null,
        }),
      ).not.toBeNull()
    })

    it('rejects QR fields that disagree with the authoritative amount, expiry or limits', () => {
      for (const invalid of [
        { amount: 6000 },
        { expiredAt: '2026-10-30T10:16:00Z' },
        { qrCode: '' },
        { description: 'TOOLONG-DESC' },
        { bin: 970422 },
        { checkoutUrl: 'https://payment.momo.vn/checkout' },
        { checkoutUrl: 'https://payos.vn.evil.example/pay' },
        { checkoutUrl: 'http://pay.payos.vn/web/1' },
      ])
        expect(parsePlanPayment({ ...payos, ...invalid })).toBeNull()
      expect(
        parsePlanPayment({
          ...payos,
          checkoutUrl: 'https://pay.payos.vn/web/abc',
        }),
      ).not.toBeNull()
    })

    it('allows a terminal reason only on a failed payment', () => {
      const failed = { ...payos, status: 'FAILED', failedAt: payos.createdAt }
      for (const terminalReason of ['EXPIRED', 'CANCELLED', 'PROVIDER_FAILED'])
        expect(parsePlanPayment({ ...failed, terminalReason })).not.toBeNull()
      expect(parsePlanPayment({ ...failed, terminalReason: 'PAID' })).toBeNull()
      expect(
        parsePlanPayment({ ...payos, terminalReason: 'EXPIRED' }),
      ).toBeNull()
    })
  })
})
