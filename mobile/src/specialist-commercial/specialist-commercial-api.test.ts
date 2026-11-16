import { create } from 'axios'

import { createSpecialistCommercialApi } from './specialist-commercial-api'

describe('MB-712 specialist owner reads', () => {
  it('uses only owner analytics and earnings endpoints', async () => {
    const now = '2026-11-16T01:00:00Z'
    const metric = { source: 'CONSULTATION', asOf: now, state: 'AVAILABLE' }
    const analytics = {
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
    }
    const earnings = {
      currency: 'VND',
      earningPolicyVersion: 'specialist-earning-v1',
      settlementHoldDays: 7,
      minimumWithdrawalVnd: 100000,
      generatedAt: now,
      balance: {
        pendingSettlementVnd: 35000,
        availableVnd: 35000,
        processingVnd: 0,
        paidVnd: 35000,
      },
      earnings: [],
      payouts: [],
    }
    const client = create()
    const get = jest
      .spyOn(client, 'get')
      .mockResolvedValueOnce({ data: analytics })
      .mockResolvedValueOnce({ data: earnings })
    const api = createSpecialistCommercialApi(client)
    await api.analytics()
    await api.earnings()
    expect(get.mock.calls.map(([path]) => path)).toEqual([
      '/api/v1/specialist/analytics',
      '/api/v1/specialist/earnings',
    ])
  })
})
