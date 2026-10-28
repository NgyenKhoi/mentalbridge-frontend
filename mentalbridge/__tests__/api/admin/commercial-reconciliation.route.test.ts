import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'

const mocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
  adminPayments: vi.fn(),
  adminPayouts: vi.fn(),
  adminPayoutDetail: vi.fn(),
  adminSubscriptionDetail: vi.fn(),
  adminCommercialDiscrepancies: vi.fn(),
  adminCommercialProvenance: vi.fn(),
}))

vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: mocks.resolveSession,
  ensureRole: mocks.ensureRole,
}))

vi.mock('@/lib/consultation/consultation-client', async (original) => ({
  ...(await original<
    typeof import('@/lib/consultation/consultation-client')
  >()),
  consultationClient: mocks,
}))

import { GET as getPayments } from '@/app/api/consultation/admin/payments/route'
import { GET as getPayouts } from '@/app/api/consultation/admin/payouts/route'
import { GET as getPayoutDetail } from '@/app/api/consultation/admin/payouts/[payoutId]/route'
import { GET as getSubscriptionDetail } from '@/app/api/consultation/admin/subscriptions/[subscriptionId]/route'
import { GET as getDiscrepancies } from '@/app/api/consultation/admin/commercial/discrepancies/route'
import { GET as getProvenance } from '@/app/api/consultation/admin/commercial/provenance/route'

const paymentId = '62200000-0000-4000-8000-000000000001'
const payoutId = '62200000-0000-4000-8000-000000000002'
const subscriptionId = '62200000-0000-4000-8000-000000000003'

describe('Admin Commercial Reconciliation BFF routes', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.resolveSession.mockResolvedValue({
      account: { roles: ['ADMIN'], status: 'ACTIVE' },
      rotatedTokens: {
        accessToken: 'admin-access-token',
        refreshToken: 'admin-refresh-token',
        expiresIn: 300,
        refreshExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
    })
    mocks.adminPayments.mockResolvedValue({ data: { items: [], count: 0 } })
    mocks.adminPayouts.mockResolvedValue({ data: { items: [], count: 0 } })
    mocks.adminPayoutDetail.mockResolvedValue({
      data: {
        payout: { payoutId, amountVnd: 210000, status: 'PROCESSING' },
        attempts: [],
        earnings: [],
        events: [],
      },
    })
    mocks.adminSubscriptionDetail.mockResolvedValue({
      data: {
        subscriptionId,
        planCode: 'PLUS',
        status: 'ACTIVE',
        payments: [],
        credits: [],
        upgrades: [],
      },
    })
    mocks.adminCommercialDiscrepancies.mockResolvedValue({
      data: {
        generatedAt: '2026-10-21T00:00:00Z',
        totalDiscrepancies: 0,
        webhooks: [],
        payouts: [],
        heldEarnings: [],
        disputes: [],
      },
    })
    mocks.adminCommercialProvenance.mockResolvedValue({
      data: {
        generatedAt: '2026-10-21T00:00:00Z',
        queryIdentifierType: 'PAYMENT',
        queryIdentifierValue: paymentId,
        found: true,
        payments: [],
        credits: [],
        appointments: [],
        disputes: [],
        earnings: [],
        payouts: [],
      },
    })
  })

  it('verifies ADMIN role and forwards payment query parameters', async () => {
    const query =
      '?status=SUCCEEDED&limit=51&momoRef=order-1&toExclusive=2026-10-23T17%3A00%3A00.000Z'
    const req = new NextRequest(
      `http://localhost/api/consultation/admin/payments${query}`,
      { headers: { cookie: 'mentalbridge_access=valid' } },
    )
    const res = await getPayments(req)
    expect(res.status).toBe(200)
    expect(mocks.ensureRole).toHaveBeenCalledWith(expect.anything(), ['ADMIN'])
    expect(mocks.adminPayments).toHaveBeenCalledWith(
      'admin-access-token',
      expect.any(String),
      query,
    )
  })

  it('verifies ADMIN role and forwards payout query parameters', async () => {
    const query =
      '?status=FAILED&providerReference=payout-ref-1&toExclusive=2026-10-23T17%3A00%3A00.000Z'
    const req = new NextRequest(
      `http://localhost/api/consultation/admin/payouts${query}`,
      { headers: { cookie: 'mentalbridge_access=valid' } },
    )
    const res = await getPayouts(req)
    expect(res.status).toBe(200)
    expect(mocks.adminPayouts).toHaveBeenCalledWith(
      'admin-access-token',
      expect.any(String),
      query,
    )
  })

  it('fetches payout detail for ADMIN', async () => {
    const req = new NextRequest(
      `http://localhost/api/consultation/admin/payouts/${payoutId}`,
      { headers: { cookie: 'mentalbridge_access=valid' } },
    )
    const res = await getPayoutDetail(req, {
      params: Promise.resolve({ payoutId }),
    })
    expect(res.status).toBe(200)
    expect(mocks.adminPayoutDetail).toHaveBeenCalledWith(
      'admin-access-token',
      expect.any(String),
      payoutId,
    )
  })

  it('fetches subscription detail for ADMIN', async () => {
    const req = new NextRequest(
      `http://localhost/api/consultation/admin/subscriptions/${subscriptionId}`,
      { headers: { cookie: 'mentalbridge_access=valid' } },
    )
    const res = await getSubscriptionDetail(req, {
      params: Promise.resolve({ subscriptionId }),
    })
    expect(res.status).toBe(200)
    expect(mocks.adminSubscriptionDetail).toHaveBeenCalledWith(
      'admin-access-token',
      expect.any(String),
      subscriptionId,
    )
  })

  it('fetches discrepancies report for ADMIN', async () => {
    const req = new NextRequest(
      'http://localhost/api/consultation/admin/commercial/discrepancies',
      { headers: { cookie: 'mentalbridge_access=valid' } },
    )
    const res = await getDiscrepancies(req)
    expect(res.status).toBe(200)
    expect(mocks.adminCommercialDiscrepancies).toHaveBeenCalledWith(
      'admin-access-token',
      expect.any(String),
    )
  })

  it('fetches commercial provenance for ADMIN', async () => {
    const req = new NextRequest(
      `http://localhost/api/consultation/admin/commercial/provenance?paymentId=${paymentId}`,
      { headers: { cookie: 'mentalbridge_access=valid' } },
    )
    const res = await getProvenance(req)
    expect(res.status).toBe(200)
    expect(mocks.adminCommercialProvenance).toHaveBeenCalledWith(
      'admin-access-token',
      expect.any(String),
      `?paymentId=${paymentId}`,
    )
  })

  it('rejects non-admin actor with 403', async () => {
    mocks.ensureRole.mockImplementation(() => {
      throw new ApiError({
        message: 'The account lacks the required role.',
        code: 'FORBIDDEN',
        status: 403,
      })
    })
    const req = new NextRequest(
      'http://localhost/api/consultation/admin/commercial/discrepancies',
      { headers: { cookie: 'mentalbridge_access=valid' } },
    )
    const res = await getDiscrepancies(req)
    expect(res.status).toBe(403)
  })
})
