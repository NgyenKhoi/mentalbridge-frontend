import { render, screen } from '@testing-library/react'
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
    browserSubscription: { catalogue: vi.fn(), checkout: vi.fn() },
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

describe('PlanCheckoutPanel', () => {
  beforeEach(() => {
    vi.mocked(browserSubscription.catalogue)
      .mockReset()
      .mockResolvedValue(catalogue)
    vi.mocked(browserServiceCredits.get)
      .mockReset()
      .mockResolvedValue(freeAccount)
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
