import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { browserSubscription } from '@/features/subscription/api/browser-client'
import AdminPaymentsManager from './AdminPaymentsManager'

vi.mock('@/features/subscription/api/browser-client', () => ({
  browserSubscription: { adminPayments: vi.fn() },
}))
beforeEach(() => {
  vi.mocked(browserSubscription.adminPayments).mockReset()
})

it('shows only canonical server transactions and labels synthetic money', async () => {
  vi.mocked(browserSubscription.adminPayments).mockResolvedValue({
    generatedAt: '2026-10-11T00:00:00Z',
    count: 1,
    items: [
      {
        paymentId: '62200000-0000-4000-8000-000000000004',
        subscriptionId: '62200000-0000-4000-8000-000000000005',
        planVersionId: '62200000-0000-4000-8000-000000000002',
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
      },
    ],
  })
  render(<AdminPaymentsManager onNotice={vi.fn()} />)
  expect(await screen.findByText(/5\.000/)).toHaveTextContent(
    /Đã xác nhận thành công/,
  )
  expect(
    screen.getByText(/không phải doanh thu thương mại/),
  ).toBeInTheDocument()
  expect(
    screen.queryByText(/486,2|PayOS|VNPay|12.480|Chênh lệch bằng 0/),
  ).not.toBeInTheDocument()
})

it('shows no invented revenue when no payments exist', async () => {
  vi.mocked(browserSubscription.adminPayments).mockResolvedValue({
    generatedAt: '2026-10-11T00:00:00Z',
    count: 0,
    items: [],
  })
  render(<AdminPaymentsManager onNotice={vi.fn()} />)
  expect(
    await screen.findByText(/Chưa có giao dịch phù hợp/),
  ).toBeInTheDocument()
})

it('reports a dependency failure without substituting financial fixtures', async () => {
  vi.mocked(browserSubscription.adminPayments).mockRejectedValue(
    new Error('unavailable'),
  )
  render(<AdminPaymentsManager onNotice={vi.fn()} />)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    /Chưa thể tải giao dịch/,
  )
  expect(screen.getByRole('button', { name: 'Thử lại' })).toBeEnabled()
  expect(screen.queryByText('Plus · Mua gói')).not.toBeInTheDocument()
})
