import { z } from 'zod'

const dateTime = z.iso.datetime({ offset: true })
const state = z.enum(['AVAILABLE', 'EMPTY', 'BLOCKED', 'UNAVAILABLE', 'STALE'])
const count = z.number().int().nonnegative().nullable()

export const specialistAnalyticsSchema = z.object({
  generatedAt: dateTime,
  operationalStatus: z.enum([
    'READY',
    'PROFILE_REQUIRED',
    'PENDING_APPROVAL',
    'PROFILE_REJECTED',
    'SUSPENDED',
  ]),
  period: z.object({
    from: dateTime,
    to: dateTime,
    timezone: z.string().min(1),
  }),
  availability: z.object({
    state,
    publishedSlotCount: count,
    utilizedSlotCount: count,
    unusedSlotCount: count,
    utilizationRate: z.number().min(0).max(100).nullable(),
  }),
  appointments: z.object({
    state,
    requestedCount: count,
    acceptedCount: count,
    completedCount: count,
    rejectedCount: count,
    expiredCount: count,
    cancelledCount: count,
    userNoShowCount: count,
  }),
  rating: z.object({
    state,
    averageRating: z.number().min(1).max(5).nullable(),
    ratingCount: count,
  }),
  financials: z.object({
    state,
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    earnedAmountMinor: count,
    paidAmountMinor: count,
  }),
})
