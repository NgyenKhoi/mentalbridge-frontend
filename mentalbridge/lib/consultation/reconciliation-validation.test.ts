import { describe, expect, it } from 'vitest'
import {
  parseAdminCommercialDiscrepancies,
  parseAdminCommercialProvenance,
  parseAdminPayoutDetail,
  parseAdminSubscriptionDetail,
} from './reconciliation-validation'

describe('reconciliation-validation', () => {
  it('parses valid commercial discrepancies report', () => {
    const report = parseAdminCommercialDiscrepancies({
      generatedAt: '2026-10-21T12:00:00Z',
      totalDiscrepancies: 2,
      webhooks: [
        {
          id: '62200000-0000-4000-8000-000000000001',
          orderId: 'MOMO_ORDER_1',
          provider: 'MOMO',
          transId: 12345,
          discrepancyType: 'PENDING_PROCESSING',
          status: 'RECEIVED',
          failureCode: null,
          receivedAt: '2026-10-21T11:50:00Z',
        },
      ],
      payouts: [
        {
          payoutId: '62200000-0000-4000-8000-000000000002',
          specialistAccountId: '62200000-0000-4000-8000-000000000003',
          destinationHint: '090***123',
          amountVnd: 210000,
          currency: 'VND',
          provider: 'MOMO',
          status: 'FAILED',
          failureCode: 'MOMO_9000',
          requestedAt: '2026-10-21T10:00:00Z',
        },
      ],
      heldEarnings: [],
      disputes: [],
    })

    expect(report).not.toBeNull()
    expect(report?.totalDiscrepancies).toBe(2)
    expect(report?.webhooks).toHaveLength(1)
    expect(report?.payouts).toHaveLength(1)
    if (!report) throw new Error('Expected valid report')
    expect(
      parseAdminCommercialDiscrepancies({
        ...report,
        payouts: [{ ...report.payouts[0], amountVnd: Number.NaN }],
      }),
    ).toBeNull()
    expect(
      parseAdminCommercialDiscrepancies({ ...report, webhooks: [null] }),
    ).toBeNull()
    expect(
      parseAdminCommercialDiscrepancies({
        ...report,
        generatedAt: '1',
      }),
    ).toBeNull()
  })

  it('rejects malformed discrepancies report', () => {
    expect(parseAdminCommercialDiscrepancies(null)).toBeNull()
    expect(parseAdminCommercialDiscrepancies({})).toBeNull()
    expect(
      parseAdminCommercialDiscrepancies({
        generatedAt: 'invalid-date',
        totalDiscrepancies: 'two',
      }),
    ).toBeNull()
  })

  it('parses valid commercial provenance response', () => {
    const trace = parseAdminCommercialProvenance({
      generatedAt: '2026-10-21T12:00:00Z',
      queryIdentifierType: 'PAYMENT',
      queryIdentifierValue: '62200000-0000-4000-8000-000000000001',
      found: true,
      truncated: false,
      subscription: {
        subscriptionId: '62200000-0000-4000-8000-000000000010',
        userAccountId: '62200000-0000-4000-8000-000000000011',
        planVersionId: '62200000-0000-4000-8000-000000000012',
        planCode: 'PLUS',
        pricingPolicyVersion: 'sandbox-full-price-v1',
        status: 'ACTIVE',
        currentPeriodStart: '2026-10-21T00:00:00Z',
        currentPeriodEnd: '2026-11-21T00:00:00Z',
        createdAt: '2026-10-21T00:00:00Z',
      },
      payments: [],
      subscriptions: [],
      credits: [],
      appointments: [],
      disputes: [],
      earnings: [],
      payouts: [],
    })

    expect(trace).not.toBeNull()
    expect(trace?.found).toBe(true)
    expect(trace?.subscription?.planCode).toBe('PLUS')
    if (!trace) throw new Error('Expected valid trace')
    expect(
      parseAdminCommercialProvenance({
        ...trace,
        subscription: { ...trace.subscription, createdAt: 'invalid-date' },
      }),
    ).toBeNull()
    expect(
      parseAdminCommercialProvenance({
        ...trace,
        payments: [{ amountVnd: '500000' }],
      }),
    ).toBeNull()
    const payosPayment = {
      paymentId: '62200000-0000-4000-8000-000000000001',
      subscriptionId: '62200000-0000-4000-8000-000000000010',
      planVersionId: '62200000-0000-4000-8000-000000000012',
      planCode: 'PLUS',
      pricingPolicyVersion: 'sandbox-full-price-v1',
      purpose: 'PURCHASE',
      provider: 'PAYOS',
      status: 'SUCCEEDED',
      amountVnd: 5000,
      currency: 'VND',
      createdAt: '2026-10-21T00:00:00Z',
      paidAt: '2026-10-21T00:01:00Z',
      failedAt: null,
    }
    expect(
      parseAdminCommercialProvenance({ ...trace, payments: [payosPayment] }),
    ).not.toBeNull()
    expect(
      parseAdminCommercialProvenance({
        ...trace,
        payments: [{ ...payosPayment, provider: 'STRIPE' }],
      }),
    ).toBeNull()
    expect(
      parseAdminCommercialProvenance({ ...trace, subscriptions: [null] }),
    ).toBeNull()
    expect(
      parseAdminCommercialProvenance({ ...trace, truncated: 'false' }),
    ).toBeNull()
  })

  it('parses payout detail and subscription detail', () => {
    const payoutDetail = parseAdminPayoutDetail({
      payout: {
        payoutId: '62200000-0000-4000-8000-000000000001',
        specialistAccountId: '62200000-0000-4000-8000-000000000002',
        destinationHint: '090***123',
        amountVnd: 210000,
        currency: 'VND',
        provider: 'MOMO',
        status: 'PROCESSING',
        earningCount: 1,
        providerReference: null,
        failureCode: null,
        requestedAt: '2026-10-21T00:00:00Z',
        completedAt: null,
      },
      attempts: [],
      earnings: [],
      events: [],
    })
    expect(payoutDetail).not.toBeNull()
    expect(payoutDetail?.payout.amountVnd).toBe(210000)
    if (!payoutDetail) throw new Error('Expected valid payout detail')
    expect(
      parseAdminPayoutDetail({
        ...payoutDetail,
        payout: { ...payoutDetail.payout, earningCount: 'one' },
      }),
    ).toBeNull()
    expect(
      parseAdminPayoutDetail({ ...payoutDetail, attempts: [null] }),
    ).toBeNull()
    expect(
      parseAdminPayoutDetail({
        ...payoutDetail,
        payout: { ...payoutDetail.payout, status: 'PAID' },
      }),
    ).toBeNull()

    const subDetail = parseAdminSubscriptionDetail({
      subscriptionId: '62200000-0000-4000-8000-000000000001',
      userAccountId: '62200000-0000-4000-8000-000000000002',
      planVersionId: '62200000-0000-4000-8000-000000000003',
      planCode: 'PLUS',
      pricingPolicyVersion: 'sandbox-full-price-v1',
      status: 'ACTIVE',
      currentPeriodStart: '2026-10-21T00:00:00Z',
      currentPeriodEnd: '2026-11-21T00:00:00Z',
      createdAt: '2026-10-21T00:00:00Z',
      payments: [],
      credits: [],
      upgrades: [],
    })
    expect(subDetail).not.toBeNull()
    expect(subDetail?.planCode).toBe('PLUS')
    if (!subDetail) throw new Error('Expected valid subscription detail')
    expect(
      parseAdminSubscriptionDetail({
        ...subDetail,
        credits: [{ creditId: 'invalid-id', creditAllocationVnd: Infinity }],
      }),
    ).toBeNull()
    expect(
      parseAdminSubscriptionDetail({ ...subDetail, upgrades: [null] }),
    ).toBeNull()
  })
})
