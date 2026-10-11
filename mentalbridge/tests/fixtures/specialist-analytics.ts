import type { SpecialistOperationalAnalytics as Analytics } from '@/lib/consultation/consultation-validation'

// Synthetic aggregate-only facts. Never use production identities or health data.
export const generatedAt = '2026-10-06T01:00:00Z'
export const readyAnalytics: Analytics = {
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
    state: 'AVAILABLE',
    currency: 'VND',
    earnedAmountMinor: 420000,
    paidAmountMinor: 210000,
  },
}

export const emptyAnalytics: Analytics = {
  ...readyAnalytics,
  availability: {
    ...readyAnalytics.availability,
    state: 'EMPTY',
    publishedSlotCount: 0,
    utilizedSlotCount: 0,
    unusedSlotCount: 0,
    utilizationRate: null,
  },
  appointments: {
    ...readyAnalytics.appointments,
    state: 'EMPTY',
    requestedCount: 0,
    acceptedCount: 0,
    rejectedCount: 0,
    expiredCount: 0,
    cancelledCount: 0,
    rescheduledCount: 0,
    completedCount: 0,
    userNoShowCount: 0,
    specialistNoShowCount: 0,
    bothNoShowCount: 0,
  },
  rating: {
    ...readyAnalytics.rating,
    state: 'EMPTY',
    averageRating: null,
    ratingCount: 0,
  },
  financials: {
    ...readyAnalytics.financials,
    state: 'EMPTY',
    earnedAmountMinor: 0,
    paidAmountMinor: 0,
  },
}

export function blockedAnalytics(
  status: 'PROFILE_REQUIRED' | 'PENDING_APPROVAL' | 'PROFILE_REJECTED',
): Analytics {
  return {
    ...readyAnalytics,
    operationalStatus: status,
    availability: {
      ...readyAnalytics.availability,
      state: 'BLOCKED',
      publishedSlotCount: null,
      utilizedSlotCount: null,
      unusedSlotCount: null,
      utilizationRate: null,
    },
    appointments: {
      ...readyAnalytics.appointments,
      state: 'BLOCKED',
      requestedCount: null,
      acceptedCount: null,
      rejectedCount: null,
      expiredCount: null,
      cancelledCount: null,
      rescheduledCount: null,
      completedCount: null,
      userNoShowCount: null,
      specialistNoShowCount: null,
      bothNoShowCount: null,
    },
    rating: {
      ...readyAnalytics.rating,
      state: 'BLOCKED',
      averageRating: null,
      ratingCount: null,
    },
    financials: {
      ...readyAnalytics.financials,
      state: 'BLOCKED',
      currency: null,
      earnedAmountMinor: null,
      paidAmountMinor: null,
    },
  }
}
