import { describe, expect, it } from 'vitest'
import {
  parsePlanPayment,
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
