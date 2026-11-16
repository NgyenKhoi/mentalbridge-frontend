import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'

import type { SubscriptionApi } from './subscription-api'
import {
  SubscriptionCommercialPanel,
  subscriptionCommands,
} from './SubscriptionCommercialPanel'

const planVersionId = '10000000-0000-4000-8000-000000000001'
const payment = {
  paymentId: '20000000-0000-4000-8000-000000000002',
  subscriptionId: '30000000-0000-4000-8000-000000000003',
  planVersionId,
  planCode: 'PLUS' as const,
  planVersion: 'plus-v1',
  purpose: 'PURCHASE' as const,
  provider: 'PAYOS' as const,
  status: 'PENDING' as const,
  terminalReason: null,
  amountVnd: 5000,
  currency: 'VND' as const,
  expiresAt: '2026-11-16T02:00:00Z',
  createdAt: '2026-11-16T01:00:00Z',
  paidAt: null,
  failedAt: null,
}
const catalogue = {
  checkoutEnabled: true,
  paymentProvider: 'PAYOS' as const,
  generatedAt: payment.createdAt,
  plans: [
    {
      planVersionId: '40000000-0000-4000-8000-000000000004',
      planCode: 'FREE' as const,
      version: 'free-v1',
      displayName: 'Free',
      currency: 'VND' as const,
      priceVnd: 0,
      billingPeriodMonths: 1 as const,
      consultationCredits: 0 as const,
      maxActiveReservations: 0 as const,
      creditAllocationVnd: 0,
      aiQuotaCode: 'FREE',
      supportPlanEnabled: false,
      entitlements: [],
      allowedUpgrades: ['PLUS' as const, 'PREMIUM' as const],
      effectiveFrom: payment.createdAt,
    },
    {
      planVersionId,
      planCode: 'PLUS' as const,
      version: 'plus-v1',
      displayName: 'Plus',
      currency: 'VND' as const,
      priceVnd: 5000,
      billingPeriodMonths: 1 as const,
      consultationCredits: 4 as const,
      maxActiveReservations: 2 as const,
      creditAllocationVnd: 1000,
      aiQuotaCode: 'PLUS',
      supportPlanEnabled: true,
      entitlements: ['CONSULTATION'],
      allowedUpgrades: ['PREMIUM' as const],
      effectiveFrom: payment.createdAt,
    },
    {
      planVersionId: '50000000-0000-4000-8000-000000000005',
      planCode: 'PREMIUM' as const,
      version: 'premium-v1',
      displayName: 'Premium',
      currency: 'VND' as const,
      priceVnd: 10000,
      billingPeriodMonths: 1 as const,
      consultationCredits: 10 as const,
      maxActiveReservations: 4 as const,
      creditAllocationVnd: 1000,
      aiQuotaCode: 'PREMIUM',
      supportPlanEnabled: true,
      entitlements: ['CONSULTATION'],
      allowedUpgrades: [],
      effectiveFrom: payment.createdAt,
    },
  ],
}

function service(): SubscriptionApi {
  return {
    catalogue: jest.fn().mockResolvedValue(catalogue),
    payments: jest.fn().mockResolvedValue({
      items: [],
      count: 0,
      generatedAt: payment.createdAt,
    }),
    checkout: jest.fn().mockResolvedValue(payment),
    payment: jest.fn().mockResolvedValue({
      ...payment,
      status: 'FAILED',
      terminalReason: 'EXPIRED',
      failedAt: payment.createdAt,
    }),
  }
}
async function mount(api: SubscriptionApi) {
  return await render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <SubscriptionCommercialPanel
        api={api}
        currentPackageCode="FREE"
        subject="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      />
    </QueryClientProvider>,
  )
}

beforeEach(() => subscriptionCommands.clear())

it('keeps one command through ambiguous pending state and reconciles expiry', async () => {
  const api = service()
  await mount(api)
  await fireEvent.press(await screen.findByRole('radio', { name: /Plus/ }))
  await fireEvent.press(
    screen.getByRole('button', { name: 'Tạo yêu cầu thanh toán' }),
  )
  expect(
    await screen.findByText(/Yêu cầu trước chưa có kết quả cuối cùng/),
  ).toBeOnTheScreen()
  const original = jest.mocked(api.checkout).mock.calls[0]
  expect(original).toBeDefined()
  await fireEvent.press(
    screen.getByRole('button', { name: 'Kiểm tra yêu cầu đang chờ' }),
  )
  await waitFor(() =>
    expect(api.payment).toHaveBeenCalledWith(payment.paymentId),
  )
  expect(api.checkout).toHaveBeenCalledTimes(1)
  expect(original?.[1]).toContain('subscription-')
  expect(
    await screen.findByText('Yêu cầu thanh toán đã hết hạn'),
  ).toBeOnTheScreen()
})
