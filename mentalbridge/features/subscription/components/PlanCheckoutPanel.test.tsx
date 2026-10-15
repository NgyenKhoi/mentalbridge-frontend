import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browserServiceCredits } from '@/features/service-credits/api/browser-client'
import { browserSubscription } from '../api/browser-client'
import PlanCheckoutPanel from './PlanCheckoutPanel'

vi.mock('@/features/service-credits/api/browser-client', () => ({
  browserServiceCredits: { get: vi.fn() },
}))
vi.mock('../api/browser-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/browser-client')>()
  return {
    ...actual,
    browserSubscription: {
      catalogue: vi.fn(),
      checkout: vi.fn(),
      history: vi.fn(),
    },
  }
})

const catalogue = {
  checkoutEnabled: true,
  paymentProvider: 'MOMO' as const,
  generatedAt: '2026-10-10T00:00:00Z',
  plans: [
    {
      planVersionId: '51500000-0000-4000-8000-000000000001',
      planCode: 'FREE' as const,
      version: 'v2-vnd-2026-01',
      displayName: 'Miễn phí',
      currency: 'VND' as const,
      priceVnd: 0,
      billingPeriodMonths: 1 as const,
      consultationCredits: 0 as const,
      maxActiveReservations: 0 as const,
      creditAllocationVnd: 0,
      aiQuotaCode: 'STANDARD_5_DAILY',
      supportPlanEnabled: false,
      entitlements: ['JOURNAL'],
      allowedUpgrades: ['PLUS', 'PREMIUM'] as const,
      effectiveFrom: '2026-01-01T00:00:00Z',
    },
    {
      planVersionId: '51500000-0000-4000-8000-000000000002',
      planCode: 'PLUS' as const,
      version: 'v2-vnd-2026-01',
      displayName: 'Plus',
      currency: 'VND' as const,
      priceVnd: 1390000,
      billingPeriodMonths: 1 as const,
      consultationCredits: 4 as const,
      maxActiveReservations: 2 as const,
      creditAllocationVnd: 300000,
      aiQuotaCode: 'PLUS_DAILY',
      supportPlanEnabled: true,
      entitlements: ['SUPPORT_PLAN'],
      allowedUpgrades: ['PREMIUM'] as const,
      effectiveFrom: '2026-01-01T00:00:00Z',
    },
    {
      planVersionId: '51500000-0000-4000-8000-000000000003',
      planCode: 'PREMIUM' as const,
      version: 'v2-vnd-2026-01',
      displayName: 'Premium',
      currency: 'VND' as const,
      priceVnd: 3490000,
      billingPeriodMonths: 1 as const,
      consultationCredits: 10 as const,
      maxActiveReservations: 4 as const,
      creditAllocationVnd: 300000,
      aiQuotaCode: 'PREMIUM_FAIR_USE',
      supportPlanEnabled: true,
      entitlements: ['SUPPORT_PLAN'],
      allowedUpgrades: [] as const,
      effectiveFrom: '2026-01-01T00:00:00Z',
    },
  ],
}

const freeAccount = {
  accountId: 'f5297ec9-bbc9-4d51-8212-62778245335c',
  packageCode: 'FREE' as const,
  source: 'DEFAULT_FREE' as const,
  sourceReference: null,
  periodStart: null,
  periodEnd: null,
  policyVersion: 'consultation-credit-v2' as const,
  balance: {
    available: 0,
    held: 0,
    consumed: 0,
    forfeited: 0,
    total: 0,
    releasedTransitions: 0,
  },
  reservationCapacity: { active: 0, maximum: 0, remaining: 0 },
  history: [],
  generatedAt: '2026-10-10T00:00:00Z',
}

const pendingPayment = {
  paymentId: 'aa100000-0000-4000-8000-000000000001',
  subscriptionId: 'aa100000-0000-4000-8000-000000000002',
  planVersionId: catalogue.plans[1].planVersionId,
  planCode: 'PLUS' as const,
  planVersion: 'sandbox-vnd-2026-10',
  pricingPolicyVersion: 'sandbox-full-price-v1' as const,
  purpose: 'PURCHASE' as const,
  provider: 'FAKE' as const,
  status: 'PENDING' as const,
  amountVnd: 5000,
  currency: 'VND' as const,
  checkoutUrl: 'https://test-payment.momo.vn/pay',
  qrCodeUrl: null,
  expiresAt: '2026-10-10T00:15:00Z',
  createdAt: '2026-10-10T00:00:00Z',
  paidAt: null,
  failedAt: null,
}

