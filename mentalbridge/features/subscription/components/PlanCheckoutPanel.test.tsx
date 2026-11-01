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
      payment: vi.fn(),
    },
  }
})

const catalogue = {
  checkoutEnabled: true,
  paymentProvider: 'PAYOS' as const,
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

// Far enough ahead that the countdown never expires during a test.
const farFuture = new Date(Date.now() + 3_600_000).toISOString()

const pendingPayment = {
  paymentId: 'aa100000-0000-4000-8000-000000000001',
  subscriptionId: 'aa100000-0000-4000-8000-000000000002',
  planVersionId: catalogue.plans[1].planVersionId,
  planCode: 'PLUS' as const,
  planVersion: 'sandbox-vnd-2026-10',
  pricingPolicyVersion: 'sandbox-full-price-v1' as const,
  purpose: 'PURCHASE' as const,
  provider: 'PAYOS' as const,
  status: 'PENDING' as const,
  amountVnd: 5000,
  currency: 'VND' as const,
  qrCode:
    '00020101021238540010A00000072701240006970422011000000007860208QRIBFTTA5303704',
  bin: '970422',
  accountNumber: '0000000786',
  accountName: 'MENTALBRIDGE TEST',
  description: 'MB000786',
  amount: 5000,
  expiredAt: farFuture,
  expiresAt: farFuture,
  createdAt: '2026-10-10T00:00:00Z',
  paidAt: null,
  failedAt: null,
}

const unconfirmed = { ...pendingPayment, qrCode: null, bin: null }

function history(...items: Array<typeof pendingPayment | typeof unconfirmed>) {
  vi.mocked(browserSubscription.history).mockResolvedValue({
    items,
    count: items.length,
    generatedAt: pendingPayment.createdAt,
  })
}

describe('PlanCheckoutPanel', () => {
  beforeEach(() => {
    vi.mocked(browserSubscription.history).mockReset()
    history()
    vi.mocked(browserSubscription.checkout).mockReset()
    vi.mocked(browserSubscription.payment)
      .mockReset()
      .mockResolvedValue(pendingPayment)
    vi.mocked(browserSubscription.catalogue)
      .mockReset()
      .mockResolvedValue(catalogue)
    vi.mocked(browserServiceCredits.get)
      .mockReset()
      .mockResolvedValue(freeAccount)
  })

  it('opens the in-app QR after checkout without leaving the page', async () => {
    const user = userEvent.setup()
    vi.mocked(browserSubscription.catalogue).mockResolvedValue({
      ...catalogue,
      paymentProvider: 'FAKE',
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
      ...pendingPayment,
      provider: 'FAKE',
    })
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    render(<PlanCheckoutPanel />)
    expect(await screen.findByText(/Gói thử nghiệm:/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Chọn Plus/ }))
    expect(
      await screen.findByRole('img', { name: /Mã QR chuyển khoản 5\.000đ/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Thanh toán thử (không trừ tiền thật)'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Chọn Premium/ })).toBeNull()
    expect(assign).not.toHaveBeenCalled()
    expect(browserServiceCredits.get).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('keeps purchase available when authoritative history is empty', async () => {
    render(<PlanCheckoutPanel />)
    expect(
      await screen.findByRole('button', { name: /Chọn Plus/ }),
    ).toBeEnabled()
  })

  it('reopens a pending QR payment on load and returns to the plans without cancelling it', async () => {
    const user = userEvent.setup()
    history(pendingPayment)
    render(<PlanCheckoutPanel />)
    expect(
      await screen.findByRole('img', { name: /Mã QR chuyển khoản/ }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Chưa kích hoạt/)).toBeNull()
    await user.click(screen.getByRole('button', { name: /Quay lại các gói/ }))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Bạn có một thanh toán đang chờ.',
    )
    expect(screen.getByRole('button', { name: /Chọn Premium/ })).toBeDisabled()
    await user.click(
      screen.getByRole('button', { name: 'Tiếp tục thanh toán' }),
    )
    expect(
      screen.getByRole('img', { name: /Mã QR chuyển khoản/ }),
    ).toBeInTheDocument()
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
    expect(
      await screen.findByRole('img', { name: /Mã QR chuyển khoản/ }),
    ).toBeInTheDocument()
    const calls = vi.mocked(browserSubscription.checkout).mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[1]).toEqual(calls[0])
  })

  it('treats an unconfirmed pending payment as waiting: status check only, no second charge, QR once confirmed', async () => {
    const user = userEvent.setup()
    history(unconfirmed)
    render(<PlanCheckoutPanel />)
    expect(await screen.findByRole('status')).toHaveTextContent(
      /Chưa kích hoạt/,
    )
    expect(screen.getByRole('button', { name: /Chọn Plus/ })).toBeDisabled()
    expect(screen.queryByRole('link')).toBeNull()
    history(pendingPayment)
    await user.click(
      screen.getByRole('button', { name: 'Kiểm tra trạng thái' }),
    )
    expect(
      await screen.findByRole('img', { name: /Mã QR chuyển khoản/ }),
    ).toBeInTheDocument()
    expect(browserSubscription.checkout).not.toHaveBeenCalled()
  })

  it('offers only a quiet fallback link for a legacy MoMo checkout without QR fields', async () => {
    vi.mocked(browserSubscription.catalogue).mockResolvedValue({
      ...catalogue,
      paymentProvider: 'MOMO',
    })
    history({
      ...unconfirmed,
      provider: 'MOMO' as never,
      checkoutUrl: 'https://test-payment.momo.vn/pay',
    } as typeof unconfirmed)
    render(<PlanCheckoutPanel />)
    const link = await screen.findByRole('link', {
      name: /Mở trang thanh toán của MoMo/,
    })
    expect(link).toHaveAttribute('href', 'https://test-payment.momo.vn/pay')
    expect(screen.queryByRole('img', { name: /Mã QR/ })).toBeNull()
  })

  it('renders server prices and names no provider but the configured one', async () => {
    render(<PlanCheckoutPanel />)
    expect(await screen.findByText(/1\.390\.000\s*₫/)).toBeInTheDocument()
    expect(screen.getByText(/3\.490\.000\s*₫/)).toBeInTheDocument()
    expect(screen.getByText('4 lượt tư vấn')).toBeInTheDocument()
    expect(screen.getByText('2 lịch')).toBeInTheDocument()
    expect(screen.getByText('10 lượt tư vấn')).toBeInTheDocument()
    expect(screen.getByText('4 lịch')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chọn Plus' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Chọn Premium' })).toBeEnabled()
    expect(screen.getByText(/chuyển khoản ngân hàng \(payOS\)/)).toBeVisible()
    expect(document.body).not.toHaveTextContent(/MoMo/)
  })

  it('names the dormant MoMo provider only when the catalogue says so', async () => {
    vi.mocked(browserSubscription.catalogue).mockResolvedValue({
      ...catalogue,
      paymentProvider: 'MOMO',
    })
    render(<PlanCheckoutPanel />)
    expect(await screen.findByText(/Thanh toán qua MoMo./)).toBeVisible()
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
      screen.getByRole('button', { name: 'Nâng cấp lên Premium' }),
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
      screen.queryByRole('button', { name: /Nâng cấp lên/ }),
    ).not.toBeInTheDocument()
  })

  it('closes an expired code on the server before creating a new one', async () => {
    const user = userEvent.setup()
    const expired = new Date(Date.now() - 1_000).toISOString()
    history({ ...pendingPayment, expiredAt: expired, expiresAt: expired })
    vi.mocked(browserSubscription.payment).mockResolvedValue({
      ...pendingPayment,
      status: 'FAILED',
      terminalReason: 'EXPIRED',
      failedAt: expired,
      expiredAt: expired,
      expiresAt: expired,
    } as never)
    vi.mocked(browserSubscription.checkout).mockResolvedValue({
      ...pendingPayment,
      paymentId: 'aa100000-0000-4000-8000-000000000009',
    })
    render(<PlanCheckoutPanel />)
    await user.click(await screen.findByRole('button', { name: 'Tạo mã mới' }))
    expect(
      await screen.findByRole('img', { name: /Mã QR chuyển khoản/ }),
    ).toBeInTheDocument()
    expect(browserSubscription.checkout).toHaveBeenCalledTimes(1)
    // The FAILED re-read is replaced directly, never shown as a failure.
    expect(screen.queryByText('Thanh toán chưa thành công')).toBeNull()
  })
  describe('renewing an expired code', () => {
    const expired = new Date(Date.now() - 5 * 60_000).toISOString()
    const settled = (overrides: Record<string, unknown>) =>
      vi.mocked(browserSubscription.payment).mockResolvedValue({
        ...pendingPayment,
        expiredAt: expired,
        expiresAt: expired,
        ...overrides,
      } as never)

    async function renew() {
      const user = userEvent.setup()
      history({ ...pendingPayment, expiredAt: expired, expiresAt: expired })
      render(<PlanCheckoutPanel />)
      await user.click(
        await screen.findByRole('button', { name: 'Tạo mã mới' }),
      )
    }

    it('shows success and creates no checkout when the re-read is SUCCEEDED, even after polling stopped', async () => {
      settled({ status: 'SUCCEEDED', paidAt: expired })
      await renew()
      expect(
        await screen.findByRole('heading', { name: 'Đã nhận thanh toán' }),
      ).toBeInTheDocument()
      expect(browserSubscription.checkout).not.toHaveBeenCalled()
    })

    it('does not create a checkout while the re-read is still PENDING', async () => {
      settled({ status: 'PENDING' })
      await renew()
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Mã cũ đang được đóng',
      )
      expect(browserSubscription.checkout).not.toHaveBeenCalled()
    })

    it('does not create a checkout for a CHARGEBACK re-read', async () => {
      settled({ status: 'CHARGEBACK' })
      await renew()
      expect(
        await screen.findByRole('heading', {
          name: 'Giao dịch cần được đối soát',
        }),
      ).toBeInTheDocument()
      expect(browserSubscription.checkout).not.toHaveBeenCalled()
    })
  })
})
