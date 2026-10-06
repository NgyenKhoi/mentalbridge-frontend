import { describe, expect, it } from 'vitest'

import { parseSpecialistOperationalAnalytics } from './consultation-validation'

const generatedAt = '2026-10-06T01:00:00Z'

function analytics() {
  return {
    source: 'CONSULTATION',
    generatedAt,
    operationalStatus: 'READY',
    period: {
      from: '2026-09-06T01:00:00Z',
      to: generatedAt,
      timezone: 'Asia/Ho_Chi_Minh',
    },
    availability: {
      source: 'CONSULTATION',
      asOf: generatedAt,
      state: 'AVAILABLE',
      publishedSlotCount: 20,
      utilizedSlotCount: 15,
      unusedSlotCount: 5,
      utilizationRate: 75,
    },
    appointments: {
      source: 'CONSULTATION',
      asOf: generatedAt,
      state: 'AVAILABLE',
      requestedCount: 18,
      acceptedCount: 15,
      rejectedCount: 1,
      expiredCount: 2,
      cancelledCount: 1,
      rescheduledCount: 2,
      completedCount: 12,
      userNoShowCount: 1,
      specialistNoShowCount: 0,
      bothNoShowCount: 0,
    },
    rating: {
      source: 'CONSULTATION',
      asOf: generatedAt,
      state: 'AVAILABLE',
      averageRating: 4.5,
      ratingCount: 10,
    },
    financials: {
      source: 'CONSULTATION',
      asOf: generatedAt,
      state: 'UNAVAILABLE',
      currency: null,
      earnedAmountMinor: null,
      paidAmountMinor: null,
    },
  }
}

describe('specialist operational analytics validation', () => {
  it('accepts Consultation-owned factual metrics and explicit unavailable financials', () => {
    expect(parseSpecialistOperationalAnalytics(analytics())).toMatchObject({
      availability: { utilizationRate: 75 },
      appointments: { acceptedCount: 15, completedCount: 12 },
      financials: { state: 'UNAVAILABLE' },
    })
  })

  it('rejects unexpected health and client-level fields', () => {
    const value = analytics()
    Object.assign(value.appointments, {
      phq9Outcome: 4,
      clientSegments: ['improved'],
    })

    expect(parseSpecialistOperationalAnalytics(value)).toBeNull()
  })

  it('requires blocked values for an unapproved profile', () => {
    const value = analytics()
    value.operationalStatus = 'PENDING_APPROVAL'
    value.availability = {
      ...value.availability,
      state: 'BLOCKED',
      publishedSlotCount: null as never,
      utilizedSlotCount: null as never,
      unusedSlotCount: null as never,
      utilizationRate: null as never,
    }

    expect(parseSpecialistOperationalAnalytics(value)).toBeNull()
  })

  it('rejects inconsistent utilization totals', () => {
    const value = analytics()
    value.availability.unusedSlotCount = 6

    expect(parseSpecialistOperationalAnalytics(value)).toBeNull()
  })
})
