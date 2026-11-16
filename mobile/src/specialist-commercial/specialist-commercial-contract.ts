import { z } from 'zod'

const instant = z.iso.datetime({ offset: true })
const state = z.enum(['AVAILABLE', 'EMPTY', 'BLOCKED', 'UNAVAILABLE', 'STALE'])
const metricBase = { source: z.literal('CONSULTATION'), asOf: instant, state }
const count = z.number().int().nonnegative().safe().nullable()

export const specialistAnalyticsSchema = z.strictObject({
  source: z.literal('CONSULTATION'),
  generatedAt: instant,
  operationalStatus: z.enum([
    'READY',
    'PROFILE_REQUIRED',
    'PENDING_APPROVAL',
    'PROFILE_REJECTED',
    'SUSPENDED',
  ]),
  period: z.strictObject({
    from: instant,
    to: instant,
    timezone: z.string().min(1).max(64),
  }),
  availability: z.strictObject({
    ...metricBase,
    publishedSlotCount: count,
    utilizedSlotCount: count,
    unusedSlotCount: count,
    utilizationRate: z.number().min(0).max(100).nullable(),
  }),
  appointments: z.strictObject({
    ...metricBase,
    requestedCount: count,
    acceptedCount: count,
    rejectedCount: count,
    expiredCount: count,
    cancelledCount: count,
    rescheduledCount: count,
    completedCount: count,
    userNoShowCount: count,
    specialistNoShowCount: count,
    bothNoShowCount: count,
  }),
  rating: z.strictObject({
    ...metricBase,
    averageRating: z.number().min(1).max(5).nullable(),
    ratingCount: count,
  }),
  financials: z.strictObject({
    ...metricBase,
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    earnedAmountMinor: count,
    paidAmountMinor: count,
  }),
})

const balanceSchema = z.strictObject({
  pendingSettlementVnd: z.number().int().nonnegative().safe(),
  availableVnd: z.number().int().nonnegative().safe(),
  retryPendingVnd: z.number().int().nonnegative().safe().optional(),
  processingVnd: z.number().int().nonnegative().safe(),
  paidVnd: z.number().int().nonnegative().safe(),
})

export const specialistEarningsSummarySchema = z
  .object({
    currency: z.literal('VND'),
    earningPolicyVersion: z.enum([
      'specialist-earning-v1',
      'staging-demo-paid-v1',
    ]),
    generatedAt: instant,
    balance: balanceSchema,
    earnings: z.array(z.unknown()).max(100),
    payouts: z.array(z.unknown()).max(100),
  })
  .passthrough()

export type SpecialistAnalytics = z.infer<typeof specialistAnalyticsSchema>
export type SpecialistEarningsSummary = z.infer<
  typeof specialistEarningsSummarySchema
>