describe('PlanCheckoutPanel', () => {
  beforeEach(() => {
    vi.mocked(browserSubscription.history).mockReset().mockResolvedValue({
      items: [],
      count: 0,
      generatedAt: '2026-10-10T00:00:00Z',
    })
    vi.mocked(browserSubscription.checkout).mockReset()
    vi.mocked(browserSubscription.catalogue)
      .mockReset()
      .mockResolvedValue(catalogue)
    vi.mocked(browserServiceCredits.get)
      .mockReset()
      .mockResolvedValue(freeAccount)
  })

  it('labels sandbox offers and never redirects a FAKE pending payment or activates its credits', async () => {
    const user = userEvent.setup()
    vi.mocked(browserSubscription.catalogue).mockResolvedValue({
      ...catalogue,
      plans: catalogue.plans.map((plan) => ({
        ...plan,
        pricingPolicyVersion: 'sandbox-full-price-v1',
        priceVnd:
          plan.planCode === 'FREE'
            ? 0
            : plan.planCode === 'PLUS'
              ? 5000
              : 10000,
      })),
    })
    vi.mocked(browserSubscription.checkout).mockResolvedValue({
      paymentId: 'aa100000-0000-4000-8000-000000000001',
      subscriptionId: 'aa100000-0000-4000-8000-000000000002',
      planVersionId: catalogue.plans[1].planVersionId,
      planCode: 'PLUS',
      planVersion: 'sandbox-vnd-2026-10',
      pricingPolicyVersion: 'sandbox-full-price-v1',
      purpose: 'PURCHASE',
      provider: 'FAKE',
      status: 'PENDING',
      amountVnd: 5000,
      currency: 'VND',
      checkoutUrl: 'https://test-payment.momo.vn/pay',
      qrCodeUrl: null,
      expiresAt: '2026-10-10T00:15:00Z',
      createdAt: '2026-10-10T00:00:00Z',
      paidAt: null,
      failedAt: null,
    })
    render(<PlanCheckoutPanel />)
    expect(await screen.findByText(/Gói thử nghiệm:/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Chọn Plus/ }))
    expect(
      await screen.findByText(/không thu tiền thật và không mở ví MoMo/),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/Chưa kích hoạt/)
    expect(screen.getByRole('button', { name: /Chọn Premium/ })).toBeDisabled()
    expect(
      screen.queryByRole('link', { name: /Tiếp tục thanh toán/ }),
    ).not.toBeInTheDocument()
    expect(browserServiceCredits.get).toHaveBeenCalledTimes(1)
  })

  it('keeps purchase available when authoritative history is empty', async () => {
    vi.mocked(browserSubscription.history).mockResolvedValue({
      items: [],
      count: 0,
      generatedAt: '2026-10-10T00:00:00Z',
    })
    render(<PlanCheckoutPanel />)
    expect(
      await screen.findByRole('button', { name: /Chọn Plus/ }),
    ).toBeEnabled()
  })

  it('recovers pending history on remount and activates only after authoritative refresh', async () => {
    const user = userEvent.setup()
    vi.mocked(browserSubscription.history).mockResolvedValue({
      items: [pendingPayment],
      count: 1,
      generatedAt: pendingPayment.createdAt,
    })
    const first = render(<PlanCheckoutPanel />)
    expect(await screen.findByRole('status')).toHaveTextContent(
      /Chưa kích hoạt/,
    )
    first.unmount()
    render(<PlanCheckoutPanel />)
    expect(await screen.findByRole('status')).toHaveTextContent(
      /Chưa kích hoạt/,
    )
    expect(screen.getByRole('button', { name: /Chọn Premium/ })).toBeDisabled()
    vi.mocked(browserSubscription.history).mockResolvedValue({
      items: [
        {
          ...pendingPayment,
          status: 'SUCCEEDED',
          paidAt: pendingPayment.createdAt,
        },
      ],
      count: 1,
      generatedAt: pendingPayment.createdAt,
    })
    vi.mocked(browserServiceCredits.get).mockResolvedValue({
      ...freeAccount,
      packageCode: 'PLUS',
      source: 'PAID',
      balance: { ...freeAccount.balance, available: 4, total: 4 },
    })
    await user.click(
      screen.getByRole('button', { name: 'Kiểm tra trạng thái' }),
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      /đã được xác nhận thành công/,
    )
    expect(screen.getByRole('button', { name: /Nâng cấp/ })).toBeEnabled()
    expect(browserSubscription.checkout).not.toHaveBeenCalled()
  })

  it('reuses the same command key after an ambiguous checkout failure', async () => {
    const user = userEvent.setup()
    vi.mocked(browserSubscription.checkout)
      .mockRejectedValueOnce(new Error('timeout after acceptance'))
      .mockResolvedValueOnce(pendingPayment)
    render(<PlanCheckoutPanel />)
    await user.click(await screen.findByRole('button', { name: /Chọn Plus/ }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Chọn Plus/ }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      /Chưa kích hoạt/,
    )
    const calls = vi.mocked(browserSubscription.checkout).mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[1]).toEqual(calls[0])
  })

  it('never redirects or enables another charge when provider creation remains unconfirmed', async () => {
    vi.mocked(browserSubscription.history).mockResolvedValue({
      items: [{ ...pendingPayment, provider: 'MOMO', checkoutUrl: null }],
      count: 1,
      generatedAt: pendingPayment.createdAt,
    })
    render(<PlanCheckoutPanel />)
    expect(
      await screen.findByText(/Chưa thể mở thanh toán/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Chọn Plus/ })).toBeDisabled()
    expect(
      screen.queryByRole('link', { name: /Tiếp tục thanh toán/ }),
    ).not.toBeInTheDocument()
    expect(browserSubscription.checkout).not.toHaveBeenCalled()
  })

  it('renders server prices and exposes only MoMo purchase actions', async () => {
    render(<PlanCheckoutPanel />)
    expect(await screen.findByText(/1\.390\.000\s*₫/)).toBeInTheDocument()
    expect(screen.getByText(/3\.490\.000\s*₫/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Chọn Plus qua MoMo/ }),
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: /Chọn Premium qua MoMo/ }),
    ).toBeEnabled()
    expect(screen.queryByText(/PayOS|thẻ|ngân hàng/i)).not.toBeInTheDocument()
  })

  it('shows only the allowed Plus to Premium upgrade', async () => {
    vi.mocked(browserServiceCredits.get).mockResolvedValue({
      ...freeAccount,
      packageCode: 'PLUS',
      source: 'PAID',
      sourceReference: 'subscription-515',
      periodStart: '2026-10-01T00:00:00Z',
      periodEnd: '2026-11-01T00:00:00Z',
      balance: { ...freeAccount.balance, available: 4, total: 4 },
      reservationCapacity: { active: 0, maximum: 2, remaining: 2 },
    })
    render(<PlanCheckoutPanel />)
    expect(
      await screen.findByRole('button', { name: 'Gói hiện tại' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: /Nâng cấp qua MoMo/ }),
    ).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: /hạ gói|hoàn tiền/i }),
    ).not.toBeInTheDocument()
  })

  it('does not offer a paid upgrade for an unmanaged demo entitlement', async () => {
    vi.mocked(browserServiceCredits.get).mockResolvedValue({
      ...freeAccount,
      packageCode: 'PLUS',
      source: 'DEMO',
      sourceReference: 'controlled-demo',
      periodStart: '2026-10-01T00:00:00Z',
      periodEnd: '2026-11-01T00:00:00Z',
      balance: { ...freeAccount.balance, available: 4, total: 4 },
      reservationCapacity: { active: 0, maximum: 2, remaining: 2 },
    })
    render(<PlanCheckoutPanel />)

    expect(
      await screen.findByRole('button', { name: 'Gói hiện tại' }),
    ).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: /Nâng cấp qua MoMo/ }),
    ).not.toBeInTheDocument()
  })
})
