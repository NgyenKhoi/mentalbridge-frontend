import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browserCommercialReconciliation } from '../api/browser-client'
import AdminCommercialReconciliationManager from './AdminCommercialReconciliationManager'
import type { AdminPaymentList } from '@/lib/consultation/billing-validation'

vi.mock('../api/browser-client', () => ({
  browserCommercialReconciliation: {
    getDiscrepancies: vi.fn(),
    getProvenance: vi.fn(),
    getPayments: vi.fn(),
    getPayouts: vi.fn(),
    getPayoutDetail: vi.fn(),
    getSubscriptionDetail: vi.fn(),
  },
}))

describe('AdminCommercialReconciliationManager', () => {
  const sampleDiscrepancies = {
    generatedAt: '2026-10-22T00:00:00Z',
    totalDiscrepancies: 4,
    webhooks: [
      {
        id: '62200000-0000-4000-8000-000000000010',
        orderId: 'ORDER-101',
        provider: 'MOMO' as const,
        discrepancyType: 'UNPROCESSED_IPN',
        receivedAt: '2026-10-21T10:00:00Z',
        failureCode: 'PENDING_RETRY',
        status: 'UNPROCESSED',
      },
    ],
    payouts: [
      {
        payoutId: '62200000-0000-4000-8000-000000000020',
        specialistAccountId: '62200000-0000-4000-8000-000000000030',
        amountVnd: 450000,
        currency: 'VND' as const,
        provider: 'MOMO',
        status: 'FAILED',
        failureCode: 'ACCOUNT_INVALID',
        destinationHint: '0987***',
        requestedAt: '2026-10-21T12:00:00Z',
      },
    ],
    heldEarnings: [
      {
        earningId: '62200000-0000-4000-8000-000000000040',
        specialistAccountId: '62200000-0000-4000-8000-000000000030',
        appointmentId: '62200000-0000-4000-8000-000000000050',
        amountVnd: 450000,
        status: 'HELD',
        holdReason: 'AWAITING_GRACE_PERIOD',
        earnedAt: '2026-10-21T09:00:00Z',
        settlementAvailableAt: '2026-10-25T00:00:00Z',
      },
    ],
    disputes: [
      {
        disputeId: '62200000-0000-4000-8000-000000000060',
        appointmentId: '62200000-0000-4000-8000-000000000050',
        openedByRole: 'USER',
        status: 'OPEN',
        reasonCode: 'QUALITY_ISSUE',
        openedAt: '2026-10-21T08:00:00Z',
        eligibleUntil: '2026-10-28T08:00:00Z',
      },
    ],
  }

  const sampleProvenance = {
    generatedAt: '2026-10-22T00:00:00Z',
    queryIdentifierType: 'paymentId',
    queryIdentifierValue: '62200000-0000-4000-8000-000000000001',
    found: true,
    truncated: false,
    payments: [
      {
        paymentId: '62200000-0000-4000-8000-000000000001',
        subscriptionId: '62200000-0000-4000-8000-000000000002',
        planVersionId: '62200000-0000-4000-8000-000000000099',
        planCode: 'PLUS' as const,
        pricingPolicyVersion: 'sandbox-full-price-v1' as const,
        purpose: 'PURCHASE' as const,
        provider: 'FAKE' as const,
        status: 'SUCCEEDED' as const,
        amountVnd: 500000,
        currency: 'VND' as const,
        createdAt: '2026-10-20T10:00:00Z',
        paidAt: '2026-10-20T10:00:01Z',
        failedAt: null,
      },
    ],
    subscription: {
      subscriptionId: '62200000-0000-4000-8000-000000000002',
      userAccountId: '62200000-0000-4000-8000-000000000003',
      planVersionId: '62200000-0000-4000-8000-000000000099',
      planCode: 'PREMIUM',
      pricingPolicyVersion: 'sandbox-full-price-v1',
      status: 'ACTIVE',
      currentPeriodStart: '2026-10-20T10:00:00Z',
      currentPeriodEnd: '2026-11-20T10:00:00Z',
      createdAt: '2026-10-20T10:00:00Z',
    },
    subscriptions: [],
    credits: [
      {
        creditId: '62200000-0000-4000-8000-000000000004',
        periodId: '62200000-0000-4000-8000-000000000090',
        ordinal: 1,
        state: 'RESERVED',
        creditAllocationVnd: 125000,
        createdAt: '2026-10-20T10:00:00Z',
      },
    ],
    appointments: [
      {
        appointmentId: '62200000-0000-4000-8000-000000000005',
        specialistAccountId: '62200000-0000-4000-8000-000000000006',
        serviceCreditId: '62200000-0000-4000-8000-000000000004',
        status: 'COMPLETED',
        modality: 'ONLINE_VIDEO',
        sessionOutcome: 'SATISFACTORY',
        completionFactId: '62200000-0000-4000-8000-000000000088',
        scheduledStartAt: '2026-10-20T11:00:00Z',
        scheduledEndAt: '2026-10-20T11:45:00Z',
        sessionSettledAt: '2026-10-20T12:00:00Z',
      },
    ],
    disputes: [],
    earnings: [
      {
        earningId: '62200000-0000-4000-8000-000000000007',
        appointmentId: '62200000-0000-4000-8000-000000000005',
        consumedCreditId: '62200000-0000-4000-8000-000000000004',
        specialistAccountId: '62200000-0000-4000-8000-000000000006',
        planVersion: 'v1',
        creditAllocationVnd: 125000,
        specialistShareBps: 7000,
        specialistAmountVnd: 87500,
        platformAllocationVnd: 37500,
        status: 'AVAILABLE',
        earnedAt: '2026-10-20T12:00:00Z',
        settlementAvailableAt: '2026-10-23T12:00:00Z',
        paidAt: null,
      },
    ],
    payouts: [],
  }

  beforeEach(() => {
    vi.mocked(browserCommercialReconciliation.getDiscrepancies).mockReset()
    vi.mocked(browserCommercialReconciliation.getProvenance).mockReset()
    vi.mocked(browserCommercialReconciliation.getPayments).mockReset()
    vi.mocked(browserCommercialReconciliation.getPayouts).mockReset()
    vi.mocked(browserCommercialReconciliation.getPayoutDetail).mockReset()
    vi.mocked(browserCommercialReconciliation.getSubscriptionDetail).mockReset()
  })

  it('renders discrepancy overview with authoritative owner facts', async () => {
    vi.mocked(
      browserCommercialReconciliation.getDiscrepancies,
    ).mockResolvedValue(sampleDiscrepancies)

    render(<AdminCommercialReconciliationManager />)

    expect(
      await screen.findByRole('heading', {
        name: 'Đối soát thương mại & Vòng đời giao dịch',
      }),
    ).toBeInTheDocument()

    expect(await screen.findByText(/ORDER-101/)).toBeInTheDocument()
    expect(screen.getByText(/ACCOUNT_INVALID/)).toBeInTheDocument()
    expect(screen.getByText(/QUALITY_ISSUE/)).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('renders empty discrepancy notice when zero discrepancies exist', async () => {
    vi.mocked(
      browserCommercialReconciliation.getDiscrepancies,
    ).mockResolvedValue({
      generatedAt: '2026-10-22T00:00:00Z',
      totalDiscrepancies: 0,
      webhooks: [],
      payouts: [],
      heldEarnings: [],
      disputes: [],
    })

    render(<AdminCommercialReconciliationManager />)

    expect(
      await screen.findByRole('heading', { name: 'Không ghi nhận sai lệch' }),
    ).toBeInTheDocument()
  })

  it('handles backend failure with friendly error state and retry button', async () => {
    vi.mocked(
      browserCommercialReconciliation.getDiscrepancies,
    ).mockRejectedValue(new Error('Connection failure'))

    render(<AdminCommercialReconciliationManager />)

    expect(
      await screen.findByText('Chưa thể tải dữ liệu sai lệch từ máy chủ.'),
    ).toBeInTheDocument()

    const retryBtn = screen.getByRole('button', { name: 'Thử lại' })
    expect(retryBtn).toBeEnabled()

    vi.mocked(
      browserCommercialReconciliation.getDiscrepancies,
    ).mockResolvedValue(sampleDiscrepancies)
    fireEvent.click(retryBtn)

    await waitFor(() => {
      expect(screen.getByText(/ORDER-101/)).toBeInTheDocument()
    })
  })

  it('hides the previous reconciliation result when refresh fails', async () => {
    vi.mocked(browserCommercialReconciliation.getDiscrepancies)
      .mockResolvedValueOnce(sampleDiscrepancies)
      .mockRejectedValueOnce(new Error('Connection failure'))

    render(<AdminCommercialReconciliationManager />)
    expect(await screen.findByText(/ORDER-101/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }))

    expect(
      await screen.findByText('Chưa thể tải dữ liệu sai lệch từ máy chủ.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/ORDER-101/)).not.toBeInTheDocument()
    expect(screen.queryByText(/ACCOUNT_INVALID/)).not.toBeInTheDocument()
  })

  it('traces commercial provenance end-to-end without leaking clinical data', async () => {
    vi.mocked(
      browserCommercialReconciliation.getDiscrepancies,
    ).mockResolvedValue(sampleDiscrepancies)
    vi.mocked(browserCommercialReconciliation.getProvenance).mockResolvedValue(
      sampleProvenance,
    )

    render(<AdminCommercialReconciliationManager />)

    // Switch to provenance tab
    fireEvent.click(
      screen.getByRole('tab', { name: 'Truy vết dòng tiền (Provenance)' }),
    )

    expect(
      screen.getByRole('heading', {
        name: 'Truy vết chu trình thương mại (5 giai đoạn)',
      }),
    ).toBeInTheDocument()

    // Type identifier into input
    const input = screen.getByLabelText('Giá trị mã định danh')
    fireEvent.change(input, {
      target: { value: '62200000-0000-4000-8000-000000000001' },
    })

    const traceBtn = screen.getByRole('button', { name: 'Truy vết' })
    fireEvent.click(traceBtn)

    await waitFor(() => {
      expect(
        browserCommercialReconciliation.getProvenance,
      ).toHaveBeenCalledWith({
        paymentId: '62200000-0000-4000-8000-000000000001',
      })
    })

    expect(
      await screen.findByRole('heading', {
        name: '1. Thanh toán (Payment Transactions)',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: '2. Thuê bao & Tín chỉ (Subscription & Service Credits)',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: '3. Lịch hẹn & Xem xét (Appointment & Disputes)',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: '4. Thu nhập chuyên gia (Specialist Earnings)',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: '5. Chi trả (Specialist Payouts)',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Chưa tạo yêu cầu chi trả')).toBeInTheDocument()
  })

  it('browses payments with authoritative filters and no fabricated data', async () => {
    vi.mocked(
      browserCommercialReconciliation.getDiscrepancies,
    ).mockResolvedValue(sampleDiscrepancies)
    vi.mocked(browserCommercialReconciliation.getPayments).mockResolvedValue({
      generatedAt: '2026-10-22T00:00:00Z',
      count: 1,
      items: [
        {
          paymentId: '62200000-0000-4000-8000-000000000001',
          subscriptionId: '62200000-0000-4000-8000-000000000002',
          planVersionId: '62200000-0000-4000-8000-000000000099',
          planCode: 'PLUS' as const,
          pricingPolicyVersion: 'sandbox-full-price-v1',
          purpose: 'PURCHASE',
          provider: 'FAKE',
          status: 'SUCCEEDED',
          amountVnd: 250000,
          currency: 'VND',
          createdAt: '2026-10-20T10:00:00Z',
          paidAt: '2026-10-20T10:00:01Z',
          failedAt: null,
        },
      ],
    })

    render(<AdminCommercialReconciliationManager />)

    // Switch to payments tab
    fireEvent.click(screen.getByRole('tab', { name: 'Giao dịch thanh toán' }))

    await waitFor(() => {
      expect(browserCommercialReconciliation.getPayments).toHaveBeenCalled()
    })

    expect(await screen.findByText(/250\.000/)).toBeInTheDocument()
    expect(screen.getByText('SUCCEEDED')).toBeInTheDocument()
  })

  it('shows unapproved actions as disabled with proper security warnings', async () => {
    vi.mocked(
      browserCommercialReconciliation.getDiscrepancies,
    ).mockResolvedValue(sampleDiscrepancies)

    render(<AdminCommercialReconciliationManager />)

    // Switch to actions tab
    fireEvent.click(
      screen.getByRole('tab', { name: 'Hành động đối soát & Giới hạn' }),
    )

    expect(
      screen.getByRole('heading', {
        name: 'Hành động đối soát & Giới hạn tài chính',
      }),
    ).toBeInTheDocument()

    // Assert read-only / disabled badges
    expect(screen.getAllByText('Đang tắt (Read-only)')).toHaveLength(3)

    expect(
      screen.getByText(/Chưa có API hoàn tiền trực tiếp được phê duyệt/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Số dư thu nhập chuyên gia được tính toán bất biến/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Cơ chế giải ngân tiền thật đang tắt mặc định/),
    ).toBeInTheDocument()
  })

  it('renders multiple subscriptions linked to provenance with dynamic status badges', async () => {
    const multiSubProvenance = {
      ...sampleProvenance,
      subscription: null,
      subscriptions: [
        {
          subscriptionId: '62200000-0000-4000-8000-000000000002',
          userAccountId: '62200000-0000-4000-8000-000000000003',
          planVersionId: '62200000-0000-4000-8000-000000000099',
          planCode: 'PREMIUM',
          pricingPolicyVersion: 'sandbox-v1',
          status: 'ACTIVE',
          currentPeriodStart: '2026-10-01T00:00:00Z',
          currentPeriodEnd: '2026-11-01T00:00:00Z',
          createdAt: '2026-10-01T00:00:00Z',
        },
        {
          subscriptionId: '62200000-0000-4000-8000-000000000009',
          userAccountId: '62200000-0000-4000-8000-000000000008',
          planVersionId: '62200000-0000-4000-8000-000000000098',
          planCode: 'PLUS',
          pricingPolicyVersion: 'sandbox-v1',
          status: 'EXPIRED',
          currentPeriodStart: '2026-09-01T00:00:00Z',
          currentPeriodEnd: '2026-10-01T00:00:00Z',
          createdAt: '2026-09-01T00:00:00Z',
        },
      ],
      payments: [
        {
          paymentId: '62200000-0000-4000-8000-000000000001',
          subscriptionId: '62200000-0000-4000-8000-000000000002',
          planVersionId: '62200000-0000-4000-8000-000000000099',
          planCode: 'PLUS' as const,
          pricingPolicyVersion: 'sandbox-full-price-v1' as const,
          purpose: 'PURCHASE' as const,
          provider: 'FAKE' as const,
          status: 'FAILED' as const,
          amountVnd: 500000,
          currency: 'VND' as const,
          createdAt: '2026-10-20T10:00:00Z',
          paidAt: null,
          failedAt: '2026-10-20T10:01:00Z',
        },
      ],
    }

    vi.mocked(
      browserCommercialReconciliation.getDiscrepancies,
    ).mockResolvedValue(sampleDiscrepancies)
    vi.mocked(browserCommercialReconciliation.getProvenance).mockResolvedValue(
      multiSubProvenance,
    )

    render(<AdminCommercialReconciliationManager />)

    fireEvent.click(
      screen.getByRole('tab', { name: 'Truy vết dòng tiền (Provenance)' }),
    )
    fireEvent.change(screen.getByLabelText('Giá trị mã định danh'), {
      target: { value: '62200000-0000-4000-8000-000000000001' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Truy vết' }))

    expect(
      await screen.findByText(/Thuê bao: 62200000-0000-4000-8000-000000000002/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Thuê bao: 62200000-0000-4000-8000-000000000009/),
    ).toBeInTheDocument()

    // Status badges: FAILED should have acr-badge-alert
    const failedBadge = screen.getByText('FAILED')
    expect(failedBadge.className).toContain('acr-badge-alert')

    // EXPIRED should have acr-badge-alert
    const expiredBadge = screen.getByText('EXPIRED')
    expect(expiredBadge.className).toContain('acr-badge-alert')
  })

  it('clears stale provenance state when subsequent trace fails', async () => {
    vi.mocked(
      browserCommercialReconciliation.getDiscrepancies,
    ).mockResolvedValue(sampleDiscrepancies)
    vi.mocked(
      browserCommercialReconciliation.getProvenance,
    ).mockResolvedValueOnce(sampleProvenance)

    render(<AdminCommercialReconciliationManager />)

    fireEvent.click(
      screen.getByRole('tab', { name: 'Truy vết dòng tiền (Provenance)' }),
    )
    fireEvent.change(screen.getByLabelText('Giá trị mã định danh'), {
      target: { value: '62200000-0000-4000-8000-000000000001' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Truy vết' }))

    expect(
      await screen.findByText('1. Thanh toán (Payment Transactions)'),
    ).toBeInTheDocument()

    // Now fail the next trace
    vi.mocked(
      browserCommercialReconciliation.getProvenance,
    ).mockRejectedValueOnce(new Error('Mã định danh không hợp lệ'))
    fireEvent.change(screen.getByLabelText('Giá trị mã định danh'), {
      target: { value: 'invalid-id' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Truy vết' }))

    expect(
      await screen.findByText('Mã định danh không hợp lệ'),
    ).toBeInTheDocument()
    // Stale provenance stages should be removed
    expect(
      screen.queryByText('1. Thanh toán (Payment Transactions)'),
    ).not.toBeInTheDocument()
  })

  it('shows error state and retry in payments tab when fetch fails', async () => {
    vi.mocked(
      browserCommercialReconciliation.getDiscrepancies,
    ).mockResolvedValue(sampleDiscrepancies)
    vi.mocked(
      browserCommercialReconciliation.getPayments,
    ).mockRejectedValueOnce(new Error('Network error'))

    render(<AdminCommercialReconciliationManager />)

    fireEvent.click(screen.getByRole('tab', { name: 'Giao dịch thanh toán' }))

    expect(
      await screen.findByText('Chưa thể tải dữ liệu thanh toán từ máy chủ.'),
    ).toBeInTheDocument()

    // Test retry
    vi.mocked(
      browserCommercialReconciliation.getPayments,
    ).mockResolvedValueOnce({
      generatedAt: '2026-10-22T00:00:00Z',
      count: 0,
      items: [],
    })
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))

    expect(
      await screen.findByText('0 giao dịch trên trang này'),
    ).toBeInTheDocument()
  })

  it('renders discrepancy truncation banner when totalDiscrepancies > 50', async () => {
    vi.mocked(
      browserCommercialReconciliation.getDiscrepancies,
    ).mockResolvedValue({
      ...sampleDiscrepancies,
      totalDiscrepancies: 85,
    })

    render(<AdminCommercialReconciliationManager />)

    const banner = await screen.findByText(/Ghi nhận tổng cộng/)
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveTextContent('85')
  })

  it('shows truncated provenance banner when backend signals truncation', async () => {
    vi.mocked(
      browserCommercialReconciliation.getDiscrepancies,
    ).mockResolvedValue(sampleDiscrepancies)
    vi.mocked(browserCommercialReconciliation.getProvenance).mockResolvedValue({
      ...sampleProvenance,
      truncated: true,
    })

    render(<AdminCommercialReconciliationManager />)
    fireEvent.click(
      screen.getByRole('tab', { name: 'Truy vết dòng tiền (Provenance)' }),
    )
    fireEvent.change(screen.getByLabelText('Giá trị mã định danh'), {
      target: { value: '62200000-0000-4000-8000-000000000001' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Truy vết' }))

    expect(
      await screen.findByText(/Một số danh sách đã đạt giới hạn hiển thị/),
    ).toBeInTheDocument()
  })

  it('ignores stale out-of-order responses in payments tab', async () => {
    vi.mocked(
      browserCommercialReconciliation.getDiscrepancies,
    ).mockResolvedValue(sampleDiscrepancies)

    let resolveFirst!: (v: AdminPaymentList) => void
    let resolveSecond!: (v: AdminPaymentList) => void

    vi.mocked(browserCommercialReconciliation.getPayments)
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveFirst = res
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveSecond = res
          }),
      )

    render(<AdminCommercialReconciliationManager />)
    fireEvent.click(screen.getByRole('tab', { name: 'Giao dịch thanh toán' }))

    const statusSelect = screen.getByRole('combobox', {
      name: /lọc trạng thái/i,
    })
    fireEvent.change(statusSelect, { target: { value: 'SUCCEEDED' } })

    const successItem: AdminPaymentList = {
      generatedAt: '2026-10-22T00:00:00Z',
      count: 1,
      items: [
        {
          paymentId: '62200000-0000-4000-8000-000000000001',
          subscriptionId: '62200000-0000-4000-8000-000000000002',
          planVersionId: '62200000-0000-4000-8000-000000000099',
          planCode: 'PLUS' as const,
          pricingPolicyVersion: 'sandbox-full-price-v1',
          purpose: 'PURCHASE',
          provider: 'FAKE',
          status: 'SUCCEEDED',
          amountVnd: 250000,
          currency: 'VND',
          createdAt: '2026-10-20T10:00:00Z',
          paidAt: '2026-10-20T10:00:01Z',
          failedAt: null,
        },
      ],
    }

    // Resolve second (newer) first
    resolveSecond(successItem)

    await waitFor(() => {
      expect(screen.getByText(/250\.000/)).toBeInTheDocument()
    })

    // Stale first response should be ignored
    resolveFirst({ generatedAt: '2026-10-22T00:00:00Z', count: 99, items: [] })

    await waitFor(() => {
      expect(screen.queryByText(/99 giao dịch/)).not.toBeInTheDocument()
    })
  })

  it('uses owner lookahead to stop at the final payment page', async () => {
    vi.mocked(
      browserCommercialReconciliation.getDiscrepancies,
    ).mockResolvedValue(sampleDiscrepancies)
    const records = Array.from({ length: 51 }, (_, index) => ({
      ...sampleProvenance.payments[0],
      paymentId: `62200000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    }))
    vi.mocked(browserCommercialReconciliation.getPayments).mockImplementation(
      async (query) => {
        const offset = Number(query?.offset ?? 0)
        const items = records.slice(offset, offset + Number(query?.limit ?? 50))
        return {
          generatedAt: '2026-10-23T00:00:00Z',
          count: items.length,
          items,
        }
      },
    )
    render(<AdminCommercialReconciliationManager />)
    fireEvent.click(screen.getByRole('tab', { name: 'Giao dịch thanh toán' }))
    await waitFor(() =>
      expect(
        screen.getByText('50 giao dịch trên trang này'),
      ).toBeInTheDocument(),
    )
    expect(screen.getAllByRole('row')).toHaveLength(51)
    expect(
      vi.mocked(browserCommercialReconciliation.getPayments),
    ).toHaveBeenCalledWith(
      expect.objectContaining({ limit: '51', offset: '0' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() =>
      expect(
        screen.getByText('1 giao dịch trên trang này'),
      ).toBeInTheDocument(),
    )
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled()
  })

  it('sends Vietnam local dates as a half-open UTC window for both lists', async () => {
    vi.mocked(
      browserCommercialReconciliation.getDiscrepancies,
    ).mockResolvedValue(sampleDiscrepancies)
    vi.mocked(browserCommercialReconciliation.getPayments).mockResolvedValue({
      generatedAt: '2026-10-23T00:00:00Z',
      count: 0,
      items: [],
    })
    vi.mocked(browserCommercialReconciliation.getPayouts).mockResolvedValue({
      generatedAt: '2026-10-23T00:00:00Z',
      count: 0,
      items: [],
    })
    render(<AdminCommercialReconciliationManager />)
    fireEvent.click(screen.getByRole('tab', { name: 'Giao dịch thanh toán' }))
    fireEvent.change(screen.getByLabelText('Mã MoMo:'), {
      target: { value: '  provider-request-1  ' },
    })
    fireEvent.change(screen.getByLabelText('Từ ngày:'), {
      target: { value: '2026-12-31' },
    })
    fireEvent.change(screen.getByLabelText('Đến ngày:'), {
      target: { value: '2027-01-01' },
    })
    await waitFor(() =>
      expect(browserCommercialReconciliation.getPayments).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '2026-12-30T17:00:00.000Z',
          toExclusive: '2027-01-01T17:00:00.000Z',
          momoRef: 'provider-request-1',
        }),
      ),
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Chi trả chuyên gia' }))
    fireEvent.change(screen.getByLabelText('Mã tham chiếu chi trả:'), {
      target: { value: '  payout-ref-1  ' },
    })
    fireEvent.change(screen.getByLabelText('Từ ngày:'), {
      target: { value: '2026-10-23' },
    })
    fireEvent.change(screen.getByLabelText('Đến ngày:'), {
      target: { value: '2026-10-23' },
    })
    await waitFor(() =>
      expect(browserCommercialReconciliation.getPayouts).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '2026-10-22T17:00:00.000Z',
          toExclusive: '2026-10-23T17:00:00.000Z',
          providerReference: 'payout-ref-1',
        }),
      ),
    )
    const requestsBeforeInvalid = vi.mocked(
      browserCommercialReconciliation.getPayouts,
    ).mock.calls.length
    fireEvent.change(screen.getByLabelText('Từ ngày:'), {
      target: { value: '2026-10-24' },
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Từ ngày không thể lớn hơn đến ngày',
    )
    expect(
      vi.mocked(browserCommercialReconciliation.getPayouts),
    ).toHaveBeenCalledTimes(requestsBeforeInvalid)
  })
})

it('prevents request counter collision between discrepancies and payments', async () => {
  const slowDiscrepancies = {
    generatedAt: '2026-10-22T00:00:00Z',
    totalDiscrepancies: 1,
    webhooks: [],
    payouts: [],
    heldEarnings: [],
    disputes: [],
  }

  // Simulate slow discrepancies load and fast payment load to test counter isolation
  let discrepanciesResolve: (value: unknown) => void
  const discrepanciesPromise = new Promise((resolve) => {
    discrepanciesResolve = resolve
  })

  vi.mocked(browserCommercialReconciliation.getDiscrepancies).mockReturnValue(
    discrepanciesPromise as ReturnType<
      typeof browserCommercialReconciliation.getDiscrepancies
    >,
  )
  vi.mocked(browserCommercialReconciliation.getPayments).mockResolvedValue({
    generatedAt: '2026-10-22T00:00:00Z',
    count: 1,
    items: [
      {
        paymentId: '62200000-0000-4000-8000-000000000001',
        subscriptionId: '62200000-0000-4000-8000-000000000002',
        planVersionId: '62200000-0000-4000-8000-000000000099',
        planCode: 'PLUS' as const,
        pricingPolicyVersion: 'sandbox-full-price-v1',
        purpose: 'PURCHASE' as const,
        provider: 'FAKE' as const,
        status: 'SUCCEEDED' as const,
        amountVnd: 500000,
        currency: 'VND' as const,
        createdAt: '2026-10-20T10:00:00Z',
        paidAt: '2026-10-20T10:00:01Z',
        failedAt: null,
      },
    ],
  })

  render(<AdminCommercialReconciliationManager />)

  // Switch to payments tab immediately (before discrepancies load)
  fireEvent.click(screen.getByRole('tab', { name: 'Giao dịch thanh toán' }))

  // Wait for payments to render
  expect(
    await screen.findByText('1 giao dịch trên trang này'),
  ).toBeInTheDocument()

  // Now resolve discrepancies
  discrepanciesResolve!(slowDiscrepancies)

  // Verify payments remain visible (not overwritten by discrepancies using same counter)
  await waitFor(() => {
    expect(screen.getByText('1 giao dịch trên trang này')).toBeInTheDocument()
  })
})
