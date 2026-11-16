import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react-native'

import type { SpecialistCommercialApi } from './specialist-commercial-api'
import { SpecialistCommercialPanel } from './SpecialistCommercialPanel'

const now = '2026-11-16T01:00:00Z'
const metric = {
  source: 'CONSULTATION' as const,
  asOf: now,
  state: 'AVAILABLE' as const,
}
const api: SpecialistCommercialApi = {
  analytics: jest.fn().mockResolvedValue({
    source: 'CONSULTATION',
    generatedAt: now,
    operationalStatus: 'READY',
    period: {
      from: '2026-10-16T01:00:00Z',
      to: now,
      timezone: 'Asia/Ho_Chi_Minh',
    },
    availability: {
      ...metric,
      publishedSlotCount: 2,
      utilizedSlotCount: 1,
      unusedSlotCount: 1,
      utilizationRate: 50,
    },
    appointments: {
      ...metric,
      requestedCount: 2,
      acceptedCount: 1,
      rejectedCount: 0,
      expiredCount: 0,
      cancelledCount: 0,
      rescheduledCount: 0,
      completedCount: 1,
      userNoShowCount: 0,
      specialistNoShowCount: 0,
      bothNoShowCount: 0,
    },
    rating: { ...metric, averageRating: 4.5, ratingCount: 2 },
    financials: {
      ...metric,
      currency: 'VND',
      earnedAmountMinor: 70000,
      paidAmountMinor: 35000,
    },
  }),
  earnings: jest.fn().mockResolvedValue({
    currency: 'VND',
    earningPolicyVersion: 'specialist-earning-v1',
    generatedAt: now,
    balance: {
      pendingSettlementVnd: 35000,
      availableVnd: 35000,
      processingVnd: 0,
      paidVnd: 35000,
    },
    earnings: [],
    payouts: [],
  }),
}

it('renders only authoritative rating and financial balances without arithmetic', async () => {
  await render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <SpecialistCommercialPanel
        api={api}
        subject="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      />
    </QueryClientProvider>,
  )
  expect(await screen.findByText('4.50/5 · 2 đánh giá')).toBeOnTheScreen()
  expect(screen.getByText('Chờ quyết toán: 35.000 VND')).toBeOnTheScreen()
  expect(screen.getByText('Có thể rút: 35.000 VND')).toBeOnTheScreen()
  expect(screen.getByText('Đã thanh toán: 35.000 VND')).toBeOnTheScreen()
})
